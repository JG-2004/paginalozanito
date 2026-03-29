// middlewares/auth.js — Verifica el token JWT en rutas privadas del admin
// Uso: router.get('/ruta-privada', requireAdmin, handler)
const jwt = require('jsonwebtoken');

const requireAdmin = (req, res, next) => {
  // El token puede venir en el header 'x-admin-token' o como 'Bearer token'
  const token =
    req.headers['x-admin-token'] ||
    (req.headers['authorization']?.startsWith('Bearer ')
      ? req.headers['authorization'].slice(7)
      : null);

  if (!token) {
    return res.status(401).json({ ok: false, message: 'Acceso denegado: token requerido' });
  }

  try {
    // Verificar que el token sea válido y no haya expirado
    req.admin = jwt.verify(token, process.env.JWT_SECRET || 'secreto_dev');
    next(); // continuar al handler de la ruta
  } catch {
    return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
  }
};

module.exports = { requireAdmin };
