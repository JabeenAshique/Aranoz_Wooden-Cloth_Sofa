const express = require('express');
const router = express.Router();
const userController = require('../controller/User/userController.js');
const profileController = require('../controller/User/profileController.js');
const cartController=require('../controller/User/cartController');
const checkoutController=require('../controller/User/checkOutController')
const authMiddlewares = require('../middleware/auth'); // Ensure this path is correct
const orderController=require('../controller/User/orderController')
const passport = require('passport');
//User
router.get('/', userController.loadHomepage);
router.get('/signup', userController.loadsignup);
router.post('/signup', userController.signup);
router.get('/verify-otp', userController.loadOtpPage);
router.post('/verify-otp', userController.verifyOtp);
router.post('/resend-otp', userController.resendOtp);
router.get('/home1', authMiddlewares.authMiddleware, userController.loadMainPage);
router.get('/Userlogin', userController.loadLoginpage);
router.post('/Userlogin', userController.login);
router.get('/logout', userController.logout);
router.get('/product/:id',authMiddlewares.authMiddleware, userController.getProductDetails);
router.get('/shop',authMiddlewares.authMiddleware, userController.loadShopPage);
//profile
router.get('/profile',authMiddlewares.ensureAuthenticated,profileController.loadProfilePage);
router.get('/updateProfile',profileController.loadUpdateProfilePage);
router.post('/updateProfile', authMiddlewares.ensureAuthenticated, profileController.updateUserProfile);
router.post('/resetPassword',authMiddlewares.ensureAuthenticated , profileController.resetPassword);
//Address
router.get('/getAddress',authMiddlewares.ensureAuthenticated,profileController.loadgetAddressPage);
router.get('/addAddress',authMiddlewares.ensureAuthenticated,profileController.loadAddAddressPage);
router.post('/addAddress',authMiddlewares.ensureAuthenticated,profileController.saveAddress);
router.get('/editAddress/:id', profileController.loadEditAddressPage);
router.post('/updateAddress/:id', profileController.updateAddress);
router.post('/deleteAddress/:id', profileController.deleteAddress);

// Cart
router.get('/cart', authMiddlewares.ensureAuthenticated, cartController.loadCartPage);
router.post('/cart/add', authMiddlewares.ensureAuthenticated, cartController.addToCart);
router.post('/cart/remove', authMiddlewares.ensureAuthenticated, cartController.removeFromCart);
router.post('/update-cart/:productId', authMiddlewares.ensureAuthenticated, cartController.updateCartQuantity); 

// Checkout
router.get('/checkout', authMiddlewares.ensureAuthenticated, checkoutController.loadCheckoutPage);
router.post('/updateAddress/:id', checkoutController.updateAddress);



//Payment method
router.post('/placeOrder',authMiddlewares.ensureAuthenticated,orderController.orderPlaced);




//router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
// router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/Userlogin' }), (req, res) => {
   
//     res.redirect('/home1');
// });
// router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/Userlogin' }), (req, res) => {
//     // Successful authentication, redirect to home.
//     res.redirect('/home1');
// });
module.exports = router;
