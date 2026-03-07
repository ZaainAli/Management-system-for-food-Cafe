const userModel = require('../models/user.model');
const { hashPassword, comparePasswords } = require('../utils/crypto');

function isBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

async function authenticate(username, password) {
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  if (!normalizedUsername || typeof password !== 'string' || password.length === 0) {
    throw new Error('Invalid username or password');
  }

  const user = await userModel.findByUsername(normalizedUsername);
  if (!user) {
    throw new Error('Invalid username or password');
  }

  let isValid = false;

  if (isBcryptHash(user.password)) {
    isValid = await comparePasswords(password, user.password);
  } else {
    // Backward compatibility for legacy plaintext rows; upgrade on successful login.
    isValid = password === user.password;
    if (isValid) {
      const upgradedHash = hashPassword(password);
      await userModel.updatePassword(user.id, upgradedHash);
    }
  }

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

  const hashedPassword = hashPassword(newPassword);
  await userModel.updatePassword(userId, hashedPassword);
}

module.exports = { authenticate, changePassword };
