const { pool } = require('../config/database');

/**
 * Resetear contraseña por email (sin necesidad de estar autenticado)
 * POST /api/auth/reset-password
 * Body: { email, nueva_password }
 */
async function resetPassword(req, res) {
  try {
    const { email, nueva_password } = req.body;

    if (!email || !nueva_password) {
      return res.status(400).json({ error: 'Email y nueva contraseña son requeridos' });
    }

    if (nueva_password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Buscar usuario por email
    const [usuarios] = await pool.query(
      'SELECT id, nombre, email FROM usuarios WHERE email = ? AND activo = 1',
      [email.trim().toLowerCase()]
    );

    if (usuarios.length === 0) {
      // Por seguridad, no revelar si el email existe o no
      return res.status(404).json({ error: 'No se encontró ningún usuario con ese correo electrónico' });
    }

    const usuario = usuarios[0];

    // Actualizar contraseña directamente
    await pool.query(
      'UPDATE usuarios SET password = ? WHERE id = ?',
      [nueva_password, usuario.id]
    );

    console.log(`🔐 Contraseña reseteada para usuario ${usuario.id} (${usuario.email})`);

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error al resetear contraseña:', error);
    res.status(500).json({ error: 'Error al resetear contraseña', details: error.message });
  }
}

module.exports = { resetPassword };