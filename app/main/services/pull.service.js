/**
 * pull.service.js
 * Runs once at app startup — pulls all cloud data from Supabase and upserts
 * into the local SQLite database. Uses ON CONFLICT DO UPDATE so existing
 * local records are refreshed with the latest cloud values.
 *
 * Order matters:
 *   menu_categories  → menu_items  (FK: categoryId)
 *   khata_profiles   → khata_transactions (FK: khataId)
 *   employees        → salary_records     (FK: employeeId)
 *   expenses         (standalone)
 */

const { createClient } = require('@supabase/supabase-js');
const { getDb }        = require('../db/index');
const logger           = require('../utils/logger');

let _client = null;

function getClient() {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      _client = createClient(url, key, { auth: { persistSession: false } });
    }
  }
  return _client;
}

/** Fetch all rows for a branch from a Supabase table */
async function fetchAll(client, table, branchId) {
  const { data, error } = await client
    .from(table)
    .select('*')
    .eq('branch_id', branchId);
  if (error) {
    logger.error(`[pull] fetch ${table} failed:`, error.message);
    return [];
  }
  return data || [];
}

// ─── Table-specific upsert helpers ───────────────────────────────────────────

function upsertMenuCategories(db, rows) {
  const stmt = db.prepare(`
    INSERT INTO menu_categories (id, name, createdAt)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name      = excluded.name
  `);
  const now = new Date().toISOString();
  const run = db.transaction(() => {
    for (const r of rows) {
      stmt.run(r.id, r.name, now);
    }
  });
  run();
  logger.info(`[pull] menu_categories: upserted ${rows.length} rows`);
}

function upsertMenuItems(db, rows) {
  const stmt = db.prepare(`
    INSERT INTO menu_items (id, name, price, categoryId, isAvailable, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name        = excluded.name,
      price       = excluded.price,
      categoryId  = excluded.categoryId,
      isAvailable = excluded.isAvailable
  `);
  const now = new Date().toISOString();
  const run = db.transaction(() => {
    for (const r of rows) {
      stmt.run(
        r.id,
        r.name,
        r.price,
        r.category_id || null,
        r.available ? 1 : 0,
        now
      );
    }
  });
  run();
  logger.info(`[pull] menu_items: upserted ${rows.length} rows`);
}

function upsertExpenses(db, rows) {
  const stmt = db.prepare(`
    INSERT INTO expenses (id, description, amount, category, date, sourceType, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      description = excluded.description,
      amount      = excluded.amount,
      category    = excluded.category,
      date        = excluded.date,
      sourceType  = excluded.sourceType
  `);
  const now = new Date().toISOString();
  const run = db.transaction(() => {
    for (const r of rows) {
      stmt.run(
        r.id,
        r.description || r.category,   // description is required in SQLite
        r.amount,
        r.category,
        r.date,
        r.source_type || 'manual',
        now
      );
    }
  });
  run();
  logger.info(`[pull] expenses: upserted ${rows.length} rows`);
}

function upsertKhataProfiles(db, rows) {
  const stmt = db.prepare(`
    INSERT INTO khata_profiles (id, name, phone, businessDetails, profileType, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name            = excluded.name,
      phone           = excluded.phone,
      businessDetails = excluded.businessDetails,
      profileType     = excluded.profileType
  `);
  const now = new Date().toISOString();
  const run = db.transaction(() => {
    for (const r of rows) {
      stmt.run(r.id, r.name, r.phone || '', r.notes || '', r.profile_type || 'supplier', now);
    }
  });
  run();
  logger.info(`[pull] khata_profiles: upserted ${rows.length} rows`);
}

function upsertKhataTransactions(db, rows) {
  const stmt = db.prepare(`
    INSERT INTO khata_transactions (id, khataId, type, amount, note, date, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      type   = excluded.type,
      amount = excluded.amount,
      note   = excluded.note,
      date   = excluded.date
  `);
  const now = new Date().toISOString();
  const run = db.transaction(() => {
    for (const r of rows) {
      stmt.run(r.id, r.profile_id, r.type, r.amount, r.note || '', r.date, now);
    }
  });
  run();
  logger.info(`[pull] khata_transactions: upserted ${rows.length} rows`);
}

function upsertEmployees(db, rows) {
  const stmt = db.prepare(`
    INSERT INTO employees (id, name, position, phone, monthlySalary, hireDate, isActive, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name          = excluded.name,
      position      = excluded.position,
      phone         = excluded.phone,
      monthlySalary = excluded.monthlySalary,
      hireDate      = excluded.hireDate,
      isActive      = excluded.isActive
  `);
  const now = new Date().toISOString();
  const run = db.transaction(() => {
    for (const r of rows) {
      stmt.run(
        r.id,
        r.name,
        r.role || 'Staff',
        r.phone || '',
        r.salary || 0,
        r.hire_date || now.slice(0, 10),
        r.active ? 1 : 0,
        now
      );
    }
  });
  run();
  logger.info(`[pull] employees: upserted ${rows.length} rows`);
}

function upsertSalaryRecords(db, rows, employeeMap) {
  const stmt = db.prepare(`
    INSERT INTO salary_records (id, employeeId, employeeName, amount, payDate, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      amount   = excluded.amount,
      payDate  = excluded.payDate
  `);
  const now = new Date().toISOString();
  const run = db.transaction(() => {
    for (const r of rows) {
      const empName = employeeMap[r.employee_id] || '';
      // Supabase stores 'YYYY-MM'; use first day of that month as payDate
      const payDate = r.month ? `${r.month}-01` : now.slice(0, 10);
      stmt.run(r.id, r.employee_id, empName, r.amount, payDate, r.paid_at || now);
    }
  });
  run();
  logger.info(`[pull] salary_records: upserted ${rows.length} rows`);
}

function upsertKhataBills(db, rows) {
  const checkStmt = db.prepare('SELECT id FROM bills WHERE id = ?');
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO bills
      (id, tableId, customerName, subtotal, tax, discount, total, paymentMethod, status, createdAt)
    VALUES (?, NULL, ?, ?, 0, ?, ?, 'khata', 'completed', ?)
  `);
  const salesStmt = db.prepare(`
    INSERT INTO daily_sales (date, totalRevenue, totalBills, totalExpenses, updatedAt)
    VALUES (?, ?, 1, 0, ?)
    ON CONFLICT(date) DO UPDATE SET
      totalRevenue = MAX(totalRevenue + excluded.totalRevenue, 0),
      totalBills   = MAX(totalBills   + excluded.totalBills,   0),
      updatedAt    = excluded.updatedAt
  `);
  const now = new Date().toISOString();
  let inserted = 0;
  const run = db.transaction(() => {
    for (const r of rows) {
      const existing = checkStmt.get(r.id);
      if (!existing) {
        insertStmt.run(r.id, r.customer_name || '', r.total, r.discount || 0, r.total, r.created_at || now);
        const date = r.date || (r.created_at ? r.created_at.slice(0, 10) : now.slice(0, 10));
        salesStmt.run(date, r.total, now);
        inserted++;
      }
    }
  });
  run();
  logger.info(`[pull] khata_bills: upserted ${inserted} new rows (of ${rows.length})`);
}

// ─── Main entry point ─────────────────────────────────────────────────────────

function getConfiguredBranchId() {
  if (process.env.SUPABASE_BRANCH_ID) return process.env.SUPABASE_BRANCH_ID;
  try {
    const fs = require('fs');
    const path = require('path');
    const { app } = require('electron');
    const configPath = path.join(app.getPath('userData'), 'branch-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.branchId) {
        process.env.SUPABASE_BRANCH_ID = config.branchId;
        return config.branchId;
      }
    }
  } catch {}
  return null;
}

async function pullAllFromSupabase() {
  const client   = getClient();
  const branchId = getConfiguredBranchId();

  if (!client || !branchId) {
    logger.info('[pull] Supabase not configured — skipping startup pull');
    return;
  }

  logger.info('[pull] Starting startup pull from Supabase...');
  const db = getDb();

  try {
    // Fetch all tables in parallel (order-independent fetches)
    const [cats, items, expenses, kProfiles, kTxs, employees, salaries, khataBillsRaw] = await Promise.all([
      fetchAll(client, 'menu_categories',    branchId),
      fetchAll(client, 'menu_items',         branchId),
      fetchAll(client, 'expenses',           branchId),
      fetchAll(client, 'khata_profiles',     branchId),
      fetchAll(client, 'khata_transactions', branchId),
      fetchAll(client, 'employees',          branchId),
      fetchAll(client, 'salary_records',     branchId),
      client.from('bills').select('*').eq('branch_id', branchId).eq('source_type', 'khata').then(({ data }) => data || []),
    ]);

    // Build employee name map for salary records
    const employeeMap = {};
    for (const e of employees) employeeMap[e.id] = e.name;

    // Upsert in FK-safe order
    if (cats.length)            upsertMenuCategories(db, cats);
    if (items.length)           upsertMenuItems(db, items);
    if (expenses.length)        upsertExpenses(db, expenses);
    if (kProfiles.length)       upsertKhataProfiles(db, kProfiles);
    if (kTxs.length)            upsertKhataTransactions(db, kTxs);
    if (employees.length)       upsertEmployees(db, employees);
    if (salaries.length)        upsertSalaryRecords(db, salaries, employeeMap);
    if (khataBillsRaw.length)   upsertKhataBills(db, khataBillsRaw);

    logger.info('[pull] Startup pull complete');
  } catch (err) {
    logger.error('[pull] Startup pull failed:', err.message);
  }
}

module.exports = { pullAllFromSupabase };
