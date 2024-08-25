const mongoose = require("mongoose");
const { Schema } = mongoose;

const offerSchema = new Schema({
  name: {
    type: String,
    required: true,
      },
  offerType: {
    type: String,
    required: true,
    enum: ['referral', 'product', 'category'],
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  referrerAmount: {  // Amount for the user who refers
    type: Number,
    required: function() { return this.offerType === 'referral'; },
  },
  referredAmount: {  // Amount for the user who is referred
    type: Number,
    required: function() { return this.offerType === 'referral'; },
  },
  offerAmount: {
    type: Number,
    required: function() { return this.offerType !== 'referral'; },
  },
  description: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    required: true,
  },
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: function() { return this.offerType === 'product'; }
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: function() { return this.offerType === 'category'; }
  },
  createdOn: {
    type: Date,
    default: Date.now,
  }
});

const Offer = mongoose.model("Offer", offerSchema);
module.exports = Offer;
