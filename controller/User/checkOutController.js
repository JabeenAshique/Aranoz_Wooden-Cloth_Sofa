const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');
const Coupon = require('../../models/couponSchema');
const Offer= require("../../models/offerSchema")
const mongoose = require('mongoose');


const calculateDiscounts = async (user, couponCode, req) => {
    let productDiscount = 0;
    let couponDiscount = 0;
    let couponApplied = false;
    let appliedCouponCode = couponCode;

    const currentDate = new Date();

    for (const item of user.cart) {
        const applicableOffers = await Offer.find({
            $or: [
                { category: item.productId.category },
                { product: item.productId._id }
            ],
            startDate: { $lte: currentDate },
            endDate: { $gte: currentDate }
        });

        const maxOffer = Math.max(...applicableOffers.map(offer => offer.offerAmount), 0);
        productDiscount += maxOffer * item.quantity;
        item.appliedOffer = maxOffer;
    }

    if (req.session.coupon) {
        couponDiscount = req.session.coupon.discount;
        couponApplied = true;
        appliedCouponCode = req.session.coupon.name;
    }

    if (appliedCouponCode && !couponApplied) {
        const coupon = await Coupon.findOne({ name: appliedCouponCode });
        if (coupon && currentDate <= coupon.expireOn) {
            const totalPrice = user.cart.reduce((acc, item) => acc + (item.quantity * item.productId.salePrice), 0);
            if (totalPrice >= coupon.minimumPrice) {
                couponDiscount = coupon.offerPrice;
                couponApplied = true;
            } else {
                throw new Error(`Minimum purchase amount should be ₹${coupon.minimumPrice}`);
            }
        } else if (coupon) {
            throw new Error('Coupon has expired.');
        } else {
            throw new Error('Coupon not found.');
        }
    }

    return { productDiscount, couponDiscount, couponApplied, appliedCouponCode };
};

const loadCheckoutPage = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            console.error('Unauthorized: User not logged in');
            return res.status(401).send('Unauthorized: User not logged in');
        }
        const cartCount = req.session.cartCount || 0;
        const wishlistCount = req.session.wishlistCount || 0;
        const userId = req.user._id;
        const { couponCode } = req.body;
        const user = await User.findById(userId).populate('cart.productId');
        const { productDiscount, couponDiscount, couponApplied, appliedCouponCode } = await calculateDiscounts(user, couponCode, req);


        if (!user) {
            console.error('User not found');
            return res.status(404).send('User not found');
        }

         // Calculate wallet balance
         let walletBalance = 0;
         if (user.walletTransactions && user.walletTransactions.length > 0) {
             const lastTransaction = user.walletTransactions[user.walletTransactions.length - 1];
             walletBalance = lastTransaction.walletBalance;
         }
        const addresses = await Address.find({ userId: userId });

        if (!addresses || addresses.length === 0) {
            console.log('No addresses found');
        } else {
            console.log('Addresses found:', addresses);
        }

        // Initialize the necessary variables
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

         finalOffer = productDiscount;

        // Calculate the total price after applying the best offer
        cartTotal = cartItems.reduce((total, item) => {
             return total + (item.quantity * (item.product.salePrice - productDiscount - couponDiscount));
        }, 0);

         // Calculate the total discount
        totalDiscount = originalTotal - cartTotal ;
        console.log(`Total Discount ${totalDiscount}`)

        // Ensure the cart total doesn't go below zero
        cartTotal = Math.max(0, cartTotal);

        // Pass the discount amount to the checkout page along with other details
        res.render('checkOut', { addresses, cartItems, cartTotal, totalDiscount, user,finalOffer,cartCount,wishlistCount,walletBalance  });

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
            discount: discount,
            originalTotal: cartTotal
        };

        res.json({ success: true, discount: discount,newTotal, message: 'Coupon applied successfully' });

    } catch (error) {
        console.error('Error applying coupon:', error);
        return res.status(500).json({ success: false, message: 'An error occurred while applying the coupon' });
    }
};
const removeCoupon = (req, res) => {
    try {
        if (!req.session.coupon) {
            return res.status(400).json({ success: false, message: 'No coupon applied' });
        }

        const originalTotal = req.session.coupon.originalTotal;
        
        // Clear the coupon from the session
        delete req.session.coupon;

        res.json({ success: true, originalTotal, message: 'Coupon removed successfully' });

    } catch (error) {
        console.error('Error removing coupon:', error);
        return res.status(500).json({ success: false, message: 'An error occurred while removing the coupon' });
    }
};

module.exports={
    updateAddress,
    loadCheckoutPage,
    getCartDetails,
    applyCoupon,
    removeCoupon
    
}