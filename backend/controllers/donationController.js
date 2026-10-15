const ClassificationResult = require('../models/ClassificationResult');
const DonationBatch = require('../models/DonationBatch');
const User = require('../models/User');

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
    }).populate('itemIds');

    let activeBatchData = null;
    if (activeBatch) {
      activeBatchData = {
        verificationCode: activeBatch.verificationCode,
        totalPoints: activeBatch.totalPoints,
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
const prepareDonationBatch = async (req, res) => {
  try {
    const { itemIds } = req.body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: 'Select at least one item to donate' });
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
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const batch = await DonationBatch.create({
      userId: req.userId,
      itemIds: items.map((i) => i._id),
      verificationCode,
      totalPoints,
    });

    await ClassificationResult.updateMany(
      { _id: { $in: items.map((i) => i._id) } },
      { $set: { batchId: batch._id, status: 'awaiting_verification' } }
    );

    res.json({ verificationCode, totalPoints, itemCount: items.length });

  } catch (error) {
    console.error('Error preparing donation batch:', error.message);
    res.status(500).json({ error: 'Failed to prepare donation batch' });
  }
};

// POST /api/verify (NGO side)
// body: { verificationCode }
const verifyDonationBatch = async (req, res) => {
  try {
    const { verificationCode } = req.body;

    if (!verificationCode) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const batch = await DonationBatch.findOne({
      verificationCode,
      status: 'awaiting_verification',
    });

    if (!batch) {
      return res.status(404).json({ error: 'Invalid or already-used verification code' });
    }

    batch.status = 'verified';
    batch.verifiedAt = new Date();
    await batch.save();

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
      donorName: donor.name,
    });

  } catch (error) {
    console.error('Error verifying donation batch:', error.message);
    res.status(500).json({ error: 'Failed to verify donation batch' });
  }
};

module.exports = { getDonationBasket, prepareDonationBatch, verifyDonationBatch };