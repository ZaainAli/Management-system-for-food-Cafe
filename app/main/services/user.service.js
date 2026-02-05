const userModel = require('../models/user.model');
const { hashPassword } = require('../utils/crypto');
const { v4: uuidv4 } = require('uuid');

const VALID_ROLES = ['admin', 'manager', 'cashier', 'staff'];

async function getAllUsers() {
  return userModel.findAll();
}

async function createUser({ username, password, role, canManage }) {
  if (!username || username.length < 3) throw new Error('Username must be at least 3 characters');
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');
  if (!VALID_ROLES.includes(role)) throw new Error(`Invalid role. Must be: ${VALID_ROLES.join(', ')}`);

  const existing = userModel.findByUsername(username);
  if (existing) throw new Error('Username already exists');

  const effectiveCanManage = role === 'cashier' ? (canManage ? 1 : 0) : 0;
  const hashedPw = hashPassword(password);

  return userModel.create({
    id: uuidv4(),
    username,
    password: hashedPw,
    role,
    canManage: effectiveCanManage,
  });
}

async function updateUser({ id, username, role, canManage }) {
  const user = userModel.findById(id);
  if (!user) throw new Error('User not found');
  if (user.username === 'admin' && role !== 'admin') {
    throw new Error('Cannot change the default admin account role');
  }

  if (username && username !== user.username) {
    const existing = userModel.findByUsername(username);
    if (existing) throw new Error('Username already taken');
  }

  const effectiveCanManage = role === 'cashier' ? (canManage ? 1 : 0) : 0;
  return userModel.update({
    id,
    username: username || user.username,
    role,
    canManage: effectiveCanManage,
  });
}

async function deleteUser(id) {
  const user = userModel.findById(id);
  if (!user) throw new Error('User not found');
  if (user.username === 'admin') throw new Error('Cannot delete the default admin account');
  userModel.remove(id);
}

async function resetUserPassword(id, newPassword) {
  if (!newPassword || newPassword.length < 6) throw new Error('Password must be at least 6 characters');
  const user = userModel.findById(id);
  if (!user) throw new Error('User not found');
  const hashed = hashPassword(newPassword);
  userModel.resetPassword(id, hashed);
}

module.exports = { getAllUsers, createUser, updateUser, deleteUser, resetUserPassword };
