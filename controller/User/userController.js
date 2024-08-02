
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category=require("../../models/categorySchema")
const nodemailer = require("nodemailer");
const env = require("dotenv").config();
const bcrypt = require('bcrypt');
const loadHomepage = async (req, res) => {
    try {
        const products = await Product.find({ isBlocked: false }).exec(); // Ensure to fetch only non-blocked products
        res.render('home', { products, user: req.session.user  });
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
        const message = req.query.message || '';
        res.render('Userlogin', { message }); 
        
       
    } catch (error) {
        console.log("Home page is not loading", error);
        res.status(500).send("server.error");
    }
};


const getProductDetails = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).populate("category");
        if (!product) {
            return res.status(404).send("Product not found");
        }

        const relatedProducts = await Product.find({ 
            category: product.category._id, 
            _id: { $ne: productId } 
        }).limit(4);
        if (product.isBlocked) {
            res.render("pro_details", { product: null, relatedProducts, message: "This product is unavailable." });
        } else {
            res.render("pro_details", { product, relatedProducts, message: null });
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
        console.log('User logged in:', req.session.user); // Log session data
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

// const loadShopPage = async (req, res) => {
//     try {
//         const filterOutOfStock = req.query.filterOutOfStock === 'true';
//         const categories = await Category.find({ isListed: true });
//         const categoryFilter = req.query.category;
//         let products;
        
//         if (filterOutOfStock) {
//             products = await Product.find({ quantity: { $gt: 0 } });
//           } else {
//             products = await Product.find({});
//           }
//         if (categoryFilter) {
//             products = await Product.find({ category: categoryFilter, isBlocked: false })
//                                     .populate({
//                                         path: 'category',
//                                         match: { isListed: true }
//                                     }).exec();
//         } else {
//             products = await Product.find({ isBlocked: false })
//                                     .populate({
//                                         path: 'category',
//                                         match: { isListed: true }
//                                     }).exec();
//         }

//         // Filter out products with unlisted categories
//         products = products.filter(product => product.category);

//         console.log('Categories:', categories); // Debugging log
//         console.log('Products:', products); // Debugging log

//         return res.render("shop", { products, categories, categoryFilter });
//     } catch (error) {
//         console.log("shop page is not loading", error);
//         res.status(500).send("server error");
//     }
// }
const loadShopPage = async (req, res) => {
    try {
      const filterOutOfStock = req.query.filterOutOfStock === 'true';
      const categoryFilter = req.query.category;
      const sort = req.query.sort;
  
      let sortOption = {};
  
      switch (sort) {
        // case 'popularity':
        //   sortOption = { popularity: -1 }; // Assuming you have a 'popularity' field
        //   break;
        case 'priceAsc':
          sortOption = { salePrice: 1 };
          break;
        case 'priceDesc':
          sortOption = { salePrice: -1 };
          break;
        // case 'averageRatings':
        //   sortOption = { ratings: -1 }; // Assuming you have a 'ratings' field
        //   break;
        // case 'featured':
        //   sortOption = { featured: -1 }; // Assuming you have a 'featured' field
        //   break;
        // case 'newArrivals':
        //   sortOption = { createdOn: -1 }; // Assuming you have a 'createdOn' field
        //   break;
        case 'az':
          sortOption = { productName: 1 };
          break;
        case 'za':
          sortOption = { productName: -1 };
          break;
        default:
          sortOption = {}; // No sorting
      }
  
      let query = { isBlocked: false };
  
      if (filterOutOfStock) {
        query.quantity = { $gt: 0 };
      }
  
      if (categoryFilter) {
        query.category = categoryFilter;
      }
  
      const categories = await Category.find({ isListed: true });
      let products = await Product.find(query)
        .populate({
          path: 'category',
          match: { isListed: true }
        })
        .sort(sortOption)
        .exec();
  
      // Filter out products with unlisted categories
      products = products.filter(product => product.category);
  
      console.log('Categories:', categories); // Debugging log
      console.log('Products:', products); // Debugging log
  
      return res.render("shop", { products, categories, categoryFilter });
    } catch (error) {
      console.log("shop page is not loading", error);
      res.status(500).send("server error");
    }
  };

const loadMainPage= async(req,res)=>{
    try {
        const products = await Product.find({ isBlocked: false }).exec(); // Ensure to fetch only non-blocked products
        res.render('home1', { products });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send('Server Error');
    }
}
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

const signup= async(req,res)=>{
    try {
     const {name,email,phone, password, cPassword}=req.body
     if(password!==cPassword){
         return res.render("signup",{message:"Password do not match"})
     }
 
     const findUser= await User.findOne({email})
     if(findUser){
         return res.render("signup",{message:"User with this email already exists"})
     }
 
     const otp=generateOtp()
 
 
     const emailSend= await sendVerificationEmail(email,otp)
     if(!emailSend){
         return res.json("email-error")
     }
 
     req.session.userOtp=otp
     req.session.userData={name,email,phone,password}
 
     res.render("verify-otp")
     console.log("OTP sent",otp)
    } catch (error) {
     console.error("signup error",error)
     res.render("/pageNotFound")
    }
 }
 

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
                password:passwordHash
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
        res.render('verify-otp', { message: "" });
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
    logout
};