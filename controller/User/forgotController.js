const nodemailer = require('nodemailer');
const User = require('../../models/userSchema');
const bcrypt = require('bcrypt'); // Adjust the path to your User model
// forgotController.js
exports.getemail_verification = (req,res)=>{
    res.render('email_verification', { message: '' });
}
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

exports.send_ResetPasswordOtp = async (req, res) => {
    try {
        const { email } = req.body;
    
        const user = await User.findOne({ email });
        if (!user) {
            return res.render('forgot-password', { message: 'No account found with this email.' });
        }
    
        const otp = generateOtp();
        const emailSend = await sendVerificationEmail(email, otp);
        if (!emailSend) {
            return res.render('forgot-password', { message: 'Failed to send OTP. Please try again.' });
        }
    
        // Store OTP and email in session
        req.session.resetOtp = otp;
        console.log(req.session.resetOtp);
        req.session.resetEmail = email;

        // Debug: Log the generated OTP and session
        console.log("Generated OTP1:", otp);
        console.log("Session after storing OTP1:", req.session);
    
        res.render('forgot-verifyOtp', { email: email, message: '' });
    } catch (error) {
        console.error('Error sending OTP for password reset:', error);
        res.render('forgot-password', { message: 'An error occurred. Please try again.' });
    }
};
exports.forgot_verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const sessionOtp = req.session.resetOtp;

        console.log("Entered OTP1:", otp);  // Debug line
        console.log("Session OTP1:", sessionOtp);  // Debug line

        if (otp === sessionOtp) {
            const email = req.session.resetEmail;
            if (email) {
                // Render the resetPassword page with the email passed as a variable
                res.render('resetPassword', { email: email, message: '' });
            } else {
                // If email is not found in the session, handle the error
                res.render('forgot-verifyOtp', { message: "Session expired or email not found." });
            }
        } else {
            console.log("OTP did not match.");
            res.render('forgot-verifyOtp', { message: "Invalid OTP", email: req.session.resetEmail });
        }
    } catch (error) {
        console.error("OTP verification error:", error);
        res.render('forgot-verifyOtp', { message: "Error verifying OTP", email: req.session.resetEmail });
    }
}

// exports.loadOtpPage = async (req, res) => {
//     try {
//         res.render('verify-otp', { message: "" });
//     } catch (error) {
//         console.log("OTP verification page is not loading", error);
//         res.status(500).send("server.error");
//     }
// };

// exports.loadResetPasswordPage = (req, res) => {
//     const email = req.session.resetEmail;
//     res.render('resetPassword', { email });
// };
exports.resetPassword = async (req, res) => {
    try {
        const { newPassword, confirmNewPassword } = req.body;

        // Check if session contains resetEmail
        if (!req.session.resetEmail) {
            return res.render('email_verification', { message: 'Session expired. Please try the password reset process again.' });
        }

        if (newPassword !== confirmNewPassword) {
            return res.render('resetpassword', { message: 'Passwords do not match', email: req.session.resetEmail });
        }

        const email = req.session.resetEmail;

        // Hash new password and update user
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.updateOne({ email }, { password: hashedPassword });

        // Clear the session data related to password reset
        req.session.resetEmail = null;
        req.session.resetOtp = null;

        res.render('home', { message: 'Password reset successful. You can now log in with your new password.' });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.render('resetpassword', { message: 'An error occurred. Please try again.', email: req.session.resetEmail });
    }

}