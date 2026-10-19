const ClassificationResult = require('../models/ClassificationResult');
const DonationBatch = require('../models/DonationBatch');
const User = require('../models/User');
const mongoose = require('mongoose');
const DonationCenter = require('../models/DonationCenter');

// GET /api/donation-basket
// Returns the user's un-batched reusable items, plus their currently active
// batch (if one is awaiting NGO verification).
const getDonationBasket = async (req, res) => {
  try {
    const pendingItems = await ClassificationResult.find({
      userId: req.userId,
      category: 'reusable',
      status: 'pending',
      batchId: null,
    }).sort({ createdAt: -1 });

    const pendingItemsWithUrls = pendingItems.map((r) => ({
      ...r.toObject(),
      imageUrl: `/uploads/${r.imageFilename}`,
    }));

    const activeBatch = await DonationBatch.findOne({
      userId: req.userId,
      status: 'awaiting_verification',
      }).populate('itemIds').populate('centerId', 'name address');

    let activeBatchData = null;
    if (activeBatch) {
      activeBatchData = {
        verificationCode: activeBatch.verificationCode,
        totalPoints: activeBatch.totalPoints,
        centre: activeBatch.centerId && activeBatch.centerId.name
          ? { name: activeBatch.centerId.name, address: activeBatch.centerId.address || '' }
          : null,
        items: activeBatch.itemIds.map((item) => ({
          ...item.toObject(),
          imageUrl: `/uploads/${item.imageFilename}`,
        })),
      };
    }

    res.json({ pendingItems: pendingItemsWithUrls, activeBatch: activeBatchData });
  } catch (error) {
    console.error('Error fetching donation basket:', error.message);
    res.status(500).json({ error: 'Failed to fetch donation basket' });
  }
};

// POST /api/donation-basket/prepare
// body: { itemIds: [...] }
// POST /api/donation-basket/prepare
// body: { itemIds: [...], centerId }
const prepareDonationBatch = async (req, res) => {
  try {
    const { itemIds, centerId } = req.body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: 'Select at least one item to donate' });
    }

    if (!mongoose.isValidObjectId(centerId)) {
      return res.status(400).json({ error: 'Please choose a donation centre' });
    }

    const centre = await DonationCenter.findOne({ _id: centerId, isActive: true }).select('name');
    if (!centre) {
      return res.status(400).json({ error: 'That donation centre is not available' });
    }

    // Block starting a new batch while one is already awaiting verification
    const existingActive = await DonationBatch.findOne({
      userId: req.userId,
      status: 'awaiting_verification',
    });
    if (existingActive) {
      return res.status(400).json({ error: 'You already have a donation batch awaiting verification' });
    }

    const items = await ClassificationResult.find({
      _id: { $in: itemIds },
      userId: req.userId,
      category: 'reusable',
      status: 'pending',
      batchId: null,
    });

    if (items.length === 0) {
      return res.status(400).json({ error: 'No valid items found for this batch' });
    }

    const totalPoints = items.reduce((sum, item) => sum + item.potentialPoints, 0);

    // Pick a 6-digit code that no other waiting donation is using.
    let verificationCode;
    do {
      verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    } while (await DonationBatch.exists({ verificationCode, status: 'awaiting_verification' }));

    const batch = await DonationBatch.create({
      userId: req.userId,
      itemIds: items.map((i) => i._id),
      verificationCode,
      totalPoints,
      centerId: centre._id,
    });

    await ClassificationResult.updateMany(
      { _id: { $in: items.map((i) => i._id) } },
      { $set: { batchId: batch._id, status: 'awaiting_verification' } }
    );

    res.json({
      verificationCode,
      totalPoints,
      itemCount: items.length,
      centreName: centre.name,
    });

  } catch (error) {
    console.error('Error preparing donation batch:', error.message);
    res.status(500).json({ error: 'Failed to prepare donation batch' });
  }
};

// POST /api/verify (NGO staff and admins only)
// body: { verificationCode, centerId? }   centerId is only used when an admin verifies
// POST /api/verify (NGO staff and admins only)
// body: { verificationCode, centerId? }   centerId is only used by an admin, for a donation with no centre yet
const verifyDonationBatch = async (req, res) => {
  try {
    const verificationCode = String(req.body.verificationCode || '').trim();

    if (!verificationCode) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const waiting = await DonationBatch.findOne({
      verificationCode,
      status: 'awaiting_verification',
    }).select('centerId');

    if (!waiting) {
      return res.status(404).json({ error: 'Invalid or already-used verification code' });
    }

    // The centre the donor chose (older donations may not have one).
    let centerId = waiting.centerId || null;

    if (req.userRole === 'ngo') {
      if (!req.userCenterId) {
        return res.status(403).json({
          error: 'Your NGO account is not linked to a donation centre yet. Ask an admin to link it.',
        });
      }
      if (centerId && String(centerId) !== String(req.userCenterId)) {
        return res.status(403).json({
          error: 'This donation was made to a different donation centre.',
        });
      }
      centerId = req.userCenterId;
    } else if (!centerId && req.body.centerId) {
      if (!mongoose.isValidObjectId(req.body.centerId)) {
        return res.status(400).json({ error: 'Invalid donation centre' });
      }
      centerId = req.body.centerId;
    }

    // Only one request can switch awaiting_verification -> verified,
    // so points can never be given twice for the same code.
    const batch = await DonationBatch.findOneAndUpdate(
      { _id: waiting._id, status: 'awaiting_verification' },
      {
        $set: {
          status: 'verified',
          verifiedAt: new Date(),
          verifiedBy: req.userId,
          centerId,
        },
      },
      { new: true }
    );

    if (!batch) {
      return res.status(404).json({ error: 'Invalid or already-used verification code' });
    }

    await ClassificationResult.updateMany(
      { _id: { $in: batch.itemIds } },
      { $set: { status: 'donated' } }
    );

    // Set pointsAwarded per item to match its own potentialPoints
    const items = await ClassificationResult.find({ _id: { $in: batch.itemIds } });
    for (const item of items) {
      item.pointsAwarded = item.potentialPoints;
      await item.save();
    }

    const donor = await User.findByIdAndUpdate(
      batch.userId,
      { $inc: { rewardPoints: batch.totalPoints } },
      { new: true }
    );

    res.json({
      itemCount: batch.itemIds.length,
      pointsAwarded: batch.totalPoints,
      donorName: donor ? donor.name : 'the donor',
    });

  } catch (error) {
    console.error('Error verifying donation batch:', error.message);
    res.status(500).json({ error: 'Failed to verify donation batch' });
  }
};

module.exports = { getDonationBasket, prepareDonationBatch, verifyDonationBatch };