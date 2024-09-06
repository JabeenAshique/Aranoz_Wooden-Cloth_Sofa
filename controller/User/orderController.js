const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const User = require('../../models/userSchema');
const Offer = require('../../models/offerSchema');
const Coupon= require('../../models/couponSchema')
const PDFDocument = require('pdfkit');
const fs = require('fs'); 
const path = require('path');

const mongoose = require('mongoose');
const Razorpay = require('razorpay');

// Initialize Razorpay with your key_id and key_secret
const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const findUserAndAddress = async (userId, addressId) => {
    const user = await User.findById(userId).populate('cart.productId');
    if (!user) throw new Error('User not found.');

    const address = await Address.findById(addressId);
    if (!address) throw new Error('Address not found.');

    return { user, address };
};

const calculateDiscounts = async (user, couponCode, req) => {
    let productDiscount = 0;
    let couponDiscount = 0;
    let couponApplied = false;
    let appliedCouponCode = couponCode;

    const currentDate = new Date();

    for (const item of user.cart) {
        const applicableOffers = await Offer.find({
            $or: [
                { category: item.productId.category },
                { product: item.productId._id }
            ],
            startDate: { $lte: currentDate },
            endDate: { $gte: currentDate }
        });

        //const maxOffer = Math.max(...applicableOffers.map(offer => offer.offerAmount), 0);
          // Find the maximum offerAmount between category and product offer
    let maxOffer = 0;
    applicableOffers.forEach(offer => {
        if (offer.offerAmount > maxOffer) {
            maxOffer = offer.offerAmount;
        }
    });
        productDiscount += maxOffer * item.quantity;
        item.appliedOffer = maxOffer;
    }

    if (req.session.coupon) {
        couponDiscount = req.session.coupon.discount;
        couponApplied = true;
        appliedCouponCode = req.session.coupon.name;
    }

    if (appliedCouponCode && !couponApplied) {
        const coupon = await Coupon.findOne({ name: appliedCouponCode });
        if (coupon && currentDate <= coupon.expireOn) {
            const totalPrice = user.cart.reduce((acc, item) => acc + (item.quantity * item.productId.salePrice), 0);
            if (totalPrice >= coupon.minimumPrice) {
                couponDiscount = coupon.offerPrice;
                couponApplied = true;
            } else {
                throw new Error(`Minimum purchase amount should be ₹${coupon.minimumPrice}`);
            }
        } else if (coupon) {
            throw new Error('Coupon has expired.');
        } else {
            throw new Error('Coupon not found.');
        }
    }

    return { productDiscount, couponDiscount, couponApplied, appliedCouponCode };
};

const createOrder = async ({ orderedItems, totalPrice, discount, finalAmount, address, payment, userId, appliedCouponCode, couponDiscount, couponApplied, razorpayOrderId,paymentStatus,razorpayPaymentId }) => {
    const newOrder = new Order({
        orderedItems,
        totalPrice,
        discount,
        couponCode: appliedCouponCode || null,
        couponDiscount,
        finalAmount,
        address: address._id,
        payment,
        userId,
        status: 'Pending',
        paymentStatus,
        //status: paymentStatus === 'Failed' ? 'Payment Failed' : 'Pending', // Set status based on paymentStatus
        createdOn: new Date(),
        couponApplied,
        razorpayPaymentId,
        razorpayOrderId: razorpayOrderId 
    });

    await newOrder.save();

    for (const item of orderedItems) {
        await Product.findByIdAndUpdate(item.product, {
            $inc: { quantity: -item.quantity }
        });
    }

    return newOrder;
};

const orderPlaced = async (req, res) => {
    try {
        const { addressId, payment, couponCode,paymentStatus  } = req.body;
        const userId = req.user._id;

        if (!addressId || !payment) {
            return res.status(400).json({ success: false, message: 'Address and payment method are required.' });
        }
      //   if (payment === 'razorpay') {
      //     return res.redirect('/order/createRazorpayOrder');
      // }

        const { user, address } = await findUserAndAddress(userId, addressId);
        const { productDiscount, couponDiscount, couponApplied, appliedCouponCode } = await calculateDiscounts(user, couponCode, req);

        const totalPrice = user.cart.reduce((acc, item) => acc + (item.quantity * item.productId.salePrice), 0);
        const discount = productDiscount + couponDiscount;
        const finalAmount = totalPrice - discount;

        const orderedItems = user.cart.map(item => ({
            product: item.productId._id,
            quantity: item.quantity,
            price: item.productId.salePrice
        }));

       
        const newOrder = await createOrder({
            orderedItems,
            totalPrice,
            discount,
            finalAmount,
            address,
            payment,
            userId,
            appliedCouponCode,
            couponDiscount,
            couponApplied,
            paymentStatus: paymentStatus, 
        });

        if (payment === 'Wallet') {
            if (user.walletBalance < newOrder.finalAmount) {
                return res.status(400).json({ success: false, message: 'Insufficient wallet balance.' });
            }
            user.walletBalance -= finalAmount;
            await user.save();
            
        }

        user.cart = [];
        await user.save();

        res.json({ success: true, message: 'Order placed successfully.' });
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
    }
};

const createRazorpayOrder = async (req, res) => {
  try {
      console.log('Reached /createRazorpayOrder route');
      const { addressId, payment, couponCode } = req.body;
      const userId = req.user._id;

      if (!addressId || !payment) {
          return res.status(400).json({ success: false, message: 'Address and payment method are required.' });
      }

      const { user } = await findUserAndAddress(userId, addressId);
      const { productDiscount, couponDiscount } = await calculateDiscounts(user, couponCode, req);

      const totalPrice = user.cart.reduce((acc, item) => acc + (item.quantity * item.productId.salePrice), 0);
      const discount = productDiscount + couponDiscount;
      const finalAmount = totalPrice - discount

      const options = {
          amount: finalAmount * 100, // Amount in paise
          currency: "INR",
          //receipt: order_rcptid_${new Date().getTime()}
          receipt: `order_rcptid_${new Date().getTime()}`

      };

      const order = await razorpayInstance.orders.create(options);

      if (!order) {
          return res.status(500).json({ success: false, message: 'Razorpay order creation failed.' });
      }
      const updatedOrder = await Order.findOneAndUpdate(
        { userId: userId, payment: 'razorpay', paymentStatus: 'Pending' }, // This line might cause issues
        { $set: { razorpayOrderId: order.id } }, // Set the Razorpay order ID
        { new: true }
    );
    

      if (!updatedOrder) {
          return res.status(500).json({ success: false, message: 'Failed to update the order with Razorpay Order ID.' });
      }
      res.json({
          success: true,
          razorpayOrderId: order.id,
          amount: order.amount,
          currency: order.currency,
          key: process.env.RAZORPAY_KEY_ID,
          name: "Aranoz",
          discount // Send discount details back to the client
      });

  } catch (error) {
      console.error('Error creating Razorpay order:', error);
      res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
  }
  console.log('Reached /createRazorpayOrder route');
};

const finalizeOrderPlacement = async (req, res) => {
  try {
      const { razorpayOrderId, razorpayPaymentId,paymentStatus  } = req.body;
      const userId = req.user._id;

      const user = await User.findById(userId).populate('cart.productId');

      if (!user) {
          return res.status(404).json({ success: false, message: 'User not found.' });
      }

      const order = await Order.findOne({ razorpayOrderId, userId });
      // If the order exists, update it
      if (order) {
        // Update the order with payment details and payment status
          order.razorpayOrderId = razorpayOrderId;
          order.razorpayPaymentId = razorpayPaymentId || null;
          order.paymentStatus = paymentStatus;  // This line might cause issues
          order.status = paymentStatus === 'Success' ? 'Paid' : 'Payment Failed'; // Set status based on payment outcome

        // Save the updated order
      await order.save();

     // Clear the user's cart after successful payment
      if (paymentStatus === 'Success') {
      user.cart = [];
      await user.save();
     }

  res.json({ success: true, message: 'Order payment status updated successfully.', orderId: order._id });
} 

  else {
    const newOrder = await createOrder({
        orderedItems: user.cart.map(item => ({
            product: item.productId._id,
            quantity: item.quantity,
            price: item.productId.salePrice
        })),
        totalPrice: user.cart.reduce((acc, item) => acc + (item.quantity * item.productId.salePrice), 0),
        discount: 0, // Adjust this based on your needs
        finalAmount: user.cart.reduce((acc, item) => acc + (item.quantity * item.productId.salePrice), 0), // Include your discount logic
        address: user.addresses, // Ensure the address is linked correctly
        payment: 'razorpay',
        userId: userId,
        razorpayOrderId: razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId || null,
        paymentStatus: paymentStatus,
        status: paymentStatus === 'Success' ? 'Paid' : 'Payment Failed' // Update order status based on payment outcome
    });

    // Save the new order
    await newOrder.save();

    // Clear the user's cart after successful payment
    if (paymentStatus === 'Success') {
        user.cart = [];
        await user.save();
    }

    res.json({ success: true, message: 'Order finalized successfully.', orderId: newOrder._id });
}
} catch (error) {
console.error('Error finalizing order:', error);
res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
}
};


const loadOrderPage = async (req, res) => {
  try {
    const wishlistCount = req.session.wishlistCount || 0;
    const cartCount = req.session.cartCount || 0;
    const userId = req.user._id; // Ensure you're using a middleware to set req.user
    const orders = await Order.find({ userId })
    .sort({ createdOn: -1 }) // Sort orders by createdOn in descending order
    .populate('orderedItems.product', 'productName') // Populate the 'name' field of each product in orderedItems
    .lean();

    for (let order of orders) {
      order.products = await Product.find({ _id: { $in: order.orderedItems.map(item => item.product) } }, 'productName').lean();
    }

    res.render('order', { orders,cartCount,wishlistCount });
  } catch (error) {
    res.status(500).send(error.message);
  }
}
const loadOrder_detailsPage = async (req, res) => {
  try {
    const wishlistCount = req.session.wishlistCount || 0;
    const cartCount = req.session.cartCount || 0 ;
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId).populate('orderedItems.product').populate('address').lean();
    res.render('order-deatils', { order,wishlistCount,cartCount });
  } catch (error) {
    res.status(500).send(error.message);
  }
}

const OrderCancel = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    console.log(`Received cancellation request for order ID: ${orderId} by user: ${req.user._id}`);
    
    const order = await Order.findOne({ orderId: orderId,userId: req.user._id });
    if (!order) {
      console.log(`Order not found for orderId: ${orderId} and userId: ${req.user._id}`);
      return res.status(404).send({ success: false, message: 'Order not found' });
    }

    // Update the product quantities back to inventory
    for (const item of order.orderedItems) {
      console.log(`Restoring quantity ${item.quantity} for product ID: ${item.product}`);
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: item.quantity }
      });
    }
    // Refund to wallet
    const user = await User.findById(order.userId);
    
    // Get the last transaction to calculate the current wallet balance
    const latestTransaction = user.walletTransactions.length > 0
      ? user.walletTransactions[user.walletTransactions.length - 1].walletBalance
      : 0;

    const newWalletBalance = latestTransaction + order.finalAmount;

    // Create a new wallet transaction for the refund
    user.walletTransactions.push({
      type: 'refund',
      amount: order.finalAmount, // Amount being refunded
      walletBalance: newWalletBalance, // New wallet balance
      description: `Refund for cancelled order #${order.orderId}`
    });

    await user.save();

    order.status = 'Cancelled';
    await order.save();

    console.log('Order successfully cancelled');
    res.json({ success: true, message: 'Order cancelled and refunded to wallet successfully.' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).send('Server error');
  }

};

const OrderReturn = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    console.log(`Received return request for order ID: ${orderId} by user: ${req.user._id}`);
     // Check if req.user exists
     if (!req.user) {
      console.error('req.user is undefined');
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    const order = await Order.findOne({ orderId: orderId,userId: req.user._id });
    if (!order || order.status !== 'Delivered') {
      return res.status(400).json({ success: false, message: 'Order cannot be returned.' });
    }

    // Find the user by ID
    const user = await User.findById(req.user._id);
    if (!user) {
      console.error(`User not found for ID: ${req.user._id}`);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Calculate the new wallet balance
    const latestTransaction = user.walletTransactions.length > 0
      ? user.walletTransactions[user.walletTransactions.length - 1].walletBalance
      : 0;
    const newWalletBalance = latestTransaction + order.finalAmount;

    // Create a new wallet transaction for the refund
    user.walletTransactions.push({
      type: 'refund',
      amount: order.finalAmount, // Amount being refunded
      walletBalance: newWalletBalance, // New wallet balance
      description: `Refund for returned order #${order.orderId}`
    });

    await user.save();
    order.status = 'Returned';
    await order.save();
    
    res.json({ success: true, message: 'Order returned and refunded to wallet successfully.' });
  } catch (error) {
    console.error('Error returning order:', error);
    res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
  }
};
const downloadInvoice = async (req, res) => {
 
  try {
    const orderId = req.params.orderId;

    // Fetch the order data from the database
    const order = await Order.findOne({ orderId: orderId })
        .populate('userId')
        .populate('orderedItems.product')
        .populate('address')
        .lean();

    if (!order) {
        return res.status(404).send('Order not found');
    }

    // Initialize the PDF document
    const doc = new PDFDocument({ size: 'A4', margin: 30 });

    // Set the headers for PDF file download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice_${orderId}.pdf`);

    // Stream the PDF document to the response
    doc.pipe(res);

     // Add Invoice Title
     doc.fontSize(18).text('Invoice', { align: 'center' });
     doc.moveDown(1.5);

     // Add Order ID, Date, and Customer Info
     doc.fontSize(12).text(`Order ID: ${order.orderId}`);
     doc.text(`Date: ${new Date(order.createdOn).toLocaleDateString()}`);
     doc.moveDown(1);

     // Customer Details
     doc.text(`Customer: ${order.userId.name}`);
     doc.text(`Email: ${order.userId.email}`);
     doc.moveDown(1);

     // Shipping Address
     doc.text('Shipping Address:', { underline: true });
     doc.text(`${order.address.name}`);
     doc.text(`${order.address.city}, ${order.address.state}`);
     doc.text(`${order.address.addressType}`);
     doc.text(`${order.address.landMark}`);
     doc.moveDown(1);

     // Table Headers for Ordered Items
     const columnPositions = {
         product: 40,
         quantity: 120,  // Position for quantity
         price: 220,     // Position for price
         total: 320      // Position for total
     };

     // Headers for the table
     doc.fontSize(10).fillColor('#444444');
     doc.text('Product', columnPositions.product, undefined, { continued: true });
     doc.text('Quantity', columnPositions.quantity, undefined, { continued: true });
     doc.text('Price', columnPositions.price, undefined, { continued: true });
     doc.text('Total', columnPositions.total);
     doc.moveDown(0.5);
     doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(columnPositions.product, doc.y).lineTo(columnPositions.total + 30, doc.y).stroke();
     doc.moveDown(1);

     // List Ordered Items
     order.orderedItems.forEach(item => {
         doc.text(item.product.productName, columnPositions.product, undefined, { continued: true });
         doc.text(item.quantity, columnPositions.quantity, undefined, { continued: true });
         doc.text(`₹${item.price}`, columnPositions.price, undefined, { continued: true });
         doc.text(`₹${item.price * item.quantity}`, columnPositions.total);
         doc.moveDown(1);
     });

     // Add Total Price, Discounts, and Final Amount
     const summaryPosition = columnPositions.total - 30; // Align to the total column

     doc.moveDown(2);
     doc.fontSize(12).fillColor('#000000');
     doc.text(`Discount: ₹${order.discount + order.couponDiscount}`, summaryPosition, undefined, { align: 'right' });
     doc.text(`Total Price: ₹${order.totalPrice}`, summaryPosition, undefined, { align: 'right' });
     doc.text(`Final Amount: ₹${order.finalAmount}`, summaryPosition, undefined, { align: 'right' });

     // End the PDF and close the stream
     doc.end();
 } catch (error) {
     console.error('Error generating invoice PDF:', error);
     res.status(500).json({ success: false, message: 'Error generating invoice PDF' });
 }
};


const retryPayment = async (req, res) => {
  try {
      const { razorpayOrderId } = req.body;
      const userId = req.user._id;

      // Find the existing order by razorpayOrderId and userId
      const order = await Order.findOne({ razorpayOrderId, userId });
      if (!order) {
          return res.status(404).json({ success: false, message: 'Order not found.' });
      }

      // Re-initialize Razorpay payment
      const options = {
          amount: order.finalAmount * 100,  // Amount in paise
          currency: "INR",
          receipt: order.razorpayOrderId,   // Use the existing Razorpay order ID
      };

      const newRazorpayOrder = await razorpayInstance.orders.create(options);
      if (!newRazorpayOrder) {
          return res.status(500).json({ success: false, message: 'Failed to create Razorpay order.' });
      }

      // Send back the necessary details to initialize Razorpay payment on the frontend
      res.json({
          success: true,
          razorpayOrderId: newRazorpayOrder.id,
          amount: newRazorpayOrder.amount,
          currency: newRazorpayOrder.currency,
          key: process.env.RAZORPAY_KEY_ID,
          name: "Aranoz",
          orderId: order._id
      });

  } catch (error) {
      console.error('Error retrying payment:', error);
      res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
  }
};

  module.exports = {

    orderPlaced,
    createRazorpayOrder,
    finalizeOrderPlacement,
    loadOrderPage,
    loadOrder_detailsPage,
    OrderCancel,
    OrderReturn,
    downloadInvoice,
    retryPayment
    
  }