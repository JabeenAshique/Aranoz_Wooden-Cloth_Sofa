const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');
const Coupon = require('../../models/couponSchema');
const Offer= require("../../models/offerSchema")
const mongoose = require('mongoose');

const loadCheckoutPage = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            console.error('Unauthorized: User not logged in');
            return res.status(401).send('Unauthorized: User not logged in');
        }

        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            console.error('Invalid User ID');
            return res.status(400).send('Invalid User ID');
        }

        const user = await User.findById(userId).populate('cart.productId');

        if (!user) {
            console.error('User not found');
            return res.status(404).send('User not found');
        }

        const addresses = await Address.find({ userId: userId });

        if (!addresses || addresses.length === 0) {
            console.log('No addresses found');
        } else {
            console.log('Addresses found:', addresses);
        }

        // Initialize the totals and discounts
        let originalTotal = 0;
        let cartTotal = 0;
        let totalDiscount = 0;
        let finalOffer = 0;

        // Make sure the products are fully populated
        const cartItems = user.cart.map(item => {
            if (!item.productId) {
                console.error(`Product not found for cart item: ${item._id}`);
                return null; // Handle the case where product is not found
            }
            originalTotal += item.quantity * item.productId.salePrice;
            
            return {
                product: item.productId,
                quantity: item.quantity,
                total: item.quantity * item.productId.salePrice
            };
        }).filter(item => item !== null); // Filter out any null items

        // Calculate total discount
        for (const item of cartItems) {
            const currentDate = new Date();

            const applicableOffers = await Offer.find({
                $or: [
                    { category: item.product.category },
                    { product: item.product._id }
                ],
                startDate: { $lte: currentDate },
                endDate: { $gte: currentDate }
            });

            let maxCategoryOffer = 0;
            let maxProductOffer = 0;

            applicableOffers.forEach(offer => {
                if (offer.category && offer.category.toString() === item.product.category.toString()) {
                    if (offer.offerAmount > maxCategoryOffer) {
                        maxCategoryOffer = offer.offerAmount;
                    }
                } else if (offer.product && offer.product.toString() === item.product._id.toString()) {
                    if (offer.offerAmount > maxProductOffer) {
                        maxProductOffer = offer.offerAmount;
                    }
                }
            });

            const bestOfferForItem = Math.max(maxCategoryOffer, maxProductOffer);
            finalOffer += bestOfferForItem * item.quantity;

            // Calculate the total price after applying the best offer
            cartTotal += (item.quantity * (item.product.salePrice - bestOfferForItem));
        }

        // Calculate the total discount
        totalDiscount = originalTotal - cartTotal;

        // Ensure the cart total doesn't go below zero
        cartTotal = Math.max(0, cartTotal);

        console.log('Cart Items:', cartItems);
        console.log('Cart Total:', cartTotal);
        console.log('Total Discount:', totalDiscount);

        // Pass the discount amount to the checkout page along with other details
        res.render('checkOut', { addresses, cartItems, cartTotal, totalDiscount, user });

    } catch (error) {
        console.error('Error loading checkout page:', error);
        res.status(500).send('Server Error');
    }
};
//updating address from check out page
const updateAddress = async (req, res) => {
    try {
        
        const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;
        const addressId = req.params.id;

        const updatedAddress = await Address.findByIdAndUpdate(addressId, {
            addressType, name, city, landMark, state, pincode, phone, altPhone
        }, { new: true });

        if (!updatedAddress) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        return res.json({ success: true, message: 'Address updated successfully', updatedAddress });
    } catch (error) {
        console.error('Error updating address:', error);
        return res.status(500).json({ success: false, message: 'An error occurred while updating the address' });
    }
};

const getCartDetails = async (req, res) => {
    try {
      const userId = req.user._id; // Adjust this based on your authentication logic
      const cart = await Cart.findOne({ userId }).populate('items.productId'); // Assuming you have a Cart model with userId and items array
  
      if (!cart) {
        return res.status(404).json({ success: false, message: 'Cart not found' });
      }
  
      res.render('cart', { cart: cart.items });
    } catch (error) {
      console.error('Error fetching cart details:', error);
      res.status(500).json({ success: false, message: 'An error occurred while fetching cart details' });
    }
  };

  const applyCoupon = async (req, res) => {
    try {
        const { couponCode, cartTotal } = req.body;

        // Fetch the coupon from the database
        const coupon = await Coupon.findOne({ name: couponCode });

        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        // Check if the coupon is expired
        const currentDate = new Date();
        if (currentDate > coupon.expireOn) {
            return res.status(400).json({ success: false, message: 'Coupon has expired' });
        }

        // Check if the cart total meets the minimum price requirement
        if (cartTotal < coupon.minimumPrice) {
            return res.status(400).json({ success: false, message: `Minimum purchase amount should be ₹${coupon.minimumPrice}` });
        }

        // // Calculate the new total after applying the coupon
        // const discount = coupon.offerPrice;
        // const newTotal = cartTotal - discount;

        // return res.json({ success: true, newTotal, discount });
        // Calculate the discount
        const discount = coupon.offerPrice;
        const newTotal = cartTotal - discount;

        // Store coupon information in the session
        req.session.coupon = {
            name: coupon.name,
            discount: discount
        };

        res.json({ success: true, discount: discount,newTotal, message: 'Coupon applied successfully' });

    } catch (error) {
        console.error('Error applying coupon:', error);
        return res.status(500).json({ success: false, message: 'An error occurred while applying the coupon' });
    }
};
module.exports={
    updateAddress,
    loadCheckoutPage,
    getCartDetails,
    applyCoupon
    
}