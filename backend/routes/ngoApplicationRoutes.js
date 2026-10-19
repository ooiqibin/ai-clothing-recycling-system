const express = require('express');
const router = express.Router();
const {
  listApplications,
  approveApplication,
  rejectApplication,
  getMyApplication,
} = require('../controllers/ngoApplicationController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Any logged-in user: see the status of their own NGO application
router.get('/ngo/application', protect, getMyApplication);

// Admin only
router.get('/admin/ngo-applications', protect, restrictTo('admin'), listApplications);
router.post('/admin/ngo-applications/:id/approve', protect, restrictTo('admin'), approveApplication);
router.post('/admin/ngo-applications/:id/reject', protect, restrictTo('admin'), rejectApplication);

module.exports = router;