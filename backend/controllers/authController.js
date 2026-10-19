const jwt = require('jsonwebtoken');
const User = require('../models/User');
const NgoApplication = require('../models/NgoApplication');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Helper to create a signed login token for a given user
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// The user details we send back to the app and the dashboard
const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  rewardPoints: user.rewardPoints,
  role: user.role || 'user',
});

// POST /api/auth/register
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const user = await User.create({ name, email, password });

    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: publicUser(user),
    });

  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ error: 'Registration failed' });
  }
};

// POST /api/auth/register-ngo
// An NGO signs up and waits for an admin to approve the application.
const registerNgo = async (req, res) => {
  try {
    const clean = (value) => String(value || '').trim();

    const name = clean(req.body.name);
    const email = clean(req.body.email).toLowerCase();
    const password = String(req.body.password || '');
    const organisationName = clean(req.body.organisationName);
    const registrationNumber = clean(req.body.registrationNumber);
    const contactPhone = clean(req.body.contactPhone);
    const address = clean(req.body.address);
    const about = clean(req.body.about);

    if (!name || !email || !password || !organisationName || !registrationNumber || !contactPhone || !address) {
      return res.status(400).json({
        error: 'Name, email, password, organisation name, registration number, phone and address are required',
      });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    // role "ngo_pending" has no NGO powers until an admin approves.
    const user = await User.create({ name, email, password, role: 'ngo_pending' });

    try {
      await NgoApplication.create({
        userId: user._id,
        organisationName,
        registrationNumber,
        contactPhone,
        address,
        about,
      });
    } catch (error) {
      await User.findByIdAndDelete(user._id); // do not leave a half-created account
      throw error;
    }

    res.status(201).json({
      token: generateToken(user._id),
      user: publicUser(user),
      ngoApplication: { status: 'pending', rejectionReason: '' },
    });

  } catch (error) {
    console.error('Register NGO error:', error.message);
    res.status(500).json({ error: 'NGO registration failed' });
  }
};

// POST /api/auth/login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.suspended) {
      return res.status(403).json({
        error: 'This account has been suspended. Please contact support.',
      });
    }

    const application = await NgoApplication.findOne({ userId: user._id })
      .select('status rejectionReason')
      .lean();

    res.json({
      token: generateToken(user._id),
      user: publicUser(user),
      ngoApplication: application
        ? { status: application.status, rejectionReason: application.rejectionReason }
        : null,
    });

  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Login failed' });
  }
};

module.exports = { registerUser, registerNgo, loginUser };