const { pool } = require('../config/database');
const { crearNotificacion, enviarNotificacionAUsuario, notificarAdministradores } = require('./notificationService');

/**
 * Genera un nuevo número de pedido
 */
async function generarNumeroPedido(connection) {
  const [config] = await connection.query(
    'SELECT valor FROM configuracion WHERE clave = "contador_pedido" FOR UPDATE'
  );
  const contador = parseInt(config[0].valor) + 1;
  await connection.query(
    'UPDATE configuracion SET valor = ? WHERE clave = "contador_pedido"',
    [contador]
  );
  return `BUC-${new Date().getFullYear()}-${String(contador).padStart(4, '0')}`;
}

/**
 * Registra un cambio de estado en el historial
 */
async function registrarEstado(connection, pedidoId, estado, descripcion, ubicacion, usuarioId, origen = 'manual') {
  await connection.query(
    `INSERT INTO estados_pedido (pedido_id, estado, descripcion, ubicacion, usuario_id, origen)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [pedidoId, estado, descripcion || '', ubicacion || '', usuarioId, origen]
  );
}

/**
 * Obtiene los datos de un pedido
 */
async function obtenerDatosPedido(connection, pedidoId) {
  const [pedidos] = await connection.query(
    'SELECT * FROM pedidos WHERE id = ?',
    [pedidoId]
  );
  return pedidos.length > 0 ? pedidos[0] : null;
}

module.exports = {
  generarNumeroPedido,
  registrarEstado,
  obtenerDatosPedido
};