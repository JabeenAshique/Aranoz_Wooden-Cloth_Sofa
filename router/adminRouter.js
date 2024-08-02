const express = require("express");
const router = express.Router();
const adminController = require("../controller/Admin/adminCotroller");
const categoryController = require("../controller/Admin/categoryController");
const productController = require('../controller/Admin/productController');
const customerController = require('../controller/Admin/customerController');
const checkBlocked = require('../middleware/checkBlocked');

//login
router.get("/login", adminController.getAdminLogin);
router.post("/login", adminController.postAdminLogin);

//dashboard
router.get("/dashboard", adminController.getAdminDashboard);

//Category
router.get('/category', categoryController.getCategoryPage);
router.post('/category/add', categoryController.addCategory);
router.post('/category/edit/:id', categoryController.editCategory);
router.post('/category/delete/:id', categoryController.deleteCategory);
router.post('/category/toggle/:id', categoryController.toggleCategoryStatus);
router.get('/category/edit/:id', categoryController.getEditCategory);



// // Product Management Routes
router.get('/product', productController.getProductPage);
router.get('/product/add', productController.getAddEditProductPage);
router.get('/product/edit/:id', productController.getAddEditProductPage);
router.post('/product/add', productController.addProduct);
router.post('/product/edit/:id', productController.editProduct);
router.post('/product/toggle/:id', productController.toggleProductStatus);
router.post('/product/remove-image', productController.removeProductImage);
router.post('/product/upload-image', productController.uploadImage); // Add this line


router.get("/customers", customerController.getCustomers);
router.post("/customers/toggle-block/:id", customerController.toggleBlock)
router.get('/check-block-status', checkBlocked, async (req, res) => {
    if (req.isAuthenticated()) {
        const user = await User.findById(req.user._id);
        if (user && user.isBlocked) {
            return res.json({ blocked: true });
        }
    }
    res.json({ blocked: false });
});


//router.post('/product/upload-image', productController.uploadImage);
// Route to get add/edit product page
// router.get('/product/add', productController.getAddEditProductPage);
// router.get('/product/edit/:id', productController.getAddEditProductPage);

// // Route to add a new product
// router.post('/product/add', productController.addProduct);

// // Route to edit an existing product
// router.post('/product/edit/:id', productController.editProduct);

// // Route to toggle product status
// router.post('/product/toggle-status/:id', productController.toggleProductStatus);

// // Route to remove a product image
// router.post('/product/remove-image', productController.removeProductImage);
// router.post('/product/upload-image', productController.uploadImage);

//customer


module.exports = router;
