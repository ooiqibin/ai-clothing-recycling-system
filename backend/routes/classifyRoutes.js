const fs = require('fs');
const express = require('express');
const multer = require('multer');
const router = express.Router();
const { classifyImage } = require('../controllers/classifyController');
const { protect } = require('../middleware/authMiddleware');
const persistUpload = require('../middleware/persistUpload');

// The folder is not in git, so make sure it exists (multer will not create it).
fs.mkdirSync('uploads', { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

router.post('/classify', protect, upload.single('image'), persistUpload, classifyImage);

module.exports = router;