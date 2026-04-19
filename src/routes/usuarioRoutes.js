const express = require('express');
const router = express.Router();
const {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  obtenerClientesBodeguero,
  actualizarTokenFCM,
  listarBodegueros,
  cambiarPassword
} = require('../controllers/usuarioController');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');
const { validateRequired } = require('../middlewares/validator');

// GET /api/usuarios - Listar todos los usuarios (admin)
router.get('/', authenticateToken, requireAdmin, listarUsuarios);

// GET /api/usuarios/bodegueros/lista - Listar bodegueros
router.get('/bodegueros/lista', authenticateToken, listarBodegueros);

// GET /api/usuarios/bodegueros/:id/clientes - Clientes de un bodeguero
router.get('/bodegueros/:id/clientes', authenticateToken, obtenerClientesBodeguero);

// GET /api/usuarios/:id - Obtener usuario por ID
router.get('/:id', authenticateToken, obtenerUsuario);

// POST /api/usuarios - Crear usuario (admin)
router.post('/',
  authenticateToken,
  requireAdmin,
  validateRequired(['nombre', 'email', 'username', 'password', 'rol']),
  crearUsuario
);

// PUT /api/usuarios/:id - Actualizar usuario
router.put('/:id', authenticateToken, actualizarUsuario);

// PUT /api/usuarios/:id/fcm-token - Actualizar token FCM
router.put('/:id/fcm-token', authenticateToken, actualizarTokenFCM);

// PUT /api/usuarios/:id/cambiar-password - Cambiar contraseña
router.put('/:id/cambiar-password', authenticateToken, cambiarPassword);

// DELETE /api/usuarios/:id - Eliminar usuario (admin)
router.delete('/:id', authenticateToken, requireAdmin, eliminarUsuario);

module.exports = router;