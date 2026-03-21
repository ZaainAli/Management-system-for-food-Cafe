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
const syncService      = require('./sync.service');

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

function _extractQueuedId(payloadRaw) {
  if (!payloadRaw) return null;
  try {
    const payload = JSON.parse(payloadRaw);
    if (payload == null) return null;
    if (typeof payload === 'string' || typeof payload === 'number') return String(payload);
    if (typeof payload === 'object' && payload.id) return String(payload.id);
  } catch {}
  return null;
}

function getPendingIdsByTable(db) {
  try {
    const rows = db.prepare('SELECT tableName, payload FROM sync_queue').all();
    const pending = new Map();
    for (const row of rows) {
      const id = _extractQueuedId(row.payload);
      if (!id) continue;
      if (!pending.has(row.tableName)) pending.set(row.tableName, new Set());
      pending.get(row.tableName).add(id);
    }
    return pending;
  } catch {
    return new Map();
  }
}

async function pushLocalToSupabase(db) {
  logger.info('[pull] Flushing local sync queue to Supabase...');

  // Flush any queued offline sync jobs first (best-effort)
  try {
    const result = await syncService.flushSyncQueue({ limit: 200 });
    if (result?.success) {
      logger.info(`[pull] sync queue flushed: processed=${result.processed || 0}`);
    }
  } catch (err) {
    logger.warn('[pull] sync queue flush failed:', err.message);
  }

  // push dailysales 
// const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
// const dailySales = db.prepare('SELECT date, totalRevenue, totalBills, totalExpenses FROM daily_sales WHERE date = ?').all(today);  for (const row of dailySales) {
//     await syncService.pushDailySales({
//       date: row.date,
//       totalRevenue: row.totalRevenue,
//       totalBills: row.totalBills,
//       totalExpenses: row.totalExpenses,
//     });
//   }


  // const expenses = db.prepare('SELECT * FROM expenses').all();
  // for (const expense of expenses) {
  //   await syncService.pushExpense(expense);
  // }

  // const khataProfiles = db.prepare('SELECT * FROM khata_profiles').all();
  // for (const profile of khataProfiles) {
  //   await syncService.pushKhataProfile(profile);
  // }

  // const khataTransactions = db.prepare('SELECT * FROM khata_transactions').all();
  // for (const tx of khataTransactions) {
  //   await syncService.pushKhataTransaction({
  //     ...tx,
  //     expenseId: tx.expenseId || null,
  //   });
  // }

  // const employees = db.prepare('SELECT * FROM employees').all();
  // for (const employee of employees) {
  //   await syncService.pushEmployee(employee);
  // }

  // const salaryRecords = db.prepare('SELECT * FROM salary_records').all();
  // for (const record of salaryRecords) {
  //   await syncService.pushSalaryRecord({
  //     ...record,
  //     payDate: record.payDate,
  //     createdAt: record.createdAt,
  //   });
  // }

  logger.info('[pull] Local push complete');
}

// ─── Table-specific upsert helpers ───────────────────────────────────────────

function upsertMenuCategories(db, rows, pendingIds = new Set()) {
  const stmt = db.prepare(`
    INSERT INTO menu_categories (id, name, createdAt)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name      = excluded.name
  `);
  const now = new Date().toISOString();
  let upserted = 0;
  let skipped = 0;
  const run = db.transaction(() => {
    for (const r of rows) {
      if (pendingIds.has(r.id)) { skipped += 1; continue; }
      stmt.run(r.id, r.name, now);
      upserted += 1;
    }
  });
  run();
  logger.info(`[pull] menu_categories: upserted ${upserted} rows${skipped ? `, skipped ${skipped} pending` : ''}`);
}

function upsertMenuItems(db, rows, pendingIds = new Set()) {
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
  let upserted = 0;
  let skipped = 0;
  const run = db.transaction(() => {
    for (const r of rows) {
      if (pendingIds.has(r.id)) { skipped += 1; continue; }
      stmt.run(
        r.id,
        r.name,
        r.price,
        r.category_id || null,
        r.available ? 1 : 0,
        now
      );
      upserted += 1;
    }
  });
  run();
  logger.info(`[pull] menu_items: upserted ${upserted} rows${skipped ? `, skipped ${skipped} pending` : ''}`);
}

function upsertExpenses(db, rows, pendingIds = new Set()) {
  const upsert = db.prepare(`
    INSERT INTO expenses (id, description, amount, category, date, sourceType, sourceEntityId, sourceEntityName, sourceRecordId, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      description = excluded.description,
      amount      = excluded.amount,
      category    = excluded.category,
      date        = excluded.date,
      sourceType = excluded.sourceType,
      sourceEntityId = excluded.sourceEntityId,
      sourceEntityName = excluded.sourceEntityName,
      sourceRecordId = excluded.sourceRecordId
  `);
  let upserted = 0;
  let skipped = 0;
  const cloudIds = [];
  const run = db.transaction(() => {
    for (const r of rows) {
      if (pendingIds.has(r.id)) { skipped += 1; continue; }
      upsert.run(
        r.id,
        r.description || r.category,   // description is required in SQLite
        r.amount,
        r.category,
        r.date,
        r.source_type || 'manual',
        r.source_entity_id || null,
        r.source_entity_name || '',
        r.source_record_id || null,
        r.created_at || new Date().toISOString()
      );
      cloudIds.push(r.id);
      upserted += 1;
    }
    const keepIds = [...new Set([...cloudIds, ...pendingIds])];
    if (keepIds.length > 0) {
      const placeholders = keepIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM expenses WHERE id NOT IN (${placeholders})`).run(...keepIds);
    } else {
      db.prepare('DELETE FROM expenses').run();
    }
  });
  run();
  logger.info(`[pull] expenses: upserted ${upserted} rows, removed orphans${skipped ? `, skipped ${skipped} pending` : ''}`);
}

/**
 * Remove the linked bill and adjust daily_sales when a customer payment
 * transaction is deleted (either directly or via profile deletion).
 */
function _removeCustomerPaymentSideEffects(db, tx, profileName, now) {
  const dateStr = tx.date.replace(/-/g, '_');
  const billId  = `${dateStr}-khata-${profileName}-${tx.id}`;
  const bill    = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
  if (bill && bill.status !== 'cancelled') {
    db.prepare('DELETE FROM bill_items WHERE billId = ?').run(billId);
    db.prepare('DELETE FROM bills WHERE id = ?').run(billId);
    db.prepare(`
      UPDATE daily_sales
      SET totalRevenue = MAX(totalRevenue - ?, 0),
          totalBills   = MAX(totalBills - 1, 0),
          updatedAt    = ?
      WHERE date = ?
    `).run(Number(tx.amount), now, tx.date);
  }
}

function upsertKhataProfiles(db, rows, pendingIds = new Set()) {
  const stmt = db.prepare(`
    INSERT INTO khata_profiles (id, name, phone, businessDetails, profileType, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name            = excluded.name,
      phone           = excluded.phone,
      businessDetails = excluded.businessDetails,
      profileType     = excluded.profileType
  `);
  const now     = new Date().toISOString();
  const cloudIds = rows.map(r => r.id);
  const cloudIdSet = new Set(cloudIds);
  let upserted = 0;
  let skipped = 0;

  const run = db.transaction(() => {
    // Upsert cloud profiles
    for (const r of rows) {
      if (pendingIds.has(r.id)) { skipped += 1; continue; }
      stmt.run(r.id, r.name, r.phone || '', r.notes || '', r.profile_type || 'supplier', now);
      upserted += 1;
    }

    // Delete local profiles that no longer exist in cloud
    const localProfiles = db.prepare('SELECT * FROM khata_profiles').all();
    for (const profile of localProfiles) {
      if (cloudIdSet.has(profile.id) || pendingIds.has(profile.id)) continue;

      // Clean up all customer payment transactions' bills + daily_sales
      if (profile.profileType === 'customer') {
        const txs = db.prepare(
          "SELECT * FROM khata_transactions WHERE khataId = ? AND type = 'payment'"
        ).all(profile.id);
        for (const tx of txs) {
          _removeCustomerPaymentSideEffects(db, tx, profile.name, now);
        }
      }

      db.prepare('DELETE FROM khata_transactions WHERE khataId = ?').run(profile.id);
      db.prepare('DELETE FROM khata_profiles WHERE id = ?').run(profile.id);
    }
  });
  run();
  logger.info(`[pull] khata_profiles: upserted ${upserted} rows${skipped ? `, skipped ${skipped} pending` : ''}`);
}

function upsertKhataTransactions(db, rows, pendingIds = new Set()) {
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
  const cloudTxIds = rows.map(r => r.id);
  const cloudTxIdSet = new Set(cloudTxIds);
  let upserted = 0;
  let skipped = 0;

  const insertBill = db.prepare(`
    INSERT OR IGNORE INTO bills
      (id, tableId, customerName, subtotal, tax, discount, total, paymentMethod, status, createdAt)
    VALUES (?, NULL, ?, ?, 0, 0, ?, 'cash', 'completed', ?)
  `);

  const run = db.transaction(() => {
    for (const r of rows) {
      if (pendingIds.has(r.id)) { skipped += 1; continue; }
      const existing = db.prepare('SELECT * FROM khata_transactions WHERE id = ?').get(r.id);
      const profile  = db.prepare('SELECT * FROM khata_profiles WHERE id = ?').get(r.profile_id);

      if (r.type === 'payment' && profile?.profileType === 'customer') {
        const newAmount = Number(r.amount);
        const newDate   = r.date;
        const dateStr   = newDate.replace(/-/g, '_');
        const billId    = `${dateStr}-khata-${profile.name}-${r.id}`;

        if (!existing) {
          // NEW transaction from web — create bill + daily_sales entry
          insertBill.run(billId, profile.name, newAmount, newAmount, now);
          db.prepare(`
            INSERT INTO daily_sales (date, totalRevenue, totalBills, totalExpenses, updatedAt)
            VALUES (?, ?, 1, 0, ?)
            ON CONFLICT(date) DO UPDATE SET
              totalRevenue = totalRevenue + ?,
              totalBills   = totalBills + 1,
              updatedAt    = ?
          `).run(newDate, newAmount, now, newAmount, now);

        } else {
          // EXISTING transaction edited on web — reconcile bill + daily_sales
          const oldAmount = Number(existing.amount);
          const oldDate   = existing.date;
          const amountChanged = oldAmount !== newAmount;
          const dateChanged   = oldDate !== newDate;

          if (amountChanged || dateChanged) {
            const oldDateStr = oldDate.replace(/-/g, '_');
            const oldBillId  = `${oldDateStr}-khata-${profile.name}-${existing.id}`;
            const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(oldBillId);

            if (bill && bill.status !== 'cancelled') {
              if (amountChanged) {
                db.prepare('UPDATE bills SET subtotal = ?, total = ? WHERE id = ?')
                  .run(newAmount, newAmount, oldBillId);
              }

              const effectiveNewAmount = amountChanged ? newAmount : oldAmount;

              if (dateChanged) {
                db.prepare(`
                  UPDATE daily_sales
                  SET totalRevenue = MAX(totalRevenue - ?, 0),
                      totalBills   = MAX(totalBills - 1, 0),
                      updatedAt    = ?
                  WHERE date = ?
                `).run(oldAmount, now, oldDate);
                db.prepare(`
                  INSERT INTO daily_sales (date, totalRevenue, totalBills, totalExpenses, updatedAt)
                  VALUES (?, ?, 1, 0, ?)
                  ON CONFLICT(date) DO UPDATE SET
                    totalRevenue = totalRevenue + ?,
                    totalBills   = totalBills + 1,
                    updatedAt    = ?
                `).run(newDate, effectiveNewAmount, now, effectiveNewAmount, now);
              } else if (amountChanged) {
                db.prepare(`
                  UPDATE daily_sales
                  SET totalRevenue = MAX(totalRevenue + ?, 0),
                      updatedAt    = ?
                  WHERE date = ?
                `).run(newAmount - oldAmount, now, oldDate);
              }
            }
          }
        }
      }

      stmt.run(r.id, r.profile_id, r.type, r.amount, r.note || '', r.date, now);
      upserted += 1;
    }

    // Delete local transactions that no longer exist in cloud
    const localTxs   = db.prepare('SELECT * FROM khata_transactions').all();
    for (const tx of localTxs) {
      if (cloudTxIdSet.has(tx.id) || pendingIds.has(tx.id)) continue;
      if (tx.type === 'payment') {
        const profile = db.prepare('SELECT * FROM khata_profiles WHERE id = ?').get(tx.khataId);
        if (profile?.profileType === 'customer') {
          _removeCustomerPaymentSideEffects(db, tx, profile.name, now);
        }
      }
      db.prepare('DELETE FROM khata_transactions WHERE id = ?').run(tx.id);
    }
  });

  run();
  logger.info(`[pull] khata_transactions: upserted ${upserted} rows${skipped ? `, skipped ${skipped} pending` : ''}`);
}

function upsertEmployees(db, rows, pendingIds = new Set()) {
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
  let upserted = 0;
  let skipped = 0;
  const run = db.transaction(() => {
    for (const r of rows) {
      if (pendingIds.has(r.id)) { skipped += 1; continue; }
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
      upserted += 1;
    }
  });
  run();
  logger.info(`[pull] employees: upserted ${upserted} rows${skipped ? `, skipped ${skipped} pending` : ''}`);
}

function upsertSalaryRecords(db, rows, employeeMap, pendingIds = new Set()) {
  const stmt = db.prepare(`
    INSERT INTO salary_records (id, employeeId, employeeName, amount, payDate, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      amount   = excluded.amount,
      payDate  = excluded.payDate
  `);
  const now = new Date().toISOString();
  const cloudIds = [];
  let upserted = 0;
  let skipped = 0;
  const run = db.transaction(() => {
    for (const r of rows) {
      if (pendingIds.has(r.id)) { skipped += 1; continue; }
      const empName = employeeMap[r.employee_id] || '';
      const payDate = r.month ? `${r.month}-01` : now.slice(0, 10);
      stmt.run(r.id, r.employee_id, empName, r.amount, payDate, r.paid_at || now);
      cloudIds.push(r.id);
      upserted += 1;
    }
    // Remove local records that no longer exist in Supabase (e.g. deleted remotely or locally)
    const keepIds = [...new Set([...cloudIds, ...pendingIds])];
    if (keepIds.length > 0) {
      const placeholders = keepIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM salary_records WHERE id NOT IN (${placeholders})`).run(...keepIds);
    } else {
      db.prepare('DELETE FROM salary_records').run();
    }
  });
  run();
  logger.info(`[pull] salary_records: upserted ${upserted} rows, removed orphans${skipped ? `, skipped ${skipped} pending` : ''}`);
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

async function pullAllFromSupabase({ skipPush = false } = {}) {
  const client   = getClient();
  const branchId = getConfiguredBranchId();

  if (!client || !branchId) {
    logger.info('[pull] Supabase not configured — skipping startup pull');
    return;
  }

  logger.info('[pull] Starting startup pull from Supabase...');
  const db = getDb();
  const pendingByTable = getPendingIdsByTable(db);

  try {
    // Fetch all tables in parallel (order-independent fetches)
    const [cats, items, expenses, kProfiles, kTxs, employees, salaries] = await Promise.all([
      fetchAll(client, 'menu_categories',    branchId),
      fetchAll(client, 'menu_items',         branchId),
      fetchAll(client, 'expenses',           branchId),
      fetchAll(client, 'khata_profiles',     branchId),
      fetchAll(client, 'khata_transactions', branchId),
      fetchAll(client, 'employees',          branchId),
      fetchAll(client, 'salary_records',     branchId),
    ]);

    // Build employee name map for salary records
    const employeeMap = {};
    for (const e of employees) employeeMap[e.id] = e.name;

    // Upsert in FK-safe order
    if (cats.length)       upsertMenuCategories(db, cats, pendingByTable.get('menu_categories') || new Set());
    if (items.length)      upsertMenuItems(db, items, pendingByTable.get('menu_items') || new Set());
    if (expenses.length)   upsertExpenses(db, expenses, pendingByTable.get('expenses') || new Set());
    if (kProfiles.length)  upsertKhataProfiles(db, kProfiles, pendingByTable.get('khata_profiles') || new Set());
    if (kTxs.length)       upsertKhataTransactions(db, kTxs, pendingByTable.get('khata_transactions') || new Set());
    if (employees.length)  upsertEmployees(db, employees, pendingByTable.get('employees') || new Set());
    if (salaries.length)   upsertSalaryRecords(db, salaries, employeeMap, pendingByTable.get('salary_records') || new Set());

    logger.info('[pull] Startup pull complete');

    if (!skipPush) {
      await pushLocalToSupabase(db);
    }
  } catch (err) {
    logger.error('[pull] Startup pull failed:', err.message);
  }
}

module.exports = { pullAllFromSupabase, pushLocalToSupabase };
