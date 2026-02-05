const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const { runMigrations } = require('./schema');
const logger = require('../utils/logger');

let db = null;

function getDb() {
  if (db) return db;

  // Store database in user app data directory for persistence across runs
  const dbDir = app.getPath('userData');
  const dbPath = path.join(dbDir, 'restaurant.db');

  try {
    db = new Database(dbPath);

    // Enable WAL mode for better concurrent read performance
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    logger.info(`Database connected: ${dbPath}`);
  } catch (err) {
    logger.error('Failed to connect to database', err);
    throw err;
  }

  return db;
}

function initializeDatabase() {
  const database = getDb();
  runMigrations(database);
  logger.info('Database initialized successfully');
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

module.exports = { getDb, initializeDatabase, closeDatabase };
