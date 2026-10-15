const ClassificationResult = require('../models/ClassificationResult');
const User = require('../models/User');

const getHistory = async (req, res) => {
  try {
    const results = await ClassificationResult.find({ userId: req.userId })
      .sort({ createdAt: -1 });

    const resultsWithUrls = results.map((r) => ({
      ...r.toObject(),
      imageUrl: `/uploads/${r.imageFilename}`,
    }));

    res.json({ history: resultsWithUrls });
  } catch (error) {
    console.error('Error fetching history:', error.message);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
};

const getHistoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await ClassificationResult.findOne({ _id: id, userId: req.userId });
    if (!result) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({
      item: { ...result.toObject(), imageUrl: `/uploads/${result.imageFilename}` },
    });
  } catch (error) {
    console.error('Error fetching item:', error.message);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error.message);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

module.exports = { getHistory, getHistoryItem, getMe };