const express = require('express');
const router = express.Router();
const { getStats } = require('../controllers/statsController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/admin/stats', protect, restrictTo('admin'), getStats);

module.exports = router;