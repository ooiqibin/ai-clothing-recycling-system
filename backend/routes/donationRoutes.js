const express = require('express');
const router = express.Router();
const { getDonationBasket, prepareDonationBatch, previewDonationBatch, verifyDonationBatch } = require('../controllers/donationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/donation-basket', protect, getDonationBasket);
router.post('/donation-basket/prepare', protect, prepareDonationBatch);
router.post('/verify/preview', protect, previewDonationBatch);
router.post('/verify', protect, verifyDonationBatch);

module.exports = router;