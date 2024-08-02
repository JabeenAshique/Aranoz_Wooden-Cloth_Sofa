const passport = require('passport');
require('../passport-setup');

module.exports = (app) => {
    app.use(passport.initialize());
    app.use(passport.session());
};
