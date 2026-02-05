const userModel = require('../models/user.model');
const { hashPassword, comparePasswords } = require('../utils/crypto');

async function authenticate(username, password) {
  const user = await userModel.findByUsername(username);
  if (!user) {
    throw new Error('Invalid username or password');
  }

  const isValid = await comparePasswords(password, user.password);
  if (!isValid) {
    throw new Error('Invalid username or password');
  }

  // Return user without the password hash
  const { password: _, ...safeUser } = user;
  return safeUser;
}

async function changePassword(userId, oldPassword, newPassword) {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const isValid = await comparePasswords(oldPassword, user.password);
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  if (newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters');
  }

  const hashedPassword = await hashPassword(newPassword);
  await userModel.updatePassword(userId, hashedPassword);
}

module.exports = { authenticate, changePassword };
