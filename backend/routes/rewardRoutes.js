const express = require('express');
const router = express.Router();
const {
  listRewards,
  redeemReward,
  listMyCoupons,
  useMyCoupon,
  adminListRewards,
  adminCreateReward,
  adminUpdateReward,
  adminSetRewardActive,
  adminDeleteReward,
  adminListCoupons,
  adminUseCoupon,
  adminCancelCoupon,
} = require('../controllers/rewardController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// App users
router.get('/rewards', protect, listRewards);
router.post('/rewards/:id/redeem', protect, redeemReward);
router.get('/coupons/mine', protect, listMyCoupons);
router.post('/coupons/:id/use', protect, useMyCoupon);

// Admin
router.get('/admin/rewards', protect, restrictTo('admin'), adminListRewards);
router.post('/admin/rewards', protect, restrictTo('admin'), adminCreateReward);
router.put('/admin/rewards/:id', protect, restrictTo('admin'), adminUpdateReward);
router.post('/admin/rewards/:id/active', protect, restrictTo('admin'), adminSetRewardActive);
router.delete('/admin/rewards/:id', protect, restrictTo('admin'), adminDeleteReward);
router.get('/admin/coupons', protect, restrictTo('admin'), adminListCoupons);
router.post('/admin/coupons/:id/use', protect, restrictTo('admin'), adminUseCoupon);
router.post('/admin/coupons/:id/cancel', protect, restrictTo('admin'), adminCancelCoupon);

module.exports = router;