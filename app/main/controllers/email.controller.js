const fs = require('fs');
const path = require('path');
const { getDb } = require('../db/index');
const emailService = require('../services/email.service');
const { getSchedulerStatus } = require('../services/scheduler.service');
const logger = require('../utils/logger');

function normalizeScheduleTime(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return '23:55';
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return '23:55';
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

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

    const scheduleTime = normalizeScheduleTime(payload.schedule_time);

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
      payload.from_name || 'Restaurant Daily Report',
      payload.recipient_email || '',
      scheduleTime,
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
    // Manual send should not block scheduled delivery later on the same day.
    const result = await emailService.sendDailyReport({ forceEnabled: true, markLastSent: false });
    return { success: true, data: result };
  } catch (err) {
    logger.error('email:sendNow failed', err);
    return { success: false, error: err.message };
  }
}

function schedulerStatus() {
  try {
    return { success: true, data: getSchedulerStatus() };
  } catch (err) {
    logger.error('email:schedulerStatus failed', err);
    return { success: false, error: err.message };
  }
}

function getLogs() {
  try {
    const { app } = require('electron');
    const logPath = path.join(app.getPath('userData'), 'logs', 'app.log');
    if (!fs.existsSync(logPath)) return { success: true, data: [] };
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    const relevant = lines.filter(l =>
      /scheduler|Scheduler|email:|Email|sendDailyReport|smtp/i.test(l)
    );
    return { success: true, data: relevant.slice(-80) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function resetLastSent() {
  try {
    emailService.resetLastSent();
    logger.info('email:resetLastSent — last_sent cleared for re-testing');
    return { success: true };
  } catch (err) {
    logger.error('email:resetLastSent failed', err);
    return { success: false, error: err.message };
  }
}

module.exports = { getSettings, saveSettings, sendTestEmail, sendNow, schedulerStatus, getLogs, resetLastSent };
