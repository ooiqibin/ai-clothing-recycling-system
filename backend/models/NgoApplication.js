const mongoose = require('mongoose');

const ngoApplicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    organisationName: { type: String, required: true, trim: true },
    registrationNumber: { type: String, required: true, trim: true },
    contactPhone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    about: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    rejectionReason: { type: String, trim: true, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    // The donation centre linked on approval.
    centerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DonationCenter',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.NgoApplication ||
  mongoose.model('NgoApplication', ngoApplicationSchema);