const express = require('express');
const router = express.Router();
const {
  registerUser,
  registerNgo,
  verifyEmail,
  resendCode,
  forgotPassword,
  resetPassword,
  loginUser,
} = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/register-ngo', registerNgo);
router.post('/verify-email', verifyEmail);
router.post('/resend-code', resendCode);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/login', loginUser);

module.exports = router;