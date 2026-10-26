const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  rewardPoints: {
    type: Number,
    default: 0,
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'ngo', 'ngo_pending'],
    default: 'user',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },

  // For NGO staff: the donation centre their account belongs to.
  centerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DonationCenter',
    default: null,
  },

  // Admins can suspend an account; a suspended user cannot log in or use the app.
  suspended: {
    type: Boolean,
    default: false,
  },
  suspendedReason: {
    type: String,
    default: '',
  },
  suspendedAt: {
    type: Date,
    default: null,
  },

  // Self-registered accounts must verify their email before they can log in.
  // This defaults to true, so existing accounts and accounts made by an admin or a
  // script keep working. The register endpoints set it to false explicitly.
  emailVerified: {
    type: Boolean,
    default: true,
  },
  emailVerification: {
    codeHash: { type: String, default: '' },
    expiresAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: null },
  },

  // Forgot password: a 6-digit code sent by email (only a hash is stored).
  passwordReset: {
    codeHash: { type: String, default: '' },
    expiresAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: null },
  },
  // Logins from before this moment stop working (set when the password is reset).
  passwordChangedAt: {
    type: Date,
    default: null,
  },
});

// Automatically hash the password before saving to the database
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Helper method to check a login password against the stored hash
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);