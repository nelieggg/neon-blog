const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'neon-blog-secret-key-2087';

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  next();
}

function isAdmin(user) {
  return user && (user.role === 'superadmin' || user.role === 'admin');
}

function isSuperAdmin(user) {
  return user && user.role === 'superadmin';
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: '请先登录' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: '权限不足' });
    next();
  };
}

module.exports = { authMiddleware, requireAuth, requireRole, isAdmin, isSuperAdmin, JWT_SECRET };
