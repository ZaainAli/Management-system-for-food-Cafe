const { execFile } = require('child_process');
const logger = require('../utils/logger');

const RECEIPT_WIDTH = 42; // characters for 80mm thermal printer

// ESC/POS commands for Epson TM-T88V
const ESC = '\x1b';
const BOLD_ON = `${ESC}\x45\x01`;
const BOLD_OFF = `${ESC}\x45\x00`;
const ALIGN_CENTER = `${ESC}\x61\x01`;
const ALIGN_LEFT = `${ESC}\x61\x00`;
const DOUBLE_HEIGHT_ON = `${ESC}\x21\x10`;
const DOUBLE_HEIGHT_OFF = `${ESC}\x21\x00`;
const CUT_PAPER = '\x1d\x56\x41\x03'; // GS V A 3 — feed 3 lines then partial cut

function formatAmount(value) {
  return String(Math.round(Number(value) || 0));
}

function centerText(text, width = RECEIPT_WIDTH) {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(pad) + text;
}

function line(char = '-', width = RECEIPT_WIDTH) {
  return char.repeat(width);
}

function renderReceiptText(bill, options = {}) {
  const restaurantName = options.restaurantName || 'Peshwari Hotel & Chapli Kabab';
  const restaurantAddress = options.restaurantAddress || '';
  const createdAt = bill.createdAt ? new Date(bill.createdAt) : new Date();
  const timeStr = createdAt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const parts = [];

  // Header
  parts.push(ALIGN_CENTER);
  parts.push(BOLD_ON + restaurantName + BOLD_OFF + '\n');
  if (restaurantAddress) {
    parts.push(restaurantAddress + '\n');
  }
  parts.push(ALIGN_LEFT);
  parts.push('\n');

  // Bill info - ID and time on same line
  const billInfo = `Bill: ${bill.id}`;
  parts.push(billInfo.padEnd(RECEIPT_WIDTH - timeStr.length) + timeStr + '\n');
  if (bill.tableId) parts.push(`Table: ${bill.tableId}\n`);
  if (bill.customerName) parts.push(`Customer: ${bill.customerName}\n`);
  parts.push(`Payment: ${bill.paymentMethod || ''}\n`);
  parts.push(line() + '\n');

  // Column header
  parts.push(
    'Qty' + ' ' +
    'Item'.padEnd(18) +
    'Price'.padStart(10) +
    'Total'.padStart(10) + '\n'
  );
  parts.push(line() + '\n');

  // Items
  for (const item of (bill.items || [])) {
    const qty = String(item.quantity).padEnd(3);
    const name = String(item.name).substring(0, 18).padEnd(18);
    const price = formatAmount(item.price).padStart(10);
    const total = formatAmount(item.lineTotal).padStart(10);
    parts.push(`${qty} ${name}${price}${total}\n`);
  }

  parts.push(line() + '\n');

  // Summary
  const labelWidth = RECEIPT_WIDTH - 20;
  if (bill.discount > 0) {
    parts.push('Discount'.padEnd(labelWidth) + ('-' + formatAmount(bill.discount)).padStart(20) + '\n');
    parts.push(line() + '\n');
  }
  

  // TOTAL - bold and double height
  const totalLine = 'TOTAL'.padEnd(labelWidth) + formatAmount(bill.total).padStart(20);
  parts.push(BOLD_ON + DOUBLE_HEIGHT_ON + totalLine + DOUBLE_HEIGHT_OFF + BOLD_OFF + '\n');

  parts.push(line() + '\n');

  // Auto paper cut
  parts.push(CUT_PAPER);

  return parts.join('');
}

async function printBillReceipt(bill, options = {}) {
  if (!bill) throw new Error('Missing bill data for receipt');

  const text = renderReceiptText(bill, options);
  const printerName = options.deviceName || 'TM-T88V';

  logger.info(`Printing receipt for bill #${bill.id} on printer: ${printerName}`);

  return new Promise((resolve, reject) => {
    const lp = execFile('lp', ['-d', printerName, '-o', 'raw'], (err, stdout, stderr) => {
      if (err) {
        logger.error(`lp command failed: ${err.message}`);
        return reject(err);
      }
      if (stderr) {
        logger.warn(`lp stderr: ${stderr}`);
      }
      logger.info(`Print job submitted: ${stdout.trim()}`);
      return resolve({ skipped: false });
    });

    lp.stdin.write(text);
    lp.stdin.end();
  });
}

module.exports = { printBillReceipt };
