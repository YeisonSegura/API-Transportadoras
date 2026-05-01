const express = require('express');
const router = express.Router();
const { login, register, refreshToken, getMe } = require('../controllers/authController');
const { validateRequired, validateEmail } = require('../middlewares/validator');
const { resetPassword } = require('../controllers/resetPasswordController');
const { authenticateToken } = require('../middlewares/auth');

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/register
router.post('/register',
  validateRequired(['nombre', 'email', 'username', 'password']),
  validateEmail,
  register
);

// POST /api/auth/refresh - Refrescar token JWT expirado
router.post('/refresh', refreshToken);

// POST /api/auth/reset-password
router.post('/reset-password', resetPassword);

module.exports = router;
