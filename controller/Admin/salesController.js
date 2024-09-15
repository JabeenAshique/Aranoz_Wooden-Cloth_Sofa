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

        // Filter the orders based on the provided date range
        const filter = applyFilter(period, startDate, endDate);
        const orders = await fetchOrders(filter);

        let totalAmount = 0;
        let totalQuantity = 0;
        const totalCount = orders.length;

        orders.forEach(order => {
            totalAmount += order.finalAmount;
            totalQuantity += order.orderedItems.reduce((acc, item) => acc + item.quantity, 0);
        });

        // Create a new PDF document
        const doc = new PDFDocument({ size: 'A4', margin: 30 });

        // Set headers for the file download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=sales_report.pdf');

        // Pipe the document to the response
        doc.pipe(res);

        // Add the report title
        doc.fontSize(18).text('Sales Report', { align: 'center' });
        doc.moveDown(1.5);

        // Add company information
        doc.fontSize(10)
            .text('Your Company Name', 40, 50)
            .text('Street Address', 40, 65)
            .text('City, State, ZIP Code', 40, 80)
            .text('Phone Number, Website, Email', 40, 95);

        // Add the report date range and logo area
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 400, 50)
            .text(`From: ${startDate} To: ${endDate}`, 400, 65)
            .text('Company Logo Here', 400, 80, { align: 'right' });

        // Add a separator line
        doc.moveTo(40, 120).lineTo(570, 120).stroke();

        // Define the positions for the columns
        const columnPositions = {
            month: 40,
            date: 100,
            cost: 160,
            invoice: 240,
            salesRep: 320,
            total: 400,
            paid: 480,
            balanceDue: 560
        };

        // Add the table header
        doc.fontSize(10).fillColor('#444444');
        doc.text('Month', columnPositions.month, 130, { continued: true });
        doc.text('Date', columnPositions.date, 130, { continued: true });
        doc.text('Cost', columnPositions.cost, 130, { continued: true });
        doc.text('Invoice #', columnPositions.invoice, 130, { continued: true });
        doc.text('Sales Rep.', columnPositions.salesRep, 130, { continued: true });
        doc.text('Total', columnPositions.total, 130, { continued: true });
        doc.text('Paid', columnPositions.paid, 130, { continued: true });
        doc.text('Balance Due', columnPositions.balanceDue, 130);
        doc.moveDown(0.5);
        doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(40, 145).lineTo(570, 145).stroke();
        doc.moveDown(0.5);

        // Loop through the orders to populate the rows
        orders.forEach(order => {
            const orderMonth = new Date(order.createdOn).toLocaleDateString('en-US', { month: 'numeric', year: 'numeric' });
            const orderDate = new Date(order.createdOn).toLocaleDateString();
            const invoiceNumber = order._id;
            const salesRep = order.salesRep || '---';
            const total = order.totalPrice;
            const paid = order.paidAmount || 0;
            const balanceDue = total - paid;

            doc.text(orderMonth, columnPositions.month, undefined, { continued: true });
            doc.text(orderDate, columnPositions.date, undefined, { continued: true });
            doc.text(`₹${order.finalAmount}`, columnPositions.cost, undefined, { continued: true });
            doc.text(invoiceNumber, columnPositions.invoice, undefined, { continued: true });
            doc.text(salesRep, columnPositions.salesRep, undefined, { continued: true });
            doc.text(`₹${total}`, columnPositions.total, undefined, { continued: true });
            doc.text(`₹${paid}`, columnPositions.paid, undefined, { continued: true });
            doc.text(`₹${balanceDue}`, columnPositions.balanceDue);
            doc.moveDown(0.5);
            doc.strokeColor('#aaaaaa').lineWidth(0.5).moveTo(40, doc.y).lineTo(570, doc.y).stroke();
            doc.moveDown(0.5);
        });

        // Add total summaries at the bottom of the page
        doc.moveDown(2);
        doc.fontSize(12).fillColor('#000000');
        doc.text('Total Orders:', 40, undefined, { continued: true });
        doc.text(totalCount, columnPositions.invoice, undefined, { continued: true });
        doc.text('Total Quantity:', columnPositions.salesRep, undefined, { continued: true });
        doc.text(totalQuantity, columnPositions.totalAmount, undefined, { continued: true });
        doc.text('Total Amount:', columnPositions.paid, undefined, { continued: true });
        doc.text(`₹${totalAmount}`, columnPositions.balanceDue);

        // Finalize the PDF
        doc.end();
    } catch (error) {
        console.error('Error generating PDF report:', error);
        res.status(500).json({ success: false, message: 'Error generating PDF report' });
    }
};
