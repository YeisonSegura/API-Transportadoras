const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const { JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_SALT_ROUNDS } = require('../config/env');

/**
 * Login de usuario
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    // Buscar usuario por email o username
    const [usuarios] = await pool.query(
      'SELECT * FROM usuarios WHERE email = ? OR username = ? LIMIT 1',
      [email, email]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const usuario = usuarios[0];

    // Por ahora, comparación directa (en desarrollo)
    // TODO: En producción usar bcrypt.compare(password, usuario.password)
    if (password !== usuario.password) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Generar token JWT
    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        rol: usuario.rol
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // No enviar la contraseña al cliente
    delete usuario.password;

    res.json({
      success: true,
      message: 'Login exitoso',
      token,
      usuario
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor', details: error.message });
  }
}

/**
 * Refrescar token JWT - Permite renovar un token expirado
 * sin necesidad de que el usuario vuelva a ingresar credenciales
 */
async function refreshToken(req, res) {
  try {
    // El token viene en el header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    // Decodificar el token (incluso si está expirado) para obtener el userId
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    } catch (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }

    // Verificar que el usuario aún existe y está activo en la BD
    const [usuarios] = await pool.query(
      'SELECT id, nombre, email, username, rol, telefono, ciudad, direccion, numero_documento, bodeguero_asignado_id, activo, fecha_registro FROM usuarios WHERE id = ? AND activo = 1',
      [decoded.id]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado o inactivo' });
    }

    const usuario = usuarios[0];

    // Generar un nuevo token con los datos actualizados
    const newToken = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        rol: usuario.rol
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log(`🔄 Token refrescado para usuario ${usuario.id} (${usuario.email})`);

    res.json({
      success: true,
      message: 'Token refrescado exitosamente',
      token: newToken,
      usuario
    });
  } catch (error) {
    console.error('Error en refresh token:', error);
    res.status(500).json({ error: 'Error al refrescar token', details: error.message });
  }
}

/**
 * Obtener datos del usuario autenticado (GET /api/usuarios/me)
 * Valida que el token sea válido y devuelve los datos actualizados del usuario
 */
async function getMe(req, res) {
  try {
    const [usuarios] = await pool.query(
      'SELECT id, nombre, email, username, rol, telefono, ciudad, direccion, numero_documento, bodeguero_asignado_id, activo, fecha_registro FROM usuarios WHERE id = ?',
      [req.user.id]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      success: true,
      usuario: usuarios[0]
    });
  } catch (error) {
    console.error('Error en getMe:', error);
    res.status(500).json({ error: 'Error al obtener usuario', details: error.message });
  }
}

/**
 * Registro de nuevo usuario (solo clientes)
 */
async function register(req, res) {
  try {
    const { nombre, email, username, password, telefono, ciudad, direccion } = req.body;

    if (!nombre || !email || !username || !password) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    // Verificar si el email o username ya existe
    const [existentes] = await pool.query(
      'SELECT id FROM usuarios WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existentes.length > 0) {
      return res.status(400).json({ error: 'Email o username ya registrado' });
    }

    // Por ahora guardar password en texto plano (desarrollo)
    // TODO: En producción usar: const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const [result] = await pool.query(
      `INSERT INTO usuarios (nombre, email, username, password, rol, telefono, ciudad, direccion)
       VALUES (?, ?, ?, ?, 'cliente', ?, ?, ?)`,
      [nombre, email, username, password, telefono, ciudad, direccion]
    );

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      usuarioId: result.insertId
    });
  } catch (error) {
    console.error('Error en register:', error);
    res.status(500).json({ error: 'Error al registrar usuario', details: error.message });
  }
}

module.exports = {
  login,
  register,
  refreshToken,
  getMe
};
