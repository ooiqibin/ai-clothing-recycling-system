const mongoose = require('mongoose');

const classificationResultSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, enum: ['reusable', 'recyclable', 'damaged'], required: true },
  confidence: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'self_use', 'awaiting_verification', 'donated', 'recycled', 'disposed'],
    default: 'pending',
  },
  potentialPoints: { type: Number, default: 0 },
  pointsAwarded: { type: Number, default: 0 },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'DonationBatch', default: null },
  recycleProofFilename: { type: String },
  imageFilename: { type: String },
  imageHash: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ClassificationResult', classificationResultSchema);