const { ipcMain } = require('electron');
const setupController = require('../controllers/setup.controller');

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
}

module.exports = { registerSetupRoutes };
