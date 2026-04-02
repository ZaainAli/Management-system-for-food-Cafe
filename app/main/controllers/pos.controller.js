const billingService = require('../services/billing.service');
const billModel = require('../models/bill.model');
const { printBillReceipt } = require('../services/print.service');
const setupController = require('./setup.controller');
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
    const { skipPrint = false, ...billPayload } = billData || {};
    const bill = await billingService.createBill(billPayload);
    logger.info(`Bill created: #${bill.id}`);
    let printError = null;
    let printSkipped = false;
    if (!skipPrint) {
      try {
        const receiptOptions = {};
        try {
          const branchRes = await setupController.getBranchInfo();
          const branchName = branchRes?.data?.name?.trim();
          if (branchName) {
            receiptOptions.restaurantName = branchName;
          }
        } catch (branchErr) {
          logger.warn('Unable to load branch info for receipt header', branchErr);
        }
        const printResult = await printBillReceipt(bill, receiptOptions);
        if (printResult?.skipped) {
          printSkipped = true;
          printError = printResult.reason || 'Receipt print skipped';
        }
      } catch (err) {
        printError = err.message || 'Receipt print failed';
        logger.error('Receipt print failed', err);
      }
    }
    return { success: true, data: bill, printError, printSkipped };
  } catch (err) {
    logger.error('createBill failed', err);
    return { success: false, error: err.message };
  }
}

async function holdBill(payload) {
  try {
    const heldBill = await billingService.holdBill(payload);
    logger.info(`Bill held: #${heldBill.id}`);
    return { success: true, data: heldBill };
  } catch (err) {
    logger.error('holdBill failed', err);
    return { success: false, error: err.message };
  }
}

async function getHeldBills() {
  try {
    const heldBills = await billingService.getHeldBills();
    return { success: true, data: heldBills };
  } catch (err) {
    logger.error('getHeldBills failed', err);
    return { success: false, error: err.message };
  }
}

async function getHeldBillById(id) {
  try {
    const heldBill = await billingService.getHeldBillById(id);
    if (!heldBill) return { success: false, error: 'Held bill not found' };
    return { success: true, data: heldBill };
  } catch (err) {
    logger.error('getHeldBillById failed', err);
    return { success: false, error: err.message };
  }
}

async function deleteHeldBill(id) {
  try {
    await billingService.deleteHeldBill(id);
    return { success: true };
  } catch (err) {
    logger.error('deleteHeldBill failed', err);
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

async function getRecentBills(limit = 20) {
  try {
    const bills = await billingService.getRecentBills(limit);
    return { success: true, data: bills };
  } catch (err) {
    logger.error('getRecentBills failed', err);
    return { success: false, error: err.message };
  }
}

async function cancelBill(payload = {}) {
  try {
    const cancelled = await billingService.cancelBill(payload);
    logger.info(`Bill cancelled: #${payload.billId || ''}`);
    return { success: true, data: cancelled };
  } catch (err) {
    logger.error('cancelBill failed', err);
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

async function getDiscountedBills(filters = {}) {
  try {
    const data = await billingService.getDiscountedBills(filters);
    // Also fetch khata bills for the same date range
    const khataBills = billModel.getPosKhataBillsByDateRange(filters);
    return { success: true, data, khataBills };
  } catch (err) {
    logger.error('getDiscountedBills failed', err);
    return { success: false, error: err.message };
  }
}

async function getQuickKeys() {
  try {
    const keys = await billingService.getQuickKeys();
    return { success: true, data: keys };
  } catch (err) {
    logger.error('getQuickKeys failed', err);
    return { success: false, error: err.message };
  }
}

async function setQuickKeys(assignments) {
  try {
    const keys = await billingService.setQuickKeys(assignments);
    logger.info('Quick keys updated');
    return { success: true, data: keys };
  } catch (err) {
    logger.error('setQuickKeys failed', err);
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
  holdBill,
  getHeldBills,
  getHeldBillById,
  deleteHeldBill,
  getBills,
  getBillById,
  getRecentBills,
  cancelBill,
  getTables,
  updateTableStatus,
  getDiscountedBills,
  getQuickKeys,
  setQuickKeys,
};
