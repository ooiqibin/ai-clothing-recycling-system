const express = require('express');
const router = express.Router();
const { getHistory, getHistoryItem, getMe } = require('../controllers/historyController');
const { protect } = require('../middleware/authMiddleware');

router.get('/history', protect, getHistory);
router.get('/history/:id', protect, getHistoryItem);
router.get('/user/me', protect, getMe);

module.exports = router;