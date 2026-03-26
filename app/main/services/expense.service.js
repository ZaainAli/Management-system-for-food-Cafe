const expenseModel = require('../models/expense.model');
const salesModel = require('../models/sales.model');
const employeeModel = require('../models/employee.model');
const khataModel = require('../models/khata.model');
const syncService = require('./sync.service');
const { v4: uuidv4 } = require('uuid');
const { formatPkDate } = require('../utils/datetime');

async function getAll(filters = {}) {
  const expenses = expenseModel.findAll(filters);
  return await enrichExpenses(expenses);
}

async function getById(id) {
  const expense = expenseModel.findById(id);
  if (!expense) return null;
  const enriched = await enrichExpenses([expense]);
  return enriched[0];
}

function normalizeSourceType(sourceType) {
  const value = String(sourceType || 'manual').trim().toLowerCase();
  if (!['manual', 'khata', 'salary'].includes(value)) {
    throw new Error('Invalid expense source type');
  }
  return value;
}

function normalizeAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Amount must be a positive number');
  return parseFloat(value.toFixed(2));
}

async function add(expense) {
  if (!expense.description || !String(expense.description).trim()) throw new Error('Expense must have a description');
  if (!expense.category || !String(expense.category).trim()) throw new Error('Expense must have a category');
  const amount = normalizeAmount(expense.amount);
  const sourceType = normalizeSourceType(expense.sourceType);

  let sourceEntityId = null;
  let sourceEntityName = '';
  let sourceRecordId = null;
  const date = expense.date || formatPkDate(new Date());
  const notes = expense.notes || '';

  if (sourceType === 'khata') {
    const khataId = expense.sourceEntityId || expense.khataId;
    if (!khataId) throw new Error('Khata profile is required');
    const profile = await khataModel.getProfileById(khataId);
    if (!profile) throw new Error('Khata profile not found');

    const tx = {
      id: uuidv4(),
      khataId: profile.id,
      type: 'payment',
      amount,
      paymentSource: 'today_sale',
      note: notes || expense.description,
      date,
      createdAt: new Date().toISOString(),
    };
    khataModel.insertTransaction(tx);
    syncService.pushKhataTransaction(tx).catch(() => {});
    sourceEntityId = profile.id;
    sourceEntityName = profile.name;
    sourceRecordId = tx.id;
  }

  if (sourceType === 'salary') {
    const employeeId = expense.sourceEntityId || expense.employeeId;
    if (!employeeId) throw new Error('Employee is required');
    const employee = await employeeModel.findById(employeeId);
    if (!employee) throw new Error('Employee not found');

    const salaryRecord = {
      id: uuidv4(),
      employeeId: employee.id,
      employeeName: employee.name,
      amount,
      payDate: date,
      notes: notes || expense.description,
      type: 'salary',
      paymentSource: 'today_sale',
      createdAt: new Date().toISOString(),
    };
    // add sycncservice push inside model method to ensure record is created before syncing
    employeeModel.insertSalaryRecord(salaryRecord);
    syncService.pushSalaryRecord(salaryRecord).catch(() => {});
    sourceEntityId = employee.id;
    sourceEntityName = employee.name;
    sourceRecordId = salaryRecord.id;
  }

  const newExpense = {
    id: uuidv4(),
    description: String(expense.description).trim(),
    amount,
    category: String(expense.category).trim(),
    date,
    sourceType,
    sourceEntityId,
    sourceEntityName,
    sourceRecordId,
    notes,
    createdAt: new Date().toISOString(),
  };

  let saved;
  try {
    saved = expenseModel.insert(newExpense);
  } catch (err) {
    if (sourceType === 'khata' && sourceRecordId) khataModel.removeTransaction(sourceRecordId);
    if (sourceType === 'salary' && sourceRecordId) employeeModel.removeSalaryRecord(sourceRecordId);
    throw err;
  }

  salesModel.addExpenseToDailySales({ date: saved.date, amountDelta: saved.amount });
  syncService.pushExpense(saved).catch(() => {});
  return saved;
}

async function update({ id, ...updates }) {
  const rawExpense = expenseModel.findById(id);
  if (!rawExpense) throw new Error('Expense not found');
  const expense = rawExpense;
  if (updates.amount !== undefined) updates.amount = normalizeAmount(updates.amount);
  if (updates.description !== undefined) updates.description = String(updates.description).trim();
  if (updates.category !== undefined) updates.category = String(updates.category).trim();
  if (updates.description !== undefined && !updates.description) throw new Error('Expense must have a description');
  if (updates.category !== undefined && !updates.category) throw new Error('Expense must have a category');

  let currentSourceTypeRaw = expense.sourceType;
  // If legacy records are missing sourceType but have a linked record, infer it.
  if (!currentSourceTypeRaw && expense.sourceRecordId) {
    const khataTx = khataModel.getTransactionById(expense.sourceRecordId);
    if (khataTx) currentSourceTypeRaw = 'khata';
    else {
      const salaryRecord = employeeModel.getSalaryRecordById(expense.sourceRecordId);
      if (salaryRecord) currentSourceTypeRaw = 'salary';
    }
  }
  const currentSourceType = normalizeSourceType(currentSourceTypeRaw);
  const hasSourceTypeUpdate =
    updates.sourceType !== undefined &&
    updates.sourceType !== null &&
    String(updates.sourceType).trim() !== '';
  const requestedSourceType = hasSourceTypeUpdate
    ? normalizeSourceType(updates.sourceType)
    : currentSourceType;
  if (requestedSourceType !== currentSourceType) {
    throw new Error('Changing expense source type is not supported');
  }

  if (currentSourceType === 'khata') {
    const tx = expense.sourceRecordId ? khataModel.getTransactionById(expense.sourceRecordId) : null;
    if (!tx) throw new Error('Linked khata transaction not found');
    const nextAmount = normalizeAmount(updates.amount !== undefined ? updates.amount : expense.amount);
    const nextDate = updates.date || expense.date;
    const nextNote =
      updates.notes !== undefined
        ? updates.notes
        : updates.description !== undefined
        ? updates.description
        : expense.notes;
    const updatedTx = {
      ...tx,
      amount: nextAmount,
      date: nextDate,
      note: nextNote || updates.description || expense.description,
      type: 'payment',
    };
    khataModel.updateTransaction(updatedTx);
    syncService.pushKhataTransaction(updatedTx).catch(() => {});
  }

  if (currentSourceType === 'salary') {
    const salaryRecord = expense.sourceRecordId ? employeeModel.getSalaryRecordById(expense.sourceRecordId) : null;
    if (!salaryRecord) throw new Error('Linked salary record not found');
    const nextAmount = normalizeAmount(updates.amount !== undefined ? updates.amount : expense.amount);
    const nextDate = updates.date || expense.date;
    const nextNote =
      updates.notes !== undefined
        ? updates.notes
        : updates.description !== undefined
        ? updates.description
        : expense.notes;
    employeeModel.updateSalaryRecord({
      ...salaryRecord,
      amount: nextAmount,
      payDate: nextDate,
      notes: nextNote || updates.description || expense.description,
    });
    syncService.pushSalaryRecord({
      ...salaryRecord,
      amount: nextAmount,
      payDate: nextDate,
      notes: nextNote || updates.description || expense.description,
    }).catch(() => {});
  }

  const updated = {
    ...expense,
    ...updates,
    sourceType: currentSourceType,
    sourceEntityId: expense.sourceEntityId || null,
    sourceEntityName: expense.sourceEntityName || '',
    sourceRecordId: expense.sourceRecordId || null,
    updatedAt: new Date().toISOString(),
  };
  const saved = expenseModel.update(updated);

  // Adjust daily_sales for date/amount changes
  if (expense.date !== saved.date || expense.amount !== saved.amount) {
    salesModel.addExpenseToDailySales({ date: expense.date, amountDelta: -expense.amount });
    salesModel.addExpenseToDailySales({ date: saved.date, amountDelta: saved.amount });
  }

  syncService.pushExpense(saved).catch(() => {});
  return saved;
}

async function remove(id) {
  const rawExpense = expenseModel.findById(id);
  if (!rawExpense) throw new Error('Expense not found');
  const expense = rawExpense;
  const sourceType = normalizeSourceType(expense.sourceType);
  if (sourceType === 'khata' && expense.sourceRecordId) {
    khataModel.removeTransaction(expense.sourceRecordId);
    syncService.deleteKhataTransaction(id).catch(() => {});
  }
  if (sourceType === 'salary' && expense.sourceRecordId) {
    employeeModel.removeSalaryRecord(expense.sourceRecordId);
    syncService.deleteSalaryRecord(expense.sourceRecordId).catch(() => {});
  }
  // Snapshot to trash before deleting
  syncService.pushDeletedItem({
    itemType: 'expense',
    itemId: expense.id,
    itemData: expense,
  }).catch(() => {});

  const removed = expenseModel.remove(id);
  salesModel.addExpenseToDailySales({ date: expense.date, amountDelta: -expense.amount });
  syncService.deleteExpense(id).catch(() => {});
  return removed;
}

async function getCategories() {
  return expenseModel.getDistinctCategories();
}

async function getSummary(filters = {}) {
  // Aggregate expenses grouped by category within date range
  const expenses = await expenseModel.findAll(filters);
  const summary = {};
  let totalAmount = 0;

  for (const exp of expenses) {
    if (!summary[exp.category]) {
      summary[exp.category] = { category: exp.category, total: 0, count: 0 };
    }
    summary[exp.category].total += exp.amount;
    summary[exp.category].count += 1;
    totalAmount += exp.amount;
  }

  return {
    byCategory: Object.values(summary),
    totalAmount: parseFloat(totalAmount.toFixed(2)),
    totalCount: expenses.length,
  };
}

// Enrich expense data by fetching and populating missing entity names
async function enrichExpenses(expenses) {
  if (!Array.isArray(expenses)) expenses = [expenses];
  if (!expenses.length) return expenses;

  // Create a map to cache entity names for performance
  const khataCache = new Map();
  const employeeCache = new Map();

  for (const exp of expenses) {
    if (!exp.sourceEntityName && exp.sourceEntityId) {
      if (exp.sourceType === 'khata') {
        if (!khataCache.has(exp.sourceEntityId)) {
          const profile = await khataModel.getProfileById(exp.sourceEntityId);
          khataCache.set(exp.sourceEntityId, profile?.name || '');
        }
        exp.sourceEntityName = khataCache.get(exp.sourceEntityId);
      } else if (exp.sourceType === 'salary') {
        if (!employeeCache.has(exp.sourceEntityId)) {
          const employee = await employeeModel.findById(exp.sourceEntityId);
          employeeCache.set(exp.sourceEntityId, employee?.name || '');
        }
        exp.sourceEntityName = employeeCache.get(exp.sourceEntityId);
      }
    }
  }

  return expenses;
}

module.exports = { getAll, getById, add, update, remove, getCategories, getSummary, enrichExpenses };

