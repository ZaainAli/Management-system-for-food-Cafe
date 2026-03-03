const nodemailer = require('nodemailer');
const { PassThrough } = require('stream');
const { getDb } = require('../db/index');
const reportService = require('./report.service');
const { getBranchInfo } = require('../controllers/setup.controller');
const logger = require('../utils/logger');

// ── Transport ──────────────────────────────────────────────────────────────

function buildTransport(settings) {
  if (settings.provider === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: settings.smtp_user, pass: settings.smtp_pass },
    });
  }
  return nodemailer.createTransport({
    host: settings.smtp_host,
    port: Number(settings.smtp_port) || 587,
    secure: !!settings.smtp_secure,
    auth: { user: settings.smtp_user, pass: settings.smtp_pass },
  });
}

// ── HTML Body ──────────────────────────────────────────────────────────────

function fmt(n) {
  return `PKR ${Number(n || 0).toLocaleString()}`;
}

function tableRow(cols, isHeader = false) {
  const tag = isHeader ? 'th' : 'td';
  const style = isHeader
    ? 'background:#1e293b;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;padding:8px 12px;text-align:left;'
    : 'padding:8px 12px;color:#e2e8f0;font-size:13px;border-bottom:1px solid #1e293b;';
  return `<tr>${cols.map(c => `<${tag} style="${style}">${c ?? ''}</${tag}>`).join('')}</tr>`;
}

function section(title, tableHtml) {
  return `
    <div style="margin-bottom:24px;">
      <h3 style="margin:0 0 10px;font-size:14px;font-weight:600;color:#cbd5e1;border-left:3px solid #6366f1;padding-left:10px;">${title}</h3>
      <table style="width:100%;border-collapse:collapse;background:#0f172a;border-radius:8px;overflow:hidden;">
        ${tableHtml}
      </table>
    </div>`;
}

function buildHtmlBody(data, dateLabel, branchName = 'Restaurant Manager') {
  const pl = data.pl || {};
  const sales = data.sales || {};
  const expense = data.expense || {};
  const staff = data.staff || {};

  const profitColor = (pl.netProfit || 0) >= 0 ? '#34d399' : '#f87171';
  const profitLabel = (pl.netProfit || 0) >= 0 ? 'Profit' : 'Loss';

  // KPI cards
  const kpiCards = [
    { label: 'Total Revenue', value: fmt(pl.totalRevenue), color: '#34d399' },
    { label: 'Total Expenses', value: fmt(pl.totalExpenses), color: '#f87171' },
    { label: `Net ${profitLabel}`, value: fmt(pl.netProfit), color: profitColor },
    { label: 'Bills Served', value: sales.totalBills || 0, color: '#818cf8' },
  ].map(k => `
    <td style="width:25%;padding:8px;">
      <div style="background:#1e293b;border-radius:8px;padding:16px;text-align:center;">
        <div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">${k.label}</div>
        <div style="color:${k.color};font-size:18px;font-weight:700;">${k.value}</div>
      </div>
    </td>`).join('');

  // Top selling items
  const topItemsRows = (sales.topItems || []).slice(0, 5).map((item, i) =>
    tableRow([`${i + 1}. ${item.name}`, item.quantity, fmt(item.revenue)])
  ).join('');
  const topItemsSection = section('Top 5 Selling Items',
    tableRow(['Item', 'Qty Sold', 'Revenue'], true) + (topItemsRows || tableRow(['No sales data']))
  );

  // Expense breakdown
  const expenseRows = (expense.byCategory || []).map(c =>
    tableRow([c.category, c.count, fmt(c.total)])
  ).join('');
  const expenseSection = section('Expense Breakdown by Category',
    tableRow(['Category', 'Entries', 'Total'], true) + (expenseRows || tableRow(['No expense data']))
  );

  // P&L summary
  const margin = pl.totalRevenue > 0
    ? ((pl.netProfit / pl.totalRevenue) * 100).toFixed(1)
    : '0.0';
  const plSection = section('Profit & Loss',
    tableRow(['Revenue', 'Expenses', 'Net Profit', 'Margin'], true) +
    tableRow([fmt(pl.totalRevenue), fmt(pl.totalExpenses), fmt(pl.netProfit), `${margin}%`])
  );

  // Staff
  const staffSection = section('Staff',
    tableRow(['Total Active Staff', 'Total Salary Paid (Period)'], true) +
    tableRow([(staff.employees || []).length, fmt(staff.totalSalaryPaid)])
  );

  // Table & Discount
  const discounted = data.discounted || {};
  const discountSummarySection = section('Table & Discount Summary',
    tableRow(['Total Bills', 'Table Bills', 'Bill Amount', 'Total Discount', 'After Discount'], true) +
    tableRow([
      discounted.totalRecords || 0,
      discounted.totalTableBills || 0,
      fmt(discounted.totalBillAmount),
      fmt(discounted.totalDiscount),
      fmt(discounted.totalFinalAmount),
    ])
  );
  const discountRows = (discounted.records || []).slice(0, 20).map(r =>
    tableRow([r.billId, r.tableNum ?? '—', fmt(r.billAmount), fmt(r.discountAmount), fmt(r.finalAmount), r.createdAt])
  ).join('');
  const discountDetailSection = section('Discounted Bills',
    tableRow(['Bill ID', 'Table No', 'Bill Amount', 'Discount', 'Final Amount', 'Created At'], true) +
    (discountRows || tableRow(['No discounted bills']))
  );

  // Khata
  const khata = data.khata || {};
  const khataSum = khata.summary || {};
  const khataSummarySection = section('Khata (Ledger) Summary',
    tableRow(['Total Profiles', 'Outstanding Balance', 'Transactions', 'Due (Period)', 'Paid (Period)'], true) +
    tableRow([
      khataSum.totalProfiles || 0,
      fmt(khataSum.totalOutstandingBalance),
      khataSum.transactionsInRange || 0,
      fmt(khataSum.totalDueInRange),
      fmt(khataSum.totalPaidInRange),
    ])
  );
  const khataProfileRows = (khata.profiles || []).slice(0, 15).map(p =>
    tableRow([p.name, p.phone || '—', fmt(p.totalDue), fmt(p.totalPaid), fmt(p.balance)])
  ).join('');
  const khataProfileSection = section('Khata Profiles',
    tableRow(['Name', 'Phone', 'Total Due', 'Total Paid', 'Balance'], true) +
    (khataProfileRows || tableRow(['No khata profiles']))
  );
  const khataTxRows = (khata.transactions || []).slice(0, 20).map(tx =>
    tableRow([tx.date, tx.khataName, tx.type, fmt(tx.amount), tx.note || '—'])
  ).join('');
  const khataTxSection = section('Khata Transactions (Period)',
    tableRow(['Date', 'Name', 'Type', 'Amount', 'Note'], true) +
    (khataTxRows || tableRow(['No transactions in this period']))
  );

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:24px 16px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
      <div style="color:#c7d2fe;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Daily Performance Report</div>
      <div style="color:#ffffff;font-size:22px;font-weight:700;">${branchName}</div>
      <div style="color:#a5b4fc;font-size:14px;margin-top:6px;">${dateLabel}</div>
    </div>

    <!-- KPI Row -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr>${kpiCards}</tr>
    </table>

    <!-- Sections -->
    ${topItemsSection}
    ${expenseSection}
    ${plSection}
    ${staffSection}
    ${discountSummarySection}
    ${discountDetailSection}
    ${khataSummarySection}
    ${khataProfileSection}
    ${khataTxSection}

    <!-- Footer -->
    <div style="text-align:center;color:#334155;font-size:11px;margin-top:32px;padding-top:16px;border-top:1px solid #1e293b;">
      Auto-generated by Restaurant Manager &bull; ${dateLabel}
    </div>
  </div>
</body>
</html>`;
}

// ── CSV Buffer ─────────────────────────────────────────────────────────────

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvTable(title, headers, rows, mapper) {
  let out = title ? `${title}\n` : '';
  if (headers.length) out += headers.map(csvEscape).join(',') + '\n';
  for (const row of rows || []) {
    const cols = mapper ? mapper(row) : row;
    out += cols.map(csvEscape).join(',') + '\n';
  }
  return out + '\n';
}

function buildCsvString(data, from, to) {
  const f = (from || '').split('T')[0];
  const t = (to || '').split('T')[0];
  const rng = (title) => `${title} (From ${f} To ${t})`;
  const sales = data.sales || {};
  const expense = data.expense || {};
  const staff = data.staff || {};
  const pl = data.pl || {};
  const discounted = data.discounted || {};
  const khata = data.khata || {};

  let csv = '';

  csv += csvTable(rng('Sales Summary'), ['Total Revenue', 'Total Bills', 'Average Bill'], [[
    sales.totalRevenue, sales.totalBills,
    sales.totalBills ? (sales.totalRevenue / sales.totalBills).toFixed(2) : 0,
  ]]);
  csv += csvTable('Sales - Daily Breakdown', ['Date', 'Bills', 'Revenue'], sales.dailyTotals, d => [d.date, d.bills, d.revenue]);
  csv += csvTable('Sales - Top Selling Items', ['Item', 'Quantity', 'Revenue'], sales.topItems, i => [i.name, i.quantity, i.revenue]);

  csv += csvTable(rng('Expense Summary'), ['Total Expenses'], [[expense.totalExpenses]]);
  csv += csvTable('Expenses - By Category', ['Category', 'Entries', 'Total'], expense.byCategory, c => [c.category, c.count, c.total]);
  csv += csvTable('Expenses - Daily Totals', ['Date', 'Total'], expense.dailyTotals, d => [d.date, d.total]);

  csv += csvTable(rng('Staff Summary'), ['Total Salary Paid'], [[staff.totalSalaryPaid]]);
  csv += csvTable('Staff - Employees', ['Name', 'Position', 'Monthly Salary', 'Total Paid', 'Payments'], staff.employees, e => [
    e.name, e.position, e.monthlySalary, e.salaryInfo?.totalPaid || 0, e.salaryInfo?.payments || 0,
  ]);

  csv += csvTable(rng('Profit & Loss'), ['Total Revenue', 'Total Expenses', 'Net Profit', 'Profit Margin %'], [[
    pl.totalRevenue, pl.totalExpenses, pl.netProfit, pl.profitMargin,
  ]]);

  csv += csvTable(rng('Table & Discount Report Summary'), ['Total Bills', 'Total Table Bills', 'Total Bill Amount', 'Total Discount', 'Total After Discount'], [[
    discounted.totalRecords, discounted.totalTableBills || 0, discounted.totalBillAmount, discounted.totalDiscount, discounted.totalFinalAmount,
  ]]);
  csv += csvTable('Table & Discount Report', ['Bill ID', 'Table No', 'Bill Amount', 'Discount Amount', 'Final Amount', 'Created At'], discounted.records, r => [
    r.billId, r.tableNum || '', r.billAmount, r.discountAmount, r.finalAmount, r.createdAt,
  ]);

  csv += csvTable(rng('Khata Summary'), ['Total Profiles', 'Outstanding Balance', 'Transactions In Range', 'Due In Range', 'Paid In Range'], [[
    khata.summary?.totalProfiles || 0, khata.summary?.totalOutstandingBalance || 0,
    khata.summary?.transactionsInRange || 0, khata.summary?.totalDueInRange || 0, khata.summary?.totalPaidInRange || 0,
  ]]);
  csv += csvTable('Khata Profiles', ['Name', 'Phone', 'Business Details', 'Total Due', 'Total Paid', 'Balance', 'Created At'], khata.profiles, p => [
    p.name, p.phone, p.businessDetails, p.totalDue, p.totalPaid, p.balance, p.createdAt,
  ]);
  csv += csvTable('Khata Transactions', ['Date', 'Khata Name', 'Type', 'Amount', 'Payment Source', 'Note', 'Created At'], khata.transactions, tx => [
    tx.date, tx.khataName, tx.type, tx.amount, tx.paymentSource, tx.note, tx.createdAt,
  ]);

  return csv;
}

// ── Core send helpers ──────────────────────────────────────────────────────

function loadSettings() {
  const db = getDb();
  return db.prepare('SELECT * FROM email_settings WHERE id = 1').get();
}

function updateLastSentDate(date) {
  const db = getDb();
  db.prepare('UPDATE email_settings SET last_sent_date = ?, updatedAt = ? WHERE id = 1').run(date, new Date().toISOString());
}

// ── Exported functions ─────────────────────────────────────────────────────

async function sendDailyReport({ forceEnabled = false } = {}) {
  const settings = loadSettings();
  if (!settings) throw new Error('Email settings not found.');
  if (!forceEnabled && !settings.is_enabled) throw new Error('Email reporting is disabled.');
  if (!settings.recipient_email) throw new Error('Recipient email is not configured.');
  if (!settings.smtp_user || !settings.smtp_pass) throw new Error('SMTP credentials are not configured.');

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  // Use local date strings (no timezone conversion) so daily_sales date comparisons
  // always match the local calendar day regardless of the server's UTC offset.
  const from = `${today}T00:00:00.000`;
  const to   = `${today}T23:59:59.999`;

  const data = {
    sales: await reportService.getSalesReport({ from, to }),
    expense: await reportService.getExpenseReport({ from, to }),
    staff: await reportService.getStaffReport({ from, to }),
    pl: await reportService.getProfitLoss({ from, to }),
    discounted: await reportService.getDiscountedBillsReport({ from, to }),
    khata: await reportService.getKhataReport({ from, to }),
  };

  // Fetch branch name from Supabase (falls back to null if offline)
  let branchName = settings.from_name || 'Restaurant Manager';
  try {
    const branchRes = await getBranchInfo();
    if (branchRes.success && branchRes.data?.name) {
      branchName = branchRes.data.name;
    }
  } catch {}

  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const htmlBody = buildHtmlBody(data, dateLabel, branchName);
  const csvString = buildCsvString(data, from, to);
  const csvFilename = `report_${today}.csv`;

  const transport = buildTransport(settings);
  await transport.sendMail({
    from: `"${branchName}" <${settings.smtp_user}>`,
    to: settings.recipient_email,
    subject: `Daily Report — ${branchName} — ${dateLabel}`,
    html: htmlBody,
    attachments: [{ filename: csvFilename, content: Buffer.from(csvString, 'utf8'), contentType: 'text/csv' }],
  });

  updateLastSentDate(today);
  logger.info(`Daily report sent to ${settings.recipient_email} for ${today}`);
  return { sentTo: settings.recipient_email, date: today };
}

async function sendTestEmail(settings) {
  if (!settings.smtp_user || !settings.smtp_pass) throw new Error('SMTP credentials are required.');
  if (!settings.recipient_email) throw new Error('Recipient email is required.');

  const transport = buildTransport(settings);
  await transport.verify();
  await transport.sendMail({
    from: `"${settings.from_name || 'Restaurant Manager'}" <${settings.smtp_user}>`,
    to: settings.recipient_email,
    subject: 'Test Email — Restaurant Manager',
    html: `<div style="font-family:sans-serif;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:8px;">
      <h2 style="color:#818cf8;">Connection Successful</h2>
      <p>Your email reporting is configured correctly. Daily reports will be sent to this address at the scheduled time.</p>
    </div>`,
  });
}

module.exports = { sendDailyReport, sendTestEmail, loadSettings };
