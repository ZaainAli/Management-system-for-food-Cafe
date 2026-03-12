const { ipcMain } = require('electron');
const setupController = require('../controllers/setup.controller');
const { pullAllFromSupabase } = require('../services/pull.service');

function registerSetupRoutes() {
  ipcMain.handle('setup:getBranchId', async () => {
    return setupController.getBranchId();
  });

  ipcMain.handle('setup:saveBranchId', async (_event, payload) => {
    return setupController.saveBranchId(payload);
  });

  ipcMain.handle('setup:getBranchInfo', async () => {
    return setupController.getBranchInfo();
  });

  ipcMain.handle('setup:getSupabaseConfig', async () => {
    return setupController.getSupabaseConfig();
  });

  ipcMain.handle('setup:saveSupabaseConfig', async (_event, payload) => {
    return setupController.saveSupabaseConfig(payload);
  });

  ipcMain.handle('sync:pull', async () => {
    try {
      await pullAllFromSupabase();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerSetupRoutes };
