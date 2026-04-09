const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');
const PDFDocument = require('pdfkit');
const reportService = require('../services/report.service');
const setupController = require('./setup.controller');
const logger = require('../utils/logger');
const { formatPkDateTime, extractDatePk } = require('../utils/datetime');

const DEFAULT_BRANCH_NAME = "Hamza & Brother's Food Chain";

const EXPORT_MAX_ROWS = 200000;

// ── PDF design constants ───────────────────────────────────────
const PX = 30;                       // horizontal margin
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CW = PAGE_W - PX * 2;         // content width
const PAGE_BG = '#f1f5f9';

const BANNER_H   = 34;
const CELL_H     = 54;               // summary card height
const SUB_LBL_H  = 24;
const COL_HDR_H  = 22;
const DATA_ROW_H = 18;

const SEC_COLORS = {
  sales: '#10b981', expense: '#ef4444', staff: '#3b82f6',
  pl: '#8b5cf6', discounted: '#0891b2', khata: '#d97706',
};
const SEC_NAMES  = { sales: 'Sales', expense: 'Expenses', staff: 'Staff & Salary', pl: 'Profit & Loss', discounted: 'Table & Discount', khata: 'Khata' };

// ── Low-level helpers ──────────────────────────────────────────

function bgPage(doc) {
  doc.rect(0, 0, PAGE_W, PAGE_H).fillColor(PAGE_BG).fill();
}

function hline(doc, y) {
  doc.moveTo(PX, y).lineTo(PX + CW, y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
}

// Cover header block drawn at top of page 1
function drawCoverHeader(doc, filename, from, to, branchName) {
  const H = 90;
  const y = 30;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  doc.rect(PX, y, CW, H).fillColor('#1e293b').fill();

  // Title
  doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
    .text(branchName || DEFAULT_BRANCH_NAME, PX + 16, y + 14, { lineBreak: false });

  // Filename
  doc.fillColor('#94a3b8').fontSize(9).font('Helvetica')
    .text(filename, PX + 16, y + 36, { width: CW * 0.65, lineBreak: false });

  // Date range pill
  doc.roundedRect(PX + 16, y + 56, 170, 20, 10).fillColor('#334155').fill();
  doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
    .text(`${from}  —  ${to}`, PX + 24, y + 62, { width: 154, lineBreak: false });

  // Date + time (right)
  doc.fillColor('#ffffff').fontSize(13).font('Helvetica-Bold')
    .text(dateStr, PX + CW - 112, y + 18, { width: 102, align: 'right', lineBreak: false });
  doc.fillColor('#94a3b8').fontSize(10).font('Helvetica')
    .text(timeStr, PX + CW - 112, y + 38, { width: 102, align: 'right', lineBreak: false });

  return y + H + 12;
}

// Colored section banner — draw icon as a shape (Helvetica is WinAnsi, no Unicode symbols)
function drawBanner(doc, sectionKey, y) {
  const color = SEC_COLORS[sectionKey] || '#3b82f6';
  doc.rect(PX, y, CW, BANNER_H).fillColor(color).fill();

  const ix = PX + 18;
  const iy = y + BANNER_H / 2;
  doc.fillColor('#ffffff');
  switch (sectionKey) {
    case 'sales':      // triangle up
      doc.path(`M ${ix} ${iy + 5} L ${ix + 5} ${iy - 5} L ${ix + 10} ${iy + 5} Z`).fill(); break;
    case 'expense':    // triangle down
      doc.path(`M ${ix} ${iy - 5} L ${ix + 10} ${iy - 5} L ${ix + 5} ${iy + 5} Z`).fill(); break;
    case 'pl':         // square
      doc.rect(ix, iy - 5, 10, 10).fill(); break;
    case 'discounted': // diamond
      doc.path(`M ${ix + 5} ${iy - 6} L ${ix + 11} ${iy} L ${ix + 5} ${iy + 6} L ${ix - 1} ${iy} Z`).fill(); break;
    default:           // circle (staff, khata)
      doc.circle(ix + 5, iy, 5).fill();
  }

  doc.fillColor('#ffffff').fontSize(13).font('Helvetica-Bold')
    .text(SEC_NAMES[sectionKey] || sectionKey, PX + 36, y + 11, { lineBreak: false });
  return y + BANNER_H;
}

// Summary card grid – max 5 per row, wraps if more
function drawSummaryCards(doc, headers, values, y) {
  const MAX = 5;
  let i = 0;
  while (i < headers.length) {
    const rh = headers.slice(i, i + MAX);
    const rv = values.slice(i, i + MAX);
    const cw = CW / rh.length;
    doc.rect(PX, y, CW, CELL_H).fillColor('#ffffff').fill();
    rh.forEach((h, j) => {
      const cx = PX + cw * j;
      if (j > 0) {
        doc.moveTo(cx, y + 8).lineTo(cx, y + CELL_H - 8).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      }
      doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica-Bold')
        .text(String(h).toUpperCase(), cx + 8, y + 10, { width: cw - 16, lineBreak: false });
      doc.fillColor('#1e293b').fontSize(13).font('Helvetica-Bold')
        .text(String(rv[j] ?? ''), cx + 8, y + 26, { width: cw - 16, height: 17, lineBreak: false, ellipsis: true });
    });
    hline(doc, y + CELL_H);
    y += CELL_H;
    i += MAX;
  }
  return y;
}

// Small gray sub-section label row
function drawSubLabel(doc, label, y) {
  doc.rect(PX, y, CW, SUB_LBL_H).fillColor('#f8fafc').fill();
  hline(doc, y + SUB_LBL_H);
  doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold')
    .text(label.toUpperCase(), PX + 10, y + 8, { lineBreak: false });
  return y + SUB_LBL_H;
}

// Data table with "No data available" empty state
// Rows auto-expand to fit wrapped text so no content is truncated
function drawTable(doc, headers, rows, startY, opts = {}) {
  let y = startY;
  const { autoHeight = true } = opts;
  const colW = CW / headers.length;

  const drawColHeaders = (atY) => {
    doc.rect(PX, atY, CW, COL_HDR_H).fillColor('#f8fafc').fill();
    doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica-Bold');
    headers.forEach((h, i) => {
      doc.text(String(h).toUpperCase(), PX + colW * i + 8, atY + 7, { width: colW - 16, height: 10, lineBreak: false, ellipsis: true });
    });
    hline(doc, atY + COL_HDR_H);
    return atY + COL_HDR_H;
  };

  y = drawColHeaders(y);

  if (!rows || rows.length === 0) {
    doc.rect(PX, y, CW, DATA_ROW_H + 6).fillColor('#ffffff').fill();
    doc.fillColor('#94a3b8').fontSize(9).font('Helvetica-Oblique')
      .text('No data available', PX, y + 7, { width: CW, align: 'center', lineBreak: false });
    y += DATA_ROW_H + 6;
    hline(doc, y);
    return y;
  }

  doc.font('Helvetica').fontSize(7.5);
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];

    let rowH = DATA_ROW_H;
    if (autoHeight) {
      doc.font('Helvetica').fontSize(7.5);
      row.forEach((cell) => {
        const needed = doc.heightOfString(String(cell ?? ''), { width: colW - 16 }) + 10;
        if (needed > rowH) rowH = needed;
      });
    }

    if (y + rowH > PAGE_H - 30) {
      doc.addPage();
      bgPage(doc);
      y = 30;
      y = drawColHeaders(y);
      doc.font('Helvetica').fontSize(7.5);
    }

    doc.rect(PX, y, CW, rowH).fillColor(idx % 2 === 0 ? '#ffffff' : '#f8fafc').fill();
    doc.fillColor('#334155');
    row.forEach((cell, i) => {
      if (autoHeight) {
        doc.text(String(cell ?? ''), PX + colW * i + 8, y + 5, { width: colW - 16 });
      } else {
        doc.text(String(cell ?? ''), PX + colW * i + 8, y + 5, { width: colW - 16, height: 10, lineBreak: false, ellipsis: true });
      }
    });
    y += rowH;
  }

  hline(doc, y);
  return y;
}

// Footer page (last page)
function drawFooterPage(doc) {
  doc.addPage();
  doc.rect(0, 0, PAGE_W, PAGE_H).fillColor('#ffffff').fill();
  const now = new Date();
  const dt = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
             ' at ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  hline(doc, 36);
  doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica')
    .text(`Generated on ${dt} — Confidential`, PX, 46, { width: CW, align: 'center', lineBreak: false });
}

// ── Section content renderers ─────────────────────────────────

function drawSalesContent(doc, d, y) {
  y = drawBanner(doc, 'sales', y);
  const avg = d.totalBills ? (d.totalRevenue / d.totalBills).toFixed(2) : 0;
  y = drawSummaryCards(doc, ['Total Revenue', 'Total Bills', 'Average Bill'],
    [`Rs ${d.totalRevenue}`, d.totalBills, avg], y);
  y = drawSubLabel(doc, 'Sales - Daily Breakdown', y);
  y = drawTable(doc, ['Date', 'Bills', 'Revenue'], (d.dailyTotals || []).map(r => [r.date, r.bills, r.revenue]), y);
  y = drawSubLabel(doc, 'Sales - Top Selling Items', y);
  y = drawTable(doc, ['Item', 'Quantity', 'Revenue'], (d.topItems || []).map(r => [r.name, r.quantity, r.revenue]), y);
  return y;
}

function drawExpensesContent(doc, d, y) {
  y = drawBanner(doc, 'expense', y);
  y = drawSummaryCards(doc, ['Total Expenses'], [`Rs ${d.totalExpenses}`], y);
  y = drawSubLabel(doc, 'Expenses - By Category', y);
  y = drawTable(doc, ['Category', 'Entries', 'Total'], (d.byCategory || []).map(r => [r.category, r.count, r.total]), y);
  y = drawSubLabel(doc, 'Expenses - Daily Totals', y);
  y = drawTable(doc, ['Date', 'Total'], (d.dailyTotals || []).map(r => [r.date, r.total]), y);
  y = drawTable(doc, ['Date', 'Description', 'Category', 'Amount'], (d.details || []).map(r => [r.date, r.description, r.category, `Rs ${r.amount}`]), y);
  return y;
}

function drawStaffContent(doc, d, y) {
  y = drawBanner(doc, 'staff', y);
  y = drawSummaryCards(doc, ['Total Salary Paid'], [`Rs ${d.totalSalaryPaid}`], y);
  y = drawSubLabel(doc, 'Staff - Employees', y);
  y = drawTable(doc, ['Name', 'Position', 'Monthly Salary', 'Total Paid', 'Payments'],
    (d.employees || []).map(e => [e.name, e.position, e.monthlySalary, e.salaryInfo?.totalPaid || 0, e.salaryInfo?.payments || 0]), y);
  return y;
}

function drawPLContent(doc, d, y) {
  y = drawBanner(doc, 'pl', y);
  y = drawSummaryCards(doc,
    ['Total Revenue', 'Total Expenses', 'Net Profit', 'Profit Margin %'],
    [`Rs ${d.totalRevenue}`, `Rs ${d.totalExpenses}`, `Rs ${d.netProfit}`, `${d.profitMargin}%`], y);
  return y;
}

function drawDiscountedContent(doc, d, y) {
  y = drawBanner(doc, 'discounted', y);
  y = drawSummaryCards(doc,
    ['Total Bills', 'Total Table Bills', 'Total Bill Amount', 'Total Discount', 'Total After Discount', 'Khata Bills', 'Khata Amount', 'Cancelled Bills', 'Total Return Amount'],
    [d.totalRecords, d.totalTableBills || 0, d.totalBillAmount, d.totalDiscount, d.totalFinalAmount, d.totalKhataBills || 0, d.totalKhataAmount || 0, d.totalCancelledBills || 0, d.totalReturnAmount || 0], y);
  y = drawSubLabel(doc, 'Table & Discount Report', y);
  y = drawTable(doc, ['Bill ID', 'Type', 'Table No', 'Bill Amt', 'Discount', 'Final Amt', 'Return Amt', 'Reason', 'Created At'],
    (d.records || []).map(r => [r.billId, r.rowType || '', r.tableNum || '', r.billAmount, r.discountAmount, r.finalAmount, r.returnAmount || 0, r.reason || '', formatPkDateTime(r.createdAt)]), y);
  // Khata Bills section
  if (d.khataBills && d.khataBills.length > 0) {
    y = drawSubLabel(doc, 'POS Khata Bills (Customer Credit)', y);
    y = drawTable(doc, ['Bill ID', 'Customer', 'Amount', 'Items', 'Created At'],
      d.khataBills.map(r => [r.billId, r.customerName, `Rs ${Number(r.totalAmount).toLocaleString()}`, r.itemsNote || '', formatPkDateTime(r.createdAt)]), y);
  }
  return y;
}

function drawKhataContent(doc, d, y) {
  y = drawBanner(doc, 'khata', y);
  y = drawSummaryCards(doc,
    ['Total Profiles', 'Outstanding Balance', 'Transactions In Range', 'Due In Range', 'Paid In Range'],
    [d.summary?.totalProfiles || 0, d.summary?.totalOutstandingBalance || 0, d.summary?.transactionsInRange || 0, d.summary?.totalDueInRange || 0, d.summary?.totalPaidInRange || 0], y);
  
  if (d.customerKhata && d.customerKhata.summary.totalProfiles > 0) {
    y = drawSubLabel(doc, 'Customer Khata Borrow (Due)', y);
    y = drawSummaryCards(doc,
      ['Customer Profiles', 'Outstanding Due', 'Due In Range', 'Paid In Range'],
      [d.customerKhata.summary.totalProfiles || 0, d.customerKhata.summary.totalOutstandingBalance || 0, d.customerKhata.summary.totalDueInRange || 0, d.customerKhata.summary.totalPaidInRange || 0], y);
    y = drawSubLabel(doc, 'Customer Khata Borrow Transactions', y);
    y = drawTable(doc, ['Date', 'Customer Name', 'Type', 'Amount', 'Note'],
      (d.customerKhata.transactions || []).map(tx => [tx.date, tx.khataName, tx.type, tx.amount, tx.note]), y);
  }

  if (d.customerKhata && d.customerKhata.summary.totalPaidInRange > 0) {
    y = drawSubLabel(doc, 'Customer Khata Payment', y);
    y = drawSummaryCards(doc,
      ['Total Paid In Range'],
      [d.customerKhata.summary.totalPaidInRange || 0], y);
    const paymentTxs = (d.customerKhata.transactions || []).filter(tx => tx.type === 'payment');
    if (paymentTxs.length > 0) {
      y = drawSubLabel(doc, 'Customer Khata Payment Transactions', y);
      y = drawTable(doc, ['Date', 'Customer Name', 'Amount', 'Payment Source', 'Note'],
        paymentTxs.map(tx => [tx.date, tx.khataName, tx.amount, tx.paymentSource, tx.note]), y);
    }
  }

  y = drawSubLabel(doc, 'Khata Profiles', y);
  y = drawTable(doc, ['Name', 'Phone', 'Business Details', 'Total Due', 'Total Paid', 'Balance'],
    (d.profiles || []).map(p => [p.name, p.phone, p.businessDetails, p.totalDue, p.totalPaid, p.balance]), y);
  y = drawSubLabel(doc, 'Khata Transactions', y);
  y = drawTable(doc, ['Date', 'Khata Name', 'Type', 'Amount', 'Payment Source', 'Note'],
    (d.transactions || []).map(tx => [tx.date, tx.khataName, tx.type, tx.amount, tx.paymentSource, tx.note]), y);
  return y;
}

// ── Main report builder ────────────────────────────────────────

function buildPdfReport(doc, type, data, from, to, branchName) {
  const filename = `report_${type}_${from}_to_${to}`;

  // Page 1: cover header
  bgPage(doc);
  const contentY = drawCoverHeader(doc, filename, from, to, branchName);

  if (type === 'all') {
    // Profit & Loss on page 1 (after header)
    drawPLContent(doc, data.pl, contentY);

    // Each remaining section on its own page
    doc.addPage(); bgPage(doc); drawSalesContent(doc, data.sales, 30);
    doc.addPage(); bgPage(doc); drawExpensesContent(doc, data.expense, 30);
    doc.addPage(); bgPage(doc); drawStaffContent(doc, data.staff, 30);
    doc.addPage(); bgPage(doc); drawDiscountedContent(doc, data.discounted, 30);
    doc.addPage(); bgPage(doc); drawKhataContent(doc, data.khata, 30);
    drawFooterPage(doc);
    return;
  }

  // Individual report types
  switch (type) {
    case 'sales':      drawSalesContent(doc, data, contentY);      break;
    case 'expense':    drawExpensesContent(doc, data, contentY);   break;
    case 'staff':      drawStaffContent(doc, data, contentY);      break;
    case 'pl':         drawPLContent(doc, data, contentY);         break;
    case 'discounted': drawDiscountedContent(doc, data, contentY); break;
    case 'khata':      drawKhataContent(doc, data, contentY);      break;
  }
  drawFooterPage(doc);
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
      return (data.records?.length || 0) + (data.khataBills?.length || 0);
    case 'khata':
      return (data.profiles?.length || 0) + (data.transactions?.length || 0);
    case 'pl':
    default:
      return 1;
  }
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

    const branchRes = await setupController.getBranchInfo();
    const branchName = branchRes?.data?.name || DEFAULT_BRANCH_NAME;

    const reportData = await buildReportData(mappedType, from, to);
    const estimatedRows = estimateExportRows(mappedType, reportData);
    if (estimatedRows > EXPORT_MAX_ROWS) {
      return {
        success: false,
        error: `Selected range is too large for export (${estimatedRows} rows). Please narrow the date range.`,
      };
    }

    const fromLabel = extractDatePk(from) || 'start';
    const toLabel = extractDatePk(to) || 'end';
    const defaultName = `report_${type}_${fromLabel}_to_${toLabel}.pdf`;
    const defaultPath = path.join(app.getPath('documents'), defaultName);

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Report',
      defaultPath,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    const finalPath = filePath.toLowerCase().endsWith('.pdf') ? filePath : `${filePath}.pdf`;
    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
      const stream = fs.createWriteStream(finalPath);
      doc.pipe(stream);
      stream.once('error', reject);
      stream.once('finish', resolve);
      buildPdfReport(doc, mappedType, reportData, fromLabel, toLabel, branchName);
      doc.end();
    });

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
