const crypto = require('crypto');
const mongoose = require('mongoose');
const Reward = require('../models/Reward');
const Coupon = require('../models/Coupon');
const User = require('../models/User');

const CODE_LENGTH = 8;
// No 0/O or 1/I, so codes are easy to read out loud.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const COUPON_STATUSES = ['active', 'used', 'expired', 'cancelled'];

function makeCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkId(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: 'Invalid id' });
    return false;
  }
  return true;
}

function rewardShape(r, redeemedByMe = 0) {
  const limited = r.stock !== null && r.stock !== undefined;

  return {
    id: String(r._id),
    title: r.title,
    description: r.description || '',
    partnerName: r.partnerName || '',
    pointsCost: r.pointsCost,
    stock: limited ? r.stock : null,
    soldOut: limited && r.stock <= 0,
    perUserLimit: r.perUserLimit ?? null,
    validDays: r.validDays,
    terms: r.terms || '',
    isActive: r.isActive,
    redeemedCount: r.redeemedCount || 0,
    redeemedByMe,
    createdAt: r.createdAt,
  };
}

function couponShape(c) {
  const expired = c.status === 'active' && new Date(c.expiresAt) < new Date();

  return {
    id: String(c._id),
    code: c.code,
    rewardTitle: c.rewardTitle,
    partnerName: c.partnerName || '',
    terms: c.terms || '',
    pointsSpent: c.pointsSpent,
    status: expired ? 'expired' : c.status,
    expiresAt: c.expiresAt,
    usedAt: c.usedAt || null,
    createdAt: c.createdAt,
    user: c.userId && c.userId.name
      ? { name: c.userId.name, email: c.userId.email }
      : undefined,
  };
}

// Checks what an admin typed for a reward.
function readRewardInput(body) {
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const partnerName = String(body.partnerName || '').trim();
  const terms = String(body.terms || '').trim();

  if (title.length < 3 || title.length > 80) {
    return { error: 'Title must be 3 to 80 characters' };
  }
  if (description.length > 300) return { error: 'Description can be at most 300 characters' };
  if (partnerName.length > 60) return { error: 'Partner name can be at most 60 characters' };
  if (terms.length > 500) return { error: 'Terms can be at most 500 characters' };

  const pointsCost = Number(body.pointsCost);
  if (!Number.isInteger(pointsCost) || pointsCost < 1 || pointsCost > 100000) {
    return { error: 'Points cost must be a whole number from 1 to 100000' };
  }

  const blank = (v) => v === null || v === undefined || v === '';

  let stock = null;
  if (!blank(body.stock)) {
    stock = Number(body.stock);
    if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) {
      return { error: 'Stock must be a whole number, or empty for unlimited' };
    }
  }

  let perUserLimit = null;
  if (!blank(body.perUserLimit)) {
    perUserLimit = Number(body.perUserLimit);
    if (!Number.isInteger(perUserLimit) || perUserLimit < 1 || perUserLimit > 1000) {
      return { error: 'Per-user limit must be a whole number of at least 1, or empty' };
    }
  }

  let validDays = 30;
  if (!blank(body.validDays)) {
    validDays = Number(body.validDays);
    if (!Number.isInteger(validDays) || validDays < 1 || validDays > 365) {
      return { error: 'Valid days must be a whole number from 1 to 365' };
    }
  }

  return {
    value: {
      title,
      description,
      partnerName,
      terms,
      pointsCost,
      stock,
      perUserLimit,
      validDays,
    },
  };
}

// ============================ App users ============================

// GET /api/rewards  (active rewards)
const listRewards = async (req, res) => {
  try {
    const rewards = await Reward.find({ isActive: true }).sort({ pointsCost: 1 }).lean();

    const mine = await Coupon.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(String(req.userId)),
          status: { $ne: 'cancelled' },
        },
      },
      { $group: { _id: '$rewardId', count: { $sum: 1 } } },
    ]);
    const countByReward = new Map(mine.map((m) => [String(m._id), m.count]));

    res.json({
      rewards: rewards.map((r) => rewardShape(r, countByReward.get(String(r._id)) || 0)),
    });
  } catch (error) {
    console.error('listRewards error:', error.message);
    res.status(500).json({ error: 'Could not load rewards' });
  }
};

// Puts back what a failed redemption took.
async function giveBackPoints(userId, points) {
  await User.updateOne({ _id: userId }, { $inc: { rewardPoints: points } });
}

async function releaseReward(rewardId, limited) {
  await Reward.updateOne(
    { _id: rewardId },
    limited ? { $inc: { stock: 1, redeemedCount: -1 } } : { $inc: { redeemedCount: -1 } }
  );
}

// POST /api/rewards/:id/redeem
const redeemReward = async (req, res) => {
  try {
    if (!checkId(req, res)) return;

    const reward = await Reward.findById(req.params.id).lean();
    if (!reward || !reward.isActive) {
      return res.status(404).json({ error: 'This reward is not available' });
    }

    if (reward.perUserLimit) {
      const already = await Coupon.countDocuments({
        userId: req.userId,
        rewardId: reward._id,
        status: { $ne: 'cancelled' },
      });
      if (already >= reward.perUserLimit) {
        return res.status(400).json({
          error: `You can only redeem this reward ${reward.perUserLimit} time(s)`,
        });
      }
    }

    const limited = reward.stock !== null && reward.stock !== undefined;

    // Step 1: reserve one unit. Only one request can take the last one.
    const reserved = await Reward.findOneAndUpdate(
      limited
        ? { _id: reward._id, isActive: true, stock: { $gt: 0 } }
        : { _id: reward._id, isActive: true },
      limited ? { $inc: { stock: -1, redeemedCount: 1 } } : { $inc: { redeemedCount: 1 } },
      { new: true }
    );
    if (!reserved) {
      return res.status(409).json({ error: 'Sorry, this reward just ran out' });
    }

    // Step 2: take the points. This only succeeds if the user has enough.
    const user = await User.findOneAndUpdate(
      { _id: req.userId, rewardPoints: { $gte: reward.pointsCost } },
      { $inc: { rewardPoints: -reward.pointsCost } },
      { new: true }
    ).select('rewardPoints');

    if (!user) {
      await releaseReward(reward._id, limited);
      return res.status(400).json({ error: 'You do not have enough points for this reward' });
    }

    // Step 3: create the coupon. If this fails, undo the first two steps.
    let coupon = null;

    try {
      for (let attempt = 0; attempt < 5 && !coupon; attempt++) {
        try {
          coupon = await Coupon.create({
            userId: req.userId,
            rewardId: reward._id,
            rewardTitle: reward.title,
            partnerName: reward.partnerName || '',
            terms: reward.terms || '',
            pointsSpent: reward.pointsCost,
            code: makeCode(),
            expiresAt: new Date(Date.now() + reward.validDays * DAY_MS),
          });
        } catch (error) {
          if (error.code !== 11000) throw error; // 11000 = code already used, try another
        }
      }
    } catch (error) {
      console.error('Coupon creation failed:', error.message);
    }

    if (!coupon) {
      await giveBackPoints(req.userId, reward.pointsCost);
      await releaseReward(reward._id, limited);
      return res.status(500).json({ error: 'Could not create your coupon. Your points were not used.' });
    }

    res.status(201).json({
      coupon: couponShape(coupon),
      totalRewardPoints: user.rewardPoints,
    });
  } catch (error) {
    console.error('redeemReward error:', error.message);
    res.status(500).json({ error: 'Could not redeem this reward' });
  }
};

// GET /api/coupons/mine
const listMyCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ coupons: coupons.map(couponShape) });
  } catch (error) {
    console.error('listMyCoupons error:', error.message);
    res.status(500).json({ error: 'Could not load your coupons' });
  }
};

// POST /api/coupons/:id/use
const useMyCoupon = async (req, res) => {
  try {
    if (!checkId(req, res)) return;

    const coupon = await Coupon.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.userId,
        status: 'active',
        expiresAt: { $gt: new Date() },
      },
      { status: 'used', usedAt: new Date() },
      { new: true }
    ).lean();

    if (!coupon) {
      return res
        .status(400)
        .json({ error: 'This coupon cannot be used (already used, expired or cancelled)' });
    }

    res.json({ coupon: couponShape(coupon) });
  } catch (error) {
    console.error('useMyCoupon error:', error.message);
    res.status(500).json({ error: 'Could not mark the coupon as used' });
  }
};

// ============================== Admin ==============================

// GET /api/admin/rewards
const adminListRewards = async (req, res) => {
  try {
    const rewards = await Reward.find().sort({ createdAt: -1 }).lean();
    res.json({ rewards: rewards.map((r) => rewardShape(r)) });
  } catch (error) {
    console.error('adminListRewards error:', error.message);
    res.status(500).json({ error: 'Could not load rewards' });
  }
};

// POST /api/admin/rewards
const adminCreateReward = async (req, res) => {
  try {
    const input = readRewardInput(req.body);
    if (input.error) return res.status(400).json({ error: input.error });

    const reward = await Reward.create({ ...input.value, createdBy: req.userId });
    res.status(201).json({ reward: rewardShape(reward) });
  } catch (error) {
    console.error('adminCreateReward error:', error.message);
    res.status(500).json({ error: 'Could not create the reward' });
  }
};

// PUT /api/admin/rewards/:id
const adminUpdateReward = async (req, res) => {
  try {
    if (!checkId(req, res)) return;

    const input = readRewardInput(req.body);
    if (input.error) return res.status(400).json({ error: input.error });

    const reward = await Reward.findByIdAndUpdate(req.params.id, input.value, {
      new: true,
      runValidators: true,
    }).lean();

    if (!reward) return res.status(404).json({ error: 'Reward not found' });

    res.json({ reward: rewardShape(reward) });
  } catch (error) {
    console.error('adminUpdateReward error:', error.message);
    res.status(500).json({ error: 'Could not update the reward' });
  }
};

// POST /api/admin/rewards/:id/active   body: { isActive }
const adminSetRewardActive = async (req, res) => {
  try {
    if (!checkId(req, res)) return;

    const reward = await Reward.findByIdAndUpdate(
      req.params.id,
      { isActive: req.body.isActive === true },
      { new: true }
    ).lean();

    if (!reward) return res.status(404).json({ error: 'Reward not found' });

    res.json({ reward: rewardShape(reward) });
  } catch (error) {
    console.error('adminSetRewardActive error:', error.message);
    res.status(500).json({ error: 'Could not update the reward' });
  }
};

// DELETE /api/admin/rewards/:id  (only if nobody has redeemed it)
const adminDeleteReward = async (req, res) => {
  try {
    if (!checkId(req, res)) return;

    const used = await Coupon.exists({ rewardId: req.params.id });
    if (used) {
      return res.status(409).json({
        error: 'This reward has been redeemed before, so it cannot be deleted. Deactivate it instead.',
      });
    }

    const reward = await Reward.findByIdAndDelete(req.params.id);
    if (!reward) return res.status(404).json({ error: 'Reward not found' });

    res.json({ message: 'Reward deleted' });
  } catch (error) {
    console.error('adminDeleteReward error:', error.message);
    res.status(500).json({ error: 'Could not delete the reward' });
  }
};

// GET /api/admin/coupons?status=active|used|expired|cancelled&q=<code, name or email>&page=1
const adminListCoupons = async (req, res) => {
  try {
    const filter = {};
    const now = new Date();

    const status = String(req.query.status || '');
    if (status === 'expired') {
      filter.status = 'active';
      filter.expiresAt = { $lt: now };
    } else if (status === 'active') {
      filter.status = 'active';
      filter.expiresAt = { $gte: now };
    } else if (COUPON_STATUSES.includes(status)) {
      filter.status = status;
    }

    const q = String(req.query.q || '').trim().slice(0, 60);
    if (q) {
      const pattern = new RegExp(escapeRegex(q), 'i');
      const users = await User.find({ $or: [{ name: pattern }, { email: pattern }] })
        .select('_id')
        .limit(500)
        .lean();

      filter.$or = [
        { code: new RegExp('^' + escapeRegex(q), 'i') },
        { userId: { $in: users.map((u) => u._id) } },
      ];
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const [total, coupons] = await Promise.all([
      Coupon.countDocuments(filter),
      Coupon.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate('userId', 'name email')
        .lean(),
    ]);

    res.json({ total, page, pageSize: PAGE_SIZE, coupons: coupons.map(couponShape) });
  } catch (error) {
    console.error('adminListCoupons error:', error.message);
    res.status(500).json({ error: 'Could not load redemptions' });
  }
};

// POST /api/admin/coupons/:id/use
const adminUseCoupon = async (req, res) => {
  try {
    if (!checkId(req, res)) return;

    const coupon = await Coupon.findOneAndUpdate(
      { _id: req.params.id, status: 'active', expiresAt: { $gt: new Date() } },
      { status: 'used', usedAt: new Date() },
      { new: true }
    )
      .populate('userId', 'name email')
      .lean();

    if (!coupon) {
      return res
        .status(400)
        .json({ error: 'This coupon cannot be marked used (already used, expired or cancelled)' });
    }

    res.json({ coupon: couponShape(coupon) });
  } catch (error) {
    console.error('adminUseCoupon error:', error.message);
    res.status(500).json({ error: 'Could not mark the coupon as used' });
  }
};

// POST /api/admin/coupons/:id/cancel  (unused coupons only; gives the points back)
const adminCancelCoupon = async (req, res) => {
  try {
    if (!checkId(req, res)) return;

    // Only one request can switch active -> cancelled, so points are refunded once.
    const coupon = await Coupon.findOneAndUpdate(
      { _id: req.params.id, status: 'active' },
      { status: 'cancelled' },
      { new: true }
    ).lean();

    if (!coupon) {
      return res.status(400).json({ error: 'Only unused coupons can be cancelled' });
    }

    await User.updateOne({ _id: coupon.userId }, { $inc: { rewardPoints: coupon.pointsSpent } });

    // Put the unit back (stock for limited rewards, the counter for all).
    await Reward.updateOne(
      { _id: coupon.rewardId, stock: { $ne: null } },
      { $inc: { stock: 1, redeemedCount: -1 } }
    );
    await Reward.updateOne(
      { _id: coupon.rewardId, stock: null },
      { $inc: { redeemedCount: -1 } }
    );

    res.json({ message: `Cancelled. ${coupon.pointsSpent} points were returned to the user.` });
  } catch (error) {
    console.error('adminCancelCoupon error:', error.message);
    res.status(500).json({ error: 'Could not cancel the coupon' });
  }
};

module.exports = {
  listRewards,
  redeemReward,
  listMyCoupons,
  useMyCoupon,
  adminListRewards,
  adminCreateReward,
  adminUpdateReward,
  adminSetRewardActive,
  adminDeleteReward,
  adminListCoupons,
  adminUseCoupon,
  adminCancelCoupon,
};