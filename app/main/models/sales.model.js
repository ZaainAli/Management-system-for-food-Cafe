const { getDb } = require('../db/index');
const syncService = require('../services/sync.service');

function upsertDailySales({ date, revenueDelta = 0, billsDelta = 0, expensesDelta = 0 }) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO daily_sales (date, totalRevenue, totalBills, totalExpenses, updatedAt)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      totalRevenue = totalRevenue + excluded.totalRevenue,
      totalBills = totalBills + excluded.totalBills,
      totalExpenses = totalExpenses + excluded.totalExpenses,
      updatedAt = excluded.updatedAt
  `).run(date, revenueDelta, billsDelta, expensesDelta, now);

  // Read back current totals and push to Supabase (non-blocking — never delays billing)
  const row = db.prepare(
    'SELECT totalRevenue, totalBills, totalExpenses FROM daily_sales WHERE date = ?'
  ).get(date);
  if (row) {
    syncService.pushDailySales({
      date,
      totalRevenue:  row.totalRevenue,
      totalBills:    row.totalBills,
      totalExpenses: row.totalExpenses,
    }).catch(() => {}); // suppress unhandled rejection
  }
}

function addBillToDailySales({ date, total }) {
  upsertDailySales({ date, revenueDelta: total, billsDelta: 1, expensesDelta: 0 });
}

function addExpenseToDailySales({ date, amountDelta }) {
  upsertDailySales({ date, revenueDelta: 0, billsDelta: 0, expensesDelta: amountDelta });
}

function adjustDailySales({ date, revenueDelta = 0, billsDelta = 0, expensesDelta = 0 }) {
  upsertDailySales({ date, revenueDelta, billsDelta, expensesDelta });
}

function getDailySales(filters = {}) {
  const db = getDb();
  let query = 'SELECT date, totalRevenue, totalBills, totalExpenses FROM daily_sales';
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

  query += ' ORDER BY date ASC';

  return db.prepare(query).all(...params);
}

function getTotals(filters = {}) {
  const db = getDb();
  let query = `
    SELECT
      COALESCE(SUM(totalRevenue), 0) as totalRevenue,
      COALESCE(SUM(totalBills), 0) as totalBills,
      COALESCE(SUM(totalExpenses), 0) as totalExpenses
    FROM daily_sales
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

  return db.prepare(query).get(...params);
}

module.exports = {
  addBillToDailySales,
  addExpenseToDailySales,
  adjustDailySales,
  getDailySales,
  getTotals,
};
