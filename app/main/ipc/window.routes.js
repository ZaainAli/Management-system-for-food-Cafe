const { ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const { app } = require('electron');

function getWindow(event) {
  return BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
}

let posWindow = null;

function registerWindowRoutes() {
  ipcMain.handle('window:openPOS', async () => {
    // If POS window already exists, focus it
    if (posWindow && !posWindow.isDestroyed()) {
      posWindow.focus();
      return;
    }

    posWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, '../../preload/index.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
      backgroundColor: '#0f172a',
      frame: false,
    });

    const isDev = process.env.VITE_DEV_SERVER_URL || !app.isPackaged;

    if (isDev) {
      const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
      posWindow.loadURL(`${devServerUrl}#pos`).catch(() => {
        posWindow.loadFile(path.join(__dirname, '../../renderer/dist/index.html'), { hash: 'pos' });
      });
    } else {
      posWindow.loadFile(path.join(__dirname, '../../renderer/dist/index.html'), { hash: 'pos' });
    }

    posWindow.on('maximize', () => {
      posWindow.webContents.send('window:maximized');
    });

    posWindow.on('unmaximize', () => {
      posWindow.webContents.send('window:unmaximized');
    });

    posWindow.on('closed', () => {
      posWindow = null;
    });
  });
  ipcMain.handle('window:minimize', async (event) => {
    const window = getWindow(event);
    if (window) {
      window.minimize();
    }
  });

  ipcMain.handle('window:maximize', async (event) => {
    const window = getWindow(event);
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    }
  });

  ipcMain.handle('window:close', async (event) => {
    const window = getWindow(event);
    if (window) {
      window.close();
    }
  });

  ipcMain.handle('window:isMaximized', async (event) => {
    const window = getWindow(event);
    return window ? window.isMaximized() : false;
  });
}

module.exports = { registerWindowRoutes };
