const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const logger = require('../utils/logger');

const RECEIPT_WIDTH = 42; // characters for 80mm thermal printer
const LEFT_MARGIN = '  '; // 2 spaces for left margin

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

function line(char = '-', width = RECEIPT_WIDTH-2) {
  return char.repeat(width);
}

function renderReceiptText(bill, options = {}) {
  const restaurantName = options.restaurantName || 'Hamza & Brother Food ';
  const createdAt = bill.createdAt ? new Date(bill.createdAt) : new Date();
  const timeStr = createdAt.toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  const parts = [];

  // Header
  parts.push(ALIGN_CENTER + BOLD_ON + restaurantName + BOLD_OFF + '\n');

  // Token number extracted from bill ID (e.g. "145" from "2026_04_02-145")
  const tokenMatch = String(bill.id).match(/-(\d+)$/);
  const tokenNumber = tokenMatch ? tokenMatch[1] : null;
  parts.push(ALIGN_CENTER  + `Token # ${tokenNumber}`  + '\n');

  parts.push(ALIGN_LEFT);

  // Reprint watermark
  if (options.reprint) {
    parts.push(ALIGN_CENTER + BOLD_ON + DOUBLE_HEIGHT_ON + '** REPRINT **' + DOUBLE_HEIGHT_OFF + BOLD_OFF + '\n');
    parts.push(LEFT_MARGIN + line() + '\n');
  }

  // Bill info - ID and time on same line
  const billInfo = `Bill: ${bill.id}`;
  parts.push(LEFT_MARGIN + billInfo.padEnd(RECEIPT_WIDTH - timeStr.length - LEFT_MARGIN.length) + timeStr + '\n');
  if (bill.tableId) parts.push(LEFT_MARGIN + `Table: ${bill.tableId}\n`);
  parts.push(LEFT_MARGIN + line() + '\n');

  // Column header
    parts.push(
    LEFT_MARGIN + 'Qty'.padEnd(4) +
    'Item'.padEnd(18- LEFT_MARGIN.length) +
    'Price'.padStart(10) +
    'Total'.padStart(10) + '\n'
  );
  parts.push(LEFT_MARGIN + line() + '\n');

  // Qty is 4 chars left-aligned, Item is 18 chars, price and total are 10 chars each, right-aligned.
  for (const item of (bill.items || [])) {
    const qty = String(item.quantity).padEnd(4);
    const name = String(item.name).substring(0, 18- LEFT_MARGIN.length).padEnd(18- LEFT_MARGIN.length);
    const price = formatAmount(item.price).padStart(10);
    const total = formatAmount(item.lineTotal).padStart(10);
    parts.push(LEFT_MARGIN + `${qty}${name}${price}${total}\n`);
  }

  parts.push(LEFT_MARGIN + line() + '\n');

  // Summary
  const labelWidth = RECEIPT_WIDTH - 20 - LEFT_MARGIN.length;
  if (bill.discount > 0) {
    parts.push(LEFT_MARGIN + 'Discount'.padEnd(labelWidth) + ('-' + formatAmount(bill.discount)).padStart(20) + '\n');
    parts.push(LEFT_MARGIN + line() + '\n');
  }
  

  // TOTAL - bold and double height
  const totalLine = 'TOTAL'.padEnd(labelWidth) + formatAmount(bill.total).padStart(20);
  parts.push(LEFT_MARGIN + BOLD_ON + DOUBLE_HEIGHT_ON + totalLine + DOUBLE_HEIGHT_OFF + BOLD_OFF + '\n');

  parts.push(LEFT_MARGIN + line() + '\n');

  // At the end, just before CUT_PAPER:
  if (options.reprint) {
    parts.push(LEFT_MARGIN + line() + '\n');
    parts.push(ALIGN_CENTER + BOLD_ON + DOUBLE_HEIGHT_ON + '** REPRINT **' + DOUBLE_HEIGHT_OFF + BOLD_OFF + '\n');
  }


  // Auto paper cut
  parts.push(CUT_PAPER);

  return parts.join('');
}

async function printBillReceipt(bill, options = {}) {
  if (!bill) throw new Error('Missing bill data for receipt');

  const text = renderReceiptText(bill, options);
  const printerName = options.deviceName || 'TM-T88V';

  logger.info(`Printing receipt for bill #${bill.id} on printer: ${printerName} (platform: ${process.platform})`);

  if (process.platform === 'win32') {
    return printWindows(text, printerName);
  }
  return printUnix(text, printerName);
}

function renderKhataReceiptText(profile, transactions, options = {}) {
  const restaurantName = options.restaurantName || 'Hamza & Brother Food ';
  const { dateFrom, dateTo } = options;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi', day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: true });

  const parts = [];

  parts.push(ALIGN_CENTER + BOLD_ON + restaurantName + BOLD_OFF + '\n');
  parts.push(ALIGN_CENTER + BOLD_ON + 'Khata Receipt' + BOLD_OFF + '\n');
  parts.push(ALIGN_LEFT);

  parts.push(LEFT_MARGIN + line() + '\n');
  const typeLabel = profile.profileType === 'customer' ? 'Customer' : 'Supplier';
  parts.push(LEFT_MARGIN + `${typeLabel}: ${profile.name}` + '\n');
  if (profile.phone) parts.push(LEFT_MARGIN + `Phone: ${profile.phone}` + '\n');
  parts.push(LEFT_MARGIN + `Date: ${dateStr} ${timeStr}` + '\n');
  if (dateFrom || dateTo) {
    const fromStr = dateFrom ? dateFrom : 'Start';
    const toStr = dateTo ? dateTo : 'Now';
    parts.push(LEFT_MARGIN + `Period: ${fromStr} to ${toStr}` + '\n');
  }
  parts.push(LEFT_MARGIN + line() + '\n');

  parts.push(LEFT_MARGIN + 'Date'.padEnd(10) + 'Due'.padStart(10) + 'Pay'.padStart(10) + 'Bal'.padStart(10) + '\n');
  parts.push(LEFT_MARGIN + line() + '\n');

  const txList = [...transactions].reverse();
  for (const tx of txList) {
    const due = tx.type === 'due' ? formatAmount(tx.amount) : '-';
    const pay = tx.type === 'payment' ? formatAmount(tx.amount) : '-';
    const bal = Math.abs(Number(tx.runningBalance) || 0);
    parts.push(LEFT_MARGIN + String(tx.date).padEnd(10) + due.padStart(10) + pay.padStart(10) + bal.toString().padStart(10) + '\n');
  }

  const totalDue = transactions.filter(t => t.type === 'due').reduce((s, t) => s + Number(t.amount), 0);
  const totalPayment = transactions.filter(t => t.type === 'payment').reduce((s, t) => s + Number(t.amount), 0);
  const balance = profile.balance || 0;

  parts.push(LEFT_MARGIN + line() + '\n');
  parts.push(LEFT_MARGIN + 'Total Due:'.padEnd(20) + formatAmount(totalDue).padStart(20) + '\n');
  parts.push(LEFT_MARGIN + 'Total Payment:'.padEnd(20) + formatAmount(totalPayment).padStart(20) + '\n');
  parts.push(LEFT_MARGIN + line() + '\n');

  const balLabel = balance >= 0 ? 'Balance (-):' : 'Balance (+):';
  parts.push(ALIGN_CENTER + BOLD_ON + DOUBLE_HEIGHT_ON + balLabel + ' ' + formatAmount(Math.abs(balance)) + DOUBLE_HEIGHT_OFF + BOLD_OFF + '\n');

  parts.push(ALIGN_CENTER + '\n');
  parts.push(ALIGN_CENTER + 'Thank you!' + '\n');
  parts.push(CUT_PAPER);

  return parts.join('');
}

async function printKhataReceipt(profile, transactions, options = {}) {
  if (!profile) throw new Error('Missing profile data for khata receipt');

  const text = renderKhataReceiptText(profile, transactions, options);
  const printerName = options.deviceName || 'TM-T88V';

  logger.info(`Printing khata receipt for ${profile.name} on printer: ${printerName} (platform: ${process.platform})`);

  if (process.platform === 'win32') {
    return printWindows(text, printerName);
  }
  return printUnix(text, printerName);
}

function printUnix(text, printerName) {
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

    lp.stdin.write(text, 'binary');
    lp.stdin.end();
  });
}

function printWindows(text, printerName) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `receipt_${Date.now()}.bin`);

    try {
      fs.writeFileSync(tmpFile, Buffer.from(text, 'binary'));
    } catch (writeErr) {
      return reject(new Error(`Failed to write temp receipt file: ${writeErr.message}`));
    }

    // Escape values for safe PowerShell string interpolation
    const psFile = tmpFile.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const psPrinter = printerName.replace(/"/g, '\\"');

    // Use Win32 WritePrinter API via PowerShell to send raw ESC/POS bytes.
    // This is the only reliable way to send raw bytes to a Windows printer
    // without the spooler re-processing them.
    const psScript = `
$printerName = "${psPrinter}"
$tempFile    = "${psFile}"
$bytes       = [System.IO.File]::ReadAllBytes($tempFile)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrinterHelper {
    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true,
        CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true,
        ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true,
        CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern Int32 StartDocPrinter(IntPtr hPrinter, Int32 level,
        [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true,
        ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true,
        ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true,
        ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true,
        ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes,
        Int32 dwCount, out Int32 dwWritten);

    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
}
"@

$di            = New-Object RawPrinterHelper+DOCINFOA
$di.pDocName   = "Receipt"
$di.pOutputFile = $null
$di.pDataType  = "RAW"

$hPrinter = [IntPtr]::Zero
if (-not [RawPrinterHelper]::OpenPrinter($printerName, [ref]$hPrinter, [IntPtr]::Zero)) {
    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
    throw "Cannot open printer '$printerName'. Verify the name in Windows Devices and Printers."
}

try {
    if ([RawPrinterHelper]::StartDocPrinter($hPrinter, 1, $di) -le 0) {
        throw "StartDocPrinter failed"
    }
    [RawPrinterHelper]::StartPagePrinter($hPrinter) | Out-Null

    $ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
    try {
        [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
        $written = 0
        if (-not [RawPrinterHelper]::WritePrinter($hPrinter, $ptr, $bytes.Length, [ref]$written)) {
            throw "WritePrinter failed (wrote $written of $($bytes.Length) bytes)"
        }
    } finally {
        [System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
    }

    [RawPrinterHelper]::EndPagePrinter($hPrinter) | Out-Null
    [RawPrinterHelper]::EndDocPrinter($hPrinter) | Out-Null
} finally {
    [RawPrinterHelper]::ClosePrinter($hPrinter) | Out-Null
    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
}

Write-Output "OK"
`;

    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', psScript],
      (err, stdout, stderr) => {
        fs.unlink(tmpFile, () => {}); // best-effort cleanup
        if (err) {
          const msg = (stderr && stderr.trim()) || err.message;
          logger.error(`Windows print error: ${msg}`);
          return reject(new Error(msg));
        }
        logger.info(`Windows print job submitted. Output: ${stdout.trim()}`);
        return resolve({ skipped: false });
      }
    );
  });
}

module.exports = { printBillReceipt, printKhataReceipt };
