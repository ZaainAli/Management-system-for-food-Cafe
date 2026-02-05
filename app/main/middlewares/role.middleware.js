const { getSession } = require('../controllers/auth.controller');

/**
 * Middleware wrapper that checks if the current user has one of the allowed roles.
 * Usage: await requireRole(['admin', 'manager'], async () => { ... })
 */
async function requireRole(allowedRoles, handler) {
  const session = getSession();
  if (!session) {
    return { success: false, error: 'Authentication required.' };
  }
  if (!allowedRoles.includes(session.role)) {
    return { success: false, error: `Access denied. Required role: ${allowedRoles.join(' or ')}` };
  }
  return handler();
}

module.exports = { requireRole };
