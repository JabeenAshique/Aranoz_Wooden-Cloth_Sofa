const mongoose = require("mongoose");
const {Schema} = mongoose;

const productSchema = new Schema({
    productName : {
        type : String,
        required : true,
    },
    description : {
        type : String,
        required : true

    },
    // author: {
    //     type : String,
        
    // },
    category : {
        type : Schema.Types.ObjectId,
        ref : "Category",
        required : true
    },
    regularPrice : {
        type : Number,
        required : true
    },
    salePrice : {
        type : Number,
        required : true
    },
    productOffer : {
        type : Number,
        default : 0
    },
    quantity: {
        type : Number,
        required : true
    },
    
    productImage : {
        type : [String],
        required : true
    },
    ratings: {
        type: Number,
        default: 0
    },
    isBlocked : {
        type : Boolean,
        default : false
    },
    status : {
        type : String,
        required : false
    },
    createdOn : {
        type : Date,
        default : Date.now
    }
})

const Product = mongoose.model("Product",productSchema);
module.exports = Product;