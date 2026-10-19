const express = require('express');
const router = express.Router();
const { getNgoOverview } = require('../controllers/ngoOverviewController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/ngo/overview', protect, restrictTo('ngo'), getNgoOverview);

module.exports = router;