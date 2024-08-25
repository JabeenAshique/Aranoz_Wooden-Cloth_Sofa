const express = require('express');
const router = express.Router();
const Coupon = require('../../models/couponSchema'); // Adjust the path to your model if necessary
const mongoose = require('mongoose');

exports.getCouponPage = async (req, res) => {
    try {
        let currentDate = new Date().toLocaleDateString('en-GB'); // format: DD/MM/YYYY
        const searchQuery = req.query.search || ''; // Get the search query from the URL
        const page = parseInt(req.query.page) || 1; // Get the page number from the URL or default to 1
        const limit = 5; // Number of coupons per page

        const searchCriteria = {
            name: { $regex: searchQuery, $options: 'i' } // Case-insensitive search by coupon name
        };
        
        // Get the total count of coupons matching the search criteria
        const totalCoupons = await Coupon.countDocuments(searchCriteria);

        // Fetch the coupons with search and pagination
        const coupons = await Coupon.find(searchCriteria)
            .skip((page - 1) * limit) // Skip the previous pages' results
            .limit(limit); // Limit the number of results per page

        // Update the status of coupons based on the current date
        coupons.forEach(coupon => {
            if (coupon.enddate === currentDate) {
                coupon.isList = "Inactive";
            }
        });
        console.log("Search Query: ", searchQuery);

        // Render the coupon page with search results and pagination data
        res.render('coupon', {
            coupons: coupons,
            currentPage: page,
            totalPages: Math.ceil(totalCoupons / limit),
            searchQuery: searchQuery
        });
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).send('Internal Server Error');
    }
};

exports.CreateCoupon=async (req,res)=>{
    try {
        const { name, expireOn, offerPrice, minimumPrice } = req.body;

        const newCoupon = new Coupon({
            name: name,
            expireOn: expireOn,
            offerPrice: offerPrice,
            minimumPrice: minimumPrice
        });
         // Automatically set the status based on the expiration date
         if (new Date(expireOn) < new Date()) {
            newCoupon.isList = 'Inactive';
        }

        await newCoupon.save();
        console.log(newCoupon)
        res.json({ success: true });
    } catch (error) {
        console.error('Error creating coupon:', error);
        res.json({ success: false, message: error.message });
    }
}
exports.EditCoupon =async (req,res)=>{
    try {
        const coupon = await Coupon.findById(req.params.id); 
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }
        res.json(coupon);
    } catch (error) {
        console.error('Error fetching coupon:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

exports.updateCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;
        const { name, expireOn, offerPrice, minimumPrice } = req.body;

        // Find the coupon by ID and update it
        const updatedCoupon = await Coupon.findByIdAndUpdate(
            couponId,
            {
                name: name,
                expireOn: expireOn,
                offerPrice: offerPrice,
                minimumPrice: minimumPrice
            },
            { new: true } // This option returns the updated document
        );

        if (!updatedCoupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        res.json({ success: true, coupon: updatedCoupon });
    } catch (error) {
        console.error('Error updating coupon:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};



exports.removeCoupon = async (req,res)=>{
    console.log('Reached the remove route');
    console.log('Coupon ID:', req.params.id);
    try {
        const couponId = req.params.id;

        // Validate if couponId is a valid ObjectId if using MongoDB, or ensure it's the correct format
        if (!mongoose.Types.ObjectId.isValid(couponId)) {
            return res.status(400).send('Invalid coupon ID');
        }

        const result = await Coupon.findByIdAndDelete(couponId);

        if (result) {
            res.status(200).send('Coupon removed');
        } else {
            res.status(404).send('Coupon not found');
        }
    } catch (error) {
        console.error('Error removing coupon:', error);
        res.status(500).send('An error occurred while trying to remove the coupon.');
    }
}
