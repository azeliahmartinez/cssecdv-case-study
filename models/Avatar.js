const mongoose = require('mongoose');

const avatarSchema = new mongoose.Schema({
  user_icon: {type: String}
},{ versionKey: false });
  
// user model
const avatarModel = mongoose.model('avatar', avatarSchema);

module.exports = avatarModel;

// TO USE IN APP.JS:
// same syntax as modules
// const avatarModel = require('./model/Avatar')