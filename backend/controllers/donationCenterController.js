const mongoose = require('mongoose');
const DonationCenter = require('../models/DonationCenter');

const EDITABLE_FIELDS = [
  'name',
  'address',
  'latitude',
  'longitude',
  'phone',
  'openingHours',
  'notes',
  'isActive',
];

function pickFields(body) {
  const data = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  return data;
}

function validationMessage(error) {
  if (error.name === 'ValidationError') {
    return Object.values(error.errors).map((e) => e.message).join(', ');
  }
  return null;
}

// Any logged-in user: active centres only (this is what the app map uses).
const getDonationCenters = async (req, res) => {
  try {
    const centers = await DonationCenter.find({ isActive: true })
      .select('name address latitude longitude phone openingHours notes')
      .lean();

    res.json({ centers });
  } catch (error) {
    console.error('getDonationCenters error:', error.message);
    res.status(500).json({ error: 'Could not load donation centres' });
  }
};

// Admin: everything, including hidden ones.
const getAllDonationCenters = async (req, res) => {
  try {
    const centers = await DonationCenter.find().sort({ createdAt: -1 }).lean();
    res.json({ centers });
  } catch (error) {
    console.error('getAllDonationCenters error:', error.message);
    res.status(500).json({ error: 'Could not load donation centres' });
  }
};

const createDonationCenter = async (req, res) => {
  try {
    const center = await DonationCenter.create({
      ...pickFields(req.body),
      createdBy: req.userId,
    });
    res.status(201).json({ center });
  } catch (error) {
    const message = validationMessage(error);
    if (message) return res.status(400).json({ error: message });

    console.error('createDonationCenter error:', error.message);
    res.status(500).json({ error: 'Could not create the donation centre' });
  }
};

const updateDonationCenter = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid donation centre id' });
    }

    const center = await DonationCenter.findByIdAndUpdate(
      req.params.id,
      pickFields(req.body),
      { new: true, runValidators: true }
    );

    if (!center) {
      return res.status(404).json({ error: 'Donation centre not found' });
    }

    res.json({ center });
  } catch (error) {
    const message = validationMessage(error);
    if (message) return res.status(400).json({ error: message });

    console.error('updateDonationCenter error:', error.message);
    res.status(500).json({ error: 'Could not update the donation centre' });
  }
};

const deleteDonationCenter = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid donation centre id' });
    }

    const center = await DonationCenter.findByIdAndDelete(req.params.id);

    if (!center) {
      return res.status(404).json({ error: 'Donation centre not found' });
    }

    res.json({ message: 'Donation centre deleted' });
  } catch (error) {
    console.error('deleteDonationCenter error:', error.message);
    res.status(500).json({ error: 'Could not delete the donation centre' });
  }
};

module.exports = {
  getDonationCenters,
  getAllDonationCenters,
  createDonationCenter,
  updateDonationCenter,
  deleteDonationCenter,
};