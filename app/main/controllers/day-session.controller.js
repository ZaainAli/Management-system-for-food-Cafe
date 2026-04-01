const daySessionService = require('../services/day-session.service');
const settingsModel = require('../models/settings.model');
const logger = require('../utils/logger');

async function getStatus() {
  try {
    const status = daySessionService.getDaySessionStatus();
    return { success: true, data: status };
  } catch (err) {
    logger.error('daySession:getStatus failed', err);
    return { success: false, error: err.message };
  }
}

async function openDay(payload = {}) {
  try {
    const result = daySessionService.openDay({ openedBy: payload.openedBy || '' });
    logger.info(`Day opened for business date: ${result.businessDate}`);
    return { success: true, data: result };
  } catch (err) {
    logger.error('daySession:openDay failed', err);
    return { success: false, error: err.message };
  }
}

async function closeDay(payload = {}) {
  try {
    const result = daySessionService.closeDay({
      closedBy: payload.closedBy || '',
      openingBalance: Number(payload.openingBalance) || 0,
      closingBalance: Number(payload.closingBalance) || 0,
      notes: payload.notes || '',
    });
    logger.info(`Day closed for business date: ${result.zReport.businessDate}`);
    return { success: true, data: result };
  } catch (err) {
    logger.error('daySession:closeDay failed', err);
    return { success: false, error: err.message };
  }
}

async function getHistory(payload = {}) {
  try {
    const limit = Math.min(Math.max(Number(payload.limit) || 30, 1), 100);
    const history = daySessionService.getDayHistory(limit);
    return { success: true, data: history };
  } catch (err) {
    logger.error('daySession:getHistory failed', err);
    return { success: false, error: err.message };
  }
}

async function getSettings() {
  try {
    const settings = settingsModel.getAll();
    const result = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return { success: true, data: result };
  } catch (err) {
    logger.error('daySession:getSettings failed', err);
    return { success: false, error: err.message };
  }
}

async function updateSettings(payload = {}) {
  try {
    if (payload.closingTimeBuffer !== undefined) {
      const buffer = parseInt(payload.closingTimeBuffer, 10);
      if (!Number.isFinite(buffer) || buffer < 0 || buffer > 23) {
        throw new Error('closingTimeBuffer must be between 0 and 23');
      }
      settingsModel.set('closingTimeBuffer', String(buffer));
    }
    const settings = settingsModel.getAll();
    const result = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    logger.info('Settings updated');
    return { success: true, data: result };
  } catch (err) {
    logger.error('daySession:updateSettings failed', err);
    return { success: false, error: err.message };
  }
}

module.exports = { getStatus, openDay, closeDay, getHistory, getSettings, updateSettings };
