const express = require('express');
const router = express.Router();
const {
  getDonationCenters,
  getAllDonationCenters,
  createDonationCenter,
  updateDonationCenter,
  deleteDonationCenter,
} = require('../controllers/donationCenterController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// App users: active centres for the map
router.get('/donation-centers', protect, getDonationCenters);

// Admin only: manage centres
router.get('/admin/donation-centers', protect, restrictTo('admin'), getAllDonationCenters);
router.post('/admin/donation-centers', protect, restrictTo('admin'), createDonationCenter);
router.put('/admin/donation-centers/:id', protect, restrictTo('admin'), updateDonationCenter);
router.delete('/admin/donation-centers/:id', protect, restrictTo('admin'), deleteDonationCenter);

module.exports = router;