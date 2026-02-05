const expenseService = require('../services/expense.service');
const logger = require('../utils/logger');

async function getAll(filters = {}) {
  try {
    const expenses = await expenseService.getAll(filters);
    return { success: true, data: expenses };
  } catch (err) {
    logger.error('expense:getAll failed', err);
    return { success: false, error: err.message };
  }
}

async function getById(id) {
  try {
    const expense = await expenseService.getById(id);
    if (!expense) return { success: false, error: 'Expense not found' };
    return { success: true, data: expense };
  } catch (err) {
    logger.error('expense:getById failed', err);
    return { success: false, error: err.message };
  }
}

async function add(expense) {
  try {
    const created = await expenseService.add(expense);
    logger.info(`Expense added: ${created.description} — ${created.amount}`);
    return { success: true, data: created };
  } catch (err) {
    logger.error('expense:add failed', err);
    return { success: false, error: err.message };
  }
}

async function update(payload) {
  try {
    const updated = await expenseService.update(payload);
    return { success: true, data: updated };
  } catch (err) {
    logger.error('expense:update failed', err);
    return { success: false, error: err.message };
  }
}

async function remove(id) {
  try {
    await expenseService.remove(id);
    return { success: true };
  } catch (err) {
    logger.error('expense:delete failed', err);
    return { success: false, error: err.message };
  }
}

async function getCategories() {
  try {
    const categories = await expenseService.getCategories();
    return { success: true, data: categories };
  } catch (err) {
    logger.error('expense:getCategories failed', err);
    return { success: false, error: err.message };
  }
}

async function getSummary(filters = {}) {
  try {
    const summary = await expenseService.getSummary(filters);
    return { success: true, data: summary };
  } catch (err) {
    logger.error('expense:getSummary failed', err);
    return { success: false, error: err.message };
  }
}

module.exports = { getAll, getById, add, update, remove, getCategories, getSummary };
