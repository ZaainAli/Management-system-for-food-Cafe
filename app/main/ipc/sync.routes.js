const { ipcMain, BrowserWindow } = require('electron');
const { pullAllFromSupabase } = require('../services/pull.service');
const logger = require('../utils/logger');

function registerSyncRoutes() {
  ipcMain.handle('sync:pull', async (event) => {
    try {
      await pullAllFromSupabase();
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && !win.isDestroyed()) {
        win.webContents.send('sync:pulled');
      }
      return { success: true };
    } catch (err) {
      logger.error('sync:pull failed', err);
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerSyncRoutes };
