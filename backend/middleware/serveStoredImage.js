const StoredImage = require('../models/StoredImage');

// Used when a photo is no longer on the server's disk.
const serveStoredImage = async (req, res) => {
  try {
    const filename = decodeURIComponent(req.path.replace(/^\//, ''));
    if (!filename) return res.status(404).end();

    const image = await StoredImage.findOne({ filename });
    if (!image) return res.status(404).end();

    res.set('Content-Type', image.contentType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(image.data);
  } catch (error) {
    res.status(404).end();
  }
};

module.exports = serveStoredImage;