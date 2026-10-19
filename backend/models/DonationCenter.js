const mongoose = require('mongoose');

const donationCenterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true, default: '' },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    phone: { type: String, trim: true, default: '' },
    openingHours: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    region: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.DonationCenter ||
  mongoose.model('DonationCenter', donationCenterSchema);