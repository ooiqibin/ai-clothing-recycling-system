const DonationBatch = require('../models/DonationBatch');
const DonationCenter = require('../models/DonationCenter');
// Make sure this model is registered so populate() can use it.
require('../models/User');

const DAY_MS = 24 * 60 * 60 * 1000;
const MY_OFFSET_MS = 8 * 60 * 60 * 1000; // Malaysia is UTC+8 all year

const { AVG_ITEM_WEIGHT_KG, CO2E_PER_KG } = require('../config/impact');

const RANKING_PERIODS = [1, 7, 30];

function dayKey(date) {
  return new Date(date.getTime() + MY_OFFSET_MS).toISOString().slice(0, 10);
}

// Start of a month in Malaysian time, as a UTC Date.
function monthStart(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex, 1) - MY_OFFSET_MS);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function bump(map, key, items, points) {
  const row = map.get(key) || { donations: 0, items: 0, points: 0 };
  row.donations += 1;
  row.items += items;
  row.points += points;
  map.set(key, row);
}

// GET /api/admin/analytics?days=1|7|30   (days = period for the centre ranking)
const getAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const local = new Date(now.getTime() + MY_OFFSET_MS);
    const year = local.getUTCFullYear();
    const month = local.getUTCMonth();

    const thisMonthStart = monthStart(year, month);
    const lastMonthStart = monthStart(year, month - 1);
    const weekStart = new Date(now.getTime() - 7 * DAY_MS);

    let days = Number(req.query.days);
    if (!RANKING_PERIODS.includes(days)) days = 30;
    const periodStart = new Date(now.getTime() - days * DAY_MS);

    const earliest = new Date(
      Math.min(lastMonthStart.getTime(), weekStart.getTime(), periodStart.getTime())
    );

    const verified = await DonationBatch.aggregate([
      { $match: { status: 'verified', verifiedAt: { $gte: earliest } } },
      {
        $project: {
          centerId: 1,
          verifiedAt: 1,
          totalPoints: 1,
          items: { $size: { $ifNull: ['$itemIds', []] } },
        },
      },
    ]);

    let thisMonthItems = 0;
    let lastMonthItems = 0;
    const byDay = new Map();
    const byCentreWeek = new Map();
    const byCentrePeriod = new Map();

    for (const b of verified) {
      const t = b.verifiedAt.getTime();
      const centreKey = b.centerId ? String(b.centerId) : 'none';

      if (t >= thisMonthStart.getTime()) thisMonthItems += b.items;
      else if (t >= lastMonthStart.getTime()) lastMonthItems += b.items;

      if (t >= weekStart.getTime()) {
        bump(byDay, dayKey(b.verifiedAt), b.items, b.totalPoints);
        bump(byCentreWeek, centreKey, b.items, b.totalPoints);
      }
      if (t >= periodStart.getTime()) {
        bump(byCentrePeriod, centreKey, b.items, b.totalPoints);
      }
    }

    // Look up centre names.
    const ids = new Set([...byCentreWeek.keys(), ...byCentrePeriod.keys()]);
    ids.delete('none');
    const centres = await DonationCenter.find({ _id: { $in: [...ids] } })
      .select('name')
      .lean();
    const centreName = new Map(centres.map((c) => [String(c._id), c.name]));

    const nameFor = (id) =>
      id === 'none' ? 'No centre recorded' : centreName.get(id) || 'Unknown centre';

    // Centre ranking: most verified donations first, then most items.
    const ranking = [...byCentrePeriod.entries()]
      .map(([id, v]) => ({
        name: nameFor(id),
        donations: v.donations,
        items: v.items,
        points: v.points,
      }))
      .sort((a, b) => b.donations - a.donations || b.items - a.items)
      .slice(0, 10);
    const maxDonations = Math.max(1, ...ranking.map((c) => c.donations));
    ranking.forEach((c) => {
      c.percent = Math.round((c.donations / maxDonations) * 100);
    });

    // Carbon estimate
    const kgPerItem = AVG_ITEM_WEIGHT_KG * CO2E_PER_KG;
    const thisMonthKg = thisMonthItems * kgPerItem;
    const lastMonthKg = lastMonthItems * kgPerItem;
    const changePct =
      lastMonthItems > 0
        ? Math.round(((thisMonthItems - lastMonthItems) / lastMonthItems) * 100)
        : null;

    // Last 7 days, including days with nothing
    const perDay = [];
    for (let i = 6; i >= 0; i--) {
      const key = dayKey(new Date(now.getTime() - i * DAY_MS));
      const v = byDay.get(key) || { donations: 0, items: 0 };
      perDay.push({ day: key, donations: v.donations, items: v.items });
    }

    const partners = [...byCentreWeek.entries()]
      .map(([id, v]) => ({
        name: nameFor(id),
        donations: v.donations,
        items: v.items,
        points: v.points,
      }))
      .sort((a, b) => b.items - a.items)
      .slice(0, 8);

    // Recent activity
    const recentBatches = await DonationBatch.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'name')
      .populate('centerId', 'name')
      .lean();

    const recent = recentBatches.map((b) => ({
      id: String(b._id),
      code: b.verificationCode,
      centre: b.centerId && b.centerId.name ? b.centerId.name : '-',
      donor: b.userId && b.userId.name ? b.userId.name : '-',
      items: b.itemIds ? b.itemIds.length : 0,
      status: b.status,
      points: b.totalPoints,
      when: b.verifiedAt || b.createdAt,
    }));

    res.json({
      generatedAt: now.toISOString(),
      centres: { days, list: ranking },
      carbon: {
        thisMonthItems,
        thisMonthKg: round1(thisMonthKg),
        lastMonthKg: round1(lastMonthKg),
        changePct,
        assumptions: { avgItemWeightKg: AVG_ITEM_WEIGHT_KG, co2ePerKg: CO2E_PER_KG },
      },
      performance: { perDay, partners },
      recent,
    });
  } catch (error) {
    console.error('getAnalytics error:', error.message);
    res.status(500).json({ error: 'Could not load analytics' });
  }
};

module.exports = { getAnalytics };