const express = require('express');
const router = express.Router();
const { getAnalytics } = require('../controllers/analyticsController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/admin/analytics', protect, restrictTo('admin'), getAnalytics);

module.exports = router;