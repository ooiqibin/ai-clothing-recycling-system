const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

    const token = generateToken(user._id);

    res.json({
      token,
      user: publicUser(user),
    });

  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Login failed' });
  }
};

module.exports = { registerUser, loginUser };