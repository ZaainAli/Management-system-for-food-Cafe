const { ipcMain } = require('electron');
const userController = require('../controllers/user.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

function registerUserRoutes() {
  ipcMain.handle('user:getAll', async () => {
    return requireAuth(async () => {
      return requireRole(['admin'], async () => {
        return userController.getAll();
      });
    });
  });

  ipcMain.handle('user:create', async (_event, userData) => {
    return requireAuth(async () => {
      return requireRole(['admin'], async () => {
        return userController.create(userData);
      });
    });
  });

  ipcMain.handle('user:update', async (_event, payload) => {
    return requireAuth(async () => {
      return requireRole(['admin'], async () => {
        return userController.update(payload);
      });
    });
  });

  ipcMain.handle('user:delete', async (_event, { id }) => {
    return requireAuth(async () => {
      return requireRole(['admin'], async () => {
        return userController.remove(id);
      });
    });
  });

  ipcMain.handle('user:resetPassword', async (_event, payload) => {
    return requireAuth(async () => {
      return requireRole(['admin'], async () => {
        return userController.resetPassword(payload);
      });
    });
  });
}

module.exports = { registerUserRoutes };
