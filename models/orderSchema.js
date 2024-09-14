const mongoose = require("mongoose");
const {Schema} = mongoose
const { v4: uuidv4 } = require('uuid');


const orderSchema = new Schema({
    orderId:{
        type : String,
        default : ()=>uuidv4(),
        unique : true
    },
    orderedItems : [{
        product : {
            type : Schema.Types.ObjectId,
            ref:"Product",
            required : true
        },
        quantity : {
            type: Number,
            required : true
        },
        price : {
            type : Number,
            default :0
        },
        appliedOffer: { 
            type: Number, 
            default: 0 
        },
        status: {
            type: String,
            enum: ['Ordered', 'Canceled', 'Delivered', 'Returned','Cancelled'], // Individual item status
            default: 'Ordered'
        }
    }],
    couponCode: {
        type: String,
        default: null // Store the coupon code applied
    },
    couponDiscount: {
        type: Number,
        default: 0 // Store the discount amount from the coupon
    },
    totalPrice : {
        type : Number,
        required : true
    },
    discount : {
        type : Number,
        default : 0
    },
    finalAmount : {
        type : Number,
        required : true
    },
    address: {
        type : Schema.Types.ObjectId,
        ref:"Address",
        required : true
    },
    payment : {
        type : String,
        required : true
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Success', 'Failed'], 
        default: 'Pending'
      },
    razorpayOrderId: { 
        type: String
    },
    razorpayPaymentId: { 
    type: String 
    },
    userId :{
        type : Schema.Types.ObjectId,
        ref:'User',
        required : true
    },
    invoiceDate : {
        type : Date
    },
    status : {
        type : String,
        required : true

    },
    createdOn : {
        type : Date,
        default : Date.now,
        required : true
    },
    couponApplied : {
        type : Boolean,
        default : false
    }
})


const Order = mongoose.model("Order",orderSchema);
 
module.exports = Order;