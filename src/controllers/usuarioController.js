const { pool } = require('../config/database');
const { ROLES } = require('../utils/constants');

/**
 * Listar todos los usuarios (solo admin)
 */
async function listarUsuarios(req, res) {
  try {
    const { rol, activo } = req.query;
    let query = 'SELECT id, nombre, email, username, rol, telefono, direccion, ciudad, bodeguero_asignado_id, activo, fecha_registro FROM usuarios WHERE 1=1';
    const params = [];

    if (rol) {
      query += ' AND rol = ?';
      params.push(rol);
    }

    if (activo !== undefined) {
      query += ' AND activo = ?';
      params.push(activo === 'true' ? 1 : 0);
    }

    query += ' ORDER BY fecha_registro DESC';

    const [usuarios] = await pool.query(query, params);
    res.json({ success: true, usuarios, total: usuarios.length });
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ error: 'Error al listar usuarios', details: error.message });
  }
}

/**
 * Obtener usuario por ID
 */
async function obtenerUsuario(req, res) {
  try {
    const [usuarios] = await pool.query(
      'SELECT id, nombre, email, username, rol, telefono, direccion, ciudad, bodeguero_asignado_id, activo, fecha_registro FROM usuarios WHERE id = ?',
      [req.params.id]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ success: true, usuario: usuarios[0] });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ error: 'Error al obtener usuario', details: error.message });
  }
}

/**
 * Obtener clientes de un bodeguero
 */
async function obtenerClientesBodeguero(req, res) {
  try {
    const [clientes] = await pool.query(
      'SELECT id, nombre, email, telefono, ciudad, direccion FROM usuarios WHERE bodeguero_asignado_id = ? AND rol = "cliente"',
      [req.params.id]
    );

    res.json({ success: true, clientes });
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ error: 'Error al obtener clientes', details: error.message });
  }
}

/**
 * Actualizar token FCM de un usuario
 */
async function actualizarTokenFCM(req, res) {
  try {
    const { token_fcm } = req.body;

    if (!token_fcm) {
      return res.status(400).json({ error: 'Token FCM requerido' });
    }

    if (req.user.id !== parseInt(req.params.id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    await pool.query(
      'UPDATE usuarios SET token_fcm = ? WHERE id = ?',
      [token_fcm, req.params.id]
    );

    console.log(`📱 Token FCM actualizado para usuario ${req.params.id}`);

    res.json({ success: true, message: 'Token FCM actualizado' });
  } catch (error) {
    console.error('Error al actualizar token FCM:', error);
    res.status(500).json({ error: 'Error al actualizar token FCM', details: error.message });
  }
}

/**
 * Crear usuario (solo admin)
 */
async function crearUsuario(req, res) {
  try {
    const { nombre, email, username, password, rol, telefono, ciudad, direccion, bodeguero_asignado_id } = req.body;

    if (!nombre || !email || !username || !password || !rol) {
      return res.status(400).json({ error: 'Datos incompletos: nombre, email, username, password y rol son requeridos' });
    }

    if (!Object.values(ROLES).includes(rol)) {
      return res.status(400).json({ error: 'Rol inválido', rolesValidos: Object.values(ROLES) });
    }

    const [existentes] = await pool.query(
      'SELECT id FROM usuarios WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existentes.length > 0) {
      return res.status(400).json({ error: 'Email o username ya registrado' });
    }

    const [result] = await pool.query(
      `INSERT INTO usuarios (nombre, email, username, password, rol, telefono, ciudad, direccion, bodeguero_asignado_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, email, username, password, rol, telefono, ciudad, direccion, bodeguero_asignado_id || null]
    );

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      usuario: {
        id: result.insertId,
        nombre,
        email,
        username,
        rol
      }
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error al crear usuario', details: error.message });
  }
}

/**
 * Actualizar usuario
 */
async function actualizarUsuario(req, res) {
  try {
    const { nombre, email, telefono, ciudad, direccion, bodeguero_asignado_id, activo } = req.body;
    const userId = req.params.id;

    const [usuarios] = await pool.query('SELECT id FROM usuarios WHERE id = ?', [userId]);
    if (usuarios.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (email) {
      const [existentes] = await pool.query(
        'SELECT id FROM usuarios WHERE email = ? AND id != ?',
        [email, userId]
      );
      if (existentes.length > 0) {
        return res.status(400).json({ error: 'Email ya registrado' });
      }
    }

    const updates = [];
    const params = [];

    if (nombre !== undefined) { updates.push('nombre = ?'); params.push(nombre); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (telefono !== undefined) { updates.push('telefono = ?'); params.push(telefono); }
    if (ciudad !== undefined) { updates.push('ciudad = ?'); params.push(ciudad); }
    if (direccion !== undefined) { updates.push('direccion = ?'); params.push(direccion); }
    if (bodeguero_asignado_id !== undefined) {
      updates.push('bodeguero_asignado_id = ?');
      params.push(bodeguero_asignado_id);
    }
    if (activo !== undefined) { updates.push('activo = ?'); params.push(activo ? 1 : 0); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    params.push(userId);

    await pool.query(
      `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ success: true, message: 'Usuario actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario', details: error.message });
  }
}

/**
 * Eliminar usuario (soft delete)
 */
async function eliminarUsuario(req, res) {
  try {
    const userId = req.params.id;

    const [usuarios] = await pool.query('SELECT id FROM usuarios WHERE id = ?', [userId]);
    if (usuarios.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await pool.query('UPDATE usuarios SET activo = 0 WHERE id = ?', [userId]);

    res.json({ success: true, message: 'Usuario desactivado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ error: 'Error al eliminar usuario', details: error.message });
  }
}

/**
 * Listar bodegueros disponibles
 */
async function listarBodegueros(req, res) {
  try {
    const [bodegueros] = await pool.query(
      'SELECT id, nombre, email, telefono FROM usuarios WHERE rol = ? AND activo = 1',
      [ROLES.BODEGUERO]
    );

    res.json({ success: true, bodegueros, total: bodegueros.length });
  } catch (error) {
    console.error('Error al listar bodegueros:', error);
    res.status(500).json({ error: 'Error al listar bodegueros', details: error.message });
  }
}

/**
 * Cambiar contraseña de un usuario
 */
async function cambiarPassword(req, res) {
  try {
    const { password_actual, password_nueva } = req.body;
    const userId = req.params.id;

    if (!password_actual || !password_nueva) {
      return res.status(400).json({ error: 'Contraseña actual y nueva requeridas' });
    }

    if (password_nueva.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    // Verificar que el usuario solo pueda cambiar su propia contraseña
    if (req.user.id !== parseInt(userId)) {
      return res.status(403).json({ error: 'No autorizado para cambiar la contraseña de otro usuario' });
    }

    // Obtener el usuario
    const [usuarios] = await pool.query(
      'SELECT id, password FROM usuarios WHERE id = ?',
      [userId]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const usuario = usuarios[0];

    // Validar que la contraseña actual sea correcta
    // Por ahora comparación directa (en desarrollo)
    // TODO: En producción usar bcrypt.compare(password_actual, usuario.password)
    if (password_actual !== usuario.password) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }

    // Validar que la nueva contraseña sea diferente
    if (password_nueva === password_actual) {
      return res.status(400).json({ error: 'La nueva contraseña debe ser diferente a la actual' });
    }

    // Actualizar la contraseña
    // Por ahora guardar en texto plano (desarrollo)
    // TODO: En producción usar: const hashedPassword = await bcrypt.hash(password_nueva, BCRYPT_SALT_ROUNDS);
    await pool.query(
      'UPDATE usuarios SET password = ? WHERE id = ?',
      [password_nueva, userId]
    );

    console.log(`🔐 Contraseña cambiada para usuario ${userId}`);

    res.json({ success: true, message: 'Contraseña cambiada exitosamente' });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ error: 'Error al cambiar contraseña', details: error.message });
  }
}

module.exports = {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  obtenerClientesBodeguero,
  actualizarTokenFCM,
  listarBodegueros,
  cambiarPassword
};