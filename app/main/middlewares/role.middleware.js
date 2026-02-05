const { getSession } = require('../controllers/auth.controller');

/**
 * Resolves the effective roles for a session, accounting for hierarchy:
 * - 'admin' gets all roles
 * - 'manager' inherits cashier
 * - 'cashier' with canManage gets manager access
 * - 'cashier' without canManage: cashier only
 */
function getEffectiveRoles(session) {
  const { role, canManage } = session;
  switch (role) {
    case 'admin':
      return ['admin', 'manager', 'cashier', 'staff'];
    case 'manager':
      return ['manager', 'cashier'];
    case 'cashier':
      return canManage ? ['cashier', 'manager'] : ['cashier'];
    default:
      return [role];
  }
}

/**
 * Middleware wrapper that checks if the current user has one of the allowed roles,
 * accounting for role hierarchy.
 */
async function requireRole(allowedRoles, handler) {
  const session = getSession();
  if (!session) {
    return { success: false, error: 'Authentication required.' };
  }
  const effectiveRoles = getEffectiveRoles(session);
  const hasAccess = allowedRoles.some(role => effectiveRoles.includes(role));
  if (!hasAccess) {
    return { success: false, error: `Access denied. Required role: ${allowedRoles.join(' or ')}` };
  }
  return handler();
}

module.exports = { requireRole, getEffectiveRoles };
