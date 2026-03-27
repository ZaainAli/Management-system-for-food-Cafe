/**
 * Bulk Bill Generation Test
 *
 * Generates bills across one month (2026-01-08 to 2026-02-07)
 * with three different item combos and enforces a fixed daily target.
 *
 * Inserts directly into the project database.
 * Run:  ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron tests/generate-bills.test.js
 */

const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

// ─── Config ────────────────────────────────────────────────
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const TAX_RATE = 0.00;
const BILLS_PER_DAY = Number(process.env.BILLS_PER_DAY || 1000);

// ─── Date range: one month (2026-01-08 to 2026-02-07) ─────
const DATE_FROM = '2026-03-27';
const DATE_TO = '2026-03-27';

function getAllDatesInRange(from, to) {
  const dates = [];
  const start = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

const ALL_DATES = getAllDatesInRange(DATE_FROM, DATE_TO);
const DATASET_1_PER_DAY = Math.ceil(BILLS_PER_DAY / 3);
const DATASET_2_PER_DAY = Math.floor(BILLS_PER_DAY / 3);
const DATASET_3_PER_DAY = BILLS_PER_DAY - DATASET_1_PER_DAY - DATASET_2_PER_DAY;

const DATASET_1_COUNT = DATASET_1_PER_DAY * ALL_DATES.length;
const DATASET_2_COUNT = DATASET_2_PER_DAY * ALL_DATES.length;
const DATASET_3_COUNT = DATASET_3_PER_DAY * ALL_DATES.length;

// ─── Connect to project database ──────────────────────────
const dbPath = path.join(require('os').homedir(), '.config', 'Electron', 'restaurant.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log(`\n📦  Database: ${dbPath}`);
console.log(`📅  Bills will be generated across: ${DATE_FROM} to ${DATE_TO} (${ALL_DATES.length} days)`);
console.log(`🎯  Daily target: ${BILLS_PER_DAY} bills/day\n`);

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
 * @param {Array} itemPool - subset of menuItems to pick from
 * @param {string} dateStr - date in YYYY-MM-DD format
 */
function buildBill(itemPool, dateStr) {
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

  const discount = randomInt(0, 10);
  const tax = parseFloat((subtotal * 0));
  const discountAmt = parseFloat((subtotal * (discount / 100)));
  const total = parseFloat((subtotal + tax - discountAmt));

  // Random time within the day
  const hh = String(randomInt(8, 23)).padStart(2, '0');
  const mm = String(randomInt(0, 59)).padStart(2, '0');
  const ss = String(randomInt(0, 59)).padStart(2, '0');
  const createdAt = `${dateStr}T${hh}:${mm}:${ss}.000Z`;

  return {
    id: uuidv4(),
    tableId: tableIds.length > 0 ? tableIds[randomInt(0, tableIds.length - 1)] : null,
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
  const billDate = bill.createdAt.split('T')[0];
  stmtDailySales.run(billDate, bill.total, new Date().toISOString());
}

// ─── Define three datasets with different item combos ──────
const dataset1Items = menuItems.filter(m =>
  ['item-001', 'item-003', 'item-006', 'item-011', 'item-010'].includes(m.id)
);

const dataset2Items = menuItems.filter(m =>
  ['item-004', 'item-005', 'item-008', 'item-012', 'item-016'].includes(m.id)
);

const dataset3Items = menuItems.filter(m =>
  ['item-007', 'item-009', 'item-012', 'item-013', 'item-014', 'item-015', 'item-017', 'item-018'].includes(m.id)
);

console.log('─── Dataset 1 (Main Course combo) ───');
console.log(`    Items: ${dataset1Items.map(i => i.name).join(', ')}`);
console.log(`    Target bills: ${DATASET_1_COUNT} (${DATASET_1_PER_DAY}/day)\n`);

console.log('─── Dataset 2 (Mixed combo) ─────────');
console.log(`    Items: ${dataset2Items.map(i => i.name).join(', ')}`);
console.log(`    Target bills: ${DATASET_2_COUNT} (${DATASET_2_PER_DAY}/day)\n`);

console.log('─── Dataset 3 (Drinks + light combo) ');
console.log(`    Items: ${dataset3Items.map(i => i.name).join(', ')}`);
console.log(`    Target bills: ${DATASET_3_COUNT} (${DATASET_3_PER_DAY}/day)\n`);

function generateBillsByDay(label, itemPool, perDayCount) {
  const start = Date.now();
  const insertMany = db.transaction(() => {
    for (const date of ALL_DATES) {
      for (let i = 0; i < perDayCount; i++) {
        const bill = buildBill(itemPool, date);
        insertBill(bill);
      }
    }
  });
  insertMany();
  const elapsed = Date.now() - start;
  const total = perDayCount * ALL_DATES.length;
  console.log(`  ✅  ${label}: ${total} bills inserted (${perDayCount}/day) in ${elapsed} ms`);
}

console.log('Generating bills …\n');

generateBillsByDay('Dataset 1', dataset1Items, DATASET_1_PER_DAY);
generateBillsByDay('Dataset 2', dataset2Items, DATASET_2_PER_DAY);
generateBillsByDay('Dataset 3', dataset3Items, DATASET_3_PER_DAY);

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
    SUM(bi.quantity) as totalQty
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
console.log(`  Expected new bills:       ${BILLS_PER_DAY * ALL_DATES.length}`);

console.log(`\n── Bills by date (${DATE_FROM} to ${DATE_TO}) ──`);
const totalBillsInRange = billsByDate.reduce((sum, r) => sum + r.count, 0);
console.log(`    Total bills in range: ${totalBillsInRange} across ${billsByDate.length} days`);
console.log(`    Avg per day: ${Math.round(totalBillsInRange / billsByDate.length)}`);

const underTargetDays = billsByDate.filter(r => r.count < BILLS_PER_DAY);
if (underTargetDays.length > 0) {
  console.log(`    ⚠️  Days below ${BILLS_PER_DAY}: ${underTargetDays.length}`);
}

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
assert(`New bills inserted = ${BILLS_PER_DAY * ALL_DATES.length}`, newBills === BILLS_PER_DAY * ALL_DATES.length);
assert(`Dataset 1 bills = ${DATASET_1_COUNT}`, DATASET_1_COUNT === DATASET_1_PER_DAY * ALL_DATES.length);
assert(`Dataset 2 bills = ${DATASET_2_COUNT}`, DATASET_2_COUNT === DATASET_2_PER_DAY * ALL_DATES.length);
assert(`Dataset 3 bills = ${DATASET_3_COUNT}`, DATASET_3_COUNT === DATASET_3_PER_DAY * ALL_DATES.length);
assert(`Bills exist for each day in range (${DATE_FROM} to ${DATE_TO})`, billsByDate.length === ALL_DATES.length);
assert(`Every day has at least ${BILLS_PER_DAY} bills`, underTargetDays.length === 0);
assert('Every bill has at least 1 line item', totalLineItems >= totalBills);

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);

// ─── Push daily_sales to Supabase ──────────────────────────
function getSupabaseBranchId() {
  if (process.env.SUPABASE_BRANCH_ID) return process.env.SUPABASE_BRANCH_ID;
  try {
    const configPath = path.join(require('os').homedir(), '.config', 'Electron', 'branch-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return config.branchId || null;
    }
  } catch {}
  return null;
}

async function pushDailySalesToSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const branchId = getSupabaseBranchId();

  if (!url || !key || !branchId) {
    console.log('⚠️   Supabase sync skipped - missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_BRANCH_ID\n');
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const rows = db.prepare(`
    SELECT date, totalRevenue, totalBills, totalExpenses
    FROM daily_sales
    WHERE date BETWEEN ? AND ?
    ORDER BY date
  `).all(DATE_FROM, DATE_TO);

  const upsertRows = rows.map(r => ({
    branch_id: branchId,
    date: r.date,
    total_revenue: r.totalRevenue,
    total_expenses: r.totalExpenses,
    bill_count: r.totalBills,
  }));

  console.log(`☁️   Pushing ${upsertRows.length} daily_sales rows to Supabase ...`);
  const { error } = await supabase
    .from('daily_sales')
    .upsert(upsertRows, { onConflict: 'branch_id,date' });

  if (error) {
    console.error('  ❌  daily_sales push failed:', error.message);
  } else {
    console.log(`  ✅  daily_sales pushed (${DATE_FROM} -> ${DATE_TO})\n`);
  }
}

(async () => {
  await pushDailySalesToSupabase();
  db.close();
  process.exit(failed > 0 ? 1 : 0);
})();
