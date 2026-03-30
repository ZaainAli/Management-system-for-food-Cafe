const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');
const khataService = require('../services/khata.service');
const logger = require('../utils/logger');
const { formatPkDate, formatPkDateTime } = require('../utils/datetime');

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers, rows) {
  const lines = [];
  lines.push(headers.map(csvEscape).join(','));
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  return lines.join('\n');
}

function sanitizeFilename(value) {
  return String(value || 'khata_profile')
    .trim()
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .replace(/\s+/g, '_');
}

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

async function updateDue(payload) {
  try {
    const updated = await khataService.updateDue(payload);
    return { success: true, data: updated };
  } catch (err) {
    logger.error('khata:updateDue failed', err);
    return { success: false, error: err.message };
  }
}

async function updateTransaction(payload) {
  try {
    const updated = await khataService.updateTransaction(payload);
    return { success: true, data: updated };
  } catch (err) {
    logger.error('khata:updateTransaction failed', err);
    return { success: false, error: err.message };
  }
}

async function deleteTransaction(payload) {
  try {
    const removed = await khataService.deleteTransaction(payload);
    return { success: true, data: removed };
  } catch (err) {
    logger.error('khata:deleteTransaction failed', err);
    return { success: false, error: err.message };
  }
}

async function deleteProfile(payload) {
  try {
    const removed = await khataService.deleteProfile(payload);
    return { success: true, data: removed };
  } catch (err) {
    logger.error('khata:deleteProfile failed', err);
    return { success: false, error: err.message };
  }
}

async function clearTransactions(payload) {
  try {
    const cleared = await khataService.clearTransactions(payload);
    return { success: true, data: cleared };
  } catch (err) {
    logger.error('khata:clearTransactions failed', err);
    return { success: false, error: err.message };
  }
}

async function exportProfile(payload = {}) {
  try {
    const { id } = payload;
    if (!id) return { success: false, error: 'Khata profile id is required' };

    const data = await khataService.getById(id);
    if (!data) return { success: false, error: 'Khata profile not found' };

    const { profile, transactions } = data;
    const profileName = sanitizeFilename(profile.name);
    const today = formatPkDate(new Date());
    const defaultPath = path.join(app.getPath('documents'), `khata_${profileName}_${today}.csv`);

    const parts = [];
    parts.push('Khata Profile');
    parts.push(toCsv(
      ['Name', 'Phone', 'Business Details', 'Total Due', 'Total Paid', 'Balance', 'Created At (PKT)'],
      [[
        profile.name,
        profile.phone,
        profile.businessDetails,
        profile.totalDue,
        profile.totalPaid,
        profile.balance,
        formatPkDateTime(profile.createdAt),
      ]]
    ));
    parts.push('');
    parts.push('Transactions');
    parts.push(toCsv(
      ['Date', 'Type', 'Amount', 'Payment Source', 'Note', 'Created At (PKT)'],
      (transactions || []).map((tx) => [
        tx.date,
        tx.type,
        tx.amount,
        tx.paymentSource,
        tx.note,
        formatPkDateTime(tx.createdAt),
      ])
    ));

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Khata Profile',
      defaultPath,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });

    if (canceled || !filePath) return { success: false, canceled: true };

    const finalPath = filePath.toLowerCase().endsWith('.csv') ? filePath : `${filePath}.csv`;
    fs.writeFileSync(finalPath, parts.join('\n'), 'utf8');

    return { success: true, path: finalPath };
  } catch (err) {
    logger.error('khata:exportProfile failed', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  getAllProfiles,
  getById,
  addProfile,
  addDue,
  updateDue,
  addPayment,
  updateTransaction,
  deleteTransaction,
  deleteProfile,
  clearTransactions,
  exportProfile,
};
