const express = require('express');
const multer = require('multer');
const router = express.Router();
const { classifyImage } = require('../controllers/classifyController');
const { protect } = require('../middleware/authMiddleware');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

router.post('/classify', protect, upload.single('image'), classifyImage);

module.exports = router;