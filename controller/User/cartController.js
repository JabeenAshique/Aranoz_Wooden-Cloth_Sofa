const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');

// const addToCart = async (req, res) => {
//     try {
//         console.log('addToCart controller called'); // Debug log
//         console.log('Request body:', req.body); // Debug log
//         const { productId, quantity } = req.body;
//         const userId = req.user._id; // Assuming you have user authentication and the user ID is available in req.user

//         const user = await User.findById(userId);
//         if (!user) {
//             return res.status(404).json({ success: false, message: 'User not found' });
//         }

//         const product = await Product.findById(productId);
//         if (!product) {
//             return res.status(404).json({ success: false, message: 'Product not found' });
//         }
//         const requestedQuantity = parseInt(quantity);
//         if (requestedQuantity > product.quantity) {
//             return res.status(400).json({ success: false, message: 'Not enough stock available' });
//         }
//         const cartItem = user.cart.find(item => item.productId.toString() === productId);
//         if (cartItem) {
//             const newQuantity = cartItem.quantity + requestedQuantity;
//             if (newQuantity > product.quantity) {
//                 return res.status(400).json({ success: false, message: 'Not enough stock available' });
//             }
//             cartItem.quantity = newQuantity;
//         } else {
//             user.cart.push({ productId, quantity: requestedQuantity });
//         }

//         await user.save();
//         res.json({ success: true });
//     } catch (error) {
//         console.error('Error adding to cart:', error);
//         res.status(500).json({ success: false, message: 'Server error' });
//     }
// };

const addToCart = async (req, res) => {
    try {
      console.log('addToCart controller called'); // Debug log
      console.log('Request body:', req.body); // Debug log
      const { productId, quantity } = req.body;
      const userId = req.user._id; // Assuming you have user authentication and the user ID is available in req.user
      console.log('User ID:', userId); // Debug log
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
  
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      if (product.isBlocked) {
        return res.status(403).json({ success: false, message: 'Product is blocked and cannot be added to the cart' });
    }
      console.log('Product found:', product); // Debug log
      if (quantity > product.quantity) {
        return res.status(400).json({ success: false, message: 'Quantity exceeds available stock' });
      }
  
      const cartItem = user.cart.find(item => item.productId.toString() === productId);
      if (cartItem) {
        cartItem.quantity += parseInt(quantity);
      } else {
        user.cart.push({ productId, quantity });
      }
  
      await user.save();
      res.json({ success: true });
      console.log('Cart updated successfully'); // Debug log
    } catch (error) {
      console.error('Error adding to cart:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };
  


const loadCartPage = async (req, res) => {
    try {
        const userId = req.user._id; // Assuming you have user authentication and the user ID is available in req.user

        const user = await User.findById(userId).populate('cart.productId');
        const cartItems = user.cart.map(item => ({
            product: item.productId,
            quantity: item.quantity,
            total: item.quantity * item.productId.salePrice // Calculate total price for each item
        }));

        res.render('cart', { cartItems });
    } catch (error) {
        console.error('Error fetching cart details:', error);
        res.status(500).send('Server Error');
    }
};

const updateCartQuantity = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    const userId = req.user._id; // assuming you have user ID from session or token

    console.log('Request received to update quantity');
    console.log('Product ID:', productId);
    console.log('New Quantity:', quantity);

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      console.error('User not found');
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find the product in the user's cart
    const cartItem = user.cart.find(item => item.productId.toString() === productId);
    if (!cartItem) {
      console.error('Product not found in cart');
      return res.status(404).json({ success: false, message: 'Product not found in cart' });
    }

    // Update the quantity
    cartItem.quantity = quantity;

    // Save the user
    await user.save();
    console.log('Cart item updated successfully');

    // Fetch the updated product details
    const updatedProduct = await Product.findById(productId);

    res.status(200).json({
      success: true,
      product: {
        productId: cartItem.productId,
        quantity: cartItem.quantity,
        price: updatedProduct.salePrice // Ensure this matches the correct price field
      }
    });
  } catch (error) {
    console.error('Error updating quantity:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
const removeFromCart = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.user._id; // Assuming you have user authentication and the user ID is available in req.user

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.cart = user.cart.filter(item => item.productId.toString() !== productId);
        await user.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error removing from cart:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
module.exports = { 
   addToCart,
   loadCartPage,
   updateCartQuantity,
   removeFromCart
};
