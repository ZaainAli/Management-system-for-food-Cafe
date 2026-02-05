const { getDb } = require('../db/index');

function findAll() {
  const db = getDb();
  return db.prepare('SELECT * FROM stock_items ORDER BY name ASC').all();
}

function findById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM stock_items WHERE id = ?').get(id) || null;
}

function insert(item) {
  const db = getDb();
  db.prepare(`
    INSERT INTO stock_items (id, name, category, quantity, unit, reorderLevel, unitPrice, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(item.id, item.name, item.category, item.quantity, item.unit, item.reorderLevel, item.unitPrice, item.createdAt);
  return item;
}

function update(item) {
  const db = getDb();
  db.prepare(`
    UPDATE stock_items SET name = ?, category = ?, quantity = ?, unit = ?, reorderLevel = ?, unitPrice = ?, updatedAt = ?
    WHERE id = ?
  `).run(item.name, item.category, item.quantity, item.unit, item.reorderLevel, item.unitPrice, item.updatedAt, item.id);
  return item;
}

function remove(id) {
  const db = getDb();
  db.prepare('DELETE FROM stock_items WHERE id = ?').run(id);
}

function insertAdjustmentLog(record) {
  const db = getDb();
  db.prepare(`
    INSERT INTO stock_adjustments (id, stockItemId, previousQty, adjustment, newQty, reason, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(record.id, record.stockItemId, record.previousQty, record.adjustment, record.newQty, record.reason, record.createdAt);
  return record;
}

function findBelowThreshold(threshold) {
  const db = getDb();
  return db.prepare('SELECT * FROM stock_items WHERE quantity <= ? ORDER BY quantity ASC').all(threshold);
}

function getDistinctCategories() {
  const db = getDb();
  return db.prepare('SELECT DISTINCT category FROM stock_items ORDER BY category ASC').all().map(r => r.category);
}

module.exports = { findAll, findById, insert, update, remove, insertAdjustmentLog, findBelowThreshold, getDistinctCategories };
