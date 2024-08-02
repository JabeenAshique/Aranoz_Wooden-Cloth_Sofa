const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');
const mongoose = require('mongoose');


// const loadCheckoutPage = async (req, res) => {
//     try {
//         if (!req.session.user || !req.session.user._id) {
//             return res.status(401).send('Unauthorized: User not logged in');
//         }

//         const userId = req.session.user._id;

//         if (!mongoose.Types.ObjectId.isValid(userId)) {
//             return res.status(400).send('Invalid User ID');
//         }
//         const user = await User.findById(userId).populate('cart.items.productId');

//         if (!user) {
//             return res.status(404).send('User not found');
//         }
//         const addresses = await Address.find({ userId: userId });

//         if (!addresses || addresses.length === 0) {
//             console.log('No addresses found');
//         } else {
//             console.log('Addresses found:', addresses);
//         }
       
//         res.render('checkOut', { addresses, cart: user.cart});
   
//     } catch (error) {
//         console.error('Error fetching addresses:', error);
//         res.status(500).send('Server Error');
//     }
// };
const loadCheckoutPage = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            console.error('Unauthorized: User not logged in');
            return res.status(401).send('Unauthorized: User not logged in');
        }

        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            console.error('Invalid User ID');
            return res.status(400).send('Invalid User ID');
        }

        const user = await User.findById(userId).populate('cart.productId');

        if (!user) {
            console.error('User not found');
            return res.status(404).send('User not found');
        }
        console.log('Cart Data:', user.cart); // Log the cart data
        
        const addresses = await Address.find({ userId: userId });

        if (!addresses || addresses.length === 0) {
            console.log('No addresses found');
        } else {
            console.log('Addresses found:', addresses);
        }
        const cartItems = user.cart.map(item => ({
            product: item.productId,
            quantity: item.quantity,
            total: item.quantity * item.productId.salePrice
        }));

        const cartTotal = cartItems.reduce((acc, item) => acc + item.total, 0);

        res.render('checkOut', { addresses, cartItems, cartTotal });
        // res.render('checkOut', { addresses, cart: user.cart });
    } catch (error) {
        console.error('Error loading checkout page:', error);
        res.status(500).send('Server Error');
    }
};
//updating address from check out page
const updateAddress = async (req, res) => {
    try {
        
        const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;
        const addressId = req.params.id;

        const updatedAddress = await Address.findByIdAndUpdate(addressId, {
            addressType, name, city, landMark, state, pincode, phone, altPhone
        }, { new: true });

        if (!updatedAddress) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        return res.json({ success: true, message: 'Address updated successfully', updatedAddress });
    } catch (error) {
        console.error('Error updating address:', error);
        return res.status(500).json({ success: false, message: 'An error occurred while updating the address' });
    }
};

const getCartDetails = async (req, res) => {
    try {
      const userId = req.user._id; // Adjust this based on your authentication logic
      const cart = await Cart.findOne({ userId }).populate('items.productId'); // Assuming you have a Cart model with userId and items array
  
      if (!cart) {
        return res.status(404).json({ success: false, message: 'Cart not found' });
      }
  
      res.render('cart', { cart: cart.items });
    } catch (error) {
      console.error('Error fetching cart details:', error);
      res.status(500).json({ success: false, message: 'An error occurred while fetching cart details' });
    }
  };
module.exports={
    updateAddress,
    loadCheckoutPage,
    getCartDetails
    
}