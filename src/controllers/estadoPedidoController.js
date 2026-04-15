const { pool } = require('../config/database');
const { ROLES } = require('../utils/constants');

/**
 * Obtener historial de estados de un pedido
 */
async function obtenerHistorialPedido(req, res) {
  try {
    const pedidoId = req.params.pedido_id;

    // Verificar permisos
    const { rol, id: userId } = req.user;

    // Obtener datos del pedido para validar permisos
    const [pedidos] = await pool.query(
      'SELECT cliente_id, bodeguero_id FROM pedidos WHERE id = ?',
      [pedidoId]
    );

    if (pedidos.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const pedido = pedidos[0];

    // Validar permisos según rol
    if (rol === ROLES.CLIENTE && pedido.cliente_id !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para ver este historial' });
    }
    if (rol === ROLES.BODEGUERO && pedido.bodeguero_id !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para ver este historial' });
    }

    // Obtener historial
    const [estados] = await pool.query(
      `SELECT e.*, u.nombre as usuario_nombre
       FROM estados_pedido e
       LEFT JOIN usuarios u ON e.usuario_id = u.id
       WHERE e.pedido_id = ?
       ORDER BY e.fecha_registro ASC`,
      [pedidoId]
    );

    res.json({ success: true, estados, total: estados.length });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: 'Error al obtener historial', details: error.message });
  }
}

/**
 * Obtener todos los estados (filtrado por pedido - solo admin)
 */
async function listarEstados(req, res) {
  try {
    const { pedido_id, origen, es_subpaso_transportadora } = req.query;

    let query = `
      SELECT e.*, u.nombre as usuario_nombre, p.numero_pedido
      FROM estados_pedido e
      LEFT JOIN usuarios u ON e.usuario_id = u.id
      LEFT JOIN pedidos p ON e.pedido_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (pedido_id) {
      query += ' AND e.pedido_id = ?';
      params.push(pedido_id);
    }

    if (origen) {
      query += ' AND e.origen = ?';
      params.push(origen);
    }

    if (es_subpaso_transportadora !== undefined) {
      query += ' AND e.es_subpaso_transportadora = ?';
      params.push(es_subpaso_transportadora === 'true' ? 1 : 0);
    }

    query += ' ORDER BY e.fecha_registro DESC LIMIT 100';

    const [estados] = await pool.query(query, params);
    res.json({ success: true, estados, total: estados.length });
  } catch (error) {
    console.error('Error al listar estados:', error);
    res.status(500).json({ error: 'Error al listar estados', details: error.message });
  }
}

/**
 * Obtener estado por ID
 */
async function obtenerEstado(req, res) {
  try {
    const [estados] = await pool.query(
      `SELECT e.*, u.nombre as usuario_nombre, p.numero_pedido
       FROM estados_pedido e
       LEFT JOIN usuarios u ON e.usuario_id = u.id
       LEFT JOIN pedidos p ON e.pedido_id = p.id
       WHERE e.id = ?`,
      [req.params.id]
    );

    if (estados.length === 0) {
      return res.status(404).json({ error: 'Estado no encontrado' });
    }

    res.json({ success: true, estado: estados[0] });
  } catch (error) {
    console.error('Error al obtener estado:', error);
    res.status(500).json({ error: 'Error al obtener estado', details: error.message });
  }
}

/**
 * Crear estado manualmente (solo admin/vendedor)
 * Nota: Normalmente los estados se crean automáticamente desde pedidos
 */
async function crearEstado(req, res) {
  try {
    const { pedido_id, estado, descripcion, ubicacion, es_subpaso_transportadora } = req.body;
    const { id: userId } = req.user;

    if (!pedido_id || !estado) {
      return res.status(400).json({ error: 'pedido_id y estado son requeridos' });
    }

    // Verificar que el pedido existe
    const [pedidos] = await pool.query('SELECT id FROM pedidos WHERE id = ?', [pedido_id]);
    if (pedidos.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const [result] = await pool.query(
      `INSERT INTO estados_pedido (pedido_id, estado, descripcion, ubicacion, es_subpaso_transportadora, usuario_id, origen)
       VALUES (?, ?, ?, ?, ?, ?, 'manual')`,
      [pedido_id, estado, descripcion || '', ubicacion || '', es_subpaso_transportadora ? 1 : 0, userId]
    );

    res.status(201).json({
      success: true,
      message: 'Estado registrado exitosamente',
      estado: {
        id: result.insertId,
        pedido_id,
        estado,
        descripcion,
        ubicacion
      }
    });
  } catch (error) {
    console.error('Error al crear estado:', error);
    res.status(500).json({ error: 'Error al crear estado', details: error.message });
  }
}

module.exports = {
  obtenerHistorialPedido,
  listarEstados,
  obtenerEstado,
  crearEstado
};