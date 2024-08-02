// const express = require('express');
// const router = express.Router();
// const passport = require('passport');

// // Google OAuth login route
// router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));



// // Google OAuth callback route
// router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
//     req.session.user = req.user; // Ensure session is set
//     res.redirect('/home1');
// });

// module.exports = router;


// router/auth.js
// router/auth.js
const express = require('express');
const router = express.Router();
const passport = require('passport');
const { isAuthenticated } = require('../middleware/auth'); // Make sure to adjust the path based on your project structure


router.get('/google', (req, res, next) => {
    console.log('Google sign-in initiated');
    next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/Userlogin' }), (req, res, next) => {
    console.log('Google sign-in callback');
    if (req.user) {
        req.session.user = req.user._id;
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

