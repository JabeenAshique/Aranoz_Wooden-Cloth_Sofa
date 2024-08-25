
const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');
const mongoose = require('mongoose');
const Offer= require('../../models/offerSchema')
const bcrypt = require('bcrypt');




// const loadAccountPage = (req, res) => {

//     res.render('profile/myAccount');
// };

const loadProfilePage = async (req, res) => {
   
    console.log('Session Data:', req.session); // Log session data
    console.log('User Data:', req.user); // Log user data

    try {
        if (!req.user || !req.user._id) {
            return res.status(401).send('Unauthorized: User not logged in');
        }

        const userId = req.user._id;
        const currentDate = new Date();
        console.log(currentDate)

        console.log('User ID:', userId); // Log user ID

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).send('Invalid User ID');
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).send('User not found');
        }

        // Fetch the addresses for the user
        const addresses = await Address.find({ userId });
        
         // Check for active referral offers in the Offer schema
        const activeReferralOffer = await Offer.findOne({
            offerType: 'referral',
            startDate: { $lte: currentDate },
            endDate: { $gte: currentDate }
        });

        // Determine if the referral code should be shown
        const showReferralCode = activeReferralOffer && user.referralCode;

        console.log('User found:', user); // Log user data
        console.log('Addresses found:', addresses); // Log address data
        console.log('Show Referral Code:', showReferralCode); // Log the decision on showing the referral code

        res.render('profile', { user, addresses, showReferralCode });
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).send('Server Error');
    }
  
};




const loadUpdateProfilePage=async(req,res)=>{
    try{
        const userId = req.user._id;
        const user = await User.findById(userId);
        // Fetch the addresses for the user
        const addresses = await Address.find({ userId });
        res.render("updateProfile",{user,addresses})
    }
    catch(error){
        console.error("Error fetching user details ")
        ers.status(500).send('Server Error')
    }
}
const updateUserProfile = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const updatedData = {
            name: req.body.name,
            email: req.body.email,
            phone: req.body.phone,
            password: req.body.password ? req.body.password : undefined, // Only update password if provided
        };
        await User.findByIdAndUpdate(userId, updatedData, { new: true });
        res.redirect('/profile');
    } catch (error) {
        console.error('Error updating user details:', error);
        res.status(500).send('Server Error');
    }
};

const loadgetAddressPage = async(req,res)=>{
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).send('Unauthorized: User not logged in');
        }
        const userId = req.user._id;
        // const userId = req.session.user._id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).send('Invalid User ID');
        }

        const addresses = await Address.find({  userId });

        res.render('getAddress', { addresses });
    } catch (error) {
        console.error('Error fetching addresses:', error);
        res.status(500).send('Server Error');
    }
};
const loadAddAddressPage = async(req,res)=>{
    try{
        res.render("addAddress")
    
    }
    catch(error){
        console.error("Error fetching data")
    }
}
const saveAddress = async (req, res) => {
    try {
        const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;
        const userId = req.user._id; // Assuming you have the user ID stored in session

        const newAddress = new Address({
            userId,
            addressType,
            name,
            city,
            landMark,
            state,
            pincode,
            phone,
            altPhone
        });

        await newAddress.save();
        return res.redirect('/getAddress?success=Address added successfully');
    } catch (error) {
        console.log('Error saving address:', error);
        return res.redirect('/getAddress?error=An error occurred while saving the address');
    }
   
//     const redirectUrl = req.query.redirect || '/getAddress';
//     return res.redirect(`${redirectUrl}?success=Address added successfully`);
// } catch (error) {
//     console.log('Error saving address:', error);

//     const redirectUrl = req.query.redirect || '/getAddress';
//     return res.redirect(`${redirectUrl}?error=An error occurred while saving the address`);
// }
};

const loadEditAddressPage = async (req, res) => {
    try {
        const addressId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            req.flash('error', 'Invalid Address ID');
            return res.redirect('/profile');
        }

        const address = await Address.findById(addressId);

        if (!address) {
            req.flash('error', 'Address not found');
            return res.redirect('/profile');
        }

        res.render("editAddress", { address });
    } catch (err) {
        console.error("Failed to load edit address page", err);
        req.flash('error', 'Server error');
        res.redirect('/profile');
    }
};
const updateAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const { addressType, name, landMark, city, state, pincode, phone, altPhone } = req.body;

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            return res.redirect('/getAddress?error=Invalid Address ID');
        }

        const address = await Address.findByIdAndUpdate(
            addressId,
            { addressType, name, landMark, city, state, pincode, phone, altPhone },
            { new: true }
        );

        if (!address) {
            return res.redirect('/getAddress?error=Address not found');
        }

        return res.redirect('/getAddress?success=Address updated successfully');
    } catch (err) {
        console.error("Failed to update address", err);
        return res.redirect('/getAddress?error=Server error');
    }
};

const deleteAddress = async (req, res) => {
    try {
        const addressId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            return res.redirect('/getAddress?error=Invalid Address ID');
        }

        const address = await Address.findByIdAndDelete(addressId);

        if (!address) {
            return res.redirect('/getAddress?error=Address not found');
        }

        return res.redirect('/getAddress?success=Address deleted successfully');
    } catch (err) {
        console.error("Failed to delete address", err);
        return res.redirect('/getAddress?error=Server error');
    }
};


const resetPassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmNewPassword } = req.body;
        const userId = req.session.user._id;

        // Log the request body and user ID for debugging
        console.log('Request body:', req.body);
        console.log('User ID from session:', userId);

        if (newPassword !== confirmNewPassword) {
            console.log('New passwords do not match');
            return res.status(400).json({ success: false, message: 'New passwords do not match' });
        }

        const user = await User.findById(userId);
        if (!user) {
            console.log('User not found');
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        console.log('Stored password hash:', user.password);

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        console.log('Password match result:', isMatch);

        if (!isMatch) {
            console.log('Current password is incorrect');
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        
        // Adding a log to ensure the new password is hashed
        console.log('New hashed password:', hashedPassword);
        
        await user.save();
        
        // Adding a success log
        console.log('Password updated successfully');
        
        res.status(200).json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error resetting password:', error.message);
        console.error(error.stack);
        res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
    }
};
module.exports = { 
    loadProfilePage,
    loadUpdateProfilePage,
    loadgetAddressPage,
    loadAddAddressPage,
    saveAddress,
    updateUserProfile,
    loadEditAddressPage,
    updateAddress,
    deleteAddress,
    resetPassword
};
