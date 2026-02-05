const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { initializeDatabase } = require('./db/index');
const { registerIPCHandlers } = require('./ipc/index');
const logger = require('./utils/logger');

let mainWindow;

function createWindow() {

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    backgroundColor: '#0f172a',
    show: false,
    frame: false,
  });

  // Disable the default menu
  Menu.setApplicationMenu(null);

  // Initialize database
  initializeDatabase();

  // Register all IPC handlers
  registerIPCHandlers();

  // Load renderer
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

  // Try to load from dev server first
  mainWindow.loadURL(devServerUrl).catch(() => {
    // Fallback to production build if dev server unavailable
    mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
  });

  mainWindow.webContents.openDevTools();

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
