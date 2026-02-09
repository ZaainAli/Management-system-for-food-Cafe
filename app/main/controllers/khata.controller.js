const khataService = require('../services/khata.service');
const logger = require('../utils/logger');

async function getAllProfiles() {
  try {
    const data = await khataService.getAllProfiles();
    return { success: true, data };
  } catch (err) {
    logger.error('khata:getAllProfiles failed', err);
    return { success: false, error: err.message };
  }
}

async function getById(id) {
  try {
    const data = await khataService.getById(id);
    if (!data) return { success: false, error: 'Khata profile not found' };
    return { success: true, data };
  } catch (err) {
    logger.error('khata:getById failed', err);
    return { success: false, error: err.message };
  }
}

async function addProfile(payload) {
  try {
    const created = await khataService.addProfile(payload);
    return { success: true, data: created };
  } catch (err) {
    logger.error('khata:addProfile failed', err);
    return { success: false, error: err.message };
  }
}

async function addDue(payload) {
  try {
    const created = await khataService.addDue(payload);
    return { success: true, data: created };
  } catch (err) {
    logger.error('khata:addDue failed', err);
    return { success: false, error: err.message };
  }
}

async function addPayment(payload) {
  try {
    const created = await khataService.addPayment(payload);
    return { success: true, data: created };
  } catch (err) {
    logger.error('khata:addPayment failed', err);
    return { success: false, error: err.message };
  }
}

module.exports = { getAllProfiles, getById, addProfile, addDue, addPayment };
