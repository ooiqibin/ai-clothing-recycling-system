const ClassificationResult = require('../models/ClassificationResult');
const DonationBatch = require('../models/DonationBatch');
const User = require('../models/User');
const mongoose = require('mongoose');
const DonationCenter = require('../models/DonationCenter');
const { POINTS_PER_DONATED_ITEM } = require('../config/points');

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
      potentialPoints: POINTS_PER_DONATED_ITEM,
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
          potentialPoints: POINTS_PER_DONATED_ITEM,
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

    const totalPoints = items.length * POINTS_PER_DONATED_ITEM;

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
      {
        $set: {
          batchId: batch._id,
          status: 'awaiting_verification',
          potentialPoints: POINTS_PER_DONATED_ITEM,
        },
      }
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

const previewDonationBatch = async (req, res) => {
  try {
    if (req.userRole !== 'ngo' && req.userRole !== 'admin') {
      return res.status(403).json({
        error: 'Only NGO personnel can inspect donations'
      });
    }

    const verificationCode = String(
      req.body.verificationCode || ''
    ).trim();

    if (!/^\d{6}$/.test(verificationCode)) {
      return res.status(400).json({
        error: 'A valid 6-digit verification code is required'
      });
    }

    const batch = await DonationBatch.findOne({
      verificationCode,
      status: 'awaiting_verification'
    })
      .populate('userId', 'name email')
      .populate(
        'itemIds',
        'category imageFilename createdAt'
      )
      .populate('centerId', 'name address');

    if (!batch) {
      return res.status(404).json({
        error: 'Invalid or already-used verification code'
      });
    }

    // NGO personnel can only inspect donations assigned
    // to their own donation centre.
    if (req.userRole === 'ngo') {
      if (!req.userCenterId) {
        return res.status(403).json({
          error: 'Your NGO account is not linked to a donation centre'
        });
      }

      if (
        batch.centerId &&
        String(batch.centerId._id || batch.centerId) !==
          String(req.userCenterId)
      ) {
        return res.status(403).json({
          error: 'This donation belongs to a different centre'
        });
      }
    }

    return res.json({
      verificationCode: batch.verificationCode,
      donorName: batch.userId?.name || 'Unknown donor',
      centreName: batch.centerId?.name || null,
      itemCount: batch.itemIds.length,

      items: batch.itemIds.map((item) => ({
        id: String(item._id),
        category: item.category,
        imageUrl: item.imageFilename
          ? `/uploads/${item.imageFilename}`
          : null,
        pointsPerItem: POINTS_PER_DONATED_ITEM
      }))
    });
  } catch (error) {
    console.error('Preview donation error:', error);

    return res.status(500).json({
      error: 'Failed to load donation details'
    });
  }
};

// POST /api/verify (NGO staff and admins only)
// body: { verificationCode, centerId? }   centerId is only used when an admin verifies
const verifyDonationBatch = async (req, res) => {
  try {
    if (req.userRole !== 'ngo' && req.userRole !== 'admin') {
      return res.status(403).json({
        error: 'Only NGO personnel can verify donations'
      });
    }

    const verificationCode = String(
      req.body.verificationCode || ''
    ).trim();

    const { acceptedItemIds } = req.body;

    if (!/^\d{6}$/.test(verificationCode)) {
      return res.status(400).json({
        error: 'Invalid verification code'
      });
    }

    if (
      !Array.isArray(acceptedItemIds) ||
      acceptedItemIds.length === 0
    ) {
      return res.status(400).json({
        error: 'Select at least one received item'
      });
    }

    if (
      acceptedItemIds.some(
        id => !mongoose.isValidObjectId(id)
      ) ||
      new Set(acceptedItemIds.map(String)).size !==
        acceptedItemIds.length
    ) {
      return res.status(400).json({
        error: 'Invalid or duplicate item IDs'
      });
    }

    const waiting = await DonationBatch.findOne({
      verificationCode,
      status: 'awaiting_verification'
    }).select('userId centerId itemIds');

    if (!waiting) {
      return res.status(404).json({
        error: 'Invalid or already-used verification code'
      });
    }

    // Check the NGO's assigned centre.
    let centerId = waiting.centerId || null;

    if (req.userRole === 'ngo') {
      if (!req.userCenterId) {
        return res.status(403).json({
          error: 'Your NGO account has no assigned centre'
        });
      }

      if (
        centerId &&
        String(centerId) !== String(req.userCenterId)
      ) {
        return res.status(403).json({
          error: 'This donation belongs to a different centre'
        });
      }

      centerId = req.userCenterId;
    }

    // Every accepted ID must belong to this batch.
    const originalIds = waiting.itemIds.map(String);
    const originalIdSet = new Set(originalIds);

    if (
      acceptedItemIds.some(
        id => !originalIdSet.has(String(id))
      )
    ) {
      return res.status(400).json({
        error: 'Selected items do not belong to this donation'
      });
    }

    const acceptedIds = acceptedItemIds.map(
      id => new mongoose.Types.ObjectId(id)
    );

    const acceptedIdSet = new Set(
      acceptedItemIds.map(String)
    );

    const rejectedIds = waiting.itemIds.filter(
      id => !acceptedIdSet.has(String(id))
    );

    const points =
      acceptedIds.length * POINTS_PER_DONATED_ITEM;

    // Claim the batch once to prevent duplicate verification.
    const batch = await DonationBatch.findOneAndUpdate(
      {
        _id: waiting._id,
        status: 'awaiting_verification'
      },
      {
        $set: {
          status: 'verified',
          verifiedAt: new Date(),
          verifiedBy: req.userId,
          centerId,
          itemIds: acceptedIds,
          totalPoints: points
        }
      },
      { new: true }
    );

    if (!batch) {
      return res.status(409).json({
        error: 'This donation has already been verified'
      });
    }

    // Accepted items: mark as donated and award 5 points each.
    await ClassificationResult.updateMany(
      {
        _id: { $in: acceptedIds },
        userId: batch.userId,
        batchId: batch._id,
        status: 'awaiting_verification'
      },
      {
        $set: {
          status: 'donated',
          pointsAwarded: POINTS_PER_DONATED_ITEM
        }
      }
    );

    // Unaccepted items: return them to the user's pending basket.
    if (rejectedIds.length > 0) {
      await ClassificationResult.updateMany(
        {
          _id: { $in: rejectedIds },
          userId: batch.userId,
          batchId: batch._id,
          status: 'awaiting_verification'
        },
        {
          $set: {
            status: 'pending',
            batchId: null,
            pointsAwarded: 0
          }
        }
      );
    }

    const donor = await User.findByIdAndUpdate(
      batch.userId,
      { $inc: { rewardPoints: points } },
      { new: true }
    );

    return res.json({
      itemCount: acceptedIds.length,
      rejectedItemCount: rejectedIds.length,
      pointsAwarded: points,
      donorName: donor?.name || 'the donor',
      message: `Verified ${acceptedIds.length} item(s); ${points} points awarded.`
    });
  } catch (error) {
    console.error('Verify donation error:', error);

    return res.status(500).json({
      error: 'Failed to verify donation'
    });
  }
};

module.exports = { getDonationBasket, prepareDonationBatch, previewDonationBatch, verifyDonationBatch };