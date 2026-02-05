const expenseModel = require('../models/expense.model');
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
  return expenseModel.insert(newExpense);
}

async function update({ id, ...updates }) {
  const expense = await expenseModel.findById(id);
  if (!expense) throw new Error('Expense not found');
  if (updates.amount && updates.amount <= 0) throw new Error('Amount must be a positive number');
  return expenseModel.update({ ...expense, ...updates, updatedAt: new Date().toISOString() });
}

async function remove(id) {
  const expense = await expenseModel.findById(id);
  if (!expense) throw new Error('Expense not found');
  return expenseModel.remove(id);
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
