const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

/**
 * Synchronous hash — used during database seeding (schema.js).
 */
function hashPassword(plaintext) {
  const salt = bcrypt.genSaltSync(SALT_ROUNDS);
  return bcrypt.hashSync(plaintext, salt);
}

/**
 * Asynchronous comparison — used at runtime for login validation.
 */
async function comparePasswords(plaintext, hashed) {
  return bcrypt.compare(plaintext, hashed);
}

module.exports = { hashPassword, comparePasswords };
