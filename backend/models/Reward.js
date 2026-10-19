const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, default: '', maxlength: 300 },
    partnerName: { type: String, trim: true, default: '', maxlength: 60 },
    pointsCost: { type: Number, required: true, min: 1 },
    // null = unlimited. Otherwise the number left to redeem.
    stock: { type: Number, default: null, min: 0 },
    // null = no limit per user.
    perUserLimit: { type: Number, default: null, min: 1 },
    validDays: { type: Number, default: 30, min: 1, max: 365 },
    terms: { type: String, trim: true, default: '', maxlength: 500 },
    isActive: { type: Boolean, default: true },
    redeemedCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Reward || mongoose.model('Reward', rewardSchema);