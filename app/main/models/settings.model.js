const { getDb } = require('../db/index');

function get(key) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM restaurant_settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function set(key, value) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO restaurant_settings (key, value, updatedAt)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
  `).run(key, String(value), now);
  return { key, value: String(value), updatedAt: now };
}

function getAll() {
  const db = getDb();
  return db.prepare('SELECT key, value, updatedAt FROM restaurant_settings ORDER BY key ASC').all();
}

function getInt(key, defaultValue = 0) {
  const raw = get(key);
  if (raw === null || raw === undefined) return defaultValue;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

module.exports = { get, set, getAll, getInt };
