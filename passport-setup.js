// const passport = require('passport');
// const GoogleStrategy = require('passport-google-oauth20').Strategy;
// const User = require('./models/userSchema'); // Adjust the path if necessary

// passport.serializeUser((user, done) => {
//     done(null, user.id);
// });

// passport.deserializeUser((id, done) => {
//     User.findById(id).then((user) => {
//         done(null, user);
//     });
// });

// passport.use(new GoogleStrategy({
//     clientID: process.env.GOOGLE_CLIENT_ID,
//     clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//     callbackURL: 'http://localhost:3000/auth/google/callback'
// }, (accessToken, refreshToken, profile, done) => {
//     User.findOne({ googleId: profile.id }).then((existingUser) => {
//         if (existingUser) {
//             done(null, existingUser);
//         } else {
//             new User({
//                 googleId: profile.id,
//                 name: profile.displayName,
//                 email: profile.emails[0].value
//             }).save().then((user) => {
//                 done(null, user);
//             });
//         }
//     });
// }));


// config/passport.js
// 

// config/passport.js
// passport-setup.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('./models/userSchema');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://localhost:3000/auth/google/callback',
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      console.log('Google profile:', profile);
      let user = await User.findOne({ googleId: profile.id });

      if (!user) {
        console.log('User not found, creating new user');
        user = new User({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value,
        });
        await user.save();
        console.log('New user created:', user);
      }

      // Check if the user is blocked
      if (user.isBlocked) {
        console.log('User is blocked:', user);
        return done(null, false, { message: 'Your account is blocked. Please contact support.' });
      }

      return done(null, user);
    } catch (err) {
      console.error('Error in Google strategy:', err);
      return done(err, false, err.message);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;


passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
