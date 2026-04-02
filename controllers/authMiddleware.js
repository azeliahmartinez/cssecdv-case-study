function requireAuth(req, res, next) {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.userType) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!roles.includes(req.session.userType)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    next();
  };
}

module.exports = { requireAuth, requireRole };