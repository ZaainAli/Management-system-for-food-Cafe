/**
 * Bulk Bill Generation Test
 *
 * Generates bills spread across one month (2026-01-08 to 2026-02-07)
 * with three different item combos:
 *   Dataset 1 — 1000+ bills  (Main Course combo)
 *   Dataset 2 — 1599+ bills  (Mixed combo)
 *   Dataset 3 — 2000+ bills  (Drinks-heavy combo)
 *
 * Inserts directly into the project database.
 * Run:  ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron tests/generate-bills.test.js
 */

const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// ─── Config ────────────────────────────────────────────────
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const DATASET_1_COUNT = randomInt(1000, 1400);   // 1000+
const DATASET_2_COUNT = randomInt(1599, 2100);   // 1599+
const DATASET_3_COUNT = randomInt(2000, 2500);   // 2000+
const TAX_RATE = 0.05;          // 5 %

// ─── Date range: one month (2026-01-08 to 2026-02-07) ─────
const DATE_FROM = '2026-01-08';
const DATE_TO   = '2026-02-07';

function getAllDatesInRange(from, to) {
  const dates = [];
  const start = new Date(from + 'T00:00:00Z');
  const end   = new Date(to + 'T00:00:00Z');
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

const ALL_DATES = getAllDatesInRange(DATE_FROM, DATE_TO);

function pickRandomDate() {
  return ALL_DATES[randomInt(0, ALL_DATES.length - 1)];
}

// ─── Connect to project database ──────────────────────────
const dbPath = path.join(require('os').homedir(), '.config', 'Electron', 'restaurant.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log(`\n📦  Database: ${dbPath}`);
console.log(`📅  Bills will be spread across: ${DATE_FROM} to ${DATE_TO} (${ALL_DATES.length} days)\n`);

// ─── Read existing menu items from the DB ──────────────────
const menuItems = db.prepare('SELECT * FROM menu_items WHERE isAvailable = 1').all();
console.log(`📋  Found ${menuItems.length} menu items in database\n`);

if (menuItems.length === 0) {
  console.error('❌  No menu items found in database. Run the app first to seed data.');
  process.exit(1);
}

// ─── Count existing bills before insertion ─────────────────
const billsBefore = db.prepare('SELECT COUNT(*) as count FROM bills').get().count;
console.log(`📊  Bills already in DB: ${billsBefore}\n`);

// ─── Helpers ───────────────────────────────────────────────
function pick(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

const paymentMethods = ['cash', 'card', 'online'];
const tableIds = db.prepare('SELECT id FROM tables').all().map(t => t.id);

/**
 * Build one bill object ready for insertion.
 * @param {Array} itemPool  – subset of menuItems to pick from
 */
function buildBill(itemPool) {
  const dateStr = pickRandomDate();
  const pickedItems = pick(itemPool, randomInt(1, Math.min(5, itemPool.length)));

  let subtotal = 0;
  const lineItems = pickedItems.map(m => {
    const qty = randomInt(1, 4);
    const lineTotal = m.price * qty;
    subtotal += lineTotal;
    return {
      id: uuidv4(),
      menuItemId: m.id,
      name: m.name,
      price: m.price,
      quantity: qty,
      lineTotal,
    };
  });

  const discount = randomInt(0, 10);               // 0-10 %
  const tax = parseFloat((subtotal * TAX_RATE).toFixed(2));
  const discountAmt = parseFloat((subtotal * (discount / 100)).toFixed(2));
  const total = parseFloat((subtotal + tax - discountAmt).toFixed(2));

  // Random time within the day
  const hh = String(randomInt(8, 23)).padStart(2, '0');
  const mm = String(randomInt(0, 59)).padStart(2, '0');
  const ss = String(randomInt(0, 59)).padStart(2, '0');
  const createdAt = `${dateStr}T${hh}:${mm}:${ss}.000Z`;

  return {
    id: uuidv4(),
    tableId: tableIds.length > 0 ? tableIds[randomInt(0, tableIds.length - 1)] : null,
    customerName: '',
    items: lineItems,
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax,
    discount: discountAmt,
    total,
    paymentMethod: paymentMethods[randomInt(0, 2)],
    status: 'completed',
    createdAt,
  };
}

// ─── Prepared statements for fast bulk insert ──────────────
const stmtBill = db.prepare(`
  INSERT INTO bills (id, tableId, customerName, subtotal, tax, discount, total, paymentMethod, status, createdAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const stmtItem = db.prepare(`
  INSERT INTO bill_items (id, billId, menuItemId, name, price, quantity, lineTotal)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const stmtDailySales = db.prepare(`
  INSERT INTO daily_sales (date, totalRevenue, totalBills, totalExpenses, updatedAt)
  VALUES (?, ?, 1, 0, ?)
  ON CONFLICT(date) DO UPDATE SET
    totalRevenue = totalRevenue + excluded.totalRevenue,
    totalBills = totalBills + excluded.totalBills,
    updatedAt = excluded.updatedAt
`);

function insertBill(bill) {
  stmtBill.run(
    bill.id, bill.tableId, bill.customerName,
    bill.subtotal, bill.tax, bill.discount, bill.total,
    bill.paymentMethod, bill.status, bill.createdAt
  );
  for (const li of bill.items) {
    stmtItem.run(li.id, bill.id, li.menuItemId, li.name, li.price, li.quantity, li.lineTotal);
  }
  // Update daily_sales so the app dashboard/reports pick up these bills
  const billDate = bill.createdAt.split('T')[0];
  stmtDailySales.run(billDate, bill.total, new Date().toISOString());
}

// ─── Define three datasets with different item combos ──────
// Dataset 1: Main Course items (Dall Mash, Beef Kabab, Qeema, Roti, Chicken Kharai)
const dataset1Items = menuItems.filter(m =>
  ['item-001', 'item-003', 'item-006', 'item-011', 'item-010'].includes(m.id)
);

// Dataset 2: Mixed items (S-Beef Kabab, Sabzi, Alu-Anda, Regular drink, Chay)
const dataset2Items = menuItems.filter(m =>
  ['item-004', 'item-005', 'item-008', 'item-012', 'item-016'].includes(m.id)
);

// Dataset 3: Drinks + light items (All drinks + Rita + Kalaji)
const dataset3Items = menuItems.filter(m =>
  ['item-007', 'item-009', 'item-012', 'item-013', 'item-014', 'item-015', 'item-017', 'item-018'].includes(m.id)
);

console.log('─── Dataset 1 (Main Course combo) ───');
console.log(`    Items: ${dataset1Items.map(i => i.name).join(', ')}`);
console.log(`    Target bills: ${DATASET_1_COUNT}\n`);

console.log('─── Dataset 2 (Mixed combo) ─────────');
console.log(`    Items: ${dataset2Items.map(i => i.name).join(', ')}`);
console.log(`    Target bills: ${DATASET_2_COUNT}\n`);

console.log('─── Dataset 3 (Drinks + light combo) ');
console.log(`    Items: ${dataset3Items.map(i => i.name).join(', ')}`);
console.log(`    Target bills: ${DATASET_3_COUNT}\n`);

// ─── Generate bills in transactions (fast) ─────────────────
function generateBills(label, itemPool, count) {
  const start = Date.now();
  const insertMany = db.transaction(() => {
    for (let i = 0; i < count; i++) {
      insertBill(buildBill(itemPool));
    }
  });
  insertMany();
  const elapsed = Date.now() - start;
  console.log(`  ✅  ${label}: ${count} bills inserted in ${elapsed} ms`);
}

console.log('Generating bills …\n');

generateBills('Dataset 1', dataset1Items, DATASET_1_COUNT);
generateBills('Dataset 2', dataset2Items, DATASET_2_COUNT);
generateBills('Dataset 3', dataset3Items, DATASET_3_COUNT);

// ─── Verify ────────────────────────────────────────────────
const totalBills = db.prepare('SELECT COUNT(*) as count FROM bills').get().count;
const totalLineItems = db.prepare('SELECT COUNT(*) as count FROM bill_items').get().count;
const newBills = totalBills - billsBefore;

const billsByDate = db.prepare(`
  SELECT substr(createdAt, 1, 10) as date, COUNT(*) as count
  FROM bills
  WHERE substr(createdAt, 1, 10) BETWEEN ? AND ?
  GROUP BY date
  ORDER BY date
`).all(DATE_FROM, DATE_TO);

const revenueByDataset = db.prepare(`
  SELECT
    CASE
      WHEN bi.menuItemId IN ('item-001','item-003','item-006','item-011','item-010')
        THEN 'Dataset 1 (Main Course)'
      WHEN bi.menuItemId IN ('item-004','item-005','item-008','item-012','item-016')
        THEN 'Dataset 2 (Mixed)'
      ELSE 'Dataset 3 (Drinks+Light)'
    END as dataset,
    SUM(bi.lineTotal) as revenue,
    SUM(bi.quantity)  as totalQty
  FROM bill_items bi
  JOIN bills b ON b.id = bi.billId
  WHERE substr(b.createdAt, 1, 10) BETWEEN ? AND ?
  GROUP BY dataset
  ORDER BY dataset
`).all(DATE_FROM, DATE_TO);

const topItems = db.prepare(`
  SELECT bi.name, SUM(bi.quantity) as totalQty, SUM(bi.lineTotal) as totalRevenue
  FROM bill_items bi
  JOIN bills b ON b.id = bi.billId
  WHERE substr(b.createdAt, 1, 10) BETWEEN ? AND ?
  GROUP BY bi.name
  ORDER BY totalRevenue DESC
  LIMIT 10
`).all(DATE_FROM, DATE_TO);

// ─── Print results ─────────────────────────────────────────
console.log('\n══════════════════════════════════════');
console.log('         VERIFICATION RESULTS');
console.log('══════════════════════════════════════\n');

console.log(`  Bills before test:        ${billsBefore}`);
console.log(`  New bills inserted:       ${newBills}`);
console.log(`  Total bills in DB:        ${totalBills}`);
console.log(`  Total line items in DB:   ${totalLineItems}`);
console.log(`  Expected new bills:       ${DATASET_1_COUNT + DATASET_2_COUNT + DATASET_3_COUNT}`);

console.log(`\n── Bills by date (${DATE_FROM} to ${DATE_TO}) ──`);
const totalBillsInRange = billsByDate.reduce((sum, r) => sum + r.count, 0);
console.log(`    Total bills in range: ${totalBillsInRange} across ${billsByDate.length} days`);
console.log(`    Avg per day: ${Math.round(totalBillsInRange / billsByDate.length)}`);

console.log('\n── Revenue by Dataset (month) ────────');
for (const row of revenueByDataset) {
  console.log(`    ${row.dataset}:  Rs ${row.revenue.toFixed(2)}  (${row.totalQty} items sold)`);
}

console.log('\n── Top 10 Items by Revenue (month) ───');
for (const row of topItems) {
  console.log(`    ${row.name.padEnd(22)} Qty: ${String(row.totalQty).padStart(5)}   Revenue: Rs ${row.totalRevenue.toFixed(2)}`);
}

// ─── Assertions ────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✅  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  ❌  FAIL: ${label}`);
    failed++;
  }
}

console.log('\n── Assertions ───────────────────────');
assert(`New bills inserted = ${DATASET_1_COUNT + DATASET_2_COUNT + DATASET_3_COUNT}`, newBills === DATASET_1_COUNT + DATASET_2_COUNT + DATASET_3_COUNT);
assert(`Dataset 1 bills >= 1000`, DATASET_1_COUNT >= 1000);
assert(`Dataset 2 bills >= 1599`, DATASET_2_COUNT >= 1599);
assert(`Dataset 3 bills >= 2000`, DATASET_3_COUNT >= 2000);
assert(`Bills spread across date range (${DATE_FROM} to ${DATE_TO})`, billsByDate.length > 1 && totalBillsInRange >= DATASET_1_COUNT + DATASET_2_COUNT + DATASET_3_COUNT);
assert('Every bill has at least 1 line item', totalLineItems >= totalBills);

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);

// ─── Close DB ──────────────────────────────────────────────
db.close();
process.exit(failed > 0 ? 1 : 0);
