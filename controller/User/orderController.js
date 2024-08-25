const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const User = require('../../models/userSchema');
const Offer = require('../../models/offerSchema');
const Coupon= require('../../models/couponSchema')

const mongoose = require('mongoose');
const Razorpay = require('razorpay');

const orderPlaced = async (req, res) => {
    try {
        const { addressId, payment,couponCode } = req.body;
        const userId = req.user._id;

        if (!addressId || !payment) {
            return res.status(400).json({ success: false, message: 'Address and payment method are required.' });
        }

        const user = await User.findById(userId).populate('cart.productId');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const address = await Address.findById(addressId);
        if (!address) {
            return res.status(404).json({ success: false, message: 'Address not found.' });
        }

        let productDiscount = 0;
        let couponDiscount = 0;
        let couponApplied = false;
        let appliedCouponCode  = null;

        if (payment === 'razorpay') {
          // Redirect to Razorpay order creation
          return res.redirect('/createRazorpayOrder');
      }
         // Retrieve coupon from session
         if (req.session.coupon) {
          couponDiscount = req.session.coupon.discount;
          couponApplied = true;
          appliedCouponCode  = req.session.coupon.name;
      }

        const orderedItems = user.cart.map(item => ({
          product: item.productId._id,
          quantity: item.quantity,
          price: item.productId.salePrice
      }));

        // Calculate product discount based on offers applicable to products in the cart
        for (const item of user.cart) {
            const currentDate = new Date();
            const applicableOffers = await Offer.find({
                $or: [
                    { category: item.productId.category },
                    { product: item.productId._id }
                ],
                startDate: { $lte: currentDate },
                endDate: { $gte: currentDate }
            });

            let maxCategoryOffer = 0;
            let maxProductOffer = 0;

            applicableOffers.forEach(offer => {
                if (offer.category && offer.category.toString() === item.productId.category.toString()) {
                    if (offer.offerAmount > maxCategoryOffer) {
                        maxCategoryOffer = offer.offerAmount;
                    }
                } else if (offer.product && offer.product.toString() === item.productId._id.toString()) {
                    if (offer.offerAmount > maxProductOffer) {
                        maxProductOffer = offer.offerAmount;
                    }
                }
            });

            const bestOfferForItem = Math.max(maxCategoryOffer, maxProductOffer);
            productDiscount += bestOfferForItem * item.quantity;

            // Store the applied offers
            if (bestOfferForItem > 0) {
                item.appliedOffer = bestOfferForItem; // Add an `appliedOffer` field to each item
            }
        }

        // Handle coupon discount if coupon code is provided
        if (couponCode) {
            const coupon = await Coupon.findOne({ name: couponCode });

            if (coupon) {
                const currentDate = new Date();
                if (currentDate <= coupon.expireOn) {
                    if (totalPrice >= coupon.minimumPrice) {
                        couponDiscount = coupon.offerPrice;
                        couponApplied = true;
                    } else {
                        return res.status(400).json({ success: false, message: `Minimum purchase amount should be ₹${coupon.minimumPrice}` });
                    }
                } else {
                    return res.status(400).json({ success: false, message: 'Coupon has expired.' });
                }
            } else {
                return res.status(404).json({ success: false, message: 'Coupon not found.' });
            }
        }

        const totalPrice = user.cart.reduce((acc, item) => acc + (item.quantity * item.productId.salePrice), 0);
        const discount = productDiscount + couponDiscount;
        const finalAmount = totalPrice - discount + 50; // Including flat rate shipping

        const newOrder = new Order({
            orderedItems: orderedItems,
            totalPrice: totalPrice,
            discount: discount,
            couponCode: appliedCouponCode  || null,
            couponDiscount: couponDiscount,
            finalAmount: finalAmount,
            address: address._id,
            payment: payment,
            userId: userId,
            status: 'Pending',
            createdOn: new Date(),
            couponApplied: couponApplied
        });

        await newOrder.save();

        // Update product quantities
        for (const item of orderedItems) {
            await Product.findByIdAndUpdate(item.product, {
                $inc: { quantity: -item.quantity }
            });
        }

        if (payment === 'wallet') {
            if (user.walletBalance < newOrder.finalAmount) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient wallet balance.'
                });
            }
            user.walletBalance -= finalAmount;
            await user.save();
        }

        // Clear the user's cart
        user.cart = [];
        await user.save();

        res.json({ success: true, message: 'Order placed successfully.' });
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
    }
};

// Initialize Razorpay with your key_id and key_secret
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// const createRazorpayOrder = async (req, res) => {
//   try {
//       const { addressId, payment, couponCode } = req.body;
//       const userId = req.user._id;

//       if (!addressId || !payment) {
//           return res.status(400).json({ success: false, message: 'Address and payment method are required.' });
//       }

//       const user = await User.findById(userId).populate('cart.productId');
//       if (!user) {
//           return res.status(404).json({ success: false, message: 'User not found.' });
//       }

//       const address = await Address.findById(addressId);
//       if (!address) {
//           return res.status(404).json({ success: false, message: 'Address not found.' });
//       }

//       let productDiscount = 0;
//       let couponDiscount = 0;
//       let couponApplied = false;
//       let appliedCouponCode  = null;


//        // Retrieve coupon from session
//        if (req.session.coupon) {
//         couponDiscount = req.session.coupon.discount;
//         couponApplied = true;
//         appliedCouponCode  = req.session.coupon.name;
//     }

//       const orderedItems = user.cart.map(item => ({
//         product: item.productId._id,
//         quantity: item.quantity,
//         price: item.productId.salePrice
//     }));

//       // Calculate product discount based on offers applicable to products in the cart
//       for (const item of user.cart) {
//           const currentDate = new Date();
//           const applicableOffers = await Offer.find({
//               $or: [
//                   { category: item.productId.category },
//                   { product: item.productId._id }
//               ],
//               startDate: { $lte: currentDate },
//               endDate: { $gte: currentDate }
//           });

//           let maxCategoryOffer = 0;
//           let maxProductOffer = 0;

//           applicableOffers.forEach(offer => {
//               if (offer.category && offer.category.toString() === item.productId.category.toString()) {
//                   if (offer.offerAmount > maxCategoryOffer) {
//                       maxCategoryOffer = offer.offerAmount;
//                   }
//               } else if (offer.product && offer.product.toString() === item.productId._id.toString()) {
//                   if (offer.offerAmount > maxProductOffer) {
//                       maxProductOffer = offer.offerAmount;
//                   }
//               }
//           });

//           const bestOfferForItem = Math.max(maxCategoryOffer, maxProductOffer);
//           productDiscount += bestOfferForItem * item.quantity;

//           // Store the applied offers
//           if (bestOfferForItem > 0) {
//               item.appliedOffer = bestOfferForItem; // Add an `appliedOffer` field to each item
//           }
//       }

//       // Handle coupon discount if coupon code is provided
//       if (couponCode) {
//           const coupon = await Coupon.findOne({ name: couponCode });

//           if (coupon) {
//               const currentDate = new Date();
//               if (currentDate <= coupon.expireOn) {
//                   if (totalPrice >= coupon.minimumPrice) {
//                       couponDiscount = coupon.offerPrice;
//                       couponApplied = true;
//                   } else {
//                       return res.status(400).json({ success: false, message: `Minimum purchase amount should be ₹${coupon.minimumPrice}` });
//                   }
//               } else {
//                   return res.status(400).json({ success: false, message: 'Coupon has expired.' });
//               }
//           } else {
//               return res.status(404).json({ success: false, message: 'Coupon not found.' });
//           }
//       }

//       const totalPrice = user.cart.reduce((acc, item) => acc + (item.quantity * item.productId.salePrice), 0);
//       const discount = productDiscount + couponDiscount;
//       const finalAmount = totalPrice - discount + 50; // Including flat rate shipping

//       const newOrder = new Order({
//           orderedItems: orderedItems,
//           totalPrice: totalPrice,
//           discount: discount,
//           couponCode: appliedCouponCode  || null,
//           couponDiscount: couponDiscount,
//           finalAmount: finalAmount,
//           address: address._id,
//           payment: payment,
//           userId: userId,
//           status: 'Pending',
//           createdOn: new Date(),
//           couponApplied: couponApplied
//       });

//       await newOrder.save();

//       // Update product quantities
//       for (const item of newOrder.orderedItems) {
//           await Product.findByIdAndUpdate(item.product, {
//               $inc: { quantity: -item.quantity }
//           });
//       }

//       if (payment === 'wallet') {
//           if (user.walletBalance < newOrder.finalAmount) {
//               return res.status(400).json({
//                   success: false,
//                   message: 'Insufficient wallet balance.'
//               });
//           }
//           user.walletBalance -= finalAmount;
//           await user.save();
//       }

//       // Clear the user's cart
//       user.cart = [];
//       await user.save();

//       // Create Razorpay order
//       const options = {
//           amount: finalAmount * 100, // Amount in paise
//           currency: "INR",
//           receipt: `order_rcptid_${new Date().getTime()}`
//       };

//       const order = await razorpayInstance.orders.create(options);

//       if (!order) {
//           return res.status(500).json({ success: false, message: 'Razorpay order creation failed.' });
//       }

//       // Update the order with Razorpay order ID
//       newOrder.razorpayOrderId = order.id;
//       await newOrder.save();

//       res.json({
//           success: true,
//           razorpayOrderId: order.id,
//           amount: order.amount,
//           currency: order.currency,
//           key: process.env.RAZORPAY_KEY_ID,
//           name: "Aranoz"
//       });

//   } catch (error) {
//       console.error('Error creating Razorpay order:', error);
//       res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
//   }
// };

const createRazorpayOrder = async (req, res) => {
  try {
      const { addressId, payment, couponCode } = req.body;
      const userId = req.user._id;

      if (!addressId || !payment) {
          return res.status(400).json({ success: false, message: 'Address and payment method are required.' });
      }

      const user = await User.findById(userId).populate('cart.productId');
      if (!user) {
          return res.status(404).json({ success: false, message: 'User not found.' });
      }

      const address = await Address.findById(addressId);
      if (!address) {
          return res.status(404).json({ success: false, message: 'Address not found.' });
      }

      let productDiscount = 0;
      let couponDiscount = 0;
      let couponApplied = false;
      let appliedCouponCode = couponCode;

      // Retrieve coupon from session
      if (req.session.coupon) {
          couponDiscount = req.session.coupon.discount;
          couponApplied = true;
          appliedCouponCode = req.session.coupon.name;
      }

      const orderedItems = user.cart.map(item => ({
          product: item.productId._id,
          quantity: item.quantity,
          price: item.productId.salePrice
      }));

      // Calculate product discount based on offers applicable to products in the cart
      for (const item of user.cart) {
          const currentDate = new Date();
          const applicableOffers = await Offer.find({
              $or: [
                  { category: item.productId.category },
                  { product: item.productId._id }
              ],
              startDate: { $lte: currentDate },
              endDate: { $gte: currentDate }
          });

          let maxCategoryOffer = 0;
          let maxProductOffer = 0;

          applicableOffers.forEach(offer => {
              if (offer.category && offer.category.toString() === item.productId.category.toString()) {
                  if (offer.offerAmount > maxCategoryOffer) {
                      maxCategoryOffer = offer.offerAmount;
                  }
              } else if (offer.product && offer.product.toString() === item.productId._id.toString()) {
                  if (offer.offerAmount > maxProductOffer) {
                      maxProductOffer = offer.offerAmount;
                  }
              }
          });

          const bestOfferForItem = Math.max(maxCategoryOffer, maxProductOffer);
          productDiscount += bestOfferForItem * item.quantity;

          // Store the applied offers
          if (bestOfferForItem > 0) {
              item.appliedOffer = bestOfferForItem; // Add an `appliedOffer` field to each item
          }
      }

      // Handle coupon discount if coupon code is provided
      if (appliedCouponCode && !couponApplied) {
          const coupon = await Coupon.findOne({ name: appliedCouponCode });

          if (coupon) {
              const currentDate = new Date();
              const totalPrice = user.cart.reduce((acc, item) => acc + (item.quantity * item.productId.salePrice), 0);
              if (currentDate <= coupon.expireOn) {
                  if (totalPrice >= coupon.minimumPrice) {
                      couponDiscount = coupon.offerPrice;
                      couponApplied = true;
                  } else {
                      return res.status(400).json({ success: false, message: `Minimum purchase amount should be ₹${coupon.minimumPrice}` });
                  }
              } else {
                  return res.status(400).json({ success: false, message: 'Coupon has expired.' });
              }
          } else {
              return res.status(404).json({ success: false, message: 'Coupon not found.' });
          }
      }

      const totalPrice = user.cart.reduce((acc, item) => acc + (item.quantity * item.productId.salePrice), 0);
      const discount = productDiscount + couponDiscount;
      const finalAmount = totalPrice - discount + 50; // Including flat rate shipping

      const newOrder = new Order({
          orderedItems: orderedItems,
          totalPrice: totalPrice,
          discount: discount,
          couponCode: appliedCouponCode || null,
          couponDiscount: couponDiscount,
          finalAmount: finalAmount,
          address: address._id,
          payment: payment,
          userId: userId,
          status: 'Pending',
          createdOn: new Date(),
          couponApplied: couponApplied
      });

      await newOrder.save();

      // Update product quantities
      for (const item of newOrder.orderedItems) {
          await Product.findByIdAndUpdate(item.product, {
              $inc: { quantity: -item.quantity }
          });
      }

      if (payment === 'wallet') {
          if (user.walletBalance < newOrder.finalAmount) {
              return res.status(400).json({
                  success: false,
                  message: 'Insufficient wallet balance.'
              });
          }
          user.walletBalance -= finalAmount;
          await user.save();
      }

      // Clear the user's cart
      user.cart = [];
      await user.save();

      // Create Razorpay order
      const options = {
          amount: finalAmount * 100, // Amount in paise
          currency: "INR",
          receipt: `order_rcptid_${new Date().getTime()}`
      };

      const order = await razorpayInstance.orders.create(options);

      if (!order) {
          return res.status(500).json({ success: false, message: 'Razorpay order creation failed.' });
      }

      // Update the order with Razorpay order ID
      newOrder.razorpayOrderId = order.id;
      await newOrder.save();

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
};

// Function to finalize order after successful payment
const finalizeOrderPlacement = async (req, res) => {
  try {
      const { razorpayOrderId, razorpayPaymentId } = req.body;
      const userId = req.user._id;

      const order = await Order.findOne({ razorpayOrderId, userId });

      if (!order) {
          return res.status(404).json({ success: false, message: 'Order not found.' });
      }

      // Update order status and store payment ID
      order.status = 'Paid';
      order.razorpayPaymentId = razorpayPaymentId;
       await order.save();

      // Clear the user's cart after successful payment
      const user = await User.findById(userId);
      user.cart = [];
      await user.save();

      res.json({ success: true, message: 'Order finalized successfully.' });
  } catch (error) {
      console.error('Error finalizing order:', error);
      res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
  }
};

const loadOrderPage = async (req, res) => {
  try {
    const userId = req.user._id; // Ensure you're using a middleware to set req.user
    const orders = await Order.find({ userId }).lean();

    for (let order of orders) {
      order.products = await Product.find({ _id: { $in: order.orderedItems.map(item => item.product) } }, 'name').lean();
    }

    res.render('order', { orders });
  } catch (error) {
    res.status(500).send(error.message);
  }
}
const loadOrder_detailsPage = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId).populate('orderedItems.product').populate('address').lean();
    res.render('order-deatils', { order });
  } catch (error) {
    res.status(500).send(error.message);
  }
}

const OrderCancel = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    console.log(`Received cancellation request for order ID: ${orderId} by user: ${req.user._id}`);
    
    const order = await Order.findOne({ orderId: orderId });
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
      user.walletBalance += order.finalAmount; // Refund the final amount
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
    const order = await Order.findOne({ orderId: orderId });
    if (!order || order.status !== 'Delivered') {
      return res.status(400).json({ success: false, message: 'Order cannot be returned.' });
    }
    // Refund to wallet
    const user = await User.findById(order.userId);
    user.walletBalance += order.finalAmount; // Refund the final amount to the wallet
    await user.save();

   
    order.status = 'Returned';
    await order.save();
    
    res.json({ success: true, message: 'Order returned and refunded to wallet successfully.' });
  } catch (error) {
    console.error('Error returning order:', error);
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
    OrderReturn
  }