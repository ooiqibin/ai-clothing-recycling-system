const mongoose = require('mongoose');
const DonationBatch = require('../models/DonationBatch');
const DonationCenter = require('../models/DonationCenter');
const { AVG_ITEM_WEIGHT_KG, CO2E_PER_KG } = require('../config/impact');

const DAY_MS = 24 * 60 * 60 * 1000;
const MY_OFFSET_MS = 8 * 60 * 60 * 1000; // Malaysia is UTC+8 all year

function dayKey(date) {
  return new Date(date.getTime() + MY_OFFSET_MS).toISOString().slice(0, 10);
}

// GET /api/ngo/overview  (NGO accounts: their own centre only)
const getNgoOverview = async (req, res) => {
  try {
    if (!req.userCenterId) {
      return res
        .status(403)
        .json({ error: 'Your NGO account is not linked to a donation centre yet.' });
    }

    const centerId = new mongoose.Types.ObjectId(String(req.userCenterId));

    const centre = await DonationCenter.findById(centerId)
      .select('name address phone openingHours')
      .lean();

    if (!centre) {
      return res.status(404).json({ error: 'Your donation centre no longer exists' });
    }

    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * DAY_MS);

    const [totals, week, pending, recent] = await Promise.all([
      DonationBatch.aggregate([
        { $match: { centerId, status: 'verified' } },
        {
          $group: {
            _id: null,
            donations: { $sum: 1 },
            items: { $sum: { $size: { $ifNull: ['$itemIds', []] } } },
            points: { $sum: '$totalPoints' },
          },
        },
      ]),
      DonationBatch.aggregate([
        { $match: { centerId, status: 'verified', verifiedAt: { $gte: weekStart } } },
        {
          $project: {
            verifiedAt: 1,
            items: { $size: { $ifNull: ['$itemIds', []] } },
          },
        },
      ]),
      DonationBatch.countDocuments({ centerId, status: 'awaiting_verification' }),
      DonationBatch.find({ centerId, status: 'verified' })
        .sort({ verifiedAt: -1 })
        .limit(10)
        .populate('userId', 'name')
        .lean(),
    ]);

    const t = totals[0] || { donations: 0, items: 0, points: 0 };

    // Verified donations per day for the last 7 days
    const byDay = new Map();
    for (const b of week) {
      const key = dayKey(b.verifiedAt);
      const row = byDay.get(key) || { donations: 0, items: 0 };
      row.donations += 1;
      row.items += b.items;
      byDay.set(key, row);
    }

    const perDay = [];
    for (let i = 6; i >= 0; i--) {
      const key = dayKey(new Date(now.getTime() - i * DAY_MS));
      const v = byDay.get(key) || { donations: 0, items: 0 };
      perDay.push({ day: key, donations: v.donations, items: v.items });
    }

    const today = byDay.get(dayKey(now)) || { donations: 0, items: 0 };
    const carbonKg = Math.round(t.items * AVG_ITEM_WEIGHT_KG * CO2E_PER_KG * 10) / 10;

    res.json({
      centre: {
        name: centre.name,
        address: centre.address || '',
        phone: centre.phone || '',
        openingHours: centre.openingHours || '',
      },
      totals: { donations: t.donations, items: t.items, points: t.points },
      thisWeek: week.length,
      today: { donations: today.donations, items: today.items },
      pending,
      carbonKg,
      perDay,
      recent: recent.map((b) => ({
        id: String(b._id),
        donorName: b.userId && b.userId.name ? b.userId.name : 'Donor',
        itemCount: b.itemIds.length,
        points: b.totalPoints,
        verifiedAt: b.verifiedAt ? b.verifiedAt.toISOString() : null,
      })),
    });
  } catch (error) {
    console.error('getNgoOverview error:', error.message);
    res.status(500).json({ error: 'Could not load your centre overview' });
  }
};
const getNgoDonationReport = async (req, res) => {
  try {
    if (!req.userCenterId) {
      return res.status(403).json({
        error: 'Your NGO account is not linked to a donation centre yet.',
      });
    }

    const centerId = new mongoose.Types.ObjectId(
      String(req.userCenterId)
    );

    const centre = await DonationCenter.findById(centerId)
      .select('name address')
      .lean();

    if (!centre) {
      return res.status(404).json({
        error: 'Your donation centre no longer exists',
      });
    }

    const batches = await DonationBatch.find({ centerId })
      .sort({ createdAt: -1 })
      .populate('userId', 'name')
      .lean();

    const donations = batches.map((batch) => ({
      id: String(batch._id),
      status: batch.status,
      itemCount: Array.isArray(batch.itemIds)
        ? batch.itemIds.length
        : 0,
      totalPoints: Number(batch.totalPoints || 0),
      createdAt: batch.createdAt || null,
      verifiedAt: batch.verifiedAt || null,
      donorName: batch.userId?.name || 'Donor',
    }));

    const verified = donations.filter(
      (item) => item.status === 'verified'
    );

    const pending = donations.filter(
      (item) => item.status === 'awaiting_verification'
    );

    return res.json({
      centre: {
        name: centre.name,
        address: centre.address || '',
      },
      generatedAt: new Date().toISOString(),
      summary: {
        totalDonations: donations.length,
        verifiedDonations: verified.length,
        pendingDonations: pending.length,
        totalItems: verified.reduce(
          (sum, item) => sum + item.itemCount,
          0
        ),
        totalPoints: verified.reduce(
          (sum, item) => sum + item.totalPoints,
          0
        ),
      },
      donations,
    });
  } catch (error) {
    console.error('getNgoDonationReport error:', error.message);

    return res.status(500).json({
      error: 'Could not generate your donation report',
    });
  }
};

module.exports = {
   getNgoOverview,
   getNgoDonationReport, 
  };