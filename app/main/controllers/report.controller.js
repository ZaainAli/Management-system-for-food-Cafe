const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');
const reportService = require('../services/report.service');
const logger = require('../utils/logger');

const EXPORT_MAX_ROWS = 200000;
const YIELD_EVERY_ROWS = 1000;

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[\",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function normalizeExportType(type) {
  const normalizedType = String(type || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (!normalizedType) return null;

  if (normalizedType === 'all' || normalizedType === 'all_reports' || normalizedType === 'all_report') {
    return 'all';
  }
  if (normalizedType.includes('discount')) {
    return 'discounted';
  }
  if (normalizedType.includes('khata')) {
    return 'khata';
  }
  if (['sales', 'expense', 'staff', 'pl'].includes(normalizedType)) {
    return normalizedType;
  }
  return null;
}

function estimateExportRows(type, data) {
  switch (type) {
    case 'all':
      return (
        (data.sales?.dailyTotals?.length || 0) +
        (data.sales?.topItems?.length || 0) +
        (data.expense?.byCategory?.length || 0) +
        (data.expense?.dailyTotals?.length || 0) +
        (data.staff?.employees?.length || 0) +
        (data.discounted?.records?.length || 0) +
        (data.khata?.profiles?.length || 0) +
        (data.khata?.transactions?.length || 0)
      );
    case 'sales':
      return (data.dailyTotals?.length || 0) + (data.topItems?.length || 0);
    case 'expense':
      return (data.byCategory?.length || 0) + (data.dailyTotals?.length || 0);
    case 'staff':
      return data.employees?.length || 0;
    case 'discounted':
      return data.records?.length || 0;
    case 'khata':
      return (data.profiles?.length || 0) + (data.transactions?.length || 0);
    case 'pl':
    default:
      return 1;
  }
}

function waitForDrain(stream) {
  return new Promise((resolve, reject) => {
    stream.once('drain', resolve);
    stream.once('error', reject);
  });
}

async function writeChunk(stream, chunk) {
  if (!chunk) return;
  if (!stream.write(chunk)) {
    await waitForDrain(stream);
  }
}

function yieldToEventLoop() {
  return new Promise(resolve => setImmediate(resolve));
}

async function writeCsvTable(stream, title, headers, rows, rowMapper) {
  if (title) {
    await writeChunk(stream, `${title}\n`);
  }

  if (headers?.length) {
    await writeChunk(stream, `${headers.map(csvEscape).join(',')}\n`);
  }

  let rowCount = 0;
  for (const row of rows || []) {
    const cols = rowMapper ? rowMapper(row) : row;
    await writeChunk(stream, `${cols.map(csvEscape).join(',')}\n`);
    rowCount += 1;
    if (rowCount % YIELD_EVERY_ROWS === 0) {
      await yieldToEventLoop();
    }
  }

  await writeChunk(stream, '\n');
}

async function writeExportCsv(stream, type, data, range) {
  const from = range?.from?.split('T')[0] || '';
  const to = range?.to?.split('T')[0] || '';
  const section = (title) => `${title} (From ${from} To ${to})`;

  switch (type) {
    case 'all': {
      await writeCsvTable(stream, section('Sales Summary'), ['Total Revenue', 'Total Bills', 'Average Bill'], [[
        data.sales.totalRevenue,
        data.sales.totalBills,
        data.sales.totalBills ? (data.sales.totalRevenue / data.sales.totalBills).toFixed(2) : 0,
      ]]);
      await writeCsvTable(stream, 'Sales - Daily Breakdown', ['Date', 'Bills', 'Revenue'], data.sales.dailyTotals, (d) => [d.date, d.bills, d.revenue]);
      await writeCsvTable(stream, 'Sales - Top Selling Items', ['Item', 'Quantity', 'Revenue'], data.sales.topItems, (i) => [i.name, i.quantity, i.revenue]);
      await writeCsvTable(stream, section('Expense Summary'), ['Total Expenses'], [[data.expense.totalExpenses]]);
      await writeCsvTable(stream, 'Expenses - By Category', ['Category', 'Entries', 'Total'], data.expense.byCategory, (c) => [c.category, c.count, c.total]);
      await writeCsvTable(stream, 'Expenses - Daily Totals', ['Date', 'Total'], data.expense.dailyTotals, (d) => [d.date, d.total]);
      await writeCsvTable(stream, section('Staff Summary'), ['Total Salary Paid'], [[data.staff.totalSalaryPaid]]);
      await writeCsvTable(stream, 'Staff - Employees', ['Name', 'Position', 'Monthly Salary', 'Total Paid', 'Payments'], data.staff.employees, (e) => [
        e.name,
        e.position,
        e.monthlySalary,
        e.salaryInfo?.totalPaid || 0,
        e.salaryInfo?.payments || 0,
      ]);
      await writeCsvTable(stream, section('Profit & Loss'), ['Total Revenue', 'Total Expenses', 'Net Profit', 'Profit Margin %'], [[
        data.pl.totalRevenue,
        data.pl.totalExpenses,
        data.pl.netProfit,
        data.pl.profitMargin,
      ]]);
      await writeCsvTable(stream, section('Table & Discount Report Summary'), ['Total Bills', 'Total Table Bills', 'Total Bill Amount', 'Total Discount', 'Total After Discount'], [[
        data.discounted.totalRecords,
        data.discounted.totalTableBills || 0,
        data.discounted.totalBillAmount,
        data.discounted.totalDiscount,
        data.discounted.totalFinalAmount,
      ]]);
      await writeCsvTable(stream, 'Table & Discount Report', ['Bill ID', 'Table No', 'Bill Amount', 'Discount Amount', 'Final Amount', 'Created At'], data.discounted.records, (r) => [
        r.billId,
        r.tableNum || '',
        r.billAmount,
        r.discountAmount,
        r.finalAmount,
        r.createdAt,
      ]);
      await writeCsvTable(stream, section('Khata Summary'), ['Total Profiles', 'Outstanding Balance', 'Transactions In Range', 'Due In Range', 'Paid In Range'], [[
        data.khata.summary?.totalProfiles || 0,
        data.khata.summary?.totalOutstandingBalance || 0,
        data.khata.summary?.transactionsInRange || 0,
        data.khata.summary?.totalDueInRange || 0,
        data.khata.summary?.totalPaidInRange || 0,
      ]]);
      await writeCsvTable(stream, 'Khata Profiles', ['Name', 'Phone', 'Business Details', 'Total Due', 'Total Paid', 'Balance', 'Created At'], data.khata.profiles, (p) => [
        p.name,
        p.phone,
        p.businessDetails,
        p.totalDue,
        p.totalPaid,
        p.balance,
        p.createdAt,
      ]);
      await writeCsvTable(stream, 'Khata Transactions (Within Selected Range)', ['Date', 'Khata Name', 'Type', 'Amount', 'Payment Source', 'Note', 'Created At'], data.khata.transactions, (tx) => [
        tx.date,
        tx.khataName,
        tx.type,
        tx.amount,
        tx.paymentSource,
        tx.note,
        tx.createdAt,
      ]);
      return;
    }
    case 'sales':
      await writeCsvTable(stream, section('Sales Summary'), ['Total Revenue', 'Total Bills', 'Average Bill'], [[
        data.totalRevenue,
        data.totalBills,
        data.totalBills ? (data.totalRevenue / data.totalBills).toFixed(2) : 0,
      ]]);
      await writeCsvTable(stream, 'Daily Breakdown', ['Date', 'Bills', 'Revenue'], data.dailyTotals, (d) => [d.date, d.bills, d.revenue]);
      await writeCsvTable(stream, 'Top Selling Items', ['Item', 'Quantity', 'Revenue'], data.topItems, (i) => [i.name, i.quantity, i.revenue]);
      return;
    case 'expense':
      await writeCsvTable(stream, section('Expense Summary'), ['Total Expenses'], [[data.totalExpenses]]);
      await writeCsvTable(stream, 'By Category', ['Category', 'Entries', 'Total'], data.byCategory, (c) => [c.category, c.count, c.total]);
      await writeCsvTable(stream, 'Daily Totals', ['Date', 'Total'], data.dailyTotals, (d) => [d.date, d.total]);
      return;
    case 'staff':
      await writeCsvTable(stream, section('Staff Summary'), ['Total Salary Paid'], [[data.totalSalaryPaid]]);
      await writeCsvTable(stream, 'Employees', ['Name', 'Position', 'Monthly Salary', 'Total Paid', 'Payments'], data.employees, (e) => [
        e.name,
        e.position,
        e.monthlySalary,
        e.salaryInfo?.totalPaid || 0,
        e.salaryInfo?.payments || 0,
      ]);
      return;
    case 'pl':
      await writeCsvTable(stream, section('Profit & Loss'), ['Total Revenue', 'Total Expenses', 'Net Profit', 'Profit Margin %'], [[
        data.totalRevenue,
        data.totalExpenses,
        data.netProfit,
        data.profitMargin,
      ]]);
      return;
    case 'discounted':
      await writeCsvTable(stream, section('Table & Discount Report Summary'), ['Total Bills', 'Total Table Bills', 'Total Bill Amount', 'Total Discount', 'Total After Discount'], [[
        data.totalRecords,
        data.totalTableBills || 0,
        data.totalBillAmount,
        data.totalDiscount,
        data.totalFinalAmount,
      ]]);
      await writeCsvTable(stream, 'Table & Discount Report', ['Bill ID', 'Table No', 'Bill Amount', 'Discount Amount', 'Final Amount', 'Created At'], data.records, (r) => [
        r.billId,
        r.tableNum || '',
        r.billAmount,
        r.discountAmount,
        r.finalAmount,
        r.createdAt,
      ]);
      return;
    case 'khata':
      await writeCsvTable(stream, section('Khata Summary'), ['Total Profiles', 'Outstanding Balance', 'Transactions In Range', 'Due In Range', 'Paid In Range'], [[
        data.summary?.totalProfiles || 0,
        data.summary?.totalOutstandingBalance || 0,
        data.summary?.transactionsInRange || 0,
        data.summary?.totalDueInRange || 0,
        data.summary?.totalPaidInRange || 0,
      ]]);
      await writeCsvTable(stream, 'Khata Profiles', ['Name', 'Phone', 'Business Details', 'Total Due', 'Total Paid', 'Balance', 'Created At'], data.profiles, (p) => [
        p.name,
        p.phone,
        p.businessDetails,
        p.totalDue,
        p.totalPaid,
        p.balance,
        p.createdAt,
      ]);
      await writeCsvTable(stream, 'Khata Transactions (Within Selected Range)', ['Date', 'Khata Name', 'Type', 'Amount', 'Payment Source', 'Note', 'Created At'], data.transactions, (tx) => [
        tx.date,
        tx.khataName,
        tx.type,
        tx.amount,
        tx.paymentSource,
        tx.note,
        tx.createdAt,
      ]);
      return;
    default:
      return;
  }
}

function endStream(stream) {
  return new Promise((resolve, reject) => {
    stream.end(() => resolve());
    stream.once('error', reject);
  });
}

async function buildReportData(type, from, to) {
  switch (type) {
    case 'all':
      return {
        sales: await reportService.getSalesReport({ from, to }),
        expense: await reportService.getExpenseReport({ from, to }),
        staff: await reportService.getStaffReport({ from, to }),
        pl: await reportService.getProfitLoss({ from, to }),
        discounted: await reportService.getDiscountedBillsReport({ from, to }),
        khata: await reportService.getKhataReport({ from, to }),
      };
    case 'sales':
      return reportService.getSalesReport({ from, to });
    case 'expense':
      return reportService.getExpenseReport({ from, to });
    case 'staff':
      return reportService.getStaffReport({ from, to });
    case 'pl':
      return reportService.getProfitLoss({ from, to });
    case 'discounted':
      return reportService.getDiscountedBillsReport({ from, to });
    case 'khata':
      return reportService.getKhataReport({ from, to });
    default:
      return null;
  }
}

async function exportReport(filters = {}) {
  try {
    const { type, from, to } = filters;
    const mappedType = normalizeExportType(type);
    if (!mappedType) {
      return { success: false, error: 'Invalid report type.' };
    }

    const reportData = await buildReportData(mappedType, from, to);
    const estimatedRows = estimateExportRows(mappedType, reportData);
    if (estimatedRows > EXPORT_MAX_ROWS) {
      return {
        success: false,
        error: `Selected range is too large for CSV export (${estimatedRows} rows). Please narrow the date range.`,
      };
    }

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
    const stream = fs.createWriteStream(finalPath, { encoding: 'utf8' });
    await writeExportCsv(stream, mappedType, reportData, { from, to });
    await endStream(stream);

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
