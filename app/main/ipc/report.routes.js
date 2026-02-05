const { ipcMain } = require('electron');
const reportController = require('../controllers/report.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

function registerReportRoutes() {
  ipcMain.handle('report:getDashboardStats', async (_event, filters) => {
    return requireAuth(async () => {
      return reportController.getDashboardStats(filters);
    });
  });

  ipcMain.handle('report:getSalesReport', async (_event, filters) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return reportController.getSalesReport(filters);
      });
    });
  });

  ipcMain.handle('report:getExpenseReport', async (_event, filters) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return reportController.getExpenseReport(filters);
      });
    });
  });

  ipcMain.handle('report:getStaffReport', async (_event, filters) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return reportController.getStaffReport(filters);
      });
    });
  });

  ipcMain.handle('report:getProfitLoss', async (_event, filters) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return reportController.getProfitLoss(filters);
      });
    });
  });
}

module.exports = { registerReportRoutes };
