const { registerAuthRoutes } = require('./auth.routes');
const { registerPosRoutes } = require('./pos.routes');
const { registerStockRoutes } = require('./stock.routes');
const { registerExpenseRoutes } = require('./expense.routes');
const { registerStaffRoutes } = require('./staff.routes');
const { registerReportRoutes } = require('./report.routes');
const { registerWindowRoutes } = require('./window.routes');
const { registerUserRoutes } = require('./user.routes');

function registerIPCHandlers() {
  registerAuthRoutes();
  registerPosRoutes();
  registerStockRoutes();
  registerExpenseRoutes();
  registerStaffRoutes();
  registerReportRoutes();
  registerWindowRoutes();
  registerUserRoutes();
}

module.exports = { registerIPCHandlers };
