const mongoose = require('mongoose');

// review schema
const reviewSchema = new mongoose.Schema({
  user_photo: {type: String},
  display_name: {type: String},
  username: {type: String},
  rating: {type: Number},
  review_photo: {type: String},
  review_title: {type: String},
  place_name: {type: String},
  caption: {type: String},
  date_posted: {type: Date},
  comments: [{
    user_icon: { type: String },
    username: { type: String },
    comment: { type: String },
  }]
},{ versionKey: false });
  
// review model
const reviewModel = mongoose.model('review', reviewSchema);

module.exports = reviewModel;

// TO USE IN APP.JS:
// same syntax as modules
// const reviewModel = require('./model/Review')