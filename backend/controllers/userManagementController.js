const mongoose = require('mongoose');
const User = require('../models/User');
const ClassificationResult = require('../models/ClassificationResult');

const PAGE_SIZE = 15;
const ACTIVE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shape(user, lastActivity) {
  let status = 'idle';
  if (user.suspended) {
    status = 'suspended';
  } else if (lastActivity && Date.now() - new Date(lastActivity).getTime() < ACTIVE_DAYS * DAY_MS) {
    status = 'active';
  }

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role || 'user',
    points: user.rewardPoints || 0,
    status,
    suspendedReason: user.suspendedReason || '',
    lastActivity: lastActivity || null,
    createdAt: user.createdAt,
  };
}

// GET /api/admin/users?group=donors|ngo|suspended&q=<name or email>&page=1
const listUsers = async (req, res) => {
  try {
    const filter = { role: { $ne: 'admin' } };

    const group = String(req.query.group || '');
    if (group === 'donors') filter.role = 'user';
    else if (group === 'ngo') filter.role = { $in: ['ngo', 'ngo_pending'] };
    else if (group === 'suspended') filter.suspended = true;

    const q = String(req.query.q || '').trim().slice(0, 60);
    if (q) {
      const pattern = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: pattern }, { email: pattern }];
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const [total, users, summary] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .select('name email role rewardPoints suspended suspendedReason createdAt')
        .lean(),
      User.aggregate([
        { $match: { role: { $ne: 'admin' } } },
        {
          $group: {
            _id: null,
            users: { $sum: 1 },
            suspended: { $sum: { $cond: [{ $eq: ['$suspended', true] }, 1, 0] } },
            points: { $sum: { $ifNull: ['$rewardPoints', 0] } },
          },
        },
      ]),
    ]);

    // Last activity = the user's most recent scan.
    const activity = await ClassificationResult.aggregate([
      { $match: { userId: { $in: users.map((u) => u._id) } } },
      { $group: { _id: '$userId', last: { $max: '$createdAt' } } },
    ]);
    const lastByUser = new Map(activity.map((a) => [String(a._id), a.last]));

    const s = summary[0] || { users: 0, suspended: 0, points: 0 };

    res.json({
      summary: { users: s.users, suspended: s.suspended, points: s.points },
      total,
      page,
      pageSize: PAGE_SIZE,
      users: users.map((u) => shape(u, lastByUser.get(String(u._id)))),
    });
  } catch (error) {
    console.error('listUsers error:', error.message);
    res.status(500).json({ error: 'Could not load users' });
  }
};

function setSuspended(suspended) {
  return async (req, res) => {
    try {
      const id = req.params.id;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ error: 'Invalid user id' });
      }
      if (suspended && String(id) === String(req.userId)) {
        return res.status(400).json({ error: 'You cannot suspend your own account' });
      }

      const user = await User.findOneAndUpdate(
        { _id: id, role: { $ne: 'admin' } },
        {
          suspended,
          suspendedReason: suspended ? String(req.body.reason || '').trim() : '',
          suspendedAt: suspended ? new Date() : null,
        },
        { new: true }
      ).select('name email role rewardPoints suspended suspendedReason createdAt');

      if (!user) {
        return res.status(404).json({ error: 'User not found (admin accounts cannot be suspended)' });
      }

      res.json({ user: shape(user, null) });
    } catch (error) {
      console.error('setSuspended error:', error.message);
      res.status(500).json({ error: 'Could not update the account' });
    }
  };
}

module.exports = {
  listUsers,
  suspendUser: setSuspended(true),
  reactivateUser: setSuspended(false),
};