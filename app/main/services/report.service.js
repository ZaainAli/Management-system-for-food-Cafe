const billModel = require('../models/bill.model');
const expenseModel = require('../models/expense.model');
const employeeModel = require('../models/employee.model');

function getDateRange(period = 'today') {
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  switch (period) {
    case 'today':
      return { from: startOfDay(now).toISOString(), to: now.toISOString() };
    case 'week': {
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - dayOfWeek + 1);
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
  const { from, to } = filters.period ? getDateRange(filters.period) : getDateRange('today');

  const bills = await billModel.getBills({ from, to });
  const expenses = await expenseModel.findAll({ from, to });
  const employees = await employeeModel.findAll({});

  const totalRevenue = bills.reduce((sum, b) => sum + b.total, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalBills = bills.length;
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
  const { from, to } = filters.period ? getDateRange(filters.period) : getDateRange('month');
  const bills = await billModel.getBills({ from, to });

  // Group by date for chart data
  const dailyTotals = {};
  for (const bill of bills) {
    const date = bill.createdAt.split('T')[0];
    if (!dailyTotals[date]) dailyTotals[date] = { date, revenue: 0, bills: 0 };
    dailyTotals[date].revenue += bill.total;
    dailyTotals[date].bills += 1;
  }

  // Top selling items
  const itemCounts = {};
  for (const bill of bills) {
    if (bill.items) {
      for (const item of bill.items) {
        if (!itemCounts[item.name]) itemCounts[item.name] = { name: item.name, quantity: 0, revenue: 0 };
        itemCounts[item.name].quantity += item.quantity;
        itemCounts[item.name].revenue += item.lineTotal;
      }
    }
  }
  const topItems = Object.values(itemCounts).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  return {
    dailyTotals: Object.values(dailyTotals).sort((a, b) => a.date.localeCompare(b.date)),
    topItems,
    totalRevenue: parseFloat(bills.reduce((s, b) => s + b.total, 0).toFixed(2)),
    totalBills: bills.length,
    period: filters.period || 'month',
  };
}

async function getExpenseReport(filters = {}) {
  const { from, to } = filters.period ? getDateRange(filters.period) : getDateRange('month');
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
  const employees = await employeeModel.findAll({});
  const salaryRecords = await employeeModel.getAllSalaryRecords(filters);

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
  const { from, to } = filters.period ? getDateRange(filters.period) : getDateRange('month');
  const bills = await billModel.getBills({ from, to });
  const expenses = await expenseModel.findAll({ from, to });

  const totalRevenue = bills.reduce((s, b) => s + b.total, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  return {
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalExpenses: parseFloat(totalExpenses.toFixed(2)),
    netProfit: parseFloat((totalRevenue - totalExpenses).toFixed(2)),
    profitMargin: totalRevenue > 0 ? parseFloat(((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(2)) : 0,
    period: filters.period || 'month',
  };
}

module.exports = { getDashboardStats, getSalesReport, getExpenseReport, getStaffReport, getProfitLoss };
