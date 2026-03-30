const billModel = require('../models/bill.model');
const expenseModel = require('../models/expense.model');
const employeeModel = require('../models/employee.model');
const salesModel = require('../models/sales.model');
const khataModel = require('../models/khata.model');
const {
  formatPkDate,
  shiftPkDate,
  extractDatePk,
  getPkDateUtcBounds,
} = require('../utils/datetime');

function normalizeDateRange(filters = {}, fallbackPeriod = 'today') {
  if (filters.from && filters.to) {
    return {
      fromDate: extractDatePk(filters.from),
      toDate: extractDatePk(filters.to),
      period: filters.period || fallbackPeriod,
    };
  }
  const fallback = getDateRange(filters.period || fallbackPeriod);
  return {
    fromDate: fallback.from,
    toDate: fallback.to,
    period: filters.period || fallbackPeriod,
  };
}

function getDateRange(period = 'today') {
  const today = formatPkDate(new Date());

  switch (period) {
    case 'today':
      return { from: today, to: today };
    case 'week':
      return { from: shiftPkDate(today, -6), to: today };
    case 'month': {
      return { from: `${today.slice(0, 7)}-01`, to: today };
    }
    case 'year': {
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    }
    default:
      return { from: today, to: today };
  }
}


async function getDashboardStats(filters = {}) {
  const { fromDate, toDate, period } = normalizeDateRange(filters, 'today');
  const totals = await salesModel.getTotals({ from: fromDate, to: toDate });
  const expTotals = expenseModel.getTotalAmount({ from: fromDate, to: toDate });
  const employees = await employeeModel.findAll({});

  const totalRevenue = totals.totalRevenue || 0;
  const totalExpenses = expTotals.totalExpenses || 0;
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
    period,
  };
}

async function getSalesReport(filters = {}) {
  const { fromDate, toDate, period } = normalizeDateRange(filters, 'month');
  const fromUtc = getPkDateUtcBounds(fromDate).from;
  const toUtc = getPkDateUtcBounds(toDate).to;

  const dailyRows = await salesModel.getDailySales({ from: fromDate, to: toDate });
  const totals = await salesModel.getTotals({ from: fromDate, to: toDate });
  const topItems = await billModel.getTopItems({ from: fromUtc, to: toUtc, limit: 10 });

  return {
    dailyTotals: dailyRows.map(r => ({
      date: r.date,
      revenue: r.totalRevenue,
      bills: r.totalBills,
    })),
    topItems,
    totalRevenue: parseFloat((totals.totalRevenue || 0).toFixed(2)),
    totalBills: totals.totalBills || 0,
    period,
  };
}

async function getExpenseReport(filters = {}) {
  const { fromDate, toDate, period } = normalizeDateRange(filters, 'month');
  const byCategory = await expenseModel.getCategoryTotals({ from: fromDate, to: toDate });
  const dailyTotals = await expenseModel.getDailyTotals({ from: fromDate, to: toDate });
  const totals = await expenseModel.getTotalAmount({ from: fromDate, to: toDate });
  const details = await expenseModel.findAll({ from: fromDate, to: toDate });

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
    period,
    details,
  };
}

async function getStaffReport(filters = {}) {
  const { fromDate, toDate, period } = normalizeDateRange(filters, 'month');
  const employees = await employeeModel.findAll({});
  const salaryTotalsByEmployee = await employeeModel.getSalaryTotalsByEmployee({ from: fromDate, to: toDate });
  const salaryTotals = await employeeModel.getSalaryTotals({ from: fromDate, to: toDate });

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
    period,
  };
}

async function getProfitLoss(filters = {}) {
  const { fromDate, toDate, period } = normalizeDateRange(filters, 'month');
  const totals = await salesModel.getTotals({ from: fromDate, to: toDate });
  const expTotals = expenseModel.getTotalAmount({ from: fromDate, to: toDate });
  const totalRevenue = totals.totalRevenue || 0;
  const totalExpenses = expTotals.totalExpenses || 0;

  return {
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalExpenses: parseFloat(totalExpenses.toFixed(2)),
    netProfit: parseFloat((totalRevenue - totalExpenses).toFixed(2)),
    profitMargin: totalRevenue > 0 ? parseFloat(((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(2)) : 0,
    period,
  };
}

async function getDiscountedBillsReport(filters = {}) {
  const { fromDate, toDate, period } = normalizeDateRange(filters, 'month');
  const from = getPkDateUtcBounds(fromDate).from;
  const to = getPkDateUtcBounds(toDate).to;

  const records = await billModel.getDiscountedBills({ from, to });
  const activeRecords = records.filter(row => row.rowType !== 'cancelled');
  const cancelledRecords = records.filter(row => row.rowType === 'cancelled');

  const totals = activeRecords.reduce((acc, row) => {
    acc.totalBillAmount += Number(row.billAmount) || 0;
    acc.totalDiscount += Number(row.discountAmount) || 0;
    acc.totalFinalAmount += Number(row.finalAmount) || 0;
    if (row.tableNum !== null && row.tableNum !== undefined && row.tableNum !== '') {
      acc.totalTableBills += 1;
    }
    return acc;
  }, { totalBillAmount: 0, totalDiscount: 0, totalFinalAmount: 0, totalTableBills: 0 });

  const totalCancelledBills = cancelledRecords.length;
  const totalReturnAmount = cancelledRecords.reduce((sum, row) => sum + (Number(row.returnAmount) || 0), 0);

  return {
    records,
    totalRecords: records.length,
    totalTableBills: totals.totalTableBills,
    totalBillAmount: parseFloat(totals.totalBillAmount.toFixed(2)),
    totalDiscount: parseFloat(totals.totalDiscount.toFixed(2)),
    totalFinalAmount: parseFloat(totals.totalFinalAmount.toFixed(2)),
    totalCancelledBills,
    totalReturnAmount: parseFloat(totalReturnAmount.toFixed(2)),
    period,
  };
}

async function getKhataReport(filters = {}) {
  const { fromDate, toDate, period } = normalizeDateRange(filters, 'month');

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
    period,
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
