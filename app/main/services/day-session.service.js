const settingsModel = require('../models/settings.model');
const salesModel = require('../models/sales.model');
const billModel = require('../models/bill.model');
const expenseModel = require('../models/expense.model');
const { getDb } = require('../db/index');
const { getEffectiveBusinessDate, formatPkDate } = require('../utils/datetime');

function getClosingTimeBuffer() {
  return settingsModel.getInt('closingTimeBuffer', 4);
}

function getCurrentBusinessDate() {
  const buffer = getClosingTimeBuffer();
  return getEffectiveBusinessDate(buffer);
}

function getDaySessionStatus() {
  const db = getDb();
  const currentBusinessDate = getCurrentBusinessDate();

  // Check if there's an open session for the current business date
  const session = db.prepare(
    "SELECT * FROM day_sessions WHERE businessDate = ? AND status = 'open'"
  ).get(currentBusinessDate);

  // Get today's stats regardless of session status
  const totals = salesModel.getTotals({ from: currentBusinessDate, to: currentBusinessDate });
  const expenseTotals = expenseModel.getTotalAmount({ from: currentBusinessDate, to: currentBusinessDate });

  return {
    isOpen: !!session,
    businessDate: currentBusinessDate,
    session: session || null,
    stats: {
      totalRevenue: totals.totalRevenue || 0,
      totalBills: totals.totalBills || 0,
      totalExpenses: expenseTotals.totalExpenses || 0,
    },
    closingTimeBuffer: getClosingTimeBuffer(),
  };
}

function openDay({ openedBy = '' } = {}) {
  const db = getDb();
  const currentBusinessDate = getCurrentBusinessDate();

  // Check if there's already an open session for this date
  const existing = db.prepare(
    "SELECT * FROM day_sessions WHERE businessDate = ? AND status = 'open'"
  ).get(currentBusinessDate);

  if (existing) {
    return { success: true, session: existing, businessDate: currentBusinessDate, alreadyOpen: true };
  }

  // Close any lingering open sessions from previous dates
  db.prepare(
    "UPDATE day_sessions SET status = 'closed', closedAt = ? WHERE status = 'open' AND businessDate != ?"
  ).run(new Date().toISOString(), currentBusinessDate);

  const sessionId = `${currentBusinessDate}-session`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO day_sessions (id, businessDate, openedAt, openedBy, status)
    VALUES (?, ?, ?, ?, 'open')
  `).run(sessionId, currentBusinessDate, now, openedBy);

  const session = db.prepare('SELECT * FROM day_sessions WHERE id = ?').get(sessionId);
  return { success: true, session, businessDate: currentBusinessDate, alreadyOpen: false };
}

function closeDay({ closedBy = '', openingBalance = 0, closingBalance = 0, notes = '' } = {}) {
  const db = getDb();
  const currentBusinessDate = getCurrentBusinessDate();

  const session = db.prepare(
    "SELECT * FROM day_sessions WHERE businessDate = ? AND status = 'open'"
  ).get(currentBusinessDate);

  if (!session) {
    throw new Error('No open day session found for the current business date');
  }

  // Compute final stats for the Z-report
  const totals = salesModel.getTotals({ from: currentBusinessDate, to: currentBusinessDate });
  const expenseTotals = expenseModel.getTotalAmount({ from: currentBusinessDate, to: currentBusinessDate });

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE day_sessions
    SET status = 'closed',
        closedAt = ?,
        closedBy = ?,
        totalRevenue = ?,
        totalBills = ?,
        totalExpenses = ?,
        openingBalance = ?,
        closingBalance = ?,
        notes = ?
    WHERE id = ?
  `).run(
    now,
    closedBy,
    totals.totalRevenue || 0,
    totals.totalBills || 0,
    expenseTotals.totalExpenses || 0,
    openingBalance,
    closingBalance,
    notes,
    session.id
  );

  const updatedSession = db.prepare('SELECT * FROM day_sessions WHERE id = ?').get(session.id);
  return {
    success: true,
    session: updatedSession,
    zReport: {
      businessDate: currentBusinessDate,
      totalRevenue: totals.totalRevenue || 0,
      totalBills: totals.totalBills || 0,
      totalExpenses: expenseTotals.totalExpenses || 0,
      netProfit: (totals.totalRevenue || 0) - (expenseTotals.totalExpenses || 0),
      openingBalance,
      closingBalance,
      closedAt: now,
    },
  };
}

function getDayHistory(limit = 30) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM day_sessions
    ORDER BY businessDate DESC
    LIMIT ?
  `).all(limit);
}

module.exports = {
  getClosingTimeBuffer,
  getCurrentBusinessDate,
  getDaySessionStatus,
  openDay,
  closeDay,
  getDayHistory,
};
