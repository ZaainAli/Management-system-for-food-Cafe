const { ipcMain } = require('electron');
const expenseController = require('../controllers/expense.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

function registerExpenseRoutes() {
  ipcMain.handle('expense:getAll', async (_event, filters) => {
    return requireAuth(async () => {
      return expenseController.getAll(filters);
    });
  });

  ipcMain.handle('expense:getById', async (_event, { id }) => {
    return requireAuth(async () => {
      return expenseController.getById(id);
    });
  });

  ipcMain.handle('expense:add', async (_event, expense) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return expenseController.add(expense);
      });
    });
  });

  ipcMain.handle('expense:update', async (_event, payload) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return expenseController.update(payload);
      });
    });
  });

  ipcMain.handle('expense:delete', async (_event, { id }) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return expenseController.remove(id);
      });
    });
  });

  ipcMain.handle('expense:getCategories', async () => {
    return requireAuth(async () => {
      return expenseController.getCategories();
    });
  });

  ipcMain.handle('expense:getSummary', async (_event, filters) => {
    return requireAuth(async () => {
      return expenseController.getSummary(filters);
    });
  });
}

module.exports = { registerExpenseRoutes };
