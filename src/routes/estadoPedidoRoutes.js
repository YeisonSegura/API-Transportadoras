const express = require('express');
const router = express.Router();
const {
  obtenerHistorialPedido,
  listarEstados,
  obtenerEstado,
  crearEstado
} = require('../controllers/estadoPedidoController');
const { authenticateToken, requireAdmin, requireBodegueroOrAdmin } = require('../middlewares/auth');
const { validateRequired } = require('../middlewares/validator');

// GET /api/estados-pedido - Listar todos los estados (admin)
router.get('/', authenticateToken, requireAdmin, listarEstados);

// GET /api/estados-pedido/pedido/:pedido_id - Historial de un pedido
router.get('/pedido/:pedido_id', authenticateToken, obtenerHistorialPedido);

// GET /api/estados-pedido/:id - Obtener estado por ID
router.get('/:id', authenticateToken, obtenerEstado);

// POST /api/estados-pedido - Crear estado manualmente (bodeguero/admin)
router.post('/',
  authenticateToken,
  requireBodegueroOrAdmin,
  validateRequired(['pedido_id', 'estado']),
  crearEstado
);

module.exports = router;