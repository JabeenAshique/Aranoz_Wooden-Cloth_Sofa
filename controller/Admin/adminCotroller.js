

const User = require("../../models/categorySchema");

// Render admin login page
exports.getAdminLogin = (req, res) => {
    res.render("login", { message:null });
};

// Handle admin login form submission
exports.postAdminLogin = (req, res) => {
    const { email, password } = req.body;

    if (email === "admin@gmail.com" && password === "admin123") {
        req.session.admin = true;
        res.redirect("/admin/dashboard");
    } else {
        res.render("login", { message: "Invalid credentials" });
    }
};

// Render admin dashboard
exports.getAdminDashboard = (req, res) => {
    if (req.session.admin) {
        res.render("dashboard");
    } else {
        res.redirect("/admin/login");
    }
};
