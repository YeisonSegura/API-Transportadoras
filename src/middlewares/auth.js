const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { ROLES } = require('../utils/constants');

/**
 * Middleware para autenticar token JWT
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
    req.user = user;
    next();
  });
}

/**
 * Middleware para verificar que el usuario sea admin
 */
function requireAdmin(req, res, next) {
  if (req.user.rol !== ROLES.ADMIN) {
    return res.status(403).json({ error: 'Se requieren permisos de administrador' });
  }
  next();
}

/**
 * Middleware para verificar que el usuario sea bodeguero o admin
 */
function requireBodegueroOrAdmin(req, res, next) {
  if (req.user.rol !== ROLES.BODEGUERO && req.user.rol !== ROLES.ADMIN) {
    return res.status(403).json({ error: 'Se requieren permisos de bodeguero o administrador' });
  }
  next();
}

/**
 * Middleware para verificar que el usuario sea el dueño del recurso o admin
 */
function requireOwnerOrAdmin(paramName = 'id') {
  return (req, res, next) => {
    const resourceId = parseInt(req.params[paramName]);
    if (req.user.id !== resourceId && req.user.rol !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'No tienes permiso para acceder a este recurso' });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireAdmin,
  requireBodegueroOrAdmin,
  requireOwnerOrAdmin
};