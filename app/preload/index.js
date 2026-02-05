const { contextBridge, ipcRenderer } = require('electron');

// ─── Auth API ───────────────────────────────────────────────
const authAPI = {
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
  changePassword: (payload) => ipcRenderer.invoke('auth:changePassword', payload),
};

// ─── POS API ────────────────────────────────────────────────
const posAPI = {
  getMenuItems: () => ipcRenderer.invoke('pos:getMenuItems'),
  addMenuItem: (item) => ipcRenderer.invoke('pos:addMenuItem', item),
  updateMenuItem: (payload) => ipcRenderer.invoke('pos:updateMenuItem', payload),
  deleteMenuItem: (payload) => ipcRenderer.invoke('pos:deleteMenuItem', payload),
  getMenuCategories: () => ipcRenderer.invoke('pos:getMenuCategories'),
  addMenuCategory: (category) => ipcRenderer.invoke('pos:addMenuCategory', category),
  createBill: (billData) => ipcRenderer.invoke('pos:createBill', billData),
  getBills: (filters) => ipcRenderer.invoke('pos:getBills', filters),
  getBillById: (payload) => ipcRenderer.invoke('pos:getBillById', payload),
  getTables: () => ipcRenderer.invoke('pos:getTables'),
  updateTableStatus: (payload) => ipcRenderer.invoke('pos:updateTableStatus', payload),
};

// ─── Stock API ──────────────────────────────────────────────
const stockAPI = {
  getAll: () => ipcRenderer.invoke('stock:getAll'),
  getById: (payload) => ipcRenderer.invoke('stock:getById', payload),
  add: (item) => ipcRenderer.invoke('stock:add', item),
  update: (payload) => ipcRenderer.invoke('stock:update', payload),
  delete: (payload) => ipcRenderer.invoke('stock:delete', payload),
  adjustQuantity: (payload) => ipcRenderer.invoke('stock:adjustQuantity', payload),
  getLowStock: (payload) => ipcRenderer.invoke('stock:getLowStock', payload),
  getCategories: () => ipcRenderer.invoke('stock:getCategories'),
};

// ─── Expense API ────────────────────────────────────────────
const expenseAPI = {
  getAll: (filters) => ipcRenderer.invoke('expense:getAll', filters),
  getById: (payload) => ipcRenderer.invoke('expense:getById', payload),
  add: (expense) => ipcRenderer.invoke('expense:add', expense),
  update: (payload) => ipcRenderer.invoke('expense:update', payload),
  delete: (payload) => ipcRenderer.invoke('expense:delete', payload),
  getCategories: () => ipcRenderer.invoke('expense:getCategories'),
  getSummary: (filters) => ipcRenderer.invoke('expense:getSummary', filters),
};

// ─── Staff API ──────────────────────────────────────────────
const staffAPI = {
  getAll: (filters) => ipcRenderer.invoke('staff:getAll', filters),
  getById: (payload) => ipcRenderer.invoke('staff:getById', payload),
  add: (employee) => ipcRenderer.invoke('staff:add', employee),
  update: (payload) => ipcRenderer.invoke('staff:update', payload),
  delete: (payload) => ipcRenderer.invoke('staff:delete', payload),
  addSalaryRecord: (salary) => ipcRenderer.invoke('staff:addSalaryRecord', salary),
  getSalaryHistory: (payload) => ipcRenderer.invoke('staff:getSalaryHistory', payload),
  markAttendance: (attendance) => ipcRenderer.invoke('staff:markAttendance', attendance),
  getAttendance: (filters) => ipcRenderer.invoke('staff:getAttendance', filters),
};

// ─── Report API ─────────────────────────────────────────────
const reportAPI = {
  getDashboardStats: (filters) => ipcRenderer.invoke('report:getDashboardStats', filters),
  getSalesReport: (filters) => ipcRenderer.invoke('report:getSalesReport', filters),
  getExpenseReport: (filters) => ipcRenderer.invoke('report:getExpenseReport', filters),
  getStaffReport: (filters) => ipcRenderer.invoke('report:getStaffReport', filters),
  getProfitLoss: (filters) => ipcRenderer.invoke('report:getProfitLoss', filters),
};

// ─── User Management API ───────────────────────────────────
const userAPI = {
  getAll: () => ipcRenderer.invoke('user:getAll'),
  create: (userData) => ipcRenderer.invoke('user:create', userData),
  update: (payload) => ipcRenderer.invoke('user:update', payload),
  delete: (payload) => ipcRenderer.invoke('user:delete', payload),
  resetPassword: (payload) => ipcRenderer.invoke('user:resetPassword', payload),
};

// ─── Window API ─────────────────────────────────────────────
const windowAPI = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximize: (callback) => ipcRenderer.on('window:maximized', callback),
  onUnmaximize: (callback) => ipcRenderer.on('window:unmaximized', callback),
};

// ─── Expose to Renderer ─────────────────────────────────────
contextBridge.exposeInMainWorld('api', {
  auth: authAPI,
  pos: posAPI,
  stock: stockAPI,
  expense: expenseAPI,
  staff: staffAPI,
  report: reportAPI,
  user: userAPI,
  window: windowAPI,
});
