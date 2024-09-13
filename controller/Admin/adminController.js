

const User = require("../../models/categorySchema");
const Product = require('../../models/productSchema');
const Category=require ('../../models/categorySchema') 
const Order = require('../../models/orderSchema');

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


function fillMissingPeriods(data, timePeriod, fieldName) {
    let filledData = [];
    let length = 12;  // Default is monthly (12 months)

    if (timePeriod === "weekly") {
        length = 52;  // For weekly data, fill up 52 weeks
    } else if (timePeriod === "yearly") {
        length = 10;  // For example, assume last 10 years
    }

    // Fill the array with default values of 0
    for (let i = 1; i <= length; i++) {
        let found = data.find(item => item._id === i);
        if (found) {
            filledData.push(found[fieldName]);  // Use the specific field name
        } else {
            filledData.push(0);  // Fill missing periods with 0
        }
    }

    return filledData;
}

// Get sales statistics by time period
async function getSalesStatistics(SalestimePeriod) {
    let groupId;

    if (SalestimePeriod === "yearly") {
        groupId = { $year: "$createdOn" };
    } else if (SalestimePeriod === "monthly") {
        groupId = { $month: "$createdOn" };
    } else if (SalestimePeriod === "weekly") {
        groupId = { $isoWeek: "$createdOn" };
    }

    const sales = await Order.aggregate([
        {
            $group: {
                _id: groupId,
                totalSales: { $sum: "$finalAmount" }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    return fillMissingPeriods(sales, SalestimePeriod, 'totalSales');
}

// Get users data by time period
async function getUsersData(SalestimePeriod) {
    let groupId;

    if (SalestimePeriod === "yearly") {
        groupId = { $year: "$createdOn" };
    } else if (SalestimePeriod === "monthly") {
        groupId = { $month: "$createdOn" };
    } else if (SalestimePeriod === "weekly") {
        groupId = { $isoWeek: "$createdOn" };
    }

    const users = await Order.aggregate([
        {
            $group: {
                _id: groupId,
                uniqueUsers: { $addToSet: "$userId" }
            }
        },
        {
            $project: {
                _id: 1,
                userCount: { $size: "$uniqueUsers" }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    return fillMissingPeriods(users, SalestimePeriod, 'userCount');
}

// Get products data by time period
async function getProductsData(SalestimePeriod) {
    let groupId;

    if (SalestimePeriod === "yearly") {
        groupId = { $year: "$createdOn" };
    } else if (SalestimePeriod === "monthly") {
        groupId = { $month: "$createdOn" };
    } else if (SalestimePeriod === "weekly") {
        groupId = { $isoWeek: "$createdOn" };
    }

    const products = await Order.aggregate([
        { $unwind: "$orderedItems" },
        {
            $group: {
                _id: groupId,
                totalProducts: { $sum: "$orderedItems.quantity" }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    return fillMissingPeriods(products, SalestimePeriod, 'totalProducts');
}

// Get orders data by time period
async function getOrdersData(SalestimePeriod) {
    let groupId;

    if (SalestimePeriod === "yearly") {
        groupId = { $year: "$createdOn" };
    } else if (SalestimePeriod === "monthly") {
        groupId = { $month: "$createdOn" };
    } else if (SalestimePeriod === "weekly") {
        groupId = { $isoWeek: "$createdOn" };
    }

    const orders = await Order.aggregate([
        {
            $group: {
                _id: groupId,
                totalOrders: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    return fillMissingPeriods(orders, SalestimePeriod, 'totalOrders');
}


async function getProductsSoldByPeriod(timePeriod) {
    let groupId;
    
    // Determine the grouping based on the selected time period
    if (timePeriod === "yearly") {
        groupId = { $year: "$createdOn" };  
    } else if (timePeriod === "monthly") {
        groupId = { $month: "$createdOn" };  
    } else if (timePeriod === "weekly") {
        groupId = { $isoWeek: "$createdOn" };  
    }

    const productsSold = await Order.aggregate([
        { $unwind: "$orderedItems" },  
        {
            $group: {
                _id: groupId,  
                totalProductsSold: { $sum: "$orderedItems.quantity" }  
            }
        },
        { $sort: { _id: 1 } }  
    ]);

    return productsSold;
}

exports.getAdminDashboard = async (req, res) => {
    try {
        const SalestimePeriod = req.query.salesTimePeriod || 'monthly';
        const usersData = await getUsersData(SalestimePeriod);
        const productsData = await getProductsData(SalestimePeriod);
        const ordersData = await getOrdersData(SalestimePeriod);
        const timePeriod = req.query.timePeriod || 'monthly'; 
        const salesStatistics = await getSalesStatistics(SalestimePeriod);
        const productsSoldByPeriod = await getProductsSoldByPeriod(timePeriod);
        console.log("Products Sold By Period:", productsSoldByPeriod);

// Log the actual data
console.log('Sales Data:', salesStatistics);
console.log('Users Data:', usersData);
console.log('Products Data:', productsData);
console.log('Orders Data:', ordersData);

        
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
        res.render('dashboard', {
            products,
            topSellingCategories,
            totalCustomers,
            totalOrders,
            totalProducts,
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
