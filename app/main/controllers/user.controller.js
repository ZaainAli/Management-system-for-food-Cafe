const userService = require('../services/user.service');
const logger = require('../utils/logger');

async function getAll() {
  try {
    const users = await userService.getAllUsers();
    return { success: true, data: users };
  } catch (err) {
    logger.error('user:getAll failed', err);
    return { success: false, error: err.message };
  }
}

async function create(userData) {
  try {
    const user = await userService.createUser(userData);
    logger.info(`User created: ${user.username} (role: ${user.role})`);
    return { success: true, data: user };
  } catch (err) {
    logger.error('user:create failed', err);
    return { success: false, error: err.message };
  }
}

async function update(payload) {
  try {
    const user = await userService.updateUser(payload);
    logger.info(`User updated: ${user.username}`);
    return { success: true, data: user };
  } catch (err) {
    logger.error('user:update failed', err);
    return { success: false, error: err.message };
  }
}

async function remove(id) {
  try {
    await userService.deleteUser(id);
    logger.info(`User deleted: ID ${id}`);
    return { success: true };
  } catch (err) {
    logger.error('user:delete failed', err);
    return { success: false, error: err.message };
  }
}

async function resetPassword({ id, newPassword }) {
  try {
    await userService.resetUserPassword(id, newPassword);
    logger.info(`Password reset for user ID: ${id}`);
    return { success: true };
  } catch (err) {
    logger.error('user:resetPassword failed', err);
    return { success: false, error: err.message };
  }
}

module.exports = { getAll, create, update, remove, resetPassword };
