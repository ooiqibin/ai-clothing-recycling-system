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
const { googleAuth } =
  require('../controllers/googleAuthController');

router.post('/register', registerUser);
router.post('/register-ngo', registerNgo);
router.post('/verify-email', verifyEmail);
router.post('/resend-code', resendCode);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/login', loginUser);
router.post('/google', googleAuth);

module.exports = router;