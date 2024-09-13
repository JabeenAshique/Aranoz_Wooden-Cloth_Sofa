const mongoose = require('mongoose');
const {Schema} = mongoose;
const ReviewSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
},
  product: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
},
  rating: { 
    type: Number, 
    required: false, 
    min: 1, 
    max: 5 
},
  review: { 
    type: String, 
    required: false 
},  
  createdAt: {
    type: Date, 
    default: Date.now 
}
});

const Review = mongoose.model('Review', ReviewSchema);

module.exports = Review;