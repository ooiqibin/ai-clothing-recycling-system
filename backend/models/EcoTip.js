const mongoose = require('mongoose');

const CATEGORIES = ['Recycling', 'Donation', 'Reuse', 'Care & Repair', 'Shopping', 'General'];

const ecoTipSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    content: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    category: { type: String, enum: CATEGORIES, default: 'General' },
    status: {
      type: String,
      enum: ['pending', 'published', 'rejected'],
      default: 'pending',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByRole: { type: String, enum: ['admin', 'ngo'], required: true },
    rejectionReason: { type: String, trim: true, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

const EcoTip = mongoose.models.EcoTip || mongoose.model('EcoTip', ecoTipSchema);
EcoTip.CATEGORIES = CATEGORIES;

module.exports = EcoTip;