const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema({
  action: { type: String, required: true },
  user: { type: String, required: true },
  role: { type: String, required: true },
  status: { type: String, default: 'success' },
  category: { type: String, default: 'general' },
  details: { type: String, default: '' },
  target: { type: String, default: '' },
  ipAddress: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
}, { versionKey: false });

module.exports = mongoose.model('audit', auditSchema);
