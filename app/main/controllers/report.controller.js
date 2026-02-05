const reportService = require('../services/report.service');
const logger = require('../utils/logger');

async function getDashboardStats(filters = {}) {
  try {
    const stats = await reportService.getDashboardStats(filters);
    return { success: true, data: stats };
  } catch (err) {
    logger.error('report:getDashboardStats failed', err);
    return { success: false, error: err.message };
  }
}

async function getSalesReport(filters = {}) {
  try {
    const report = await reportService.getSalesReport(filters);
    return { success: true, data: report };
  } catch (err) {
    logger.error('report:getSalesReport failed', err);
    return { success: false, error: err.message };
  }
}

async function getExpenseReport(filters = {}) {
  try {
    const report = await reportService.getExpenseReport(filters);
    return { success: true, data: report };
  } catch (err) {
    logger.error('report:getExpenseReport failed', err);
    return { success: false, error: err.message };
  }
}

async function getStaffReport(filters = {}) {
  try {
    const report = await reportService.getStaffReport(filters);
    return { success: true, data: report };
  } catch (err) {
    logger.error('report:getStaffReport failed', err);
    return { success: false, error: err.message };
  }
}

async function getProfitLoss(filters = {}) {
  try {
    const report = await reportService.getProfitLoss(filters);
    return { success: true, data: report };
  } catch (err) {
    logger.error('report:getProfitLoss failed', err);
    return { success: false, error: err.message };
  }
}

module.exports = { getDashboardStats, getSalesReport, getExpenseReport, getStaffReport, getProfitLoss };
