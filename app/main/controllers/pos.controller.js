const billingService = require('../services/billing.service');
const logger = require('../utils/logger');

async function getMenuItems() {
  try {
    const items = await billingService.getMenuItems();
    return { success: true, data: items };
  } catch (err) {
    logger.error('getMenuItems failed', err);
    return { success: false, error: err.message };
  }
}

async function addMenuItem(item) {
  try {
    const created = await billingService.addMenuItem(item);
    logger.info(`Menu item added: ${created.name}`);
    return { success: true, data: created };
  } catch (err) {
    logger.error('addMenuItem failed', err);
    return { success: false, error: err.message };
  }
}

async function updateMenuItem({ id, ...updates }) {
  try {
    const updated = await billingService.updateMenuItem(id, updates);
    return { success: true, data: updated };
  } catch (err) {
    logger.error('updateMenuItem failed', err);
    return { success: false, error: err.message };
  }
}

async function deleteMenuItem(id) {
  try {
    await billingService.deleteMenuItem(id);
    return { success: true };
  } catch (err) {
    logger.error('deleteMenuItem failed', err);
    return { success: false, error: err.message };
  }
}

async function getMenuCategories() {
  try {
    const categories = await billingService.getMenuCategories();
    return { success: true, data: categories };
  } catch (err) {
    logger.error('getMenuCategories failed', err);
    return { success: false, error: err.message };
  }
}

async function addMenuCategory(category) {
  try {
    const created = await billingService.addMenuCategory(category);
    return { success: true, data: created };
  } catch (err) {
    logger.error('addMenuCategory failed', err);
    return { success: false, error: err.message };
  }
}

async function createBill(billData) {
  try {
    const bill = await billingService.createBill(billData);
    logger.info(`Bill created: #${bill.id}`);
    return { success: true, data: bill };
  } catch (err) {
    logger.error('createBill failed', err);
    return { success: false, error: err.message };
  }
}

async function getBills(filters = {}) {
  try {
    const bills = await billingService.getBills(filters);
    return { success: true, data: bills };
  } catch (err) {
    logger.error('getBills failed', err);
    return { success: false, error: err.message };
  }
}

async function getBillById(id) {
  try {
    const bill = await billingService.getBillById(id);
    if (!bill) return { success: false, error: 'Bill not found' };
    return { success: true, data: bill };
  } catch (err) {
    logger.error('getBillById failed', err);
    return { success: false, error: err.message };
  }
}

async function getTables() {
  try {
    const tables = await billingService.getTables();
    return { success: true, data: tables };
  } catch (err) {
    logger.error('getTables failed', err);
    return { success: false, error: err.message };
  }
}

async function updateTableStatus(payload) {
  try {
    const table = await billingService.updateTableStatus(payload);
    return { success: true, data: table };
  } catch (err) {
    logger.error('updateTableStatus failed', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  getMenuItems,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getMenuCategories,
  addMenuCategory,
  createBill,
  getBills,
  getBillById,
  getTables,
  updateTableStatus,
};
