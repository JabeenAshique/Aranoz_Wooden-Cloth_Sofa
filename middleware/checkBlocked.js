
// // middleware/checkBlocked.js
// const User = require('../models/userSchema');


// const checkBlocked = async (req, res, next) => {
//     if (req.isAuthenticated()) {
//         try {
//             const user = await User.findById(req.user._id);
//             if (user && user.isBlocked) {
//                 req.logout((err) => {
//                     if (err) {
//                         console.error("Logout error:", err);
//                     }
//                     req.session.destroy((err) => {
//                         if (err) {
//                             console.error("Session destroy error:", err);
//                         }
//                         res.clearCookie('connect.sid');
//                         return res.render('Userlogin', { message: "Your account has been blocked." });
//                     });
//                 });
//             } else {
//                 next();
//             }
//         } catch (error) {
//             console.error('Error checking user blocked status:', error);
//             next(error);
//         }
//     } else {
//         next();
//     }
// };
// module.exports = checkBlocked;

// middleware/checkBlocked.js
// middleware/checkBlocked.js
const User = require('../models/userSchema');

const checkBlocked = async (req, res, next) => {
    if (!req.isAuthenticated()) {
        return next();
    }

    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return next();
        }

        if (user.isBlocked) {
            await logoutUser(req, res);
            res.clearCookie('connect.sid');
            return res.render('Userlogin', { message: "Your account has been blocked." });
        }

        next();
    } catch (error) {
        console.error('Error checking user blocked status:', error);
        next(error);
    }
};

const logoutUser = (req, res) => {
    return new Promise((resolve, reject) => {
        req.logout((err) => {
            if (err) {
                console.error("Logout error:", err);
                return reject(err);
            }

            req.session.destroy((err) => {
                if (err) {
                    console.error("Session destroy error:", err);
                    return reject(err);
                }
                resolve();
            });
        });
    });
};

module.exports = checkBlocked;
