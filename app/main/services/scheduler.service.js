const { sendDailyReport, loadSettings } = require('./email.service');
const logger = require('../utils/logger');

let schedulerInterval = null;

function getCurrentHHMM() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function normalizeHHMM(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getTodayScheduledDateTime(scheduleTime) {
  const [hours, minutes] = scheduleTime.split(':').map(Number);
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
}

function parseLastSentAt(settings, scheduleTime) {
  if (settings.last_sent_at) {
    const parsed = new Date(settings.last_sent_at);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  // Backward-compatibility with older records that only had last_sent_date.
  if (settings.last_sent_date) {
    const dateMatch = String(settings.last_sent_date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
      const y = Number(dateMatch[1]);
      const m = Number(dateMatch[2]);
      const d = Number(dateMatch[3]);
      const [hours, minutes] = scheduleTime.split(':').map(Number);
      return new Date(y, m - 1, d, hours, minutes, 0, 0);
    }
  }

  return null;
}

async function tick() {
  try {
    const settings = loadSettings();
    if (!settings) {
      logger.warn('Scheduler tick: email_settings row not found in DB');
      return;
    }
    if (!settings.is_enabled) {
      logger.info('Scheduler tick: scheduling is disabled — skipping');
      return;
    }
    if (!settings.recipient_email) {
      logger.warn('Scheduler tick: recipient_email not set — skipping');
      return;
    }
    if (!settings.smtp_user || !settings.smtp_pass) {
      logger.warn('Scheduler tick: SMTP credentials not configured — skipping');
      return;
    }

    const now = new Date();
    const currentTime = getCurrentHHMM();
    const scheduleTime = normalizeHHMM(settings.schedule_time);
    if (!scheduleTime) {
      logger.warn(`Scheduler tick: invalid schedule_time "${settings.schedule_time}" — skipping`);
      return;
    }
    const scheduledAt = getTodayScheduledDateTime(scheduleTime);
    const lastSentAt = parseLastSentAt(settings, scheduleTime);

    logger.info(`Scheduler tick: now=${currentTime}, scheduled=${scheduleTime}, lastSent=${lastSentAt ? lastSentAt.toISOString() : 'never'}, willFire=${now >= scheduledAt && (!lastSentAt || lastSentAt < scheduledAt)}`);

    // Use >= so a late start or brief offline period still catches up.
    if (now >= scheduledAt && (!lastSentAt || lastSentAt < scheduledAt)) {
      logger.info(`Scheduler: triggering daily report (scheduled ${scheduleTime}, current ${currentTime})`);
      await sendDailyReport({ forceEnabled: false });
    }
  } catch (err) {
    logger.error('Scheduler tick error:', err);
  }
}

function startScheduler() {
  if (schedulerInterval) return;
  // Run one check immediately on startup.
  tick().catch((err) => logger.error('Scheduler immediate tick error:', err));
  schedulerInterval = setInterval(tick, 60_000);
  logger.info('Email scheduler started (checking every 60s)');
}

function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

function getSchedulerStatus() {
  const settings = loadSettings();
  if (!settings) return { error: 'email_settings not found in DB' };

  const scheduleTime = normalizeHHMM(settings.schedule_time);
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  let scheduledAt = null;
  let lastSentAt = null;
  let willFireToday = false;

  if (scheduleTime) {
    scheduledAt = getTodayScheduledDateTime(scheduleTime);
    lastSentAt = parseLastSentAt(settings, scheduleTime);
    willFireToday = now >= scheduledAt && (!lastSentAt || lastSentAt < scheduledAt);
  }

  const issues = [];
  if (!settings.is_enabled) issues.push('Scheduling is disabled — toggle it ON and save.');
  if (!settings.recipient_email) issues.push('Recipient email is not set.');
  if (!settings.smtp_user || !settings.smtp_pass) issues.push('SMTP credentials are missing.');
  if (!scheduleTime) issues.push(`Invalid schedule time: "${settings.schedule_time}".`);

  // Human-readable reason why the scheduler won't fire right now
  let reasonNotFiring = null;
  let minutesUntilFire = null;
  if (issues.length > 0) {
    reasonNotFiring = issues[0];
  } else if (!scheduledAt) {
    reasonNotFiring = 'Schedule time is not configured.';
  } else if (willFireToday) {
    reasonNotFiring = null; // All good — will fire on next tick
  } else if (now < scheduledAt) {
    minutesUntilFire = Math.ceil((scheduledAt - now) / 60000);
    reasonNotFiring = `Waiting for ${scheduleTime} — fires in ${minutesUntilFire} minute(s).`;
  } else if (lastSentAt) {
    const pad = n => String(n).padStart(2, '0');
    const sentTime = `${pad(lastSentAt.getHours())}:${pad(lastSentAt.getMinutes())}:${pad(lastSentAt.getSeconds())}`;
    reasonNotFiring = `Already sent today at ${sentTime} — will fire again tomorrow at ${scheduleTime}.`;
  }

  return {
    isEnabled: !!settings.is_enabled,
    scheduleTime: scheduleTime || settings.schedule_time,
    currentTime,
    scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
    lastSentAt: lastSentAt ? lastSentAt.toISOString() : null,
    lastSentDate: settings.last_sent_date || null,
    willFireToday,
    schedulerRunning: schedulerInterval !== null,
    issues,
    reasonNotFiring,
    minutesUntilFire,
  };
}

module.exports = { startScheduler, stopScheduler, getSchedulerStatus };
