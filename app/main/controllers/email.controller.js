const { getDb } = require('../db/index');
const emailService = require('../services/email.service');
const logger = require('../utils/logger');

function getSettings() {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM email_settings WHERE id = 1').get();
    if (!row) return { success: false, error: 'Settings not found.' };
    // Mask password
    return {
      success: true,
      data: { ...row, smtp_pass: row.smtp_pass ? '****' : '' },
    };
  } catch (err) {
    logger.error('email:getSettings failed', err);
    return { success: false, error: err.message };
  }
}

function saveSettings(payload = {}) {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT smtp_pass FROM email_settings WHERE id = 1').get();
    // Keep existing password if the caller sent the mask
    const pass = payload.smtp_pass === '****' ? (existing?.smtp_pass || '') : (payload.smtp_pass || '');

    db.prepare(`
      UPDATE email_settings SET
        provider = ?, smtp_host = ?, smtp_port = ?, smtp_secure = ?,
        smtp_user = ?, smtp_pass = ?, from_name = ?, recipient_email = ?,
        schedule_time = ?, is_enabled = ?, updatedAt = ?
      WHERE id = 1
    `).run(
      payload.provider || 'gmail',
      payload.smtp_host || '',
      Number(payload.smtp_port) || 587,
      payload.smtp_secure ? 1 : 0,
      payload.smtp_user || '',
      pass,
      payload.from_name || 'Restaurant Manager',
      payload.recipient_email || '',
      payload.schedule_time || '23:55',
      payload.is_enabled ? 1 : 0,
      new Date().toISOString(),
    );
    return { success: true };
  } catch (err) {
    logger.error('email:saveSettings failed', err);
    return { success: false, error: err.message };
  }
}

async function sendTestEmail(payload = {}) {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT smtp_pass FROM email_settings WHERE id = 1').get();
    const pass = payload.smtp_pass === '****' ? (existing?.smtp_pass || '') : (payload.smtp_pass || '');
    await emailService.sendTestEmail({ ...payload, smtp_pass: pass });
    return { success: true };
  } catch (err) {
    logger.error('email:sendTestEmail failed', err);
    return { success: false, error: err.message };
  }
}

async function sendNow() {
  try {
    const result = await emailService.sendDailyReport({ forceEnabled: true });
    return { success: true, data: result };
  } catch (err) {
    logger.error('email:sendNow failed', err);
    return { success: false, error: err.message };
  }
}

module.exports = { getSettings, saveSettings, sendTestEmail, sendNow };
