const User = require('../models/User');
const DonationCenter = require('../models/DonationCenter');
const ClassificationResult = require('../models/ClassificationResult');
const DonationBatch = require('../models/DonationBatch');

const TIME_ZONE = 'Asia/Kuala_Lumpur';
const DAY_MS = 24 * 60 * 60 * 1000;

// Date -> "YYYY-MM-DD" in local time
function dayKey(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(date);
}

// GET /api/admin/stats
const getStats = async (req, res) => {
  try {
    const since = new Date(Date.now() - 8 * DAY_MS);

    const [
      donors,
      ngoAccounts,
      centresTotal,
      centresVisible,
      totalScans,
      itemsDonated,
      byCategory,
      pointsAgg,
      verifiedBatches,
      awaitingBatches,
      perDay,
    ] = await Promise.all([
      User.countDocuments({ role: { $nin: ['admin', 'ngo', 'ngo_pending'] } }),
      User.countDocuments({ role: 'ngo' }),
      DonationCenter.countDocuments(),
      DonationCenter.countDocuments({ isActive: true }),
      ClassificationResult.countDocuments(),
      ClassificationResult.countDocuments({ status: 'donated' }),
      ClassificationResult.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      ClassificationResult.aggregate([
        { $group: { _id: null, total: { $sum: '$pointsAwarded' } } },
      ]),
      DonationBatch.countDocuments({ status: 'verified' }),
      DonationBatch.countDocuments({ status: 'awaiting_verification' }),
      ClassificationResult.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
                timezone: TIME_ZONE,
              },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // The last 7 days, including days with no scans.
    const counts = new Map(perDay.map((d) => [d._id, d.count]));
    const scansPerDay = [];
    for (let i = 6; i >= 0; i--) {
      const day = dayKey(new Date(Date.now() - i * DAY_MS));
      scansPerDay.push({ day, count: counts.get(day) || 0 });
    }

    res.json({
      donors,
      ngoAccounts,
      centres: { total: centresTotal, visible: centresVisible },
      totalScans,
      itemsDonated,
      pointsAwarded: pointsAgg[0] ? pointsAgg[0].total : 0,
      verifiedBatches,
      awaitingBatches,
      byCategory: byCategory.map((c) => ({
        category: c._id || 'unknown',
        count: c.count,
      })),
      scansPerDay,
    });
  } catch (error) {
    console.error('getStats error:', error.message);
    res.status(500).json({ error: 'Could not load statistics' });
  }
};

module.exports = { getStats };