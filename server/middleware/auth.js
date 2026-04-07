const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'casino_adiil_secret_2024';

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux admins' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin, JWT_SECRET };
