const Wishlist = require('../../models/wishlistSchema');
const Product = require('../../models/productSchema');
const mongoose = require('mongoose');

exports.getWishListPage = async (req, res) => {
    try {
        if (!req.user) {
            console.log('User not authenticated');
            return res.status(401).render('login', { message: 'Please log in to view your wishlist.' });
        }
        
        const userId = req.user._id;
        console.log('User ID:', userId);
        const cartCount = req.session.cartCount || 0;
        // Find the user's wishlist and calculate the count
        const wishlist = await Wishlist.findOne({ userId: userId }).populate('products.productId');
        const wishlistCount = wishlist ? wishlist.products.length : 0;
        
        // Store the wishlist count in the session
        req.session.wishlistCount = wishlistCount;

        // Make cartCount and wishlistCount available globally for the current response
        res.locals.cartCount = cartCount;
        res.locals.wishlistCount = wishlistCount;

        if (!wishlist) {
            console.log('Wishlist not found');
            return res.render('wishList', { wishlistItems: [], cartCount, wishlistCount });
        }

        // Pass the wishlist items to the EJS template
         res.render('wishList', { wishlistItems: wishlist.products,cartCount,wishlistCount });
        
    } catch (error) {
        console.error('Error retrieving wishlist:', error.stack);
        res.status(500).render('error', { message: 'Server error while retrieving wishlist.' });
    }
}

exports.addToWishlist = async (req, res) => {
    try {
        console.log('addToWishlist controller called');
        const { productId } = req.body;

        if (!req.user) {
            console.log('User not authenticated');
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const userId = req.user._id;
        console.log('User ID:', userId);

        // Check if the product exists
        const product = await Product.findById(productId);
        if (!product) {
            console.log('Product not found');
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (product.isBlocked) {
            console.log('Product is blocked');
            return res.status(403).json({ success: false, message: 'Product is blocked and cannot be added to the wishlist' });
        }

        console.log('Product found:', product);

        // Check if the wishlist already exists for the user
        let wishlist = await Wishlist.findOne({ userId: new mongoose.Types.ObjectId(userId) });

        if (!wishlist) {
            // If the wishlist doesn't exist, create a new one
            wishlist = new Wishlist({
                userId: new mongoose.Types.ObjectId(userId),
                products: [{ productId: new mongoose.Types.ObjectId(productId) }]
            });
        } else {
            // If the wishlist exists, check if the product is already in the wishlist
            const wishlistItem = wishlist.products.find(item => item.productId.equals(productId));
            if (wishlistItem) {
                console.log('Product already in wishlist');
                return res.status(400).json({ success: false, message: 'Product is already in your wishlist' });
            }

            // Add the product to the wishlist
            wishlist.products.push({ productId });
        }

        // Save the wishlist
        await wishlist.save();
        
        // Update wishlistCount in the session
        req.session.wishlistCount = wishlist.products.length;

        res.json({ success: true, wishlistCount: req.session.wishlistCount });
        console.log('Wishlist updated successfully');
    } catch (error) {
        console.error('Error adding to wishlist:', error.stack);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
// exports.removeFromWishlist = async (req, res) => {
//     try {
//         const { productId } = req.body;
//         const userId = req.user._id;

//         // Find the user's wishlist and remove the item
//         const wishlist = await Wishlist.findOne({ userId: userId });
//         if (!wishlist) {
//             return res.status(404).json({ success: false, message: 'Wishlist not found' });
//         }

//         // Filter out the product that matches the productId
//         wishlist.products = wishlist.products.filter(item => item.productId.toString() !== productId);
//         await wishlist.save();

//         res.json({ success: true, message: 'Product removed from wishlist' });
//     } catch (error) {
//         console.error('Error removing from wishlist:', error);
//         res.status(500).json({ success: false, message: 'Server error' });
//     }
// };
exports.removeFromWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.user._id;

        // Find the user's wishlist and remove the item
        const wishlist = await Wishlist.findOne({ userId: userId });
        if (!wishlist) {
            return res.status(404).json({ success: false, message: 'Wishlist not found' });
        }

        // Filter out the product that matches the productId
        wishlist.products = wishlist.products.filter(item => item.productId.toString() !== productId);
        await wishlist.save();

        // Update the wishlist count in the session after removing the product
        req.session.wishlistCount = wishlist.products.length;

        // Send the updated wishlist count back to the client
        res.json({ success: true, wishlistCount: req.session.wishlistCount, message: 'Product removed from wishlist' });
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
