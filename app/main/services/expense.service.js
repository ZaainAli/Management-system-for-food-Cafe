const expenseModel = require('../models/expense.model');
const salesModel = require('../models/sales.model');
const { v4: uuidv4 } = require('uuid');

async function getAll(filters = {}) {
  return expenseModel.findAll(filters);
}

async function getById(id) {
  return expenseModel.findById(id);
}

async function add(expense) {
  if (!expense.description) throw new Error('Expense must have a description');
  if (!expense.amount || expense.amount <= 0) throw new Error('Amount must be a positive number');
  if (!expense.category) throw new Error('Expense must have a category');

  const newExpense = {
    id: uuidv4(),
    description: expense.description,
    amount: parseFloat(expense.amount),
    category: expense.category,
    date: expense.date || new Date().toISOString().split('T')[0],
    notes: expense.notes || '',
    createdAt: new Date().toISOString(),
  };
  const saved = expenseModel.insert(newExpense);
  salesModel.addExpenseToDailySales({ date: saved.date, amountDelta: saved.amount });
  return saved;
}

async function update({ id, ...updates }) {
  const expense = await expenseModel.findById(id);
  if (!expense) throw new Error('Expense not found');
  if (updates.amount && updates.amount <= 0) throw new Error('Amount must be a positive number');
  const updated = { ...expense, ...updates, updatedAt: new Date().toISOString() };
  const saved = expenseModel.update(updated);

  // Adjust daily_sales for date/amount changes
  if (expense.date !== saved.date || expense.amount !== saved.amount) {
    salesModel.addExpenseToDailySales({ date: expense.date, amountDelta: -expense.amount });
    salesModel.addExpenseToDailySales({ date: saved.date, amountDelta: saved.amount });
  }

  return saved;
}

async function remove(id) {
  const expense = await expenseModel.findById(id);
  if (!expense) throw new Error('Expense not found');
  const removed = expenseModel.remove(id);
  salesModel.addExpenseToDailySales({ date: expense.date, amountDelta: -expense.amount });
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

module.exports = { getAll, getById, add, update, remove, getCategories, getSummary };
