const Order = require('../../models/orderSchema');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Helper function to apply filtering logic
const applyFilter = (period, startDate, endDate) => {
    let filter = {};

    if (startDate && endDate) {
        filter.createdOn = {
            $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
            $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
        };
    } else if (period === 'day') {
        const today = new Date();
        filter.createdOn = {
            $gte: new Date(today.setHours(0, 0, 0, 0)),
            $lte: new Date(today.setHours(23, 59, 59, 999))
        };
    } else if (period === 'week') {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - diffToMonday);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfToday = new Date(today.setHours(23, 59, 59, 999));

        filter.createdOn = {
            $gte: startOfWeek,
            $lte: endOfToday
        };
    } else if (period === 'month') {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        filter.createdOn = {
            $gte: new Date(startOfMonth.setHours(0, 0, 0, 0)),
            $lte: new Date(today.setHours(23, 59, 59, 999))
        };
    }

    return filter;
};

// Helper function to fetch orders
const fetchOrders = async (filter) => {
    return await Order.find(filter).populate({
        path: 'orderedItems.product',
        select: 'productName'
    });
};

// Helper function to calculate summary data
const calculateSummary = (orders) => { let overallSales = 0;
    let overallAmount = 0;
    let overallDiscount = 0;

    const salesDetails = orders.map(order => {
        let totalDiscount = order.discount; // Base discount (this may already include coupon discount)
        
        // Only add the coupon discount if it's not already part of the base discount
        if (!order.discount || order.discount === 0) {
            totalDiscount += order.couponDiscount;
        }

        overallSales += 1;
        overallAmount += order.finalAmount;
        overallDiscount += totalDiscount;
        
        return {
            date: order.createdOn.toDateString(),
            orderId: order.orderId,
            product: order.orderedItems.map(item => item.product.productName).join(', '),
            quantity: order.orderedItems.reduce((acc, item) => acc + item.quantity, 0),
            coupon: order.couponCode || 'N/A',
            discount: totalDiscount,
            total: order.finalAmount
        };
    });

    let discountPercentage = 0;
    if (overallAmount + overallDiscount > 0) {
        discountPercentage = ((overallDiscount / (overallAmount + overallDiscount)) * 100).toFixed(2);
    }

    return { overallSales, overallAmount, discountPercentage, salesDetails };
};

exports.getSalesPage = async (req, res) => {
    try {
        // Assuming you have some logic to fetch these values, if not, set them to defaults
        const salesDetails = []; // or fetch from DB
        const overallSales = 0; // calculate from DB
        const overallAmount = 0; // calculate from DB
        const overallDiscount = 0; // calculate from DB

        // Pass these to the EJS template
        res.render('sales', {
            salesDetails,
            overallSales,
            overallAmount,
            overallDiscount
        });
    } catch (error) {
        console.error('Error rendering sales page:', error);
        res.status(500).send('Server Error');
    }
};

exports.getSalesReport = async (req, res) => {
    try {
        const { period, startDate, endDate } = req.body;

        const filter = applyFilter(period, startDate, endDate);
        const orders = await fetchOrders(filter);
        const { overallSales, overallAmount, discountPercentage, salesDetails } = calculateSummary(orders);

        res.json({
            success: true,
            overallSales,
            overallAmount,
            overallDiscount: discountPercentage,
            salesDetails
        });
    } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(500).json({ success: false, message: 'Error generating sales report' });
    }
};

exports.downloadExcelReport = async (req, res) => {
    try {
        const { period, startDate, endDate } = req.body;

        const filter = applyFilter(period, startDate, endDate);
        const orders = await fetchOrders(filter);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        worksheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Order ID', key: 'orderId', width: 25 },
            { header: 'Product', key: 'product', width: 30 },
            { header: 'Quantity', key: 'quantity', width: 10 },
            { header: 'Coupon', key: 'coupon', width: 20 },
            { header: 'Discount', key: 'discount', width: 15 },
            { header: 'Total', key: 'total', width: 15 },
        ];

        orders.forEach(order => {
            worksheet.addRow({
                date: order.createdOn.toDateString(),
                orderId: order.orderId,
                product: order.orderedItems.map(item => item.product.productName).join(', '),
                quantity: order.orderedItems.reduce((acc, item) => acc + item.quantity, 0),
                coupon: order.couponCode || 'N/A',
                discount: order.discount + order.couponDiscount,
                total: order.finalAmount,
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=sales_report.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating Excel report:', error);
        res.status(500).json({ success: false, message: 'Error generating Excel report' });
    }
};

exports.downloadPdfReport = async (req, res) => {
    try {
        const { period, startDate, endDate } = req.body;

        const filter = applyFilter(period, startDate, endDate);
        const orders = await fetchOrders(filter);

        let totalAmount = 0;
        let totalQuantity = 0;
        const totalCount = orders.length;  

        
        orders.forEach(order => {
            totalAmount += order.finalAmount;
            totalQuantity += order.orderedItems.reduce((acc, item) => acc + item.quantity, 0);
        });


        const doc = new PDFDocument({ size: 'A4', margin: 30 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=sales_report.pdf');

        doc.pipe(res);

        doc.fontSize(18).text('Sales Report', { align: 'center' });
        doc.moveDown(1.5);
        doc.fontSize(10).text(`Period: ${period.charAt(0).toUpperCase() + period.slice(1)}`, { align: 'left' });
        if (startDate && endDate) {
            doc.text(`From: ${startDate} To: ${endDate}`, { align: 'left' });
        }
        doc.moveDown(0.5);

        const columnPositions = {
            date: 40,       
            orderId: 120,    
            product: 240,   
            quantity: 420,   
            coupon: 480,     
            discount: 540,   
            total: 600       
        };
        
        doc.fontSize(9).fillColor('#444444');
        doc.text('Date', columnPositions.date, undefined, { continued: true });
        doc.text('Order ID', columnPositions.orderId, undefined, { continued: true });
        doc.text('Product', columnPositions.product, undefined, { continued: true });
        doc.text('Quantity', columnPositions.quantity, undefined, { continued: true });
        doc.text('Coupon', columnPositions.coupon, undefined, { continued: true });
        doc.text('Discount', columnPositions.discount, undefined, { continued: true });
        doc.text('Total', columnPositions.total);
        doc.moveDown(0.5);
        doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(columnPositions.date, doc.y).lineTo(columnPositions.total + 40, doc.y).stroke();
        doc.moveDown(0.5);

        orders.forEach(order => {
            // Slicing the order ID into two parts for better readability
            const orderIdPart1 = order.orderId.slice(0, order.orderId.length / 2);
            const orderIdPart2 = order.orderId.slice(order.orderId.length / 2);
            
            // Format the order creation date and slice it into two parts
            const orderDate = order.createdOn.toDateString(); // Convert date to string
            const orderDatePart1 = orderDate.slice(0, orderDate.length / 2);
            const orderDatePart2 = orderDate.slice(orderDate.length / 2);
        
            // Concatenate product names into a single string
             // Split the product names into two parts to ensure they fit within the column
            const productNames = order.orderedItems.map(item => {
                const productName = item.product.productName;
                const productNamePart1 = productName.slice(0, productName.length / 2);
                const productNamePart2 = productName.slice(productName.length / 2);
                return `${productNamePart1}\n${productNamePart2}`;
            }).join(',\n'); // Join with comma and newline for each product
        
            // Adding the data to the PDF document
            doc.text(`${orderDatePart1}\n${orderDatePart2}`, columnPositions.date, undefined, { continued: true });
            doc.text(`${orderIdPart1}\n${orderIdPart2}`, columnPositions.orderId, undefined, { continued: true });
            doc.text(`${productNames}`, columnPositions.product, undefined, { continued: true });
            doc.text(order.orderedItems.reduce((acc, item) => acc + item.quantity, 0), columnPositions.quantity, undefined, { continued: true });
            // doc.text(order.couponCode || 'N/A', columnPositions.coupon, undefined, { continued: true });
            doc.text(`₹${order.discount + order.couponDiscount}`, columnPositions.discount, undefined, { continued: true });
            doc.text(`₹${order.finalAmount}`, columnPositions.total);
            doc.moveDown(0.5);
            doc.strokeColor('#aaaaaa').lineWidth(0.5).moveTo(columnPositions.date, doc.y).lineTo(columnPositions.total + 40, doc.y).stroke();
            doc.moveDown(0.5);
        });
         // Adding the total amount, total quantity, and total count at the bottom of the PDF
         doc.moveDown(2);
         doc.fontSize(12).fillColor('#000000').text('Total Orders:', 40, undefined, { continued: true });
         doc.text(totalCount, columnPositions.orderId, undefined, { continued: true });  // Display total count of orders
         doc.text('Total Quantity:', columnPositions.quantity, undefined, { continued: true });
         doc.text(totalQuantity, columnPositions.quantity, undefined, { continued: true });
         doc.text('Total Amount:', 540, undefined, { continued: true });
         doc.text(`₹${totalAmount}`, columnPositions.total);
        doc.end();
    } catch (error) {
        console.error('Error generating PDF report:', error);
        res.status(500).json({ success: false, message: 'Error generating PDF report' });
    }
};
