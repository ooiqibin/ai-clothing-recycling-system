const express = require('express');
const multer = require('multer');
const router = express.Router();
const { selfUse, recycleProof, confirmAction } = require('../controllers/actionController');
const { protect } = require('../middleware/authMiddleware');

const upload = multer({ dest: 'uploads/' });

router.post('/history/:id/self-use', protect, selfUse);
router.post('/history/:id/recycle-proof', protect, upload.single('proof'), recycleProof);
router.post('/history/:id/confirm', protect, confirmAction);

module.exports = router;