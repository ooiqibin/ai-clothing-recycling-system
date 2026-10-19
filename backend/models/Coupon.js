const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rewardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward', required: true },
    // Copied from the reward when redeemed, so later edits do not change old coupons.
    rewardTitle: { type: String, required: true },
    partnerName: { type: String, default: '' },
    terms: { type: String, default: '' },
    pointsSpent: { type: Number, required: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    status: { type: String, enum: ['active', 'used', 'cancelled'], default: 'active' },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);