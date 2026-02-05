const { ipcMain, BrowserWindow } = require('electron');

function getWindow(event) {
  return BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
}

function registerWindowRoutes() {
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
