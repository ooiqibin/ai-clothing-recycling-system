const fs = require('fs/promises');
const sharp = require('sharp');
const StoredImage = require('../models/StoredImage');

const MAX_SIDE = 1024;

// Keeps a small copy of each uploaded photo in the database, because the
// server's disk is wiped when it restarts. The original file stays on disk
// for the AI call.
const persistUpload = async (req, res, next) => {
  if (!req.file) return next();

  try {
    const original = await fs.readFile(req.file.path);

    const data = await sharp(original)
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    await StoredImage.findOneAndUpdate(
      { filename: req.file.filename },
      { filename: req.file.filename, contentType: 'image/jpeg', data },
      { upsert: true }
    );
  } catch (error) {
    // A failed backup must not stop the scan.
    console.error('Could not save a copy of the upload:', error.message);
  }

  next();
};

module.exports = persistUpload;