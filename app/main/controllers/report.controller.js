const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');
const reportService = require('../services/report.service');
const logger = require('../utils/logger');

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers, rows) {
  const lines = [];
  if (headers?.length) {
    lines.push(headers.map(csvEscape).join(','));
  }
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  return lines.join('\n');
}

function buildExportCsv(type, data, range) {
  const from = range?.from?.split('T')[0] || '';
  const to = range?.to?.split('T')[0] || '';
  const section = (title) => `${title} (From ${from} To ${to})`;

  switch (type) {
    case 'all': {
      const parts = [];
      parts.push(section('Sales Summary'));
      parts.push(toCsv(
        ['Total Revenue', 'Total Bills', 'Average Bill'],
        [[data.sales.totalRevenue, data.sales.totalBills, data.sales.totalBills ? (data.sales.totalRevenue / data.sales.totalBills).toFixed(2) : 0]]
      ));
      parts.push('');
      parts.push('Sales - Daily Breakdown');
      parts.push(toCsv(
        ['Date', 'Bills', 'Revenue'],
        (data.sales.dailyTotals || []).map(d => [d.date, d.bills, d.revenue])
      ));
      parts.push('');
      parts.push('Sales - Top Selling Items');
      parts.push(toCsv(
        ['Item', 'Quantity', 'Revenue'],
        (data.sales.topItems || []).map(i => [i.name, i.quantity, i.revenue])
      ));
      parts.push('');
      parts.push(section('Expense Summary'));
      parts.push(toCsv(
        ['Total Expenses'],
        [[data.expense.totalExpenses]]
      ));
      parts.push('');
      parts.push('Expenses - By Category');
      parts.push(toCsv(
        ['Category', 'Entries', 'Total'],
        (data.expense.byCategory || []).map(c => [c.category, c.count, c.total])
      ));
      parts.push('');
      parts.push('Expenses - Daily Totals');
      parts.push(toCsv(
        ['Date', 'Total'],
        (data.expense.dailyTotals || []).map(d => [d.date, d.total])
      ));
      parts.push('');
      parts.push(section('Staff Summary'));
      parts.push(toCsv(
        ['Total Salary Paid'],
        [[data.staff.totalSalaryPaid]]
      ));
      parts.push('');
      parts.push('Staff - Employees');
      parts.push(toCsv(
        ['Name', 'Position', 'Monthly Salary', 'Total Paid', 'Payments'],
        (data.staff.employees || []).map(e => [
          e.name,
          e.position,
          e.monthlySalary,
          e.salaryInfo?.totalPaid || 0,
          e.salaryInfo?.payments || 0,
        ])
      ));
      parts.push('');
      parts.push(section('Profit & Loss'));
      parts.push(toCsv(
        ['Total Revenue', 'Total Expenses', 'Net Profit', 'Profit Margin %'],
        [[data.pl.totalRevenue, data.pl.totalExpenses, data.pl.netProfit, data.pl.profitMargin]]
      ));
      parts.push('');
      parts.push(section('Table & Discount Report Summary'));
      parts.push(toCsv(
        ['Total Bills', 'Total Table Bills', 'Total Bill Amount', 'Total Discount', 'Total After Discount'],
        [[
          data.discounted.totalRecords,
          data.discounted.totalTableBills || 0,
          data.discounted.totalBillAmount,
          data.discounted.totalDiscount,
          data.discounted.totalFinalAmount
        ]]
      ));
      parts.push('');
      parts.push('Table & Discount Report');
      parts.push(toCsv(
        ['Bill ID', 'Table No', 'Bill Amount', 'Discount Amount', 'Final Amount', 'Created At'],
        (data.discounted.records || []).map(r => [r.billId, r.tableNum || '', r.billAmount, r.discountAmount, r.finalAmount, r.createdAt])
      ));
      parts.push('');
      parts.push(section('Khata Summary'));
      parts.push(toCsv(
        ['Total Profiles', 'Outstanding Balance', 'Transactions In Range', 'Due In Range', 'Paid In Range'],
        [[
          data.khata.summary?.totalProfiles || 0,
          data.khata.summary?.totalOutstandingBalance || 0,
          data.khata.summary?.transactionsInRange || 0,
          data.khata.summary?.totalDueInRange || 0,
          data.khata.summary?.totalPaidInRange || 0,
        ]]
      ));
      parts.push('');
      parts.push('Khata Profiles');
      parts.push(toCsv(
        ['Name', 'Phone', 'Business Details', 'Total Due', 'Total Paid', 'Balance', 'Created At'],
        (data.khata.profiles || []).map(p => [p.name, p.phone, p.businessDetails, p.totalDue, p.totalPaid, p.balance, p.createdAt])
      ));
      parts.push('');
      parts.push('Khata Transactions (Within Selected Range)');
      parts.push(toCsv(
        ['Date', 'Khata Name', 'Type', 'Amount', 'Payment Source', 'Note', 'Created At'],
        (data.khata.transactions || []).map(tx => [tx.date, tx.khataName, tx.type, tx.amount, tx.paymentSource, tx.note, tx.createdAt])
      ));
      return parts.join('\n');
    }
    case 'sales': {
      const parts = [];
      parts.push(section('Sales Summary'));
      parts.push(toCsv(
        ['Total Revenue', 'Total Bills', 'Average Bill'],
        [[data.totalRevenue, data.totalBills, data.totalBills ? (data.totalRevenue / data.totalBills).toFixed(2) : 0]]
      ));
      parts.push('');
      parts.push('Daily Breakdown');
      parts.push(toCsv(
        ['Date', 'Bills', 'Revenue'],
        (data.dailyTotals || []).map(d => [d.date, d.bills, d.revenue])
      ));
      parts.push('');
      parts.push('Top Selling Items');
      parts.push(toCsv(
        ['Item', 'Quantity', 'Revenue'],
        (data.topItems || []).map(i => [i.name, i.quantity, i.revenue])
      ));
      return parts.join('\n');
    }
    case 'expense': {
      const parts = [];
      parts.push(section('Expense Summary'));
      parts.push(toCsv(
        ['Total Expenses'],
        [[data.totalExpenses]]
      ));
      parts.push('');
      parts.push('By Category');
      parts.push(toCsv(
        ['Category', 'Entries', 'Total'],
        (data.byCategory || []).map(c => [c.category, c.count, c.total])
      ));
      parts.push('');
      parts.push('Daily Totals');
      parts.push(toCsv(
        ['Date', 'Total'],
        (data.dailyTotals || []).map(d => [d.date, d.total])
      ));
      return parts.join('\n');
    }
    case 'staff': {
      const parts = [];
      parts.push(section('Staff Summary'));
      parts.push(toCsv(
        ['Total Salary Paid'],
        [[data.totalSalaryPaid]]
      ));
      parts.push('');
      parts.push('Employees');
      parts.push(toCsv(
        ['Name', 'Position', 'Monthly Salary', 'Total Paid', 'Payments'],
        (data.employees || []).map(e => [
          e.name,
          e.position,
          e.monthlySalary,
          e.salaryInfo?.totalPaid || 0,
          e.salaryInfo?.payments || 0,
        ])
      ));
      return parts.join('\n');
    }
    case 'pl': {
      return [
        section('Profit & Loss'),
        toCsv(
          ['Total Revenue', 'Total Expenses', 'Net Profit', 'Profit Margin %'],
          [[data.totalRevenue, data.totalExpenses, data.netProfit, data.profitMargin]]
        ),
      ].join('\n');
    }
    case 'discounted': {
      const parts = [];
      parts.push(section('Table & Discount Report Summary'));
      parts.push(toCsv(
        ['Total Bills', 'Total Table Bills', 'Total Bill Amount', 'Total Discount', 'Total After Discount'],
        [[data.totalRecords, data.totalTableBills || 0, data.totalBillAmount, data.totalDiscount, data.totalFinalAmount]]
      ));
      parts.push('');
      parts.push('Table & Discount Report');
      parts.push(toCsv(
        ['Bill ID', 'Table No', 'Bill Amount', 'Discount Amount', 'Final Amount', 'Created At'],
        (data.records || []).map(r => [r.billId, r.tableNum || '', r.billAmount, r.discountAmount, r.finalAmount, r.createdAt])
      ));
      return parts.join('\n');
    }
    case 'khata': {
      const parts = [];
      parts.push(section('Khata Summary'));
      parts.push(toCsv(
        ['Total Profiles', 'Outstanding Balance', 'Transactions In Range', 'Due In Range', 'Paid In Range'],
        [[
          data.summary?.totalProfiles || 0,
          data.summary?.totalOutstandingBalance || 0,
          data.summary?.transactionsInRange || 0,
          data.summary?.totalDueInRange || 0,
          data.summary?.totalPaidInRange || 0,
        ]]
      ));
      parts.push('');
      parts.push('Khata Profiles');
      parts.push(toCsv(
        ['Name', 'Phone', 'Business Details', 'Total Due', 'Total Paid', 'Balance', 'Created At'],
        (data.profiles || []).map(p => [p.name, p.phone, p.businessDetails, p.totalDue, p.totalPaid, p.balance, p.createdAt])
      ));
      parts.push('');
      parts.push('Khata Transactions (Within Selected Range)');
      parts.push(toCsv(
        ['Date', 'Khata Name', 'Type', 'Amount', 'Payment Source', 'Note', 'Created At'],
        (data.transactions || []).map(tx => [tx.date, tx.khataName, tx.type, tx.amount, tx.paymentSource, tx.note, tx.createdAt])
      ));
      return parts.join('\n');
    }
    default:
      return '';
  }
}

async function exportReport(filters = {}) {
  try {
    const { type, from, to } = filters;
    const normalizedType = String(type || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (!normalizedType) {
      return { success: false, error: 'Report type is required.' };
    }

    let reportData;
    switch (normalizedType) {
      case 'all':
      case 'all_reports':
      case 'all_report':
        reportData = {
          sales: await reportService.getSalesReport({ from, to }),
          expense: await reportService.getExpenseReport({ from, to }),
          staff: await reportService.getStaffReport({ from, to }),
          pl: await reportService.getProfitLoss({ from, to }),
          discounted: await reportService.getDiscountedBillsReport({ from, to }),
          khata: await reportService.getKhataReport({ from, to }),
        };
        break;
      case 'sales': reportData = await reportService.getSalesReport({ from, to }); break;
      case 'expense': reportData = await reportService.getExpenseReport({ from, to }); break;
      case 'staff': reportData = await reportService.getStaffReport({ from, to }); break;
      case 'pl': reportData = await reportService.getProfitLoss({ from, to }); break;
      case 'discounted':
      case 'discounted_bills':
      case 'discount_bill':
      case 'discount_bills':
        reportData = await reportService.getDiscountedBillsReport({ from, to });
        break;
      case 'khata':
      case 'khata_report':
      case 'khata_reports':
        reportData = await reportService.getKhataReport({ from, to });
        break;
      default: return { success: false, error: 'Invalid report type.' };
    }

    const mappedType = normalizedType === 'all_reports' || normalizedType === 'all_report'
      ? 'all'
      : normalizedType.includes('discount')
        ? 'discounted'
        : normalizedType.includes('khata')
          ? 'khata'
          : normalizedType;
    const csv = buildExportCsv(mappedType, reportData, { from, to });
    const fromLabel = (from || '').split('T')[0] || 'start';
    const toLabel = (to || '').split('T')[0] || 'end';
    const defaultName = `report_${type}_${fromLabel}_to_${toLabel}.csv`;
    const defaultPath = path.join(app.getPath('documents'), defaultName);

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Report',
      defaultPath,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    const finalPath = filePath.toLowerCase().endsWith('.csv') ? filePath : `${filePath}.csv`;
    fs.writeFileSync(finalPath, csv, 'utf8');

    return { success: true, path: finalPath };
  } catch (err) {
    logger.error('report:exportReport failed', err);
    return { success: false, error: err.message };
  }
}

async function getDashboardStats(filters = {}) {
  try {
    const stats = await reportService.getDashboardStats(filters);
    return { success: true, data: stats };
  } catch (err) {
    logger.error('report:getDashboardStats failed', err);
    return { success: false, error: err.message };
  }
}

async function getSalesReport(filters = {}) {
  try {
    const report = await reportService.getSalesReport(filters);
    return { success: true, data: report };
  } catch (err) {
    logger.error('report:getSalesReport failed', err);
    return { success: false, error: err.message };
  }
}

async function getExpenseReport(filters = {}) {
  try {
    const report = await reportService.getExpenseReport(filters);
    return { success: true, data: report };
  } catch (err) {
    logger.error('report:getExpenseReport failed', err);
    return { success: false, error: err.message };
  }
}

async function getStaffReport(filters = {}) {
  try {
    const report = await reportService.getStaffReport(filters);
    return { success: true, data: report };
  } catch (err) {
    logger.error('report:getStaffReport failed', err);
    return { success: false, error: err.message };
  }
}

async function getProfitLoss(filters = {}) {
  try {
    const report = await reportService.getProfitLoss(filters);
    return { success: true, data: report };
  } catch (err) {
    logger.error('report:getProfitLoss failed', err);
    return { success: false, error: err.message };
  }
}

module.exports = { getDashboardStats, getSalesReport, getExpenseReport, getStaffReport, getProfitLoss, exportReport };
