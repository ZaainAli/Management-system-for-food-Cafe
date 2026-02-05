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

function findAll() {
  const db = getDb();
  return db.prepare(
    'SELECT id, username, role, canManage, createdAt, updatedAt FROM users ORDER BY createdAt ASC'
  ).all();
}

function create({ id, username, password, role, canManage }) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO users (id, username, password, role, canManage, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, username, password, role, canManage ? 1 : 0, now);
  return { id, username, role, canManage: canManage ? 1 : 0, createdAt: now };
}

function update({ id, username, role, canManage }) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE users SET username = ?, role = ?, canManage = ?, updatedAt = ? WHERE id = ?'
  ).run(username, role, canManage ? 1 : 0, now, id);
  return { id, username, role, canManage: canManage ? 1 : 0, updatedAt: now };
}

function remove(id) {
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

function resetPassword(id, hashedPassword) {
  const db = getDb();
  db.prepare('UPDATE users SET password = ?, updatedAt = ? WHERE id = ?')
    .run(hashedPassword, new Date().toISOString(), id);
}

module.exports = { findByUsername, findById, updatePassword, findAll, create, update, remove, resetPassword };
