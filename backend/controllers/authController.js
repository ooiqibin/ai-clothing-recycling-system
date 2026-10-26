const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const NgoApplication = require('../models/NgoApplication');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

const clean = (value) => String(value || '').trim();

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

// We only ever store a hash of a code.
function hashCode(code) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(String(code)).digest('hex');
}

function sameHash(a, b) {
  const x = Buffer.from(a || '', 'hex');
  const y = Buffer.from(b || '', 'hex');
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

// Makes a new 6-digit verification code, saves its hash, and emails it.
async function sendNewCode(user) {
  const code = String(crypto.randomInt(100000, 1000000));

  user.emailVerification = {
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
    attempts: 0,
    lastSentAt: new Date(),
  };
  await user.save();

  await sendVerificationEmail(user.email, user.name, code);
}

const EMAIL_FAILED = {
  error: 'We could not send the verification email. Check the address and try again.',
};

// POST /api/auth/register
const registerUser = async (req, res) => {
  let created = false;
  let user = null;

  try {
    const name = clean(req.body.name);
    const email = clean(req.body.email).toLowerCase();
    const password = String(req.body.password || '');

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    if (password.length < 9) {
      return res.status(400).json({ error: 'Password must be at least 9 characters' });
    }

    user = await User.findOne({ email });

    if (user && user.emailVerified !== false) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    if (user) {
      // An earlier sign-up was never verified, so the new sign-up replaces it.
      user.name = name;
      user.password = password;
      user.role = 'user';
      await NgoApplication.deleteOne({ userId: user._id });
    } else {
      user = new User({ name, email, password });
      created = true;
    }

    user.emailVerified = false;
    await user.save();

    try {
      await sendNewCode(user);
    } catch (error) {
      console.error('Verification email failed:', error.message);
      if (created) await User.findByIdAndDelete(user._id);
      return res.status(500).json(EMAIL_FAILED);
    }

    res.status(201).json({ verificationRequired: true, email });

  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ error: 'Registration failed' });
  }
};

// POST /api/auth/register-ngo
// An NGO signs up, verifies their email, and waits for an admin to approve the application.
const registerNgo = async (req, res) => {
  let created = false;
  let user = null;

  try {
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
    if (password.length < 9) {
      return res.status(400).json({ error: 'Password must be at least 9 characters' });
    }

    user = await User.findOne({ email });

    if (user && user.emailVerified !== false) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    if (user) {
      user.name = name;
      user.password = password;
    } else {
      user = new User({ name, email, password });
      created = true;
    }

    // role "ngo_pending" has no NGO powers until an admin approves.
    user.role = 'ngo_pending';
    user.emailVerified = false;
    await user.save();

    try {
      await NgoApplication.findOneAndUpdate(
        { userId: user._id },
        {
          organisationName,
          registrationNumber,
          contactPhone,
          address,
          about,
          status: 'pending',
          rejectionReason: '',
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      await sendNewCode(user);
    } catch (error) {
      console.error('NGO registration step failed:', error.message);
      if (created) {
        await User.findByIdAndDelete(user._id);
        await NgoApplication.deleteOne({ userId: user._id });
      }
      return res.status(500).json(EMAIL_FAILED);
    }

    res.status(201).json({ verificationRequired: true, email });

  } catch (error) {
    console.error('Register NGO error:', error.message);
    res.status(500).json({ error: 'NGO registration failed' });
  }
};

// POST /api/auth/verify-email   body: { email, code }
const verifyEmail = async (req, res) => {
  try {
    const email = clean(req.body.email).toLowerCase();
    const code = clean(req.body.code);

    const wrong = () =>
      res.status(400).json({ error: 'That code is not valid. Check it or ask for a new one.' });

    if (!email || !/^\d{6}$/.test(code)) return wrong();

    const user = await User.findOne({ email });
    if (!user || user.emailVerified !== false) return wrong();

    const v = user.emailVerification || {};

    if (!v.codeHash || !v.expiresAt || v.expiresAt < new Date()) {
      return res.status(400).json({ error: 'This code has expired. Please ask for a new one.' });
    }
    if ((v.attempts || 0) >= MAX_CODE_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many wrong tries. Please ask for a new code.' });
    }

    if (!sameHash(v.codeHash, hashCode(code))) {
      user.set('emailVerification.attempts', (v.attempts || 0) + 1);
      await user.save();
      return wrong();
    }

    user.emailVerified = true;
    user.emailVerification = { codeHash: '', expiresAt: null, attempts: 0, lastSentAt: null };
    await user.save();

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
    console.error('Verify email error:', error.message);
    res.status(500).json({ error: 'Could not verify your email' });
  }
};

// POST /api/auth/resend-code   body: { email }
const resendCode = async (req, res) => {
  try {
    const email = clean(req.body.email).toLowerCase();
    const reply = {
      message: 'If this account is waiting for verification, a new code has been sent.',
    };

    const user = email ? await User.findOne({ email }) : null;
    if (!user || user.emailVerified !== false) return res.json(reply);

    const last = user.emailVerification && user.emailVerification.lastSentAt;
    if (last && Date.now() - new Date(last).getTime() < RESEND_COOLDOWN_MS) {
      return res.status(429).json({ error: 'Please wait a minute before asking for another code.' });
    }

    try {
      await sendNewCode(user);
    } catch (error) {
      console.error('Resend email failed:', error.message);
      return res.status(500).json(EMAIL_FAILED);
    }

    res.json(reply);

  } catch (error) {
    console.error('Resend code error:', error.message);
    res.status(500).json({ error: 'Could not send a new code' });
  }
};

// POST /api/auth/forgot-password   body: { email }
const forgotPassword = async (req, res) => {
  // The same answer whether or not the account exists, so nobody can check who has one.
  const reply = { message: 'If an account exists for this email, a reset code has been sent.' };

  try {
    const email = clean(req.body.email).toLowerCase();

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.json(reply);

    // Never verified their email? They need a verification code instead.
    if (user.emailVerified === false) {
      const last = user.emailVerification && user.emailVerification.lastSentAt;
      if (!last || Date.now() - new Date(last).getTime() >= RESEND_COOLDOWN_MS) {
        try {
          await sendNewCode(user);
        } catch (error) {
          console.error('Could not send a verification code:', error.message);
        }
      }
      return res.json(reply);
    }

    const lastReset = user.passwordReset && user.passwordReset.lastSentAt;
    if (lastReset && Date.now() - new Date(lastReset).getTime() < RESEND_COOLDOWN_MS) {
      return res.json(reply);
    }

    const code = String(crypto.randomInt(100000, 1000000));

    user.passwordReset = {
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
      attempts: 0,
      lastSentAt: new Date(),
    };
    await user.save();

    try {
      await sendPasswordResetEmail(user.email, user.name, code);
    } catch (error) {
      console.error('Password reset email failed:', error.message);
    }

    res.json(reply);

  } catch (error) {
    console.error('Forgot password error:', error.message);
    res.status(500).json({ error: 'Could not start the password reset' });
  }
};

// POST /api/auth/reset-password   body: { email, code, newPassword }
const resetPassword = async (req, res) => {
  try {
    const email = clean(req.body.email).toLowerCase();
    const code = clean(req.body.code);
    const newPassword = String(req.body.newPassword || '');

    const wrong = () =>
      res.status(400).json({ error: 'That code is not valid. Check it or ask for a new one.' });

    if (newPassword.length < 9) {
      return res.status(400).json({ error: 'Password must be at least 9 characters' });
    }
    
    if (!email || !/^\d{6}$/.test(code)) return wrong();

    const user = await User.findOne({ email });
    if (user && await user.comparePassword(newPassword)) {
    return res.status(400).json({
      error: 'New password cannot be the same as your previous password',
    });
  }
    if (!user) return wrong();

    const r = user.passwordReset || {};

    if (!r.codeHash || !r.expiresAt || r.expiresAt < new Date()) {
      return res.status(400).json({ error: 'This code has expired. Please ask for a new one.' });
    }
    if ((r.attempts || 0) >= MAX_CODE_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many wrong tries. Please ask for a new code.' });
    }

    if (!sameHash(r.codeHash, hashCode(code))) {
      user.set('passwordReset.attempts', (r.attempts || 0) + 1);
      await user.save();
      return wrong();
    }

    user.password = newPassword; // the model hashes it when saving
    user.passwordChangedAt = new Date();
    user.emailVerified = true; // they proved they own this inbox
    user.passwordReset = { codeHash: '', expiresAt: null, attempts: 0, lastSentAt: null };
    user.emailVerification = { codeHash: '', expiresAt: null, attempts: 0, lastSentAt: null };
    await user.save();

    res.json({ message: 'Your password was changed. Please log in.' });

  } catch (error) {
    console.error('Reset password error:', error.message);
    res.status(500).json({ error: 'Could not reset the password' });
  }
};

// POST /api/auth/login
const loginUser = async (req, res) => {
  try {
    const email = clean(req.body.email).toLowerCase();
    const password = String(req.body.password || '');

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

    if (user.emailVerified === false) {
      // Make sure there is a live code in their inbox.
      const v = user.emailVerification || {};
      const hasLiveCode = v.codeHash && v.expiresAt && v.expiresAt > new Date();

      if (!hasLiveCode) {
        try {
          await sendNewCode(user);
        } catch (error) {
          console.error('Could not send a code at login:', error.message);
        }
      }

      return res.status(403).json({
        error: 'Please verify your email address first. We sent a code to your inbox.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
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

module.exports = {
  registerUser,
  registerNgo,
  verifyEmail,
  resendCode,
  forgotPassword,
  resetPassword,
  loginUser,
};