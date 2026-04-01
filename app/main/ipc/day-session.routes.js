const { ipcMain } = require('electron');
const daySessionController = require('../controllers/day-session.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

function registerDaySessionRoutes() {
  ipcMain.handle('daySession:getStatus', async () => {
    return requireAuth(async () => {
      return daySessionController.getStatus();
    });
  });

  ipcMain.handle('daySession:openDay', async (_event, payload) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return daySessionController.openDay(payload);
      });
    });
  });

  ipcMain.handle('daySession:closeDay', async (_event, payload) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return daySessionController.closeDay(payload);
      });
    });
  });

  ipcMain.handle('daySession:getHistory', async (_event, payload) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return daySessionController.getHistory(payload);
      });
    });
  });

  ipcMain.handle('daySession:getSettings', async () => {
    return requireAuth(async () => {
      return daySessionController.getSettings();
    });
  });

  ipcMain.handle('daySession:updateSettings', async (_event, payload) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return daySessionController.updateSettings(payload);
      });
    });
  });
}

module.exports = { registerDaySessionRoutes };
