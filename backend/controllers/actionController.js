const ClassificationResult = require('../models/ClassificationResult');
const User = require('../models/User');

// POST /api/history/:id/self-use - reusable item kept by the user, 0 points
const selfUse = async (req, res) => {
  try {
    const result = await ClassificationResult.findOne({ _id: req.params.id, userId: req.userId });
    if (!result) return res.status(404).json({ error: 'Item not found' });
    if (result.category !== 'reusable') return res.status(400).json({ error: 'Only reusable items can be marked self-use' });
    if (result.status !== 'pending') return res.status(400).json({ error: 'Already actioned' });

    result.status = 'self_use';
    result.pointsAwarded = 0;
    await result.save();

    res.json({ status: 'self_use', pointsAwarded: 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark self-use' });
  }
};

// POST /api/history/:id/recycle-proof - upload photo proving recycling was done, awards points
const recycleProof = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Proof photo is required' });

    const result = await ClassificationResult.findOne({ _id: req.params.id, userId: req.userId });
    if (!result) return res.status(404).json({ error: 'Item not found' });
    if (result.category !== 'recyclable') return res.status(400).json({ error: 'Only recyclable items need proof' });
    if (result.status !== 'pending') return res.status(400).json({ error: 'Already actioned' });

    result.status = 'recycled';
    result.pointsAwarded = result.potentialPoints;
    result.recycleProofFilename = req.file.filename;
    await result.save();

    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { $inc: { rewardPoints: result.pointsAwarded } },
      { new: true }
    );

    res.json({ status: 'recycled', pointsAwarded: result.pointsAwarded, totalRewardPoints: updatedUser.rewardPoints });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit recycle proof' });
  }
};

// POST /api/history/:id/confirm - damaged items only now
const confirmAction = async (req, res) => {
  try {
    const { action } = req.body;
    if (action !== 'disposed') return res.status(400).json({ error: 'Invalid action' });

    const result = await ClassificationResult.findOne({ _id: req.params.id, userId: req.userId });
    if (!result) return res.status(404).json({ error: 'Item not found' });
    if (result.category !== 'damaged') return res.status(400).json({ error: 'Only damaged items use this action' });
    if (result.status !== 'pending') return res.status(400).json({ error: 'Already actioned' });

    result.status = 'disposed';
    result.pointsAwarded = result.potentialPoints;
    await result.save();

    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { $inc: { rewardPoints: result.pointsAwarded } },
      { new: true }
    );

    res.json({ status: 'disposed', pointsAwarded: result.pointsAwarded, totalRewardPoints: updatedUser.rewardPoints });
  } catch (error) {
    res.status(500).json({ error: 'Failed to confirm disposal' });
  }
};

module.exports = { selfUse, recycleProof, confirmAction };