const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');


const addToCart = async (req, res) => {
    try {
     
      const { productId, quantity } = req.body;
      const userId = req.user._id; // Assuming you have user authentication and the user ID is available in req.user
      console.log('User ID:', userId); // Debug log
      


        // Retrieve the user document from the database
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
      // Check if the product already exists in the cart
      const cartItem = user.cart.find(item => item.productId.toString() === productId);
      if (cartItem) {
        // If the product already exists in the cart, return an error response
        return res.json({ success: false, message: 'Product already in cart' });
      } else {
        // Add new item to cart
        user.cart.push({ productId, quantity });
      }
  
      await user.save();
       // Calculate the total quantity of items in the cart for the session
       req.session.cartCount = user.cart.reduce((total, item) => total + item.quantity, 0);

       res.json({ success: true, cartCount: req.session.cartCount });

      console.log('Cart updated successfully'); // Debug log
    } catch (error) {
      console.error('Error adding to cart:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
const loadCartPage = async (req, res) => {
  try {
      const userId = req.user._id; // Assuming you have user authentication and the user ID is available in req.user
      const wishlistCount = req.session.wishlistCount || 0;

      // Fetch user with cart products, filtering out blocked products
      const user = await User.findById(userId)
          .populate({
              path: 'cart.productId',
              match: { isBlocked: false } // Only fetch products that are not blocked
          });

      // Filter valid cart items (products that exist and are not blocked)
      const validCartItems = user.cart.filter(item => item.productId);

      // If blocked items exist, remove them from the cart and update the database
      if (validCartItems.length !== user.cart.length) {
          // Update user's cart in the database
          user.cart = validCartItems;
          await user.save();
      }

      // Update the cart session count to reflect the valid items only
      req.session.cartCount = validCartItems.length;

      // Prepare the cart items for rendering
      const cartItems = validCartItems.map(item => ({
          product: item.productId,
          quantity: item.quantity,
          total: item.quantity * item.productId.salePrice // Calculate total price for each item
      }));

      // Render the cart page with valid cart items, cart count, and wishlist count
      res.render('cart', { cartItems, cartCount: req.session.cartCount, wishlistCount });
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
        // Find the item to be removed to adjust the cart count
        const itemToRemove = user.cart.find(item => item.productId.toString() === productId);

        user.cart = user.cart.filter(item => item.productId.toString() !== productId);
        await user.save();
        // Update the cart count in the session
        req.session.cartCount = user.cart.reduce((total, item) => total + item.quantity, 0);
        res.json({ success: true,cartCount: req.session.cartCount });
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
