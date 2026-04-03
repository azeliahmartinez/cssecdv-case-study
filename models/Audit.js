const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema({
  action: { type: String, required: true },
  user: { type: String, required: true },
  role: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { versionKey: false });

module.exports = mongoose.model('audit', auditSchema);