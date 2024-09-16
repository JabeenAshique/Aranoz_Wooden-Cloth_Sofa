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
      const { addressId, payment, couponCode, paymentStatus, razorpayOrderId, razorpayPaymentId } = req.body;
      const userId = req.user._id;

      if (!addressId || !payment) {
          return res.status(400).json({ success: false, message: 'Address and payment method are required.' });
      }

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
          payment, // COD or Wallet
          userId,
          appliedCouponCode,
          couponDiscount,
          couponApplied,
          paymentStatus: payment === 'COD' ? 'Pending' : paymentStatus,  // COD is always pending, Wallet is successful
          razorpayOrderId: payment === 'Wallet' ? null : razorpayOrderId, // Only for Razorpay
          razorpayPaymentId: payment === 'Wallet' ? null : razorpayPaymentId // Only for Razorpay
      });

      // Handle Wallet Payment
      if (payment === 'Wallet') {
          const latestTransaction = user.walletTransactions.length > 0
              ? user.walletTransactions[user.walletTransactions.length - 1].walletBalance
              : 0;

          // Check if the wallet balance is sufficient
          if (latestTransaction < newOrder.finalAmount) {
              return res.status(400).json({ success: false, message: 'Insufficient wallet balance.' });
          }

          const newWalletBalance = latestTransaction - newOrder.finalAmount;

          // Add the wallet debit transaction
          user.walletTransactions.push({
              type: 'debit',
              amount: newOrder.finalAmount,
              walletBalance: newWalletBalance,
              description: `Payment for order #${newOrder._id}`  // Use newOrder._id here
          });

          await user.save(); // Save the user with updated wallet balance
      }

      // Clear the user's cart after successful order placement
      user.cart = [];
      req.session.cartCount = 0; // Reset cart count in the session
      await user.save();

      // Return the orderId to the frontend
      // res.json({ success: true, message: 'Order placed successfully.', orderId: newOrder._id, cartCount: 0 });
      res.json({
        success: true,
        message: 'Order placed successfully.',
        orderId: newOrder._id,
        paymentStatus: payment === 'COD' ? 'Pending' : paymentStatus,
        cartCount: 0
    });
    
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
          amount: finalAmount * 100, 
          currency: "INR",
          receipt: `order_rcptid_${new Date().getTime()}`
      };

      const order = await razorpayInstance.orders.create(options);

      if (!order) {
          return res.status(500).json({ success: false, message: 'Razorpay order creation failed.' });
      }
      res.json({
          success: true,
          razorpayOrderId: order.id,
          amount: order.amount,
          currency: order.currency,
          key: process.env.RAZORPAY_KEY_ID,
          name: "Aranoz",
          discount 
      });

  } catch (error) {
      console.error('Error creating Razorpay order:', error);
      res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
  }
  console.log('Reached /createRazorpayOrder route');
};

const finalizeOrderPlacement = async (req, res) => {
  console.log('Reached /FinilizeRazorpayOrder route');
  try {
      const { razorpayOrderId, razorpayPaymentId,paymentStatus  } = req.body;
      const userId = req.user._id;
      const cartCount = req.session.cartCount || 0;
      console.log('razorpayOrderId:', razorpayOrderId);
      console.log('razorpayPaymentId:', razorpayPaymentId);
      console.log('paymentStatus:', paymentStatus);


      const user = await User.findById(userId).populate('cart.productId');

      if (!user) {
          return res.status(404).json({ success: false, message: 'User not found.' });
      }

            // Find the existing order
            const order = await Order.findOne({ razorpayOrderId, userId });
 
    const newOrder = await createOrder({
        orderedItems: user.cart.map(item => ({
            product: item.productId._id,
            quantity: item.quantity,
            price: item.productId.salePrice
        })),
        totalPrice: user.cart.reduce((acc, item) => acc + (item.quantity * item.productId.salePrice), 0),
        discount: 0, 
        finalAmount: user.cart.reduce((acc, item) => acc + (item.quantity * item.productId.salePrice), 0), 
        address: user.addresses, 
        payment: 'razorpay',
        userId: userId,
        razorpayOrderId: razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId || null,
        paymentStatus: paymentStatus,
        status: 'Pending',
    });


    await newOrder.save();

    
    if (paymentStatus === 'Success') {
        user.cart = [];
         req.session.cartCount = 0;  // Reset cart count in the session
        cartCount = 0;  // Update the local variable to return in the response
        await user.save();
    }

    res.json({ success: true, message: 'Order finalized successfully.', orderId: newOrder._id,cartCount });
}
 catch (error) {
console.error('Error finalizing order:', error);
res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
}
};

// const loadOrderPage = async (req, res) => {
//   try {
//     const wishlistCount = req.session.wishlistCount || 0;
//     const cartCount = req.session.cartCount || 0;
//     const userId = req.user._id; 

//     // Fetch order and populate product details, including image
//     const orders = await Order.find({ userId })
//       .populate({
//         path: 'orderedItems.product',
//         select: 'productName productImage price', // Ensure 'productImage' and 'productName' are selected
//       })
//       .populate('address')
//       .sort({ createdOn: -1 })
//       .lean();

//     // Log the orders to verify the images are fetched
//     console.log(orders);

//     res.render('order', { orders, cartCount, wishlistCount });
//   } catch (error) {
//     console.error('Error loading order page:', error);
//     res.status(500).send(error.message);
//   }
// };


const loadOrderPage = async (req, res) => {
  try {
    const wishlistCount = req.session.wishlistCount || 0;
    const cartCount = req.session.cartCount || 0;
    const userId = req.user._id;
    
    // Retrieve the search query from the URL
    const searchQuery = req.query.search ? req.query.search.trim() : '';
    
    // Base filter to search for orders by this user
    let orderFilter = { userId }; 
    
    // Log to debug the search query
    console.log('Search Query:', searchQuery);

    // Log to debug the final query that will be used in MongoDB
    console.log('Final Query:', orderFilter);

    // Fetch orders based on the status or default search query
    let orders = await Order.find(orderFilter)
      .populate({
        path: 'orderedItems.product',
        select: 'productName productImage price', 
      })
      .populate('address')
      .sort({ createdOn: -1 })
      .lean();

    // Log fetched orders to see what's coming from the database
    console.log('Fetched Orders:', orders);

    // Additional filter for product name search
    if (searchQuery) {
      orders = orders.filter(order => 
        order.orderedItems.some(item => 
          item.product && item.product.productName && item.product.productName.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    // If no orders are found, log that for debugging
    if (!orders || orders.length === 0) {
      console.log('No matching orders found for the search query.');
    }

    res.render('order', { orders: orders, cartCount, wishlistCount });
  } catch (error) {
    console.error('Error in loadOrderPage:', error);
    res.status(500).send(error.message);
  }
};


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
    const { orderId } = req.params;
    const { productIds } = req.body; // Array of product IDs to cancel

    if (!productIds || productIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No products selected for cancellation.' });
    }

    // Find the order by ID
    const order = await Order.findOne({ _id: orderId, userId: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    let allItemsCancelled = true; // Flag to track if all items are cancelled
    let totalRefundAmount = 0;
    const updatedOrderedItems = [];

    // Loop through each ordered item and check if it's in the cancellation request
    for (const item of order.orderedItems) {
      if (productIds.includes(item.product.toString())) { // If product is selected for cancellation
        console.log(`Cancelling product ${item.product} with quantity ${item.quantity}`);
        
        // Refund the item price * quantity
        const refundAmount = item.price * item.quantity;
        totalRefundAmount += refundAmount;

        // Restore product quantity back to inventory
        await Product.findByIdAndUpdate(item.product, { $inc: { quantity: item.quantity } });

        // Mark item as cancelled
        item.status = 'Cancelled';
      }

      // Check if any item is not cancelled
      if (item.status !== 'Cancelled') {
        allItemsCancelled = false;
      }

      updatedOrderedItems.push(item);
    }

    // Update the order with remaining products
    order.orderedItems = updatedOrderedItems;

    // If all items are cancelled, mark the order status as "Cancelled"
    if (allItemsCancelled) {
      order.status = 'Cancelled';
    } else {
      // Otherwise, mark the order as "Partially Cancelled"
      order.status = 'Partially Cancelled';
    }

    // Refund to the user's wallet
    const user = await User.findById(order.userId);
    
    // Get the latest wallet transaction balance
    const latestTransaction = user.walletTransactions.length > 0
      ? user.walletTransactions[user.walletTransactions.length - 1].walletBalance
      : 0;

    const newWalletBalance = latestTransaction + totalRefundAmount;

    // Create a new wallet transaction for the refund
    user.walletTransactions.push({
      type: 'refund',
      amount: totalRefundAmount, // Amount being refunded
      walletBalance: newWalletBalance, // New wallet balance
      description: `Refund for partially cancelled order #${order.orderId}`
    });

    await user.save(); // Save the user after updating the wallet
    await order.save(); // Save the updated order status

    console.log('Order cancellation processed successfully.');
    res.json({ success: true, message: 'Order updated and refunded to wallet successfully.' });

  } catch (error) {
    console.error('Error cancelling product(s):', error);
    res.status(500).send('Server error');
  }
};



const OrderReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { productIds } = req.body; // Array of product IDs to return

    if (!productIds || productIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No products selected for return.' });
    }

    const order = await Order.findOne({ _id: orderId, userId: req.user._id });
    if (!order || order.status !== 'Delivered') {
      return res.status(400).json({ success: false, message: 'Order cannot be returned.' });
    }

    let totalRefundAmount = 0;

    // Loop through each ordered item and mark it as returned if selected
    order.orderedItems.forEach(item => {
      if (productIds.includes(item.product.toString())) {
        console.log(`Returning product ${item.product} with quantity ${item.quantity}`);
        
        // Refund the item price * quantity
        const refundAmount = item.price * item.quantity;
        totalRefundAmount += refundAmount;

        // Mark the item as returned
        item.status = 'Returned';

        // Restore product quantity back to inventory
        Product.findByIdAndUpdate(item.product, { $inc: { quantity: item.quantity } }).exec();
      }
    });

    // Update the overall order status based on whether some items remain unreturned
    const isAllReturned = order.orderedItems.every(item => item.status === 'Returned');
    order.status = isAllReturned ? 'Returned' : 'Partially Returned';

    // Refund to the user's wallet
    const user = await User.findById(order.userId);
    const latestTransaction = user.walletTransactions.length > 0
      ? user.walletTransactions[user.walletTransactions.length - 1].walletBalance
      : 0;

    const newWalletBalance = latestTransaction + totalRefundAmount;

    // Create a new wallet transaction for the refund
    user.walletTransactions.push({
      type: 'refund',
      amount: totalRefundAmount,
      walletBalance: newWalletBalance,
      description: `Refund for returned products in order #${order.orderId}`
    });

    await user.save(); // Save the user after updating the wallet
    await order.save(); // Save the updated order status

    console.log('Order partially returned and refunded to wallet');
    res.json({ success: true, message: 'Selected items have been returned and refunded to the wallet.' });

  } catch (error) {
    console.error('Error returning product(s):', error);
    res.status(500).send('Server error');
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    // Fetch the order data from the database
    const order = await Order.findById(orderId)
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

    // Add Invoice Title and Header
    doc.fontSize(18).text('Invoice', { align: 'right' });
    doc.moveDown(1);

    // Add company details (left top)
    doc.fontSize(10)
      .text('Aranoz.', 40, 50)
      .text('Kalarikkal veliyil', 40, 65)
      .text('Alappuzha, 688561', 40, 80)
      .text('Phone: 8921663696', 40, 95);
    
    // Add Bill To (recipient details)
    doc.text('Bill To:', 40, 130)
      .text(`Name: ${order.address.name}`, 40, 145)
      .text(`Address: ${order.address.city}, ${order.address.state}, ${order.address.zipcode}`, 40, 160)
      .text(`Phone: ${order.address.phone}`, 40, 175);

    // Add Invoice Details (right top)
    doc.text(`Invoice no: ${order._id}`, 400, 130, { align: 'right' })
      .text(`Date: ${new Date(order.createdOn).toLocaleDateString()}`, 400, 155, { align: 'right' })
      

    // Add a horizontal line separator
    doc.moveTo(40, 200).lineTo(570, 200).stroke();

    // Add Table Header for Product Items
    doc.fontSize(10).text('Description', 40, 220)
      .text('Quantity', 220, 220)
      .text('Unit Price', 320, 220)
      .text('Amount', 420, 220);

    // Draw another horizontal line under the table header
    doc.moveTo(40, 235).lineTo(570, 235).stroke();

    // List Ordered Items
    let y = 250;
    order.orderedItems.forEach(item => {
      doc.text(item.product.productName, 40, y)
        .text(item.quantity, 220, y)
        .text(`₹${item.price}`, 320, y)
        .text(`₹${item.price * item.quantity}`, 420, y);
      y += 20;
    });

    // Total, Paid, and Balance
    doc.moveTo(40, y + 10).lineTo(570, y + 10).stroke(); // Separator line
    doc.text('Total amount', 320, y + 30).text(`₹${order.totalPrice}`, 420, y + 30);
    

    // End the PDF document
    doc.end();
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    res.status(500).json({ success: false, message: 'Error generating invoice PDF' });
  }
};

const retryPayment = async (req, res) => {
  try {
      const { orderId } = req.params;
      const userId = req.user._id;

      // Find the order using the Razorpay order ID
      const order = await Order.findOne({ _id: orderId, userId });

      if (!order || order.paymentStatus !== 'Failed') {
          return res.status(404).json({ success: false, message: 'Order not found or payment not failed.' });
      }

      // Return the existing Razorpay order details for retrying payment
      res.json({
          success: true,
          razorpayOrderId: order.razorpayOrderId,  
          amount: order.finalAmount * 100,  // Razorpay requires the amount in paise (multiply by 100)
          currency: "INR",
          key: process.env.RAZORPAY_KEY_ID,  // Razorpay Key ID
          name: "YourAppName"  // Optional: Name of the app
      });
  } catch (error) {
      console.error('Error retrying payment:', error);
      res.status(500).json({ success: false, message: 'An error occurred while retrying payment.' });
  }
};
const retryplaceOrder = async (req, res) => {
  try {
    console.log('Received retry place order request:', req.body);
    const { payment, paymentStatus, razorpayOrderId, razorpayPaymentId } = req.body;
      const userId = req.user._id;

    
      // Find the existing order using razorpayOrderId and userId
      const order = await Order.findOne({ razorpayOrderId, userId });

      if (order) {
          // Update the existing order with new payment details
          order.razorpayPaymentId = razorpayPaymentId;
          order.paymentStatus = paymentStatus;
          await order.save();

          if (paymentStatus === 'Success') {
              // Clear the user's cart if payment is successful
              const user = await User.findById(userId);
              user.cart = [];
              await user.save();
          }

          return res.json({ success: true, message: 'Order payment status updated successfully.' });
      } else {
          return res.status(404).json({ success: false, message: 'Order not found or payment not failed.' });
      }
  } catch (error) {
      console.error('Error retrying order placement:', error);
      return res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
  }
};

const finalizereOrderPlacement = async (req, res) => {
  try {
      const { orderId } = req.params;
      const { paymentStatus, razorpayOrderId, razorpayPaymentId } = req.body;
      const userId = req.user._id;

      console.log('Finalizing order for orderId:', orderId);

      
      const order = await Order.findOne({ _id: orderId, razorpayOrderId, userId });

      if (!order) {
          return res.status(404).json({ success: false, message: 'Order not found' });
      }

      // Update the order's payment details
      order.paymentStatus = paymentStatus;
      order.razorpayPaymentId = razorpayPaymentId;
      

      await order.save();

      // If payment succeeded, clear the user's cart
      if (paymentStatus === 'Success') {
          const user = await User.findById(userId);
          user.cart = [];
          await user.save();
      }

      res.json({ success: true, message: 'Order payment finalized successfully.', orderId: order._id });
  } catch (error) {
      console.error('Error finalizing order:', error);
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
    retryPayment,
    retryplaceOrder,
    finalizereOrderPlacement
    
  }