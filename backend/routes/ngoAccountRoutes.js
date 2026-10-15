const express = require('express');
const router = express.Router();
const {
  listNgoAccounts,
  createNgoAccount,
  deleteNgoAccount,
} = require('../controllers/ngoAccountController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/admin/ngo-accounts', protect, restrictTo('admin'), listNgoAccounts);
router.post('/admin/ngo-accounts', protect, restrictTo('admin'), createNgoAccount);
router.delete('/admin/ngo-accounts/:id', protect, restrictTo('admin'), deleteNgoAccount);

module.exports = router;