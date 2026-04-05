const Audit = require('../models/Audit');

function getClientIp(req) {
  if (!req) return '';
  const xf = req.headers && req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  if (req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
  if (req.ip) return req.ip;
  return '';
}

/**
 * Persist an audit row. Never throws; logs to console on DB failure.
 */
async function logAudit(payload) {
  const {
    req,
    username,
    userType,
    action,
    status = 'success',
    category = 'general',
    details = '',
    target = ''
  } = payload;

  if (!action) return;

  const user =
    username != null
      ? String(username)
      : (req && req.session && req.session.username) || 'anonymous';
  const role =
    userType != null
      ? String(userType)
      : (req && req.session && req.session.userType) || 'none';

  try {
    await Audit.create({
      user,
      role,
      action: String(action),
      status,
      category,
      details: details != null ? String(details) : '',
      target: target != null ? String(target) : '',
      ipAddress: getClientIp(req),
      timestamp: new Date()
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

function logAuditFireAndForget(payload) {
  logAudit(payload).catch(() => {});
}

module.exports = { logAudit, logAuditFireAndForget, getClientIp };
