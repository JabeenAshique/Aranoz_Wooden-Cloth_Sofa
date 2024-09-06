const Address = require('../../models/addressSchema');

const addAddress = async (req, res) => {
    try {
        const address = new Address({
            userId: req.session.user._id,
            ...req.body,
        });
        
        await address.save();
        res.redirect('/updateAddress?success=Address added successfully');
    } catch (error) {
        console.error('Error adding address:', error);
        res.redirect('/updateAddress?error=Error adding address');
    }
};

const getAddress = async (req, res) => {
    try {
        const cartCount = req.session.cartCount || 0;
        const wishlistCount = req.session.wishlistCount || 0;
        const addresses = await Address.find({ userId: req.session.user._id });
        res.render('updateAddress', { addresses, user: req.session.user,cartCount,wishlistCount });
    } catch (error) {
        console.error('Error fetching addresses:', error);
        res.redirect('/updateAddress?error=Error fetching addresses');
    }
};

const deleteAddress = async (req, res) => {
    try {
        await Address.findByIdAndDelete(req.params.id);
        res.redirect('/updateAddress?success=Address deleted successfully');
    } catch (error) {
        console.error('Error deleting address:', error);
        res.redirect('/updateAddress?error=Error deleting address');
    }
};

module.exports = { addAddress, getAddress, deleteAddress };
