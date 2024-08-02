const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const User = require('../../models/userSchema');


const orderPlaced= async (req, res) => {
    try {
      const { addressId, payment } = req.body;
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
  
      const orderedItems = user.cart.map(item => ({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.productId.salePrice
      }));
  
      const totalPrice = orderedItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);
      const finalAmount = totalPrice + 50; // Including flat rate shipping
  
      const newOrder = new Order({
        orderedItems: orderedItems,
        totalPrice: totalPrice,
        discount: 0,
        finalAmount: finalAmount,
        address: address._id,
        payment: payment,
        userId: userId,
        status: 'Pending',
        createdOn: new Date()
      });
  
      await newOrder.save();
  
      // Update product quantities
      for (const item of orderedItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { quantity: -item.quantity }
        });
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
  
  module.exports = {orderPlaced}