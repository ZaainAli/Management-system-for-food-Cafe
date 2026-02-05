const { ipcMain } = require('electron');
const stockController = require('../controllers/stock.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

function registerStockRoutes() {
  ipcMain.handle('stock:getAll', async () => {
    return requireAuth(async () => {
      return stockController.getAll();
    });
  });

  ipcMain.handle('stock:getById', async (_event, { id }) => {
    return requireAuth(async () => {
      return stockController.getById(id);
    });
  });

  ipcMain.handle('stock:add', async (_event, item) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return stockController.add(item);
      });
    });
  });

  ipcMain.handle('stock:update', async (_event, payload) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return stockController.update(payload);
      });
    });
  });

  ipcMain.handle('stock:delete', async (_event, { id }) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return stockController.remove(id);
      });
    });
  });

  ipcMain.handle('stock:adjustQuantity', async (_event, payload) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return stockController.adjustQuantity(payload);
      });
    });
  });

  ipcMain.handle('stock:getLowStock', async (_event, { threshold }) => {
    return requireAuth(async () => {
      return stockController.getLowStock(threshold || 10);
    });
  });

  ipcMain.handle('stock:getCategories', async () => {
    return requireAuth(async () => {
      return stockController.getCategories();
    });
  });
}

module.exports = { registerStockRoutes };
