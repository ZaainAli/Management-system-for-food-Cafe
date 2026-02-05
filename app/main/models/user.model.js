const { getDb } = require('../db/index');

function findByUsername(username) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) || null;
}

function findById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
}

function updatePassword(id, hashedPassword) {
  const db = getDb();
  db.prepare('UPDATE users SET password = ?, updatedAt = ? WHERE id = ?')
    .run(hashedPassword, new Date().toISOString(), id);
}

module.exports = { findByUsername, findById, updatePassword };
