const Offer = require('../../models/offerSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const mongoose = require('mongoose');

const loadOfferForm = async (req, res) => {
    try {
        // Fetch categories and products
        const categories = await Category.find({});
        const products = await Product.find({});

        const page = parseInt(req.query.page) || 1; // Get the page number from the URL or default to 1
        const limit = 5; // Number of offers per page
        const skip = (page - 1) * limit; // Calculate the number of documents to skip

        const searchQuery = req.query.search || ''; // Get the search query from the URL

        // Define search criteria based on the search query
        const searchCriteria = {
            name: { $regex: searchQuery, $options: 'i' } // Case-insensitive search by offer name
        };

        // Fetch the total count of offers for pagination
        const totalOffers = await Offer.countDocuments(searchCriteria);

        // Fetch the offers with pagination
        const offers = await Offer.find(searchCriteria)
            .populate('category')
            .populate('product')
            .skip(skip) // Skip the previous pages' results
            .limit(limit); // Limit the number of results per page

        // Determine if each offer is active based on the current date
        offers.forEach(offer => {
            offer.isActive = offer.startDate <= new Date() && offer.endDate >= new Date();
        });

        const totalPages = Math.ceil(totalOffers / limit); // Calculate total pages

        // Render the form with the fetched data
        res.render('offer', { 
            categories, 
            products, 
            offers, 
            currentPage: page, 
            totalPages, 
            searchQuery // Pass searchQuery to the template
        });
    } catch (error) {
        console.error('Error fetching categories, products, or offers:', error);
        res.status(500).send('Server error');
    }
};

const createOffer = async (req, res) => {
    try {
        const offerData = req.body;

        // Validate ObjectId for category and product
        if (offerData.category && !mongoose.Types.ObjectId.isValid(offerData.category)) {
            return res.status(400).json({ success: false, message: 'Invalid category ID' });
        }
        if (offerData.product && !mongoose.Types.ObjectId.isValid(offerData.product)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }
        const isActive = offerData.startDate <= new Date() && offerData.endDate >= new Date();
        // Create a new Offer based on the submitted data
        const newOffer = new Offer({
            name: offerData.name,
            offerType: offerData.offerType,
            description: offerData.description,
            category: offerData.category || null,
            product: offerData.product || null,
            referredAmount: offerData.referredAmount || null,
            referrerAmount: offerData.referrerAmount || null,
            offerAmount: offerData.offerAmount || null,
            startDate: offerData.startTime,  
            endDate: offerData.endTime,
            isActive
        });

        // Save the offer to the database
        await newOffer.save();

        res.status(201).json({ success: true, message: 'Offer created successfully' });
    } catch (error) {
        console.error('Error creating offer:', error);
        res.status(500).json({ success: false, message: 'Failed to create offer' });
    }
};
// Function to update an offer
const updateOffer =async function updateOffer(req, res) {
    try {
        const offerId = req.params.id;
        const updatedOffer = await Offer.findByIdAndUpdate(offerId, req.body, { new: true });
        if (!updatedOffer) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }
        res.json({ success: true, message: 'Offer updated successfully', data: updatedOffer });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update offer', error });
    }
}
const editloadOffer = async (req, res) => {
    try {
        const offer = await Offer.findById(req.params.id);
        if (!offer) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }
        res.json({ success: true, data: offer });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
  };

  const deleteOffer = async (req, res) => {
    try {
        const offerId = req.params.id;

        // Find and delete the offer by its ID
        const deletedOffer = await Offer.findByIdAndDelete(offerId);

        if (!deletedOffer) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }

        res.json({ success: true, message: 'Offer deleted successfully' });
    } catch (error) {
        console.error('Error deleting offer:', error);
        res.status(500).json({ success: false, message: 'Failed to delete offer' });
    }
};

module.exports = {
  loadOfferForm,
  createOffer,
  updateOffer,
  editloadOffer,
  deleteOffer
};
