const User = require("../../models/userSchema");

const getCustomers = async (req, res) => {
    try {
        const customers = await User.find({ isAdmin: false });
        res.render("customers", { customers });
    } catch (error) {
        console.error("Error fetching customers:", error);
        res.status(500).send("Server Error");
    }
};

const toggleBlock = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);
        
        if (user) {
            user.isBlocked = !user.isBlocked;
            await user.save();
        }
        
        res.redirect("/admin/customers");
    } catch (error) {
        console.error("Error toggling block status:", error);
        res.status(500).send("Server Error");
    }
};

module.exports = {
    getCustomers,
    toggleBlock
};
