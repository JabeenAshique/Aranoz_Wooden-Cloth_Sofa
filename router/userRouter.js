const express = require('express');
const router = express.Router();
const userController = require('../controller/User/userController');
const forgotController=require("../controller/User/forgotController")
const profileController = require('../controller/User/profileController.js');
const cartController=require('../controller/User/cartController');
const checkoutController=require('../controller/User/checkOutController')
const authMiddlewares = require('../middleware/auth'); // Ensure this path is correct
const orderController=require('../controller/User/orderController');
const wishlistController=require("../controller/User/wishListController")
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
// Route to handle forgot password and send OTP
// router.get('/forgot-password', forgotController.loadForgotPasswordPage);
// router.post('/send-otp', forgotController.sendResetOtp);
// router.post('/verify-otp', forgotController.forgot_verifyOtp);
router.get('/email_verification', forgotController.getemail_verification);
router.post('/forgot_verifyOtp', forgotController.send_ResetPasswordOtp);
router.post('/resetverify-otp', forgotController.forgot_verifyOtp);
// router.get('/reset-password', forgotController.loadResetPasswordPage);
 router.post('/reset-password', forgotController.resetPassword);
//profile
router.get('/profile',authMiddlewares.ensureAuthenticated,profileController.loadProfilePage);
router.get('/updateProfile',authMiddlewares.ensureAuthenticated,profileController.loadUpdateProfilePage);
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
router.post('/updateAddress/:id', authMiddlewares.ensureAuthenticated, checkoutController.updateAddress);
router.post('/applyCoupon',  authMiddlewares.ensureAuthenticated,checkoutController.applyCoupon);

//Payment method
router.post('/placeOrder',authMiddlewares.ensureAuthenticated,orderController.orderPlaced);

//Order
router.get('/order',authMiddlewares.ensureAuthenticated,orderController.loadOrderPage)
router.get('/order/:orderId',authMiddlewares.ensureAuthenticated,orderController.loadOrder_detailsPage)
router.post('/cancel/:orderId',authMiddlewares.ensureAuthenticated,orderController.OrderCancel);
router.post('/return/:orderId',  authMiddlewares.ensureAuthenticated,orderController.OrderReturn);
router.post('/createRazorpayOrder', authMiddlewares.ensureAuthenticated, orderController.createRazorpayOrder);
router.post('/finalizeOrder', authMiddlewares.ensureAuthenticated, orderController.finalizeOrderPlacement);

//WhishList

router.get('/wishlist', authMiddlewares.ensureAuthenticated,wishlistController.getWishListPage);
router.post('/wishlist/add',  authMiddlewares.ensureAuthenticated,wishlistController.addToWishlist);

router.post('/wishlist/remove',  authMiddlewares.ensureAuthenticated,wishlistController.removeFromWishlist);

module.exports = router;
