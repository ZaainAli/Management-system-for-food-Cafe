const { getDb } = require('../db/index');

function findAll(filters = {}) {
  const db = getDb();
  let query = 'SELECT * FROM expenses';
  const params = [];
  const conditions = [];

  if (filters.from) {
    conditions.push('(date >= ? OR createdAt >= ?)');
    params.push(filters.from, filters.from);
  }
  if (filters.to) {
    conditions.push('(date <= ? OR createdAt <= ?)');
    params.push(filters.to, filters.to);
  }
  if (filters.category) {
    conditions.push('category = ?');
    params.push(filters.category);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY date DESC, createdAt DESC';
  return db.prepare(query).all(...params);
}

function findById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) || null;
}

function insert(expense) {
  const db = getDb();
  db.prepare(`
    INSERT INTO expenses (id, description, amount, category, date, notes, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(expense.id, expense.description, expense.amount, expense.category, expense.date, expense.notes, expense.createdAt);
  return expense;
}

function update(expense) {
  const db = getDb();
  db.prepare(`
    UPDATE expenses SET description = ?, amount = ?, category = ?, date = ?, notes = ?, updatedAt = ?
    WHERE id = ?
  `).run(expense.description, expense.amount, expense.category, expense.date, expense.notes, expense.updatedAt, expense.id);
  return expense;
}

function remove(id) {
  const db = getDb();
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
}

function getDistinctCategories() {
  const db = getDb();
  return db.prepare('SELECT DISTINCT category FROM expenses ORDER BY category ASC').all().map(r => r.category);
}

module.exports = { findAll, findById, insert, update, remove, getDistinctCategories };
