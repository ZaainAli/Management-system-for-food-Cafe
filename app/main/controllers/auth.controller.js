const authService = require('../services/auth.service');
const logger = require('../utils/logger');

// In-memory session store (single-user desktop app)
let currentSession = null;

async function login({ username, password }) {
  try {
    const user = await authService.authenticate(username, password);
    currentSession = {
      id: user.id,
      username: user.username,
      role: user.role,
      loginAt: new Date().toISOString(),
    };
    logger.info(`User logged in: ${user.username}`);
    return { success: true, data: currentSession };
  } catch (err) {
    logger.warn(`Login failed for: ${username} — ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function logout() {
  try {
    if (currentSession) {
      logger.info(`User logged out: ${currentSession.username}`);
    }
    currentSession = null;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function getCurrentUser() {
  return currentSession
    ? { success: true, data: currentSession }
    : { success: false, error: 'No active session' };
}

async function changePassword({ userId, oldPassword, newPassword }) {
  try {
    await authService.changePassword(userId, oldPassword, newPassword);
    logger.info(`Password changed for user ID: ${userId}`);
    return { success: true };
  } catch (err) {
    logger.warn(`Password change failed for user ID: ${userId} — ${err.message}`);
    return { success: false, error: err.message };
  }
}

// Export session getter for middleware
function getSession() {
  return currentSession;
}

module.exports = { login, logout, getCurrentUser, changePassword, getSession };
