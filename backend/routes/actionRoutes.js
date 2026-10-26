const express = require('express');
const router = express.Router();
const { selfUse, confirmAction } = require('../controllers/actionController');
const { protect } = require('../middleware/authMiddleware');

router.post('/history/:id/self-use', protect, selfUse);
router.post('/history/:id/confirm', protect, confirmAction);

module.exports = router;