const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const crypto = require('crypto');
const ClassificationResult = require('../models/ClassificationResult');

const AI_SERVICE_URL ='https://ai-clothing-recycling-system-1.onrender.com/predict';

const POTENTIAL_POINTS_MAP = {
  reusable: 10,
  recyclable: 5,
  damaged: 1,
};

const classifyImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  try {
    // Compute a hash of the image to detect duplicate submissions
    const fileBuffer = fs.readFileSync(req.file.path);
    const imageHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const existing = await ClassificationResult.findOne({
      userId: req.userId,
      imageHash,
    });

    if (existing) {
      fs.unlink(req.file.path, () => {});
      return res.status(409).json({
        error: 'You have already submitted this exact item before.',
      });
    }

    const formData = new FormData();
    formData.append('image', fs.createReadStream(req.file.path));

    const aiResponse = await axios.post(AI_SERVICE_URL, formData, {
      headers: formData.getHeaders(),
    });

    const { category, confidence } = aiResponse.data;
    const potentialPoints = POTENTIAL_POINTS_MAP[category] || 0;

    const savedResult = await ClassificationResult.create({
      userId: req.userId,
      category,
      confidence,
      status: 'pending',
      potentialPoints,
      pointsAwarded: 0,
      imageFilename: req.file.filename,
      imageHash,
    });

    res.json({
      resultId: savedResult._id,
      category,
      confidence,
      potentialPoints,
      imageUrl: `/uploads/${req.file.filename}`,
    });

  } catch (error) {
    console.error('Classification error:', {
      message: error.message,
      status: error.response?.status,
      response: error.response?.data,
      url: error.config?.url,
    });

    res.status(500).json({
      error: 'Classification failed.',
      details: error.response?.data || error.message,
    });
  }
};

module.exports = { classifyImage };