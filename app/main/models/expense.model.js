const { getDb } = require('../db/index');

function findAll(filters = {}) {
  const db = getDb();
  let query = 'SELECT * FROM expenses';
  const params = [];
  const conditions = [];

  if (filters.from) {
    conditions.push('date >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push('date <= ?');
    params.push(filters.to);
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

function getCategoryTotals(filters = {}) {
  const db = getDb();
  let query = `
    SELECT
      category,
      COUNT(1) as count,
      COALESCE(SUM(amount), 0) as total
    FROM expenses
  `;
  const params = [];
  const conditions = [];

  if (filters.from) {
    conditions.push('date >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push('date <= ?');
    params.push(filters.to);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' GROUP BY category ORDER BY total DESC';
  return db.prepare(query).all(...params);
}

function getDailyTotals(filters = {}) {
  const db = getDb();
  let query = `
    SELECT
      COALESCE(NULLIF(date, ''), SUBSTR(createdAt, 1, 10)) as date,
      COALESCE(SUM(amount), 0) as total
    FROM expenses
  `;
  const params = [];
  const conditions = [];

  if (filters.from) {
    conditions.push('date >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push('date <= ?');
    params.push(filters.to);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' GROUP BY COALESCE(NULLIF(date, \'\'), SUBSTR(createdAt, 1, 10)) ORDER BY date ASC';
  return db.prepare(query).all(...params);
}

function getTotalAmount(filters = {}) {
  const db = getDb();
  let query = 'SELECT COALESCE(SUM(amount), 0) as totalExpenses FROM expenses';
  const params = [];
  const conditions = [];

  if (filters.from) {
    conditions.push('date >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push('date <= ?');
    params.push(filters.to);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  return db.prepare(query).get(...params) || { totalExpenses: 0 };
}

function findById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) || null;
}

function insert(expense) {
  const db = getDb();
  db.prepare(`
    INSERT INTO expenses (
      id, description, amount, category, date,
      sourceType, sourceEntityId, sourceEntityName, sourceRecordId,
      notes, createdAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    expense.id,
    expense.description,
    expense.amount,
    expense.category,
    expense.date,
    expense.sourceType,
    expense.sourceEntityId,
    expense.sourceEntityName,
    expense.sourceRecordId,
    expense.notes,
    expense.createdAt
  );
  return expense;
}

function update(expense) {
  const db = getDb();
  db.prepare(`
    UPDATE expenses
    SET description = ?, amount = ?, category = ?, date = ?,
        sourceType = ?, sourceEntityId = ?, sourceEntityName = ?, sourceRecordId = ?,
        notes = ?, updatedAt = ?
    WHERE id = ?
  `).run(
    expense.description,
    expense.amount,
    expense.category,
    expense.date,
    expense.sourceType || 'manual',
    expense.sourceEntityId || null,
    expense.sourceEntityName || '',
    expense.sourceRecordId || null,
    expense.notes || '',
    expense.updatedAt,
    expense.id
  );
  return expense;
}

function remove(id) {
  const db = getDb();
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
}

function findBySourceRecordId(sourceRecordId, sourceType) {
  if (!sourceRecordId) return null;
  const db = getDb();
  if (sourceType) {
    return db.prepare('SELECT * FROM expenses WHERE sourceRecordId = ? AND sourceType = ? LIMIT 1').get(sourceRecordId, sourceType) || null;
  }
  return db.prepare('SELECT * FROM expenses WHERE sourceRecordId = ? LIMIT 1').get(sourceRecordId) || null;
}

function findBySourceRecordIds(sourceRecordIds, sourceType) {
  if (!Array.isArray(sourceRecordIds) || sourceRecordIds.length === 0) return [];
  const db = getDb();
  const placeholders = sourceRecordIds.map(() => '?').join(', ');
  const baseParams = [...sourceRecordIds];
  if (sourceType) {
    const query = `SELECT * FROM expenses WHERE sourceRecordId IN (${placeholders}) AND sourceType = ?`;
    return db.prepare(query).all(...baseParams, sourceType);
  }
  const query = `SELECT * FROM expenses WHERE sourceRecordId IN (${placeholders})`;
  return db.prepare(query).all(...baseParams);
}

function countBySourceEntity(sourceType, sourceEntityId) {
  if (!sourceType || !sourceEntityId) return 0;
  const db = getDb();
  const row = db.prepare('SELECT COUNT(1) as count FROM expenses WHERE sourceType = ? AND sourceEntityId = ?').get(sourceType, sourceEntityId);
  return Number(row?.count || 0);
}

function findBySourceEntity(sourceType, sourceEntityId) {
  if (!sourceType || !sourceEntityId) return [];
  const db = getDb();
  return db.prepare('SELECT * FROM expenses WHERE sourceType = ? AND sourceEntityId = ? ORDER BY date DESC, createdAt DESC').all(sourceType, sourceEntityId);
}

function unlinkKhataBySourceEntity(sourceEntityId, updatedAt) {
  if (!sourceEntityId) return;
  const db = getDb();
  db.prepare(`
    UPDATE expenses
    SET sourceType = 'manual',
        sourceEntityId = NULL,
        sourceEntityName = '',
        sourceRecordId = NULL,
        updatedAt = ?
    WHERE sourceType = 'khata' AND sourceEntityId = ?
  `).run(updatedAt || new Date().toISOString(), sourceEntityId);
}

function getDistinctCategories() {
  const db = getDb();
  return db.prepare('SELECT DISTINCT category FROM expenses ORDER BY category ASC').all().map(r => r.category);
}

module.exports = {
  findAll,
  getCategoryTotals,
  getDailyTotals,
  getTotalAmount,
  findById,
  insert,
  update,
  remove,
  findBySourceRecordId,
  findBySourceRecordIds,
  countBySourceEntity,
  findBySourceEntity,
  unlinkKhataBySourceEntity,
  getDistinctCategories,
};
