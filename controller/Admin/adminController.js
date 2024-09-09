

const User = require("../../models/categorySchema");
const Product = require('../../models/productSchema');
const Category=require ('../../models/categorySchema') 
const Order = require('../../models/orderSchema');
const moment = require('moment');
const { name } = require("ejs");

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
// exports.getAdminDashboard = async (req, res) => {
//     try {
//         // Fetch best-selling products for the dashboard
//         const bestSellingProducts = await Product.find().sort({ productName: -1 }).limit(10);
//         const bestsellingCategory=await category.find().sort({name:-1}).limit(10)
//         // Render the dashboard with the bestSellingProducts data
//         res.render('dashboard', { bestSellingProducts,bestsellingCategory });
//     } catch (error) {
//         console.error(error);
//         res.status(500).send('Server Error');
//     }
// };// Render admin dashboard
// Render admin dashboard
// Admin Dashboard Sales API for different time periods
async function getSalesStatistics(SalestimePeriod) {
    let groupId;
    
    if (SalestimePeriod === "yearly") {
        groupId = { $year: "$createdOn" };  // Group by year
    } else if (SalestimePeriod === "monthly") {
        groupId = { $month: "$createdOn" };  // Group by month
    } else if (SalestimePeriod === "weekly") {
        groupId = { $isoWeek: "$createdOn" };  // Group by ISO week
    }

    const sales = await Order.aggregate([
        {
            $group: {
                _id: groupId,  // Group by the chosen time period
                totalSales: { $sum: "$finalAmount" }  // Sum total sales
            }
        },
        { $sort: { _id: 1 } }
    ]);

    return sales;
}
async function getUsersData(SalestimePeriod) {
    let groupId;
    let totalWeeks = 12; // Default array length for monthly

    if (SalestimePeriod === "yearly") {
        groupId = { $year: "$createdOn" };  // Group by year
    } else if (SalestimePeriod === "monthly") {
        groupId = { $month: "$createdOn" };  // Group by month
    } else if (SalestimePeriod === "weekly") {
        groupId = { $isoWeek: "$createdOn" };  // Group by week
        totalWeeks = 52; // Weekly, so we'll use 52 weeks in our array
    }

    const users = await Order.aggregate([
        {
            $group: {
                _id: groupId,  // Group by the selected period (year, month, or week)
                uniqueUsers: { $addToSet: "$userId" }  // Add unique users who placed orders in that period
            }
        },
        {
            $project: {
                _id: 1,
                userCount: { $size: "$uniqueUsers" }  // Count the unique users
            }
        },
        {
            $sort: { _id: 1 }
        }
    ]);

    const usersData = Array(totalWeeks).fill(0);  // Initialize an array for 12 months or 52 weeks

    users.forEach(user => {
        usersData[user._id - 1] = user.userCount;  // Populate the array with user counts
    });

    return usersData;  // Return the data as an array for the chart
}

async function getProductsData(SalestimePeriod) {
    let groupId;
    
    if (SalestimePeriod === "yearly") {
        groupId = { $year: "$createdOn" };  // Group by year
    } else if (SalestimePeriod === "monthly") {
        groupId = { $month: "$createdOn" };  // Group by month
    } else if (SalestimePeriod === "weekly") {
        groupId = { $isoWeek: "$createdOn" };  // Group by ISO week
    }

    const products = await Order.aggregate([
        { $unwind: "$orderedItems" },  // Unwind the orderedItems array
        {
            $group: {
                _id: { $month: "$createdOn" },  // Group by month
                totalProducts: { $sum: "$orderedItems.quantity" }  // Sum the quantity of products ordered
            }
        },
        { $sort: { _id: 1 } }
    ]);

    const productsData = Array(12).fill(0);  // Initialize an array with 12 months of zeroes

    products.forEach(product => {
        productsData[product._id - 1] = product.totalProducts;  // Populate the corresponding month with total products
    });

    return productsData;  // Return an array of 12 values (product quantity per month)
}
async function getOrdersData(SalestimePeriod) {
    let groupId;
    
    if (SalestimePeriod === "yearly") {
        groupId = { $year: "$createdOn" };  // Group by year
    } else if (SalestimePeriod === "monthly") {
        groupId = { $month: "$createdOn" };  // Group by month
    } else if (SalestimePeriod === "weekly") {
        groupId = { $isoWeek: "$createdOn" };  // Group by ISO week
    }

    const orders = await Order.aggregate([
        {
            $group: {
                _id: { $month: "$createdOn" },  // Group by month
                totalOrders: { $sum: 1 }  // Count the number of orders
            }
        },
        { $sort: { _id: 1 } }
    ]);

    const ordersData = Array(12).fill(0);  // Initialize an array with 12 months of zeroes

    orders.forEach(order => {
        ordersData[order._id - 1] = order.totalOrders;  // Populate the corresponding month with total orders
    });

    return ordersData;  // Return an array of 12 values (order count per month)
}
// async function getRevenueByCategory() {
//     const revenue = await Order.aggregate([
//         { $unwind: "$orderedItems" },  // Unwind the orderedItems array
//         {
//             $lookup: {
//                 from: "products",  // Join with the Product collection
//                 localField: "orderedItems.product",
//                 foreignField: "_id",
//                 as: "productDetails"
//             }
//         },
//         { $unwind: "$productDetails" },  // Unwind the productDetails array
//         {
//             $group: {
//                 _id: "$productDetails.category",  // Group by product category
//                 totalRevenue: { $sum: "$orderedItems.price" }  // Sum the price
//             }
//         }
//     ]);

//     return revenue.map(r => ({ category: r._id, totalRevenue: r.totalRevenue }));  // Return revenue by category
// }
async function getProductsSoldByPeriod(timePeriod) {
    let groupId;
    
    // Determine the grouping based on the selected time period
    if (timePeriod === "yearly") {
        groupId = { $year: "$createdOn" };  // Group by year
    } else if (timePeriod === "monthly") {
        groupId = { $month: "$createdOn" };  // Group by month
    } else if (timePeriod === "weekly") {
        groupId = { $isoWeek: "$createdOn" };  // Group by ISO week
    }

    const productsSold = await Order.aggregate([
        { $unwind: "$orderedItems" },  // Unwind the orderedItems array
        {
            $group: {
                _id: groupId,  // Group by the chosen time period (year, month, or week)
                totalProductsSold: { $sum: "$orderedItems.quantity" }  // Sum the quantity of products sold
            }
        },
        { $sort: { _id: 1 } }  // Sort by period (ascending)
    ]);

    return productsSold;
}

exports.getAdminDashboard = async (req, res) => {
    try {

        const SalestimePeriod = req.query.salesTimePeriod || 'monthly';
        //const salesPerMonth = await getSalesPerMonth();
        const usersData = await getUsersData(SalestimePeriod);
        const productsData = await getProductsData(SalestimePeriod);
        const ordersData = await getOrdersData(SalestimePeriod);
        const timePeriod = req.query.timePeriod || 'monthly'; // Get timePeriod from query, default to monthly
        //const SalestimePeriod = req.query.salesTimePeriod || 'monthly';  // Default to 'monthly' if no time period selected
        const salesStatistics = await getSalesStatistics(SalestimePeriod);

        const productsSoldByPeriod = await getProductsSoldByPeriod(timePeriod);
        // Top 10 Best Selling Products
        const topSellingProducts = await Order.aggregate([
            { $unwind: "$orderedItems" },
            { $group: {
                _id: "$orderedItems.product",
                totalSold: { $sum: "$orderedItems.quantity" }
            }},
            { $sort: { totalSold: -1 } },
            { $limit: 10 }
        ]).exec();
        const products = await Product.find({ _id: { $in: topSellingProducts.map(p => p._id) } });

        // Top 10 Best Selling Categories
        const topSellingCategories = await Order.aggregate([
            { $unwind: "$orderedItems" },
            { $lookup: { from: "products", localField: "orderedItems.product", foreignField: "_id", as: "productDetails" }},
            { $unwind: "$productDetails" },
            { $group: {
                _id: "$productDetails.category",
                totalSold: { $sum: "$orderedItems.quantity" }
            }},
            { $sort: { totalSold: -1 } },
            { $limit: 10 }
        ]).exec();
        const categories = await Category.find(
            { _id: { $in: topSellingCategories.map(c => c._id) }}, 
            { name: 1, _id: 1 } // Project only the name field and _id
        );

        // Summary Stats
        const totalCustomers = await User.countDocuments();
        const totalOrders = await Order.countDocuments();
        const totalProducts = await Product.countDocuments();
        const totalTransaction = await Order.aggregate([
            { $group: { _id: null, total: { $sum: "$finalAmount" } } }
        ]).exec();

        res.render('dashboard', {
            products,
            topSellingCategories,
            totalCustomers,
            totalOrders,
            totalProducts,
            totalTransaction: totalTransaction[0]?.total || 0,
            topSellingProducts,
            
            categories,
            salesData: JSON.stringify(salesStatistics),  // Sales data
            usersData: JSON.stringify(usersData),        // Users data
            productsData: JSON.stringify(productsData),  // Products data
            ordersData: JSON.stringify(ordersData),      // Orders data
            productsSoldByPeriod: JSON.stringify(productsSoldByPeriod),  // Pass the data for the pie chart
            timePeriod: timePeriod, 
            salesTimePeriod:SalestimePeriod 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading dashboard');
    }
}
