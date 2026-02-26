const billModel = require('../models/bill.model');
const expenseModel = require('../models/expense.model');
const employeeModel = require('../models/employee.model');
const salesModel = require('../models/sales.model');
const khataModel = require('../models/khata.model');

function getDateRange(period = 'today') {
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  switch (period) {
    case 'today':
      return { from: startOfDay(now).toISOString(), to: now.toISOString() };
    case 'week': {
      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const monday = new Date(now);
      const daysBack = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      monday.setDate(now.getDate() - daysBack);
      return { from: startOfDay(monday).toISOString(), to: now.toISOString() };
    }
    case 'month': {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDay(firstOfMonth).toISOString(), to: now.toISOString() };
    }
    case 'year': {
      const firstOfYear = new Date(now.getFullYear(), 0, 1);
      return { from: startOfDay(firstOfYear).toISOString(), to: now.toISOString() };
    }
    default:
      return { from: startOfDay(now).toISOString(), to: now.toISOString() };
  }
}


async function getDashboardStats(filters = {}) {
  const { from, to } = (filters.from && filters.to)
    ? { from: filters.from, to: filters.to }
    : getDateRange(filters.period || 'today');

  const fromDate = from.split('T')[0];
  const toDate = to.split('T')[0];
  const totals = await salesModel.getTotals({ from: fromDate, to: toDate });
  const employees = await employeeModel.findAll({});

  const totalRevenue = totals.totalRevenue || 0;
  const totalExpenses = totals.totalExpenses || 0;
  const totalBills = totals.totalBills || 0;
  const totalEmployees = employees.length;
  const averageBill = totalBills > 0 ? totalRevenue / totalBills : 0;

  return {
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalExpenses: parseFloat(totalExpenses.toFixed(2)),
    netProfit: parseFloat((totalRevenue - totalExpenses).toFixed(2)),
    totalBills,
    totalEmployees,
    averageBill: parseFloat(averageBill.toFixed(2)),
    period: filters.period || 'today',
  };
}

async function getSalesReport(filters = {}) {
  const { from, to } = (filters.from && filters.to)
    ? { from: filters.from, to: filters.to }
    : getDateRange(filters.period || 'month');
  const fromDate = from.split('T')[0];
  const toDate = to.split('T')[0];

  const dailyRows = await salesModel.getDailySales({ from: fromDate, to: toDate });
  const totals = await salesModel.getTotals({ from: fromDate, to: toDate });
  const topItems = await billModel.getTopItems({ from, to, limit: 10 });

  return {
    dailyTotals: dailyRows.map(r => ({
      date: r.date,
      revenue: r.totalRevenue,
      bills: r.totalBills,
    })),
    topItems,
    totalRevenue: parseFloat((totals.totalRevenue || 0).toFixed(2)),
    totalBills: totals.totalBills || 0,
    period: filters.period || 'month',
  };
}

async function getExpenseReport(filters = {}) {
  const { from, to } = (filters.from && filters.to)
    ? { from: filters.from, to: filters.to }
    : getDateRange(filters.period || 'month');
  const byCategory = await expenseModel.getCategoryTotals({ from, to });
  const dailyTotals = await expenseModel.getDailyTotals({ from, to });
  const totals = await expenseModel.getTotalAmount({ from, to });

  return {
    byCategory: byCategory.map(row => ({
      category: row.category,
      total: row.total,
      count: row.count,
    })),
    dailyTotals: dailyTotals.map(row => ({
      date: row.date,
      total: row.total,
    })),
    totalExpenses: parseFloat((totals.totalExpenses || 0).toFixed(2)),
    period: filters.period || 'month',
  };
}

async function getStaffReport(filters = {}) {
  const { from, to } = (filters.from && filters.to)
    ? { from: filters.from, to: filters.to }
    : getDateRange(filters.period || 'month');
  const employees = await employeeModel.findAll({});
  const salaryTotalsByEmployee = await employeeModel.getSalaryTotalsByEmployee({ from, to });
  const salaryTotals = await employeeModel.getSalaryTotals({ from, to });

  // Group salary by employee
  const bySalary = {};
  for (const rec of salaryTotalsByEmployee) {
    if (!bySalary[rec.employeeId]) bySalary[rec.employeeId] = { employeeId: rec.employeeId, employeeName: rec.employeeName, totalPaid: 0, payments: 0 };
    bySalary[rec.employeeId].totalPaid += rec.totalPaid || 0;
    bySalary[rec.employeeId].payments += rec.payments || 0;
  }

  return {
    employees: employees.map(e => ({
      ...e,
      salaryInfo: bySalary[e.id] || { totalPaid: 0, payments: 0 },
    })),
    totalSalaryPaid: parseFloat((salaryTotals.totalPaid || 0).toFixed(2)),
    period: filters.period || 'month',
  };
}

async function getProfitLoss(filters = {}) {
  const { from, to } = (filters.from && filters.to)
    ? { from: filters.from, to: filters.to }
    : getDateRange(filters.period || 'month');
  const fromDate = from.split('T')[0];
  const toDate = to.split('T')[0];
  const totals = await salesModel.getTotals({ from: fromDate, to: toDate });
  const totalRevenue = totals.totalRevenue || 0;
  const totalExpenses = totals.totalExpenses || 0;

  return {
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalExpenses: parseFloat(totalExpenses.toFixed(2)),
    netProfit: parseFloat((totalRevenue - totalExpenses).toFixed(2)),
    profitMargin: totalRevenue > 0 ? parseFloat(((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(2)) : 0,
    period: filters.period || 'month',
  };
}

async function getDiscountedBillsReport(filters = {}) {
  const { from, to } = (filters.from && filters.to)
    ? { from: filters.from, to: filters.to }
    : getDateRange(filters.period || 'month');

  const discountedBills = await billModel.getDiscountedBills({ from, to });
  const totals = discountedBills.reduce((acc, row) => {
    acc.totalBillAmount += Number(row.billAmount) || 0;
    acc.totalDiscount += Number(row.discountAmount) || 0;
    acc.totalFinalAmount += Number(row.finalAmount) || 0;
    if (row.tableNum !== null && row.tableNum !== undefined && row.tableNum !== '') {
      acc.totalTableBills += 1;
    }
    return acc;
  }, { totalBillAmount: 0, totalDiscount: 0, totalFinalAmount: 0, totalTableBills: 0 });

  return {
    records: discountedBills,
    totalRecords: discountedBills.length,
    totalTableBills: totals.totalTableBills,
    totalBillAmount: parseFloat(totals.totalBillAmount.toFixed(2)),
    totalDiscount: parseFloat(totals.totalDiscount.toFixed(2)),
    totalFinalAmount: parseFloat(totals.totalFinalAmount.toFixed(2)),
    period: filters.period || 'month',
  };
}

async function getKhataReport(filters = {}) {
  const { from, to } = (filters.from && filters.to)
    ? { from: filters.from, to: filters.to }
    : getDateRange(filters.period || 'month');

  const fromDate = from.split('T')[0];
  const toDate = to.split('T')[0];

  const profiles = khataModel.getAllProfiles();
  const transactions = khataModel.getAllTransactionsInRange({ from: fromDate, to: toDate });

  const dueTotal = transactions
    .filter(tx => tx.type === 'due')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const paidTotal = transactions
    .filter(tx => tx.type === 'payment')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  return {
    profiles,
    transactions: transactions.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || '').localeCompare(b.createdAt || '')),
    summary: {
      totalProfiles: profiles.length,
      totalOutstandingBalance: parseFloat(profiles.reduce((sum, p) => sum + (Number(p.balance) || 0), 0).toFixed(2)),
      transactionsInRange: transactions.length,
      totalDueInRange: parseFloat(dueTotal.toFixed(2)),
      totalPaidInRange: parseFloat(paidTotal.toFixed(2)),
    },
    period: filters.period || 'month',
  };
}

module.exports = {
  getDashboardStats,
  getSalesReport,
  getExpenseReport,
  getStaffReport,
  getProfitLoss,
  getDiscountedBillsReport,
  getKhataReport,
};
