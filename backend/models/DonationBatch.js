const mongoose = require('mongoose');

const donationBatchSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  itemIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassificationResult',
  }],
  verificationCode: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['awaiting_verification', 'verified'],
    default: 'awaiting_verification',
  },
  totalPoints: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  verifiedAt: {
    type: Date,
  },
});

module.exports = mongoose.model('DonationBatch', donationBatchSchema);