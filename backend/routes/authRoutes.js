const express = require('express');
const router = express.Router();
const { registerUser, registerNgo, loginUser } = require('../controllers/authController');

// POST /api/auth/register
router.post('/register', registerUser);

// POST /api/auth/login
router.post('/login', loginUser);

router.post('/register-ngo', registerNgo);

module.exports = router;