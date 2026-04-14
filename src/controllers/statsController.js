const { pool } = require('../config/database');
const { ROLES } = require('../utils/constants');

/**
 * Obtener estadísticas de administrador
 */
async function obtenerStatsAdmin(req, res) {
  try {
    if (req.user.rol !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'Solo administradores pueden acceder a estas estadísticas' });
    }

    const [stats] = await pool.query('CALL sp_stats_admin()');

    res.json({ success: true, estadisticas: stats[0][0] });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas', details: error.message });
  }
}

/**
 * Obtener estadísticas de bodeguero
 */
async function obtenerStatsBodeguero(req, res) {
  try {
    if (req.user.rol === ROLES.CLIENTE ||
       (req.user.rol === ROLES.BODEGUERO && req.user.id !== parseInt(req.params.id))) {
      return res.status(403).json({ error: 'No tienes permiso para ver estas estadísticas' });
    }

    const [stats] = await pool.query(
      'SELECT * FROM vista_stats_bodeguero WHERE bodeguero_id = ?',
      [req.params.id]
    );

    if (stats.length === 0) {
      return res.status(404).json({ error: 'Bodeguero no encontrado' });
    }

    res.json({ success: true, estadisticas: stats[0] });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas', details: error.message });
  }
}

module.exports = {
  obtenerStatsAdmin,
  obtenerStatsBodeguero
};