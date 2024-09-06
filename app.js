// app.js
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const dotenv = require('dotenv');
const path = require('path');
const db = require('./Config/db');
const cookieParser = require('cookie-parser');
const passport = require('./passport-setup');
const checkBlocked = require('./middleware/checkBlocked');
const MongoStore = require('connect-mongo');
const userRouter = require('./router/userRouter');
const adminRouter = require('./router/adminRouter');
const authRouter = require('./router/auth');



const cors = require('cors');

dotenv.config();
db();

const app = express();

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URL }),
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 72 * 60 * 60 * 1000
    }
}));
// Log session data for debugging
app.use((req, res, next) => {
    console.log('Session data:', req.session);
    next();
});
app.use(flash());


// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());


// Middleware to prevent caching of protected routes
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});

// Middleware to check if the user is blocked
app.use(checkBlocked);

app.use((req, res, next) => {
    //console.log('Setting up routes');
    next();
});

app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

app.set('view engine', 'ejs');
app.set('views', [path.join(__dirname, 'views/users'), path.join(__dirname, 'views/admin')]);
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', userRouter);
app.use('/admin', adminRouter);
app.use('/auth', authRouter);

app.listen(process.env.PORT, () => {
    console.log('Server is running on port', process.env.PORT);
});
