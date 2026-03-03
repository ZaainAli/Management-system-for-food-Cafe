const { sendDailyReport, loadSettings } = require('./email.service');
const logger = require('../utils/logger');

let schedulerInterval = null;

function getCurrentHHMM() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function getTodayDate() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

async function tick() {
  try {
    const settings = loadSettings();
    if (!settings || !settings.is_enabled) return;
    if (!settings.schedule_time || !settings.recipient_email) return;

    const currentTime = getCurrentHHMM();
    const today = getTodayDate();

    // Use >= so a late start or brief offline period still catches up
    if (currentTime >= settings.schedule_time && settings.last_sent_date !== today) {
      logger.info(`Scheduler: triggering daily report (scheduled ${settings.schedule_time}, current ${currentTime})`);
      await sendDailyReport({ forceEnabled: false });
    }
  } catch (err) {
    logger.error('Scheduler tick error:', err);
  }
}

function startScheduler() {
  if (schedulerInterval) return;
  schedulerInterval = setInterval(tick, 60_000);
  logger.info('Email scheduler started (checking every 60s)');
}

function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

module.exports = { startScheduler, stopScheduler };
