
const express = require('express');
const router = express.Router();
const passport = require('passport');
const WishList= require('../models/wishlistSchema')
const { isAuthenticated } = require('../middleware/auth'); // Make sure to adjust the path based on your project structure


router.get('/google', (req, res, next) => {
    console.log('Google sign-in initiated');
    next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/Userlogin' }), async (req, res, next) => {
    console.log('Google sign-in callback');
    if (req.user) {
        req.session.user = req.user._id;
        //req.session.cartCount = req.user.cart.reduce((total, item) => total + item.quantity, 0);
        req.session.cartCount = req.user.cart.length;
       // Fetch the user's wishlist and calculate the count
       const wishlist =  await WishList.findOne({ userId: req.user._id });
       req.session.wishlistCount = wishlist ? wishlist.products.length : 0;
       console.log('Session data:', req.session);

        console.log('Google sign-in successful, redirecting to home1');
        res.redirect('/home1');
    } else {
        console.log('User is not authenticated');
        res.redirect('/Userlogin');
    }
});

// router.get('/google/callback',(req, res, next) => {
//     console.log('Google sign-in callback');
//     req.session.user = req.user._id;
//      next();
// }, passport.authenticate('google', { failureRedirect: '/Userlogin' }), (req, res) => {
//     console.log('Google sign-in successful, redirecting to home1');
//     res.redirect('/profile');
// });


module.exports = router;

