const { ipcMain } = require('electron');
const posController = require('../controllers/pos.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

function registerPosRoutes() {
  // Menu & Items
  ipcMain.handle('pos:getMenuItems', async () => {
    return requireAuth(async () => {
      return posController.getMenuItems();
    });
  });

  ipcMain.handle('pos:addMenuItem', async (_event, item) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return posController.addMenuItem(item);
      });
    });
  });

  ipcMain.handle('pos:updateMenuItem', async (_event, payload) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return posController.updateMenuItem(payload);
      });
    });
  });

  ipcMain.handle('pos:deleteMenuItem', async (_event, { id }) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return posController.deleteMenuItem(id);
      });
    });
  });

  ipcMain.handle('pos:getMenuCategories', async () => {
    return requireAuth(async () => {
      return posController.getMenuCategories();
    });
  });

  ipcMain.handle('pos:addMenuCategory', async (_event, category) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return posController.addMenuCategory(category);
      });
    });
  });

  // Billing
  ipcMain.handle('pos:createBill', async (_event, billData) => {
    return requireAuth(async () => {
      return posController.createBill(billData);
    });
  });

  ipcMain.handle('pos:getBills', async (_event, filters) => {
    return requireAuth(async () => {
      return posController.getBills(filters);
    });
  });

  ipcMain.handle('pos:getBillById', async (_event, { id }) => {
    return requireAuth(async () => {
      return posController.getBillById(id);
    });
  });

  // Table management
  ipcMain.handle('pos:getTables', async () => {
    return requireAuth(async () => {
      return posController.getTables();
    });
  });

  ipcMain.handle('pos:updateTableStatus', async (_event, payload) => {
    return requireAuth(async () => {
      return posController.updateTableStatus(payload);
    });
  });
}

module.exports = { registerPosRoutes };
