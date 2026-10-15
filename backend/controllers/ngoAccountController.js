const mongoose = require('mongoose');
const User = require('../models/User');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

// GET /api/admin/ngo-accounts
const listNgoAccounts = async (req, res) => {
  try {
    const accounts = await User.find({ role: 'ngo' })
      .select('name email createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ accounts });
  } catch (error) {
    console.error('listNgoAccounts error:', error.message);
    res.status(500).json({ error: 'Could not load NGO accounts' });
  }
};

// POST /api/admin/ngo-accounts   body: { name, email, password }
const createNgoAccount = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

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

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const user = await User.create({ name, email, password, role: 'ngo' });

    res.status(201).json({
      account: {
        _id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    console.error('createNgoAccount error:', error.message);
    res.status(500).json({ error: 'Could not create the NGO account' });
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

module.exports = { listNgoAccounts, createNgoAccount, deleteNgoAccount };