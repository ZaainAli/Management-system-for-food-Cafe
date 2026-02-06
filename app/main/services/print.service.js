const { BrowserWindow } = require('electron');
const logger = require('../utils/logger');

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCurrency(value) {
  const num = Number(value) || 0;
  return `PKR ${num.toFixed(2)}`;
}

function renderReceiptHTML(bill, options = {}) {
  const restaurantName = options.restaurantName || 'Restaurant';
  const restaurantAddress = options.restaurantAddress || '';
  const footerNote = options.footerNote || 'Thank you for your visit!';
  const createdAt = bill.createdAt ? new Date(bill.createdAt) : new Date();

  const itemsHtml = (bill.items || []).map(item => `
    <tr>
      <td class="qty">${escapeHtml(item.quantity)}</td>
      <td class="name">${escapeHtml(item.name)}</td>
      <td class="price">${formatCurrency(item.price)}</td>
      <td class="total">${formatCurrency(item.lineTotal)}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 10px 12px;
      width: 80mm;
      font-family: "Courier New", Courier, monospace;
      font-size: 11px;
      color: #111;
    }
    h1 { font-size: 14px; margin: 0; text-align: center; }
    .center { text-align: center; }
    .muted { color: #444; }
    .spacer { height: 6px; }
    .line { border-top: 1px dashed #666; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 2px 0; vertical-align: top; }
    th { text-align: left; font-weight: 600; }
    .qty { width: 12%; }
    .name { width: 44%; }
    .price { width: 22%; text-align: right; }
    .total { width: 22%; text-align: right; }
    .summary td { padding-top: 2px; }
    .summary .label { text-align: left; }
    .summary .value { text-align: right; }
  </style>
</head>
<body>
  <h1>${escapeHtml(restaurantName)}</h1>
  ${restaurantAddress ? `<div class="center muted">${escapeHtml(restaurantAddress)}</div>` : ''}
  <div class="spacer"></div>
  <div>Bill: #${escapeHtml(bill.id)}</div>
  <div>Date: ${escapeHtml(createdAt.toLocaleString())}</div>
  ${bill.tableId ? `<div>Table: ${escapeHtml(bill.tableId)}</div>` : ''}
  ${bill.customerName ? `<div>Customer: ${escapeHtml(bill.customerName)}</div>` : ''}
  <div>Payment: ${escapeHtml(bill.paymentMethod || '')}</div>
  <div class="line"></div>
  <table>
    <thead>
      <tr>
        <th class="qty">Qty</th>
        <th class="name">Item</th>
        <th class="price">Price</th>
        <th class="total">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>
  <div class="line"></div>
  <table class="summary">
    <tr><td class="label">Subtotal</td><td class="value">${formatCurrency(bill.subtotal)}</td></tr>
    <tr><td class="label">Tax</td><td class="value">${formatCurrency(bill.tax)}</td></tr>
    ${bill.discount > 0 ? `<tr><td class="label">Discount</td><td class="value">-${formatCurrency(bill.discount)}</td></tr>` : ''}
    <tr><td class="label"><strong>Total</strong></td><td class="value"><strong>${formatCurrency(bill.total)}</strong></td></tr>
  </table>
  <div class="line"></div>
  <div class="center muted">${escapeHtml(footerNote)}</div>
</body>
</html>`;
}

async function printBillReceipt(bill, options = {}) {
  if (!bill) throw new Error('Missing bill data for receipt');

  const html = renderReceiptHTML(bill, options);
  const printWindow = new BrowserWindow({
    width: 320,
    height: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    const printers = await printWindow.webContents.getPrintersAsync();
    if (!printers || printers.length === 0) {
      logger.warn('No printers available; skipping receipt print');
      return { skipped: true, reason: 'No printers available' };
    }

    const printOptions = {
      silent: options.silent !== undefined ? options.silent : true,
      printBackground: true,
    };
    if (options.deviceName) {
      printOptions.deviceName = options.deviceName;
    } else {
      const defaultPrinter = printers.find(p => p.isDefault);
      if (!defaultPrinter && printOptions.silent) {
        logger.warn('No default printer; skipping silent receipt print');
        return { skipped: true, reason: 'No default printer for silent print' };
      }
    }

    await new Promise((resolve, reject) => {
      printWindow.webContents.print(printOptions, (success, failureReason) => {
        if (!success) return reject(new Error(failureReason || 'Print failed'));
        return resolve();
      });
    });
    return { skipped: false };
  } catch (err) {
    logger.error('printBillReceipt failed', err);
    throw err;
  } finally {
    if (!printWindow.isDestroyed()) printWindow.close();
  }
}

module.exports = { printBillReceipt };
