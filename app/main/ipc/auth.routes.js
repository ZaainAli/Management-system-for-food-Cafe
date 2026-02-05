const { ipcMain } = require('electron');
const authController = require('../controllers/auth.controller');

function registerAuthRoutes() {
  ipcMain.handle('auth:login', async (_event, credentials) => {
    return authController.login(credentials);
  });

  ipcMain.handle('auth:logout', async () => {
    return authController.logout();
  });

  ipcMain.handle('auth:getCurrentUser', async () => {
    return authController.getCurrentUser();
  });

  ipcMain.handle('auth:changePassword', async (_event, payload) => {
    return authController.changePassword(payload);
  });
}

module.exports = { registerAuthRoutes };
