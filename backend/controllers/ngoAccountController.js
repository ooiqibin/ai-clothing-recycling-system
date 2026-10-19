const mongoose = require('mongoose');
const User = require('../models/User');
const DonationCenter = require('../models/DonationCenter');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

function shape(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    centre:
      user.centerId && user.centerId.name
        ? { id: user.centerId._id, name: user.centerId.name }
        : null,
  };
}

async function centreExists(id) {
  return mongoose.isValidObjectId(id) && (await DonationCenter.exists({ _id: id }));
}

// GET /api/admin/ngo-accounts
const listNgoAccounts = async (req, res) => {
  try {
    const accounts = await User.find({ role: 'ngo' })
      .select('name email createdAt centerId')
      .populate('centerId', 'name')
      .sort({ createdAt: -1 });

    res.json({ accounts: accounts.map(shape) });
  } catch (error) {
    console.error('listNgoAccounts error:', error.message);
    res.status(500).json({ error: 'Could not load NGO accounts' });
  }
};

// POST /api/admin/ngo-accounts   body: { name, email, password, centerId }
const createNgoAccount = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const centerId = req.body.centerId;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    if (!(await centreExists(centerId))) {
      return res.status(400).json({ error: 'Please choose a donation centre for this account' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const user = await User.create({ name, email, password, role: 'ngo', centerId });
    const saved = await User.findById(user._id).populate('centerId', 'name');

    res.status(201).json({ account: shape(saved) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    console.error('createNgoAccount error:', error.message);
    res.status(500).json({ error: 'Could not create the NGO account' });
  }
};

// PUT /api/admin/ngo-accounts/:id   body: { centerId }
const updateNgoAccount = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid account id' });
    }
    if (!(await centreExists(req.body.centerId))) {
      return res.status(400).json({ error: 'Please choose a valid donation centre' });
    }

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'ngo' },
      { centerId: req.body.centerId },
      { new: true }
    ).populate('centerId', 'name');

    if (!user) {
      return res.status(404).json({ error: 'NGO account not found' });
    }

    res.json({ account: shape(user) });
  } catch (error) {
    console.error('updateNgoAccount error:', error.message);
    res.status(500).json({ error: 'Could not update the NGO account' });
  }
};

// DELETE /api/admin/ngo-accounts/:id  (only ever deletes NGO accounts)
const deleteNgoAccount = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid account id' });
    }

    const user = await User.findOneAndDelete({ _id: req.params.id, role: 'ngo' });

    if (!user) {
      return res.status(404).json({ error: 'NGO account not found' });
    }

    res.json({ message: 'NGO account deleted' });
  } catch (error) {
    console.error('deleteNgoAccount error:', error.message);
    res.status(500).json({ error: 'Could not delete the NGO account' });
  }
};

module.exports = {
  listNgoAccounts,
  createNgoAccount,
  updateNgoAccount,
  deleteNgoAccount,
};