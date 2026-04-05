const { logAuditFireAndForget } = require('./auditLogger');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.username) {
    logAuditFireAndForget({
      req,
      username: 'anonymous',
      userType: 'none',
      action: 'access denied',
      status: 'failure',
      category: 'authorization',
      details: `Unauthenticated ${req.method} ${req.originalUrl || req.path}`,
      target: req.originalUrl || req.path || ''
    });
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.userType) {
      logAuditFireAndForget({
        req,
        username: (req.session && req.session.username) || 'anonymous',
        userType: 'none',
        action: 'access denied',
        status: 'failure',
        category: 'authorization',
        details: `Missing or invalid session role for ${req.method} ${req.originalUrl || req.path}; required: ${roles.join(', ')}`,
        target: req.originalUrl || req.path || ''
      });
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!roles.includes(req.session.userType)) {
      logAuditFireAndForget({
        req,
        username: req.session.username,
        userType: req.session.userType,
        action: 'access denied',
        status: 'failure',
        category: 'authorization',
        details: `Forbidden ${req.method} ${req.originalUrl || req.path}; required roles: ${roles.join(', ')}`,
        target: req.originalUrl || req.path || ''
      });
      return res.status(403).json({ message: 'Forbidden' });
    }

    next();
  };
}

module.exports = { requireAuth, requireRole };
