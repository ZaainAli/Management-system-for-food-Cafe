const { getSession } = require('../controllers/auth.controller');

/**
 * Middleware wrapper that checks for an active session.
 * Usage: await requireAuth(async () => { ... })
 */
async function requireAuth(handler) {
  const session = getSession();
  if (!session) {
    return { success: false, error: 'Authentication required. Please log in.' };
  }
  return handler();
}

module.exports = { requireAuth };
