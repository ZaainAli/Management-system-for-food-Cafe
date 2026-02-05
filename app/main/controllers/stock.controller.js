const stockService = require('../services/stock.service');
const logger = require('../utils/logger');

async function getAll() {
  try {
    const items = await stockService.getAll();
    return { success: true, data: items };
  } catch (err) {
    logger.error('stock:getAll failed', err);
    return { success: false, error: err.message };
  }
}

async function getById(id) {
  try {
    const item = await stockService.getById(id);
    if (!item) return { success: false, error: 'Stock item not found' };
    return { success: true, data: item };
  } catch (err) {
    logger.error('stock:getById failed', err);
    return { success: false, error: err.message };
  }
}

async function add(item) {
  try {
    const created = await stockService.add(item);
    logger.info(`Stock item added: ${created.name}`);
    return { success: true, data: created };
  } catch (err) {
    logger.error('stock:add failed', err);
    return { success: false, error: err.message };
  }
}

async function update(payload) {
  try {
    const updated = await stockService.update(payload);
    return { success: true, data: updated };
  } catch (err) {
    logger.error('stock:update failed', err);
    return { success: false, error: err.message };
  }
}

async function remove(id) {
  try {
    await stockService.remove(id);
    return { success: true };
  } catch (err) {
    logger.error('stock:delete failed', err);
    return { success: false, error: err.message };
  }
}

async function adjustQuantity({ id, adjustment, reason }) {
  try {
    const updated = await stockService.adjustQuantity(id, adjustment, reason);
    logger.info(`Stock adjusted for item ${id}: ${adjustment > 0 ? '+' : ''}${adjustment}`);
    return { success: true, data: updated };
  } catch (err) {
    logger.error('stock:adjustQuantity failed', err);
    return { success: false, error: err.message };
  }
}

async function getLowStock(threshold) {
  try {
    const items = await stockService.getLowStock(threshold);
    return { success: true, data: items };
  } catch (err) {
    logger.error('stock:getLowStock failed', err);
    return { success: false, error: err.message };
  }
}

async function getCategories() {
  try {
    const categories = await stockService.getCategories();
    return { success: true, data: categories };
  } catch (err) {
    logger.error('stock:getCategories failed', err);
    return { success: false, error: err.message };
  }
}

module.exports = { getAll, getById, add, update, remove, adjustQuantity, getLowStock, getCategories };
