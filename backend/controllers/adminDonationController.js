const mongoose = require('mongoose');
const DonationBatch = require('../models/DonationBatch');
const User = require('../models/User');
// Make sure this model is registered so populate() can use it.
require('../models/DonationCenter');

const STATUSES = ['awaiting_verification', 'verified'];
const PAGE_SIZE = 20;

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shape(batch) {
  return {
    id: String(batch._id),
    status: batch.status,
    code: batch.verificationCode,
    itemCount: batch.itemIds ? batch.itemIds.length : 0,
    totalPoints: batch.totalPoints,
    createdAt: batch.createdAt,
    verifiedAt: batch.verifiedAt || null,
    donor: batch.userId && batch.userId.name
      ? { name: batch.userId.name, email: batch.userId.email }
      : null,
    centre: batch.centerId && batch.centerId.name ? { name: batch.centerId.name } : null,
    verifiedBy: batch.verifiedBy && batch.verifiedBy.name ? { name: batch.verifiedBy.name } : null,
  };
}

// GET /api/admin/donations
//   ?status=awaiting_verification|verified
//   &centerId=<id> | none      (none = verified before centres were recorded)
//   &q=<donor name, email or 6-digit code>
//   &page=1
const listDonations = async (req, res) => {
  try {
    const filter = {};

    if (STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const centerId = String(req.query.centerId || '');
    if (centerId === 'none') {
      filter.centerId = null;
      filter.status = 'verified';
    } else if (centerId) {
      if (!mongoose.isValidObjectId(centerId)) {
        return res.status(400).json({ error: 'Invalid donation centre' });
      }
      filter.centerId = centerId;
    }

    const q = String(req.query.q || '').trim().slice(0, 60);
    if (q) {
      const pattern = new RegExp(escapeRegex(q), 'i');
      const users = await User.find({ $or: [{ name: pattern }, { email: pattern }] })
        .select('_id')
        .limit(500)
        .lean();

      const conditions = [{ userId: { $in: users.map((u) => u._id) } }];
      if (/^\d{6}$/.test(q)) conditions.push({ verificationCode: q });
      filter.$or = conditions;
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const [total, batches, pendingCount] = await Promise.all([
      DonationBatch.countDocuments(filter),
      DonationBatch.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate('userId', 'name email')
        .populate('centerId', 'name')
        .populate('verifiedBy', 'name')
        .lean(),
      DonationBatch.countDocuments({ status: 'awaiting_verification' }),
    ]);

    res.json({
      pendingCount,
      total,
      page,
      pageSize: PAGE_SIZE,
      donations: batches.map(shape),
    });
  } catch (error) {
    console.error('listDonations error:', error.message);
    res.status(500).json({ error: 'Could not load donations' });
  }
};

module.exports = { listDonations };