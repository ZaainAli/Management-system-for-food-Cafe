const { ipcMain } = require('electron');
const staffController = require('../controllers/staff.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

function registerStaffRoutes() {
  ipcMain.handle('staff:getAll', async (_event, filters) => {
    return requireAuth(async () => {
      return staffController.getAll(filters);
    });
  });

  ipcMain.handle('staff:getById', async (_event, { id }) => {
    return requireAuth(async () => {
      return staffController.getById(id);
    });
  });

  ipcMain.handle('staff:add', async (_event, employee) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return staffController.add(employee);
      });
    });
  });

  ipcMain.handle('staff:update', async (_event, payload) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return staffController.update(payload);
      });
    });
  });

  ipcMain.handle('staff:delete', async (_event, { id }) => {
    return requireAuth(async () => {
      return requireRole(['admin'], async () => {
        return staffController.remove(id);
      });
    });
  });

  // Salary
  ipcMain.handle('staff:addSalaryRecord', async (_event, salary) => {
    return requireAuth(async () => {
      return requireRole(['admin', 'manager'], async () => {
        return staffController.addSalaryRecord(salary);
      });
    });
  });

  ipcMain.handle('staff:getSalaryHistory', async (_event, { employeeId, filters }) => {
    return requireAuth(async () => {
      return staffController.getSalaryHistory(employeeId, filters);
    });
  });

  // Attendance
  ipcMain.handle('staff:markAttendance', async (_event, attendance) => {
    return requireAuth(async () => {
      return staffController.markAttendance(attendance);
    });
  });

  ipcMain.handle('staff:getAttendance', async (_event, filters) => {
    return requireAuth(async () => {
      return staffController.getAttendance(filters);
    });
  });
}

module.exports = { registerStaffRoutes };
