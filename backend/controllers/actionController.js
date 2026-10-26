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

// Which action closes which kind of item.
const ACTIONS = { recycled: 'recyclable', disposed: 'damaged' };

// POST /api/history/:id/confirm   body: { action: 'recycled' | 'disposed' }
// Closes the case. Recycling and disposal never earn points.
const confirmAction = async (req, res) => {
  try {
    const action = String(req.body.action || '');
    const requiredCategory = ACTIONS[action];

    if (!requiredCategory) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const result = await ClassificationResult.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId, category: requiredCategory, status: 'pending' },
      { status: action, pointsAwarded: 0 },
      { new: true }
    );

    if (!result) {
      const existing = await ClassificationResult.findOne({ _id: req.params.id, userId: req.userId });
      if (!existing) return res.status(404).json({ error: 'Item not found' });
      if (existing.category !== requiredCategory) {
        return res.status(400).json({ error: `Only ${requiredCategory} items use this action` });
      }
      return res.status(400).json({ error: 'Already actioned' });
    }

    const user = await User.findById(req.userId).select('rewardPoints');

    res.json({ status: action, pointsAwarded: 0, totalRewardPoints: user ? user.rewardPoints : 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to close this item' });
  }
};

module.exports = { selfUse, confirmAction };