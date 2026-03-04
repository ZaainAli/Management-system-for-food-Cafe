const { ipcMain } = require('electron');
const emailController = require('../controllers/email.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

function registerEmailRoutes() {
  ipcMain.handle('email:getSettings', async () => {
    return requireAuth(async () => {
      return requireRole(['admin'], async () => {
        return emailController.getSettings();
      });
    });
  });

  ipcMain.handle('email:saveSettings', async (_event, payload) => {
    return requireAuth(async () => {
      return requireRole(['admin'], async () => {
        return emailController.saveSettings(payload);
      });
    });
  });

  ipcMain.handle('email:sendTestEmail', async (_event, payload) => {
    return requireAuth(async () => {
      return requireRole(['admin'], async () => {
        return emailController.sendTestEmail(payload);
      });
    });
  });

  ipcMain.handle('email:sendNow', async () => {
    return requireAuth(async () => {
      return requireRole(['admin'], async () => {
        return emailController.sendNow();
      });
    });
  });

  ipcMain.handle('email:schedulerStatus', async () => {
    return requireAuth(async () => {
      return requireRole(['admin'], async () => {
        return emailController.schedulerStatus();
      });
    });
  });

  ipcMain.handle('email:getLogs', async () => {
    return requireAuth(async () => {
      return requireRole(['admin'], async () => {
        return emailController.getLogs();
      });
    });
  });

  ipcMain.handle('email:resetLastSent', async () => {
    return requireAuth(async () => {
      return requireRole(['admin'], async () => {
        return emailController.resetLastSent();
      });
    });
  });
}

module.exports = { registerEmailRoutes };
