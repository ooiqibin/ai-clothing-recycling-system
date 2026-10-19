const express = require('express');
const router = express.Router();
const {
  listPublishedTips,
  listMyTips,
  createNgoTip,
  deleteMyTip,
  listAllTips,
  createAdminTip,
  updateTip,
  approveTip,
  rejectTip,
  deleteTip,
} = require('../controllers/ecoTipController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Any logged-in user: published tips
router.get('/eco-tips', protect, listPublishedTips);

// NGO accounts: submit and manage their own tips
router.get('/ngo/eco-tips', protect, restrictTo('ngo'), listMyTips);
router.post('/ngo/eco-tips', protect, restrictTo('ngo'), createNgoTip);
router.delete('/ngo/eco-tips/:id', protect, restrictTo('ngo'), deleteMyTip);

// Admin: manage everything
router.get('/admin/eco-tips', protect, restrictTo('admin'), listAllTips);
router.post('/admin/eco-tips', protect, restrictTo('admin'), createAdminTip);
router.put('/admin/eco-tips/:id', protect, restrictTo('admin'), updateTip);
router.post('/admin/eco-tips/:id/approve', protect, restrictTo('admin'), approveTip);
router.post('/admin/eco-tips/:id/reject', protect, restrictTo('admin'), rejectTip);
router.delete('/admin/eco-tips/:id', protect, restrictTo('admin'), deleteTip);

module.exports = router;