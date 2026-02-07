const billModel = require('../models/bill.model');
const expenseModel = require('../models/expense.model');
const employeeModel = require('../models/employee.model');
const salesModel = require('../models/sales.model');

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
  const expenses = await expenseModel.findAll({ from, to });

  // Group by category
  const byCategory = {};
  for (const exp of expenses) {
    if (!byCategory[exp.category]) byCategory[exp.category] = { category: exp.category, total: 0, count: 0 };
    byCategory[exp.category].total += exp.amount;
    byCategory[exp.category].count += 1;
  }

  // Group by date
  const dailyTotals = {};
  for (const exp of expenses) {
    const date = exp.date || exp.createdAt.split('T')[0];
    if (!dailyTotals[date]) dailyTotals[date] = { date, total: 0 };
    dailyTotals[date].total += exp.amount;
  }

  return {
    byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
    dailyTotals: Object.values(dailyTotals).sort((a, b) => a.date.localeCompare(b.date)),
    totalExpenses: parseFloat(expenses.reduce((s, e) => s + e.amount, 0).toFixed(2)),
    period: filters.period || 'month',
  };
}

async function getStaffReport(filters = {}) {
  const { from, to } = (filters.from && filters.to)
    ? { from: filters.from, to: filters.to }
    : getDateRange(filters.period || 'month');
  const employees = await employeeModel.findAll({});
  const salaryRecords = await employeeModel.getAllSalaryRecords({ from, to });

  // Group salary by employee
  const bySalary = {};
  for (const rec of salaryRecords) {
    if (!bySalary[rec.employeeId]) bySalary[rec.employeeId] = { employeeId: rec.employeeId, employeeName: rec.employeeName, totalPaid: 0, payments: 0 };
    bySalary[rec.employeeId].totalPaid += rec.amount;
    bySalary[rec.employeeId].payments += 1;
  }

  return {
    employees: employees.map(e => ({
      ...e,
      salaryInfo: bySalary[e.id] || { totalPaid: 0, payments: 0 },
    })),
    totalSalaryPaid: parseFloat(salaryRecords.reduce((s, r) => s + r.amount, 0).toFixed(2)),
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

module.exports = { getDashboardStats, getSalesReport, getExpenseReport, getStaffReport, getProfitLoss };
