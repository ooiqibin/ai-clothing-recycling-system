const express = require('express');
const router = express.Router();

const {
  getNgoOverview,
  getNgoDonationReport,
} = require('../controllers/ngoOverviewController');

const {
  protect,
  restrictTo,
} = require('../middleware/authMiddleware');

router.get(
  '/ngo/overview',
  protect,
  restrictTo('ngo'),
  getNgoOverview
);

router.get(
  '/ngo/report',
  protect,
  restrictTo('ngo'),
  getNgoDonationReport
);

module.exports = router;