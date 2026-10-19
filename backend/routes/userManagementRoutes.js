const express = require('express');
const router = express.Router();
const {
  listUsers,
  suspendUser,
  reactivateUser,
} = require('../controllers/userManagementController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/admin/users', protect, restrictTo('admin'), listUsers);
router.post('/admin/users/:id/suspend', protect, restrictTo('admin'), suspendUser);
router.post('/admin/users/:id/reactivate', protect, restrictTo('admin'), reactivateUser);

module.exports = router;