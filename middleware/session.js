// middlewares/session.js
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');

module.exports = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 72 * 60 * 60 * 1000 // 72 hours
    },
    store: MongoStore.create({ mongoUrl: mongoose.connection._connectionString })
});
