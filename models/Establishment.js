const mongoose = require('mongoose');

// establishment scheme
const establishmentSchema = new mongoose.Schema({
  banner_image: {type: String},
  establishment_name: {type: String},
  establishment_address: {type: String},
  establishment_description: {type: String},
  price_range: {type: String},
  establishment_ratings: {type: Number},
  services_offered: {type: Array},
  establishment_schedule: {type: Array},
  contact_details_FB: {type: String},
  contact_details_IG: {type: String},
  establishment_images: {type: Array},
  establishment_map: {type: String},
  establishment_owner: {type: String}, 
  owner_username: {type: String}
},{ versionKey: false });
  
// establishment model
const establishmentModel = mongoose.model('establishment', establishmentSchema);

module.exports = establishmentModel;

// TO USE IN APP.JS:
// same syntax as modules
// const establishmentModel = require('./model/Establishment')