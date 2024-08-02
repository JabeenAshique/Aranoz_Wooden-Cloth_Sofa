const passport = require('passport');
const authMiddleware = (req, res, next) => {
    if (req.session.user || req.isAuthenticated()) {
        return next();
    } else {
        return res.redirect('/');
    }
};
// const ensureAuthenticated = (req, res, next) => {
//   if (req.session.user && req.session.user._id) {
//       return next();
//   }
//   res.status(401).send('Unauthorized: User not logged in');
// };

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated() || (req.session && req.session.passport && req.session.passport.user)) {
        return next();
    } else if (req.session && req.session.user) {
        req.user = req.session.user; // Set req.user from session data
        return next();
    } else {
        res.status(401).send('Unauthorized: User not logged in');
    }
    // if (req.session.user && req.session.user._id) {
    //     if (!req.user) {
    //         req.user = req.session.user; // Populate req.user from session
    //     }
    //     return next();
    // }
    // res.status(401).send('Unauthorized: User not logged in');
};

module.exports = {authMiddleware,ensureAuthenticated};





