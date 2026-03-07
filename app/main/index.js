const path = require('path');
const fs   = require('fs');
const dotenvResult = require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { app, BrowserWindow, Menu } = require('electron');
const { initializeDatabase } = require('./db/index');
const { registerIPCHandlers } = require('./ipc/index');
const { pullAllFromSupabase } = require('./services/pull.service');
const logger = require('./utils/logger');

// Debug: confirm dotenv loaded correctly
logger.info('[dotenv] path resolved to: ' + path.join(__dirname, '../../.env'));
logger.info('[dotenv] load result: ' + (dotenvResult.error ? 'ERROR: ' + dotenvResult.error.message : 'OK'));
logger.info('[dotenv] SUPABASE_URL set: ' + !!process.env.SUPABASE_URL);
logger.info('[dotenv] SUPABASE_SERVICE_ROLE_KEY set: ' + !!process.env.SUPABASE_SERVICE_ROLE_KEY);

// Load Supabase credentials from userData/supabase-config.json (packaged app support)
function loadSupabaseConfig() {
  try {
    const configPath = path.join(app.getPath('userData'), 'supabase-config.json');
    if (!fs.existsSync(configPath)) {
      logger.info('[config] No supabase-config.json in userData — Supabase not configured');
      return;
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.supabaseUrl && !process.env.SUPABASE_URL) {
      process.env.SUPABASE_URL = config.supabaseUrl;
    }
    if (config.supabaseKey && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = config.supabaseKey;
    }
    logger.info('[config] Loaded Supabase config from userData');
    logger.info('[config] SUPABASE_URL set: ' + !!process.env.SUPABASE_URL);
    logger.info('[config] SUPABASE_SERVICE_ROLE_KEY set: ' + !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  } catch (err) {
    logger.error('[config] Failed to load supabase-config.json:', err.message);
  }
}

let mainWindow;

function createWindow() {

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    backgroundColor: '#0f172a',
    frame: false,
  });

  // Disable the default menu
  Menu.setApplicationMenu(null);

  // Start loading the renderer immediately so it loads in parallel with DB init
  const isDev = process.env.VITE_DEV_SERVER_URL || !app.isPackaged;
  if (isDev) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(devServerUrl).catch(() => {
      mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
  }

  // Initialize database and register IPC handlers (renderer loads in parallel)
  initializeDatabase();
  registerIPCHandlers();

  // Pull latest data from Supabase into SQLite (non-blocking)
  pullAllFromSupabase().catch(() => {});

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    logger.info('Main window ready and shown');
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximized');
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:unmaximized');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  loadSupabaseConfig();
  logger.info('Electron app ready');
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (!mainWindow) {
    createWindow();
  }
});
