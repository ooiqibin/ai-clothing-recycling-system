const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authorized, no token provided' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Not authorized, invalid token' });
  }

  try {
    const user = await User.findById(decoded.userId).select(
      '_id role centerId suspended passwordChangedAt'
    );

    if (!user) {
      return res.status(401).json({ error: 'Not authorized, user no longer exists' });
    }

    if (user.suspended) {
      return res.status(403).json({
        error: 'Your account has been suspended. Please contact support.',
      });
    }

    // A password reset logs out every older session.
    if (
      user.passwordChangedAt &&
      decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)
    ) {
      return res.status(401).json({ error: 'Your password was changed. Please log in again.' });
    }

    req.userId = decoded.userId;
    req.userRole = user.role || 'user';
    req.userCenterId = user.centerId || null;
    next();
  } catch (error) {
    console.error('Auth lookup error:', error.message);
    return res.status(500).json({ error: 'Could not verify your account' });
  }
};

// Use after protect: restrictTo('admin')
const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.userRole)) {
    return res.status(403).json({ error: 'Your account is not allowed to do this' });
  }
  next();
};

module.exports = { protect, restrictTo };