const express = require('express');
const router = express.Router();
const { login, register } = require('../controllers/authController');
const { validateRequired, validateEmail } = require('../middlewares/validator');
const { resetPassword } = require('../controllers/resetPasswordController');

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/register
router.post('/register',
  validateRequired(['nombre', 'email', 'username', 'password']),
  validateEmail,
  register
);

// POST /api/auth/reset-password
router.post('/reset-password', resetPassword);

module.exports = router;
