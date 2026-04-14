const express = require('express');
const router = express.Router();
const {
  obtenerStatsAdmin,
  obtenerStatsBodeguero
} = require('../controllers/statsController');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');

// GET /api/stats/admin
router.get('/admin', authenticateToken, requireAdmin, obtenerStatsAdmin);

// GET /api/stats/bodeguero/:id
router.get('/bodeguero/:id', authenticateToken, obtenerStatsBodeguero);

module.exports = router;