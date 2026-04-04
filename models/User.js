const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  user_icon: { type: String },
  name: { type: String },
  username: { type: String, required: true, unique: true },
  bio: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  userType: {
    type: String,
    enum: ['admin', 'owner', 'rater'],
    default: 'rater',
    required: true
  },
  following: { type: Array, default: [] },
  followers: { type: Array, default: [] },
  favoriteplace: { type: Array, default: [] },
  createdreview: [{
    review_photo: { type: String },
    place_name: { type: String },
    review_title: { type: String },
  }],
rememberMeToken: String,
rememberMeTokenExpires: Date,

//SECURITY FIELDS
loginAttempts: { type: Number, default: 0 },
lockUntil: { type: Date },
passwordHistory: { type: [String], default: [] },
passwordChangedAt: { type: Date }
}, { versionKey: false });

// user model
const userModel = mongoose.model('user', userSchema);

module.exports = userModel;

// TO USE IN APP.JS:
// same syntax as modules
// const userModel = require('./model/User')
