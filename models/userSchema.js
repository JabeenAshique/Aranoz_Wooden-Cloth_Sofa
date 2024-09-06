const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: String,
    required: false,
    sparse: true,
    default: null,
  },
  password: {
    type: String,
    required: function () {
      return !this.googleId;
    },
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true, // Allow sparse index
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  wallet: {
    type: Schema.Types.ObjectId,
  },
  wishlist: [{
    type: Schema.Types.ObjectId,
    ref: "Wishlist",
  }],
  orderHistory: [{
    type: Schema.Types.ObjectId,
    ref: "Order",
  }],
  createdOn: {
    type: Date,
    default: Date.now,
  },
  // walletBalance: {
  //   type: Number,
  //   default: 0,
  // },
  walletTransactions: [{
    date: { type: Date, default: Date.now },
    type: { type: String, enum: ['credit', 'debit','refund'] },
    walletBalance: { type: Number },
    description: { type: String }
    }],
  referralCode: {
    type: String,
    // required : true
  },
  redeemed: {
    type: Boolean,
    default: false,
  },
  redeemedUsers: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    // required : true
  }],
  searchHistory: [
    {
      category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
    
      searchedOn: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  addresses: [{
    type: Schema.Types.ObjectId,
    ref: 'Address',
}],
cart: [
  {
      productId: { type: Schema.Types.ObjectId, ref: 'Product' },
      quantity: { type: Number, required: true, default: 1 }
       }
    ],
wishlist: [{ type: Schema.Types.ObjectId, ref: 'Wishlist' }],
profileImage: { type: String },
 // Add this field
},{
  timestamps:true
},

);


const User = mongoose.model("User", userSchema);
module.exports = User;
