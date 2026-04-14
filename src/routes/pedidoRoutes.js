const express = require('express');
const router = express.Router();
const {
  obtenerPedidos,
  obtenerPedidoPorId,
  crearPedido,
  actualizarEstadoPedido,
  asignarNumeroGuia,
  confirmarEntrega
} = require('../controllers/pedidoController');
const { authenticateToken, requireBodegueroOrAdmin } = require('../middlewares/auth');
const { validateRequired, validateEstado } = require('../middlewares/validator');

// GET /api/pedidos
router.get('/', authenticateToken, obtenerPedidos);

// GET /api/pedidos/:id
router.get('/:id', authenticateToken, obtenerPedidoPorId);

// POST /api/pedidos
router.post('/',
  authenticateToken,
  requireBodegueroOrAdmin,
  validateRequired(['cliente_id', 'ciudad_destino', 'direccion_entrega']),
  crearPedido
);

// PUT /api/pedidos/:id/estado
router.put('/:id/estado',
  authenticateToken,
  requireBodegueroOrAdmin,
  validateRequired(['nuevo_estado']),
  validateEstado,
  actualizarEstadoPedido
);

// PUT /api/pedidos/:id/guia — Asignar número de guía (solo bodeguero y admin)
router.put('/:id/guia',
  authenticateToken,
  requireBodegueroOrAdmin,
  validateRequired(['numero_guia', 'transportadora_id']),
  asignarNumeroGuia
);

// PUT /api/pedidos/:id/confirmar-entrega — Cliente confirma recepción
router.put('/:id/confirmar-entrega',
  authenticateToken,
  confirmarEntrega
);

module.exports = router;