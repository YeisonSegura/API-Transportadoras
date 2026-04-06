const { pool } = require('../config/database');
const { ROLES, TIPOS_NOTIFICACION, ESTADOS_PEDIDO } = require('../utils/constants');
const { validarCambioEstado } = require('../middlewares/validator');
const {
  generarNumeroPedido,
  registrarEstado,
  obtenerDatosPedido
} = require('../services/pedidoService');
const {
  crearNotificacion,
  enviarNotificacionAUsuario,
  notificarAdministradores
} = require('../services/notificationService');

/**
 * Obtener todos los pedidos (con filtros por rol)
 */
async function obtenerPedidos(req, res) {
  try {
    const { rol, id } = req.user;
    let query;
    let params;

    if (rol === ROLES.ADMIN) {
      query = 'SELECT * FROM vista_pedidos_completos ORDER BY fecha_creacion DESC';
      params = [];
    } else if (rol === ROLES.VENDEDOR) {
      query = 'SELECT * FROM vista_pedidos_completos WHERE vendedor_id = ? ORDER BY fecha_creacion DESC';
      params = [id];
    } else {
      query = 'SELECT * FROM vista_pedidos_completos WHERE cliente_id = ? ORDER BY fecha_creacion DESC';
      params = [id];
    }

    const [pedidos] = await pool.query(query, params);
    res.json({ success: true, pedidos });
  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    res.status(500).json({ error: 'Error al obtener pedidos', details: error.message });
  }
}

/**
 * Obtener pedido por ID
 */
async function obtenerPedidoPorId(req, res) {
  try {
    const [pedidos] = await pool.query(
      'SELECT * FROM vista_pedidos_completos WHERE id = ?',
      [req.params.id]
    );

    if (pedidos.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const pedido = pedidos[0];

    // Validar permisos
    const { rol, id: userId } = req.user;
    if (rol === ROLES.CLIENTE && pedido.cliente_id !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para ver este pedido' });
    }
    if (rol === ROLES.VENDEDOR && pedido.vendedor_id !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para ver este pedido' });
    }

    // Obtener historial de estados
    const [estados] = await pool.query(
      'SELECT * FROM estados_pedido WHERE pedido_id = ? ORDER BY fecha_registro ASC',
      [req.params.id]
    );

    res.json({ success: true, pedido, estados });
  } catch (error) {
    console.error('Error al obtener pedido:', error);
    res.status(500).json({ error: 'Error al obtener pedido', details: error.message });
  }
}

/**
 * Crear nuevo pedido
 */
async function crearPedido(req, res) {
  const connection = await pool.getConnection();

  try {
    const { rol, id: userId } = req.user;
    const {
      cliente_id,
      ciudad_destino,
      direccion_entrega,
      link_pedido,
      observaciones
    } = req.body;

    if (rol === ROLES.CLIENTE) {
      return res.status(403).json({ error: 'Los clientes no pueden crear pedidos directamente' });
    }

    if (!cliente_id || !ciudad_destino || !direccion_entrega) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    await connection.beginTransaction();

    const numeroPedido = await generarNumeroPedido(connection);

    const [result] = await connection.query(
      `INSERT INTO pedidos (
        numero_pedido, cliente_id, vendedor_id, ciudad_destino,
        direccion_entrega, link_pedido, observaciones, estado_actual
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
      [numeroPedido, cliente_id, userId, ciudad_destino, direccion_entrega, link_pedido, observaciones]
    );

    const pedidoId = result.insertId;

    const mensajeCliente = `Tu pedido ${numeroPedido} ha sido creado`;
    await crearNotificacion(connection, cliente_id, pedidoId, TIPOS_NOTIFICACION.PEDIDO_CREADO, 'Nuevo Pedido', mensajeCliente);
    await enviarNotificacionAUsuario(cliente_id, 'Nuevo Pedido', mensajeCliente, pedidoId);

    const mensajeAdmin = `Pedido ${numeroPedido} requiere aprobación`;
    await notificarAdministradores(connection, pedidoId, TIPOS_NOTIFICACION.PEDIDO_PENDIENTE, 'Nuevo Pedido Pendiente', mensajeAdmin);

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Pedido creado exitosamente',
      pedido: {
        id: pedidoId,
        numero_pedido: numeroPedido
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error al crear pedido:', error);
    res.status(500).json({ error: 'Error al crear pedido', details: error.message });
  } finally {
    connection.release();
  }
}

/**
 * Actualizar estado de pedido
 */
async function actualizarEstadoPedido(req, res) {
  const connection = await pool.getConnection();

  try {
    const { rol } = req.user;
    const { nuevo_estado, descripcion, ubicacion, numero_guia, transportadora_id, link_factura } = req.body;

    if (rol === ROLES.CLIENTE) {
      return res.status(403).json({ error: 'Los clientes no pueden cambiar estados' });
    }

    if (!nuevo_estado) {
      return res.status(400).json({ error: 'Nuevo estado requerido' });
    }

    await connection.beginTransaction();

    const [pedidos] = await connection.query(
      'SELECT estado_actual, numero_guia FROM pedidos WHERE id = ?',
      [req.params.id]
    );

    if (pedidos.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const estadoActual = pedidos[0].estado_actual;

    const validacion = validarCambioEstado(estadoActual, nuevo_estado);
    if (!validacion.valido) {
      await connection.rollback();
      return res.status(400).json({ error: validacion.mensaje });
    }

    let updateFields = { estado_actual: nuevo_estado };
    let updateParams = [nuevo_estado];

    // Si se entrega a transportadora, guardar guía (ya no se genera QR)
    if (nuevo_estado === ESTADOS_PEDIDO.ENTREGADO_TRANSPORTADORA) {
      if (!numero_guia || !transportadora_id) {
        await connection.rollback();
        return res.status(400).json({ error: 'Número de guía y transportadora requeridos para este estado' });
      }
      updateFields.numero_guia = numero_guia;
      updateFields.transportadora_id = transportadora_id;
      updateParams.push(numero_guia, transportadora_id);
    }

    if (nuevo_estado === ESTADOS_PEDIDO.FACTURADO && link_factura) {
      updateFields.link_factura = link_factura;
      updateParams.push(link_factura);
    }

    const setClause = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
    updateParams.push(req.params.id);

    await connection.query(
      `UPDATE pedidos SET ${setClause} WHERE id = ?`,
      updateParams
    );

    await registrarEstado(connection, req.params.id, nuevo_estado, descripcion, ubicacion, req.user.id, 'manual');

    const [pedidoData] = await connection.query(
      'SELECT cliente_id, vendedor_id, numero_pedido FROM pedidos WHERE id = ?',
      [req.params.id]
    );

    let mensajeNotif = `Tu pedido ${pedidoData[0].numero_pedido} cambió a: ${nuevo_estado}`;
    if (nuevo_estado === ESTADOS_PEDIDO.ENTREGADO_TRANSPORTADORA) {
      mensajeNotif += ` - Guía: ${numero_guia}`;
    }

    await crearNotificacion(connection, pedidoData[0].cliente_id, req.params.id, TIPOS_NOTIFICACION.CAMBIO_ESTADO, 'Actualización de Pedido', mensajeNotif);
    await enviarNotificacionAUsuario(pedidoData[0].cliente_id, 'Actualización de Pedido', mensajeNotif, req.params.id);

    await connection.commit();

    res.json({
      success: true,
      message: 'Estado actualizado exitosamente',
      nuevo_estado
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error al actualizar estado', details: error.message });
  } finally {
    connection.release();
  }
}

module.exports = {
  obtenerPedidos,
  obtenerPedidoPorId,
  crearPedido,
  actualizarEstadoPedido
};