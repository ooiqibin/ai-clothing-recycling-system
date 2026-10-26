const mongoose = require('mongoose');

const storedImageSchema = new mongoose.Schema({
  filename: { type: String, required: true, unique: true },
  contentType: { type: String, default: 'image/jpeg' },
  data: { type: Buffer, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.StoredImage || mongoose.model('StoredImage', storedImageSchema);