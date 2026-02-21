const { ipcMain } = require('electron');
const khataController = require('../controllers/khata.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

function registerKhataRoutes() {
  ipcMain.handle('khata:getAll', async () => {
    return requireAuth(async () => {
      return khataController.getAllProfiles();
    });
  });

  ipcMain.handle('khata:getById', async (_event, { id }) => {
    return requireAuth(async () => {
      return khataController.getById(id);
    });
  });

  ipcMain.handle('khata:addProfile', async (_event, payload) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return khataController.addProfile(payload);
      });
    });
  });

  ipcMain.handle('khata:addDue', async (_event, payload) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager', 'cashier'], async () => {
        return khataController.addDue(payload);
      });
    });
  });

  ipcMain.handle('khata:addPayment', async (_event, payload) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager', 'cashier'], async () => {
        return khataController.addPayment(payload);
      });
    });
  });

  ipcMain.handle('khata:updateTransaction', async (_event, payload) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager', 'cashier'], async () => {
        return khataController.updateTransaction(payload);
      });
    });
  });

  ipcMain.handle('khata:deleteTransaction', async (_event, payload) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager', 'cashier'], async () => {
        return khataController.deleteTransaction(payload);
      });
    });
  });

  ipcMain.handle('khata:deleteProfile', async (_event, payload) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return khataController.deleteProfile(payload);
      });
    });
  });

  ipcMain.handle('khata:exportProfile', async (_event, payload) => {
    return requireAuth(async () => {
      return khataController.exportProfile(payload);
    });
  });
}

module.exports = { registerKhataRoutes };
