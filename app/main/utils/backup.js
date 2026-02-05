const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const logger = require('./logger');

function createBackup() {
  try {
    const userData = app.getPath('userData');
    const dbPath = path.join(userData, 'restaurant.db');
    const backupDir = path.join(userData, 'backups');

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    if (!fs.existsSync(dbPath)) {
      logger.warn('No database file found to backup');
      return { success: false, error: 'Database file not found' };
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `restaurant_backup_${timestamp}.db`);

    fs.copyFileSync(dbPath, backupPath);

    logger.info(`Backup created: ${backupPath}`);
    return { success: true, path: backupPath };
  } catch (err) {
    logger.error('Backup failed', err);
    return { success: false, error: err.message };
  }
}

function listBackups() {
  try {
    const userData = app.getPath('userData');
    const backupDir = path.join(userData, 'backups');

    if (!fs.existsSync(backupDir)) return [];

    return fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        size: fs.statSync(path.join(backupDir, f)).size,
        createdAt: fs.statSync(path.join(backupDir, f)).birthtime.toISOString(),
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (err) {
    logger.error('Failed to list backups', err);
    return [];
  }
}

module.exports = { createBackup, listBackups };
