
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category=require("../../models/categorySchema");
const Wishlist=require("../../models/wishlistSchema");
const Offer= require ("../../models/offerSchema");
const nodemailer = require("nodemailer");
const env = require("dotenv").config();
const bcrypt = require('bcrypt');
const loadHomepage = async (req, res) => {
    try {
        const cartCount = req.session.cartCount || 0;
        const products = await Product.find({ isBlocked: false }).exec(); // Ensure to fetch only non-blocked products
        const categories = await Category.find().limit(4).exec();
        const categoriesWithProducts = await Promise.all(categories.map(async (category) => {
            const product = await Product.findOne({ category: category._id, isBlocked: false }).exec();
            return { category, product };
        }));

        res.render('home', { products, user: req.session.user,cartCount,categoriesWithProducts });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send('Server Error');
    }
};

const loadsignup = async (req, res) => {
    try {
        res.render('signup');
    } catch (error) {
        console.log("Signup page is not loading", error);
        res.status(500).send("server.error");
    }
};
const loadLoginpage = async (req, res) => {
    try {
        const cartCount = req.session.cartCount || 0;
        const message = req.query.message || '';
        res.render('Userlogin', { message,cartCount }); 
        
       
    } catch (error) {
        console.log("Home page is not loading", error);
        res.status(500).send("server.error");
    }
};


const getProductDetails = async (req, res) => {
    try {
        const productId = req.params.id;
        const currentDate = new Date();
        const product = await Product.findById(productId).populate("category");
        // Assuming you are using session to store cartCount
        const cartCount = req.session.cartCount || 0;
        const wishlistCount = req.session.wishlistCount || 0;
        if (!product) {
            return res.status(404).send("Product not found");
        }
         // Fetch offers that apply to the product's category or the product itself and are active on the current date
         const applicableOffers = await Offer.find({
            $or: [
                { category: product.category._id },
                { product: product._id }
            ],
            startDate: { $lte: currentDate },
            endDate: { $gte: currentDate }
        });
        console.log("Applicable Offers:", applicableOffers);
        // Initialize variables to hold the maximum offer amounts
        let maxCategoryOffer = 0;
        let maxProductOffer = 0;

        // Iterate over the applicable offers
        applicableOffers.forEach(offer => {
        if (offer.category && offer.category.toString() === product.category._id.toString()) {        
        if (offer.offerAmount > maxCategoryOffer) {
            maxCategoryOffer = offer.offerAmount;
        }
        } else if (offer.product && offer.product.toString() === product._id.toString()) {
        // It's a product-specific offer
        if (offer.offerAmount > maxProductOffer) {
            maxProductOffer = offer.offerAmount;
        }
    }
});
console.log("Max Category Offer:", maxCategoryOffer);
console.log("Max Product Offer:", maxProductOffer);

      // Determine the greater offer
        const finalOffer = Math.max(maxCategoryOffer, maxProductOffer);  
        const relatedProducts = await Product.find({ 
            category: product.category._id, 
            _id: { $ne: productId } 
        }).limit(4);
        if (product.isBlocked) {
            res.render("pro_details", { product: null, relatedProducts, message: "This product is unavailable." });
        } else {
            res.render("pro_details", { product, relatedProducts, message: null,finalOffer,cartCount,wishlistCount });
        }
        // res.render("pro_details", { product, relatedProducts });
    } catch (error) {
        console.error("Error fetching product details:", error);
        res.status(500).send("Server error");
    }
};
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log("Login attempt with email:", email);

        const user = await User.findOne({ email });
        console.log("User found:", user);

        if (!user) {
            console.log("No user found with this email.");
            return res.render("Userlogin", { message: "Invalid email or password" });
        }

        if (user.isBlocked) {
            console.log("User is blocked.");
            return res.render("Userlogin", { message: "Your account is blocked. Please contact support." });
        }
        console.log("Plain text password:", password);
        console.log("Hashed password from DB:", user.password);

        const isMatch = await bcrypt.compare(password, user.password);
        console.log("Password match:", isMatch);

        if (!isMatch) {
            console.log("Password does not match.");
            return res.render("Userlogin", { message: "Invalid email or password" });
        }

        console.log("User authenticated successfully.");
        req.session.user = { _id: user._id }; // Set session
        
        // Calculate the cart count based on the user's cart
        //req.session.cartCount = user.cart.reduce((total, item) => total + item.quantity, 0);
        req.session.cartCount = user.cart.length;
        
        // Fetch the user's wishlist and calculate the count
        const wishlist = await Wishlist.findOne({ userId: user._id });
        req.session.wishlistCount = wishlist ? wishlist.products.length : 0;

        // req.session.cartCount = user.cart.length;

        console.log('Session data:', req.session);

        res.redirect("/home1");
    } catch (error) {
        console.error("Login error:", error);
        res.redirect("/pageNotFound");
    }
};


// controllers/userController.js
const logout = (req, res) => {
    console.log('Logout function called'); // Log when function is called
    req.session.destroy(err => {
        if (err) {
            console.error("Logout error:", err);
            return res.redirect('/home1'); // Redirect to the home page or error page if there's an error
        }
        console.log('Session destroyed, clearing cookie'); // Log after session is destroyed
        res.clearCookie('connect.sid'); // Clear the session cookie
        console.log('Cookie cleared, redirecting to Userlogin'); // Log before redirect
        res.redirect('/'); // Redirect to login page after logout
    });
};


const loadShopPage = async (req, res) => {
    try {
        const cartCount = req.session.cartCount || 0;
        const wishlistCount = req.session.wishlistCount || 0;
        const page = parseInt(req.query.page) || 1;
        const limit = 9; // Adjust the limit as per  requirement
        const sortOption = req.query.sort || 'default';
        const searchQuery = req.query.search || ''; // Get the search query
        const minPrice = parseInt(req.query.minPrice) || 0; // Get the minimum price, default is 0
        const maxPrice = parseInt(req.query.maxPrice) || 1000000; // Get the maximum price, default is 10 lakh (1,000,000)
        let sortCriteria = {};

        // Define sorting criteria based on sortOption
        switch (sortOption) {
            case 'popularity':
                sortCriteria = { popularity: -1 };
                break;
            case 'priceAsc':
                sortCriteria = { salePrice: 1 };
                break;
            case 'priceDesc':
                sortCriteria = { salePrice: -1 };
                break;
            case 'averageRatings':
                sortCriteria = { averageRatings: -1 };
                break;
            case 'featured':
                sortCriteria = { featured: -1 };
                break;
            case 'newArrivals':
                sortCriteria = { createdAt: -1 };
                break;
            case 'az':
                sortCriteria = { productName: 1 };
                break;
            case 'za':
                sortCriteria = { productName: -1 };
                break;
            default:
                sortCriteria = {};
        }

        const categoryFilter = req.query.category;
        const categoryQuery = categoryFilter ? { category: categoryFilter } : {};
         // Update the product query to include the search term
         const productQuery = {
            ...categoryQuery,
            productName: { $regex: searchQuery, $options: 'i' }, // Case-insensitive search
            salePrice: { $gte: minPrice, $lte: maxPrice }
 // Apply price range filter
        };

        const products = await Product.find(productQuery)
            .sort(sortCriteria)
            .skip((page - 1) * limit)
            .limit(limit)
            .populate({
                path: 'category',
                match: { isBlocked: true }
            })
            .exec();
            

        const count = await Product.countDocuments(productQuery);
        const totalPages = Math.ceil(count / limit);
        const categories = await Category.find({isListed:true});
       
        
         // Retrieve the user's wishlist
         let wishlistItems = [];
         if (req.user) {
             const wishlist = await Wishlist.findOne({ userId: req.user._id }).populate('products.productId');
             if (wishlist) {
                 wishlistItems = wishlist.products.map(item => item.productId._id.toString());
             }
         }
        res.render("shop", {
            products,
            categories,
            currentPage: page,
            totalPages,
            categoryFilter,
            sortOption,
            searchQuery,
            minPrice,
            maxPrice,
            wishlistItems,
            cartCount,
            wishlistCount,
            
        });
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).send("Server Error");
    }
};

const loadMainPage = async (req, res) => {
    try {
        const cartCount = req.session.cartCount || 0;
        const wishlistCount = req.session.wishlistCount || 0;
        const categories = await Category.find().limit(4).exec();
        const products = await Product.find({ isBlocked: false }).exec(); 
        const categoriesWithProducts = await Promise.all(categories.map(async (category) => {
            const product = await Product.findOne({ category: category._id, isBlocked: false }).exec();
            return { category, product };
        }));

        // Render the page with the categories and their products
        res.render('home1', { categoriesWithProducts,products,cartCount,wishlistCount });
    } catch (error) {
        console.error('Error fetching categories and products:', error);
        res.status(500).send('Server Error');
    }
};

//otp



function generateOtp(){
    return Math.floor(100000+Math.random()*900000).toString()
}

async function sendVerificationEmail(email,otp){
try {
    const transporter=nodemailer.createTransport({
        service:"gmail",
        port:587,
        secure:false,
        requireTLS:true,
        auth:{
            user:process.env.NODEMAILER_EMAIL,
            pass:process.env.NODEMAILER_PASSWORD
        }
    })
    const info= await transporter.sendMail({
        from:process.env.NODEMAILER_EMAIL,
        to:email,
        subject:"Verify your account",
        text:`Your otp is ${otp}`,
        html:`<b> Your OTP:${otp}</b>`
    })
    return info.accepted.length>0
} catch (error) {
    console.error("Error sending email",error)
    return false
}
}

const signup = async (req, res) => {
    try {
        const { name, email, phone, password, cPassword, referralCode } = req.body;

        // Check if passwords match
        if (password !== cPassword) {
            return res.render("signup", { message: "Passwords do not match" });
        }

        // Check if the user already exists
        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render("signup", { message: "User with this email already exists" });
        }

        // Generate a referral code based on the user's name
        const namePart = name.substring(0, 3).toUpperCase();
        const randomPart = Math.floor(100 + Math.random() * 900).toString(); // Generate a random 3-digit number
        const userReferralCode = `${namePart}${randomPart}`;

        let walletBalance = 0;
        let walletTransactions = [];
        let referredAmount = 0;

       
        // Check if the referral code provided is valid
        if (referralCode) {
            const referrer = await User.findOne({ referralCode });

            if (referrer) {
                // Fetch the referral offer from the Offer schema
                const referralOffer = await Offer.findOne({
                    offerType: "referral",
                    startDate: { $lte: new Date() },
                    endDate: { $gte: new Date() }
                });

                if (referralOffer) {
                    // Calculate the new wallet balance for the referrer
                    const latestReferrerTransaction = referrer.walletTransactions.length > 0
                        ? referrer.walletTransactions[referrer.walletTransactions.length - 1].walletBalance
                        : 0;
                    const referrerNewBalance = latestReferrerTransaction + (referralOffer.referrerAmount );

                    // Create a new transaction for the referrer
                    referrer.walletTransactions.push({
                        type: 'credit',
                        amount: referralOffer.referrerAmount || 100,
                        walletBalance: referrerNewBalance,
                        description: `Referral bonus for referring ${name}`
                    });

                    await referrer.save();

                    // Add the amount defined in the offer to the new user's wallet
                    referredAmount =referralOffer.referredAmount
                    walletBalance += referredAmount 

                    // Add the new user's initial transaction
                    walletTransactions.push({
                        type: 'credit',
                        amount: referralOffer.referredAmount || 0,
                        walletBalance: walletBalance,
                        description: 'Referral bonus for signing up'
                    });
                } else {
                    return res.render("signup", { message: "No active referral offer available" });
                }
            } else {
                return res.render("signup", { message: "Invalid referral code" });
            }
        }


        // Generate OTP for email verification
        const otp = generateOtp();

        // Send verification email
        const emailSend = await sendVerificationEmail(email, otp);
        if (!emailSend) {
            return res.json("email-error");
        }

        // Store OTP and user data in the session
        req.session.userOtp = otp;
        req.session.userData = {
            name,
            email,
            phone,
            password,
            walletTransactions, // Store the initial wallet transactions for the new user
            referralCode: userReferralCode // Store the generated referral code
        };

        // Render the OTP verification page
        res.render("verify-otp");
        console.log("OTP sent:", otp);
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).render("pageNotFound");
    }
};
const securePassword=async (password)=>{
    try {
        const passwordHash=await bcrypt.hash(password,10)
        return passwordHash
    } catch (error) {
        
    }
}

const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const sessionOtp = req.session.userOtp;

        console.log("Entered OTP:", otp);  // Debug line
        console.log("Session OTP:", sessionOtp);  // Debug line

        if(otp===req.session.userOtp){
            const user=req.session.userData
            const passwordHash=await securePassword(user.password)
            const saveUserData=new User({
                name:user.name,
                email:user.email,
                phone:user.phone,
                password:passwordHash,
                walletTransactions: user.walletTransactions,
                referralCode: user.referralCode
            })


            await saveUserData.save();
            req.session.userOtp = null;
            req.session.userData = null;

            res.json({ success: true, redirectUrl: "/home1" });
        } else {
            res.json({ success: false, message: "Invalid OTP" });
        }
    } catch (error) {
        console.error("OTP verification error:", error);
        res.json({ success: false, message: "Error verifying OTP" });
    }
};



const resendOtp=async(req,res)=>{
    try {
        const {email}=req.session.userData
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in the session"})
        }
        const otp=generateOtp()
        req.session.userOtp=otp
        const emailSend=await sendVerificationEmail(email,otp)
        if(emailSend){
            console.log("Resend otp:",otp)
            res.status(200).json({success:true,message:"OTP send Successfully"})
        } else{
            res.status(500).json({success:false,message:"Failed to resend otp, please try again"})
        }
    } catch (error) {
        console.error("Error resending otp",otp)
        res.status(500).json({success:false,message:"Internal server error"})
    }
}

const loadOtpPage = async (req, res) => {
    try {
        const cartCount = req.session.cartCount || 0;
        res.render('verify-otp', { message: "" ,cartCount});
    } catch (error) {
        console.log("OTP verification page is not loading", error);
        res.status(500).send("server.error");
    }
};
module.exports = {
    
    loadsignup,
    signup,
    verifyOtp,
    resendOtp,
    loadOtpPage,
    getProductDetails,
    loadShopPage,
    login,
    loadLoginpage,
    loadHomepage,
    loadMainPage,
    logout,
    generateOtp,
    sendVerificationEmail,
    securePassword
};