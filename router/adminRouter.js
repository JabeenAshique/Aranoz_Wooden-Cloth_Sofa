const express = require("express");
const router = express.Router();
const adminController = require("../controller/Admin/adminCotroller");
const categoryController = require("../controller/Admin/categoryController");
const productController = require("../controller/Admin/productController");
const customerController = require("../controller/Admin/customerController");
const orderController = require("../controller/Admin/orderController");
const couponController = require("../controller/Admin/couponController");
const OfferController=require("../controller/Admin/offerController");
const salesController=require("../controller/Admin/salesController")
const checkBlocked = require("../middleware/checkBlocked");
const authMiddlewares = require('../middleware/auth'); // Ensure this path is correct
const Coupon = require("../models/couponSchema");


//login
router.get("/login", adminController.getAdminLogin);
router.post("/login", adminController.postAdminLogin);

//dashboard
router.get("/dashboard",authMiddlewares.isAdmin, adminController.getAdminDashboard);

//Category
router.get("/category",authMiddlewares.isAdmin, categoryController.getCategoryPage);
router.post("/category/add", authMiddlewares.isAdmin,categoryController.addCategory);
router.post("/category/edit/:id",authMiddlewares.isAdmin, categoryController.editCategory);
router.post("/category/delete/:id",authMiddlewares.isAdmin, categoryController.deleteCategory);
router.post("/category/toggle/:id", authMiddlewares.isAdmin,categoryController.toggleCategoryStatus);
router.get("/category/edit/:id", authMiddlewares.isAdmin,categoryController.getEditCategory);

// // Product Management Routes
router.get("/product",authMiddlewares.isAdmin, productController.getProductPage);
router.get("/product/add",authMiddlewares.isAdmin, productController.getAddEditProductPage);
router.get("/product/edit/:id", authMiddlewares.isAdmin,productController.getAddEditProductPage);
router.post("/product/add",authMiddlewares.isAdmin, productController.addProduct);
router.post("/product/edit/:id",authMiddlewares.isAdmin, productController.editProduct);
router.post("/product/toggle/:id",authMiddlewares.isAdmin, productController.toggleProductStatus);
router.post("/product/toggle/:id", authMiddlewares.isAdmin,productController.toggleProductStatus);
// router.post("/product/remove-image", productController.removeProductImage);
router.post('/product/:productId/image/:index',authMiddlewares.isAdmin, productController.removeProductImage);
router.post("/product/upload-image",authMiddlewares.isAdmin, productController.uploadImage); // Add this line


//Cutomer
router.get("/customers", authMiddlewares.isAdmin,customerController.getCustomers);
router.post("/customers/toggle-block/:id", customerController.toggleBlock);
router.get("/check-block-status", checkBlocked, async (req, res) => {
  if (req.isAuthenticated()) {
    const user = await User.findById(req.user._id);
    if (user && user.isBlocked) {
      return res.json({ blocked: true });
    }
  }
  res.json({ blocked: false });
});


//Order Management
router.get("/orders",authMiddlewares.isAdmin, orderController.getOrders);
router.get('/order/:orderId',authMiddlewares.isAdmin, orderController.getOrderDetails);
router.post('/order/:orderId/status',authMiddlewares.isAdmin, orderController.updateOrderStatus);

//Coupon Management
router.get("/coupon",authMiddlewares.isAdmin, couponController.getCouponPage);
router.post('/coupon',authMiddlewares.isAdmin,couponController.CreateCoupon);
router.get('/coupon/edit/:id',authMiddlewares.isAdmin,couponController.EditCoupon);
router.put('/coupon/edit/:id',authMiddlewares.isAdmin, couponController.updateCoupon);
router.delete('/coupon/remove/:id',authMiddlewares.isAdmin,couponController.removeCoupon);

// Offer Management
router.get('/offers', authMiddlewares.isAdmin, OfferController.loadOfferForm);
router.post('/offers',authMiddlewares.isAdmin, OfferController.createOffer)
router.put('/offers/:id',authMiddlewares.isAdmin, OfferController.updateOffer);
router.get('/offers/:id', authMiddlewares.isAdmin,OfferController.editloadOffer);
router.delete('/offers/:id', authMiddlewares.isAdmin, OfferController.deleteOffer);

//Sales Management

router.get('/sales',salesController.getSalesPage)
router.post('/generate-sales-report', salesController.getSalesReport);
router.post('/download-excel-report', salesController.downloadExcelReport);
router.post('/download-pdf-report', salesController.downloadPdfReport);


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
