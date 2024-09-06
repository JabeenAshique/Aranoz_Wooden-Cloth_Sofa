const passport = require('passport');
const authMiddleware = (req, res, next) => {
    if (req.session.user || req.isAuthenticated()) {
        return next();
    } else {
        return res.redirect('/');
    }
};


const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated() || (req.session && req.session.passport && req.session.passport.user)) {
        return next();
    } else if (req.session && req.session.user) {
        req.user = req.session.user; // Set req.user from session data
        return next();
    } else {
        return res.redirect('/Userlogin?message=Please log in to access this page.');
    }
  
};
const isAdmin=(req,res,next)=>{
    if(req.session.admin){
        return next()
    }
    return res.redirect('/admin/login')
}
module.exports = {authMiddleware,ensureAuthenticated,isAdmin};





