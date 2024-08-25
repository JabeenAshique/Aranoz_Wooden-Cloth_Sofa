
const Order = require('../../models/orderSchema');

    exports.getOrders =async  (req, res) => {       
        try {
            const searchQuery = req.query.search || ''; // Get the search query from the URL
            const page = parseInt(req.query.page) || 1; // Get the page number from the URL or default to 1
            const limit = 10; // Number of orders per page
            const skip = (page - 1) * limit; // Calculate the number of documents to skip
    
            // Define search criteria based on the search query
            const searchCriteria = {
                $or: [
                    { orderId: { $regex: searchQuery, $options: 'i' } },
                    { 'userId.name': { $regex: searchQuery, $options: 'i' } }
                ]
            };
    
            // Fetch the total count of orders for pagination
            const totalOrders = await Order.countDocuments(searchCriteria);
    
            // Fetch the orders with search and pagination
            const orders = await Order.find(searchCriteria)
                .populate('userId')
                .skip(skip) // Skip the previous pages' results
                .limit(limit) // Limit the number of results per page
                .lean();
    
            const totalPages = Math.ceil(totalOrders / limit); // Calculate total pages
    
            // Render the order management page with search and pagination data
            res.render('orderManagement', { 
                orders, 
                currentPage: page, 
                totalPages, 
                searchQuery // Pass searchQuery to the template
            });
        } catch (error) {
            console.error('Error fetching orders:', error);
            res.status(500).send('Server error');
        }
        } 
        
        exports.getOrderDetails = async (req, res) => {
            try {
                const orderId = req.params.orderId;
                const order = await Order.findById(orderId)
                                         .populate('userId')
                                         .populate('orderedItems.product')
                                         .populate('address')
                                         .lean();
        
                if (!order) {
                    return res.status(404).send('Order not found');
                }
        
                res.render('customer_OrderDetails', { order });
            } catch (error) {
                console.error('Error fetching order details:', error);
                res.status(500).send('Server error');
            }
        };
        exports.updateOrderStatus = async (req, res) => {
            try {
                const orderId = req.params.orderId;
                const { status } = req.body;
                const order = await Order.findById(orderId);
        
                if (!order) {
                    return res.status(404).send('Order not found');
                }
        
                order.status = status;
                // res.send({ success: true });
                await order.save();
        
                res.redirect(`/admin/order/${orderId}`);
            } catch (error) {
                console.error('Error updating order status:', error);
                res.status(500).send('Server error');
            }
        };
    