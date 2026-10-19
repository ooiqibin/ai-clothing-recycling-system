const express = require('express');
const router = express.Router();
const { listDonations } = require('../controllers/adminDonationController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/admin/donations', protect, restrictTo('admin'), listDonations);

module.exports = router;