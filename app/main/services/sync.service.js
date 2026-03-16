const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

let _client = null;

function getClient() {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      _client = createClient(url, key, {
        auth: { persistSession: false }, // no localStorage in Node.js main process
      });
    }
  }
  return _client;
}

function getBranchId() {
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

/** Shared helper — upsert a single row, log on error */
async function upsert(table, row, conflict) {
  try {
    const client = getClient();
    const branchId = getBranchId();
    if (!client || !branchId) return;
    const { error } = await client.from(table).upsert(row, { onConflict: conflict });
    if (error) logger.error(`[sync] ${table} upsert failed:`, error.message);
  } catch (err) {
    logger.error(`[sync] ${table} upsert error:`, err.message);
  }
}

/** Shared helper — delete a row by id, log on error */
async function del(table, id) {
  try {
    const client = getClient();
    if (!client || !getBranchId()) return;
    const { error } = await client.from(table).delete().eq('id', id);
    if (error) logger.error(`[sync] ${table} delete failed:`, error.message);
  } catch (err) {
    logger.error(`[sync] ${table} delete error:`, err.message);
  }
}

// ─── daily_sales ─────────────────────────────────────────────────────────────

/**
 * Push the current daily_sales row for a given date to Supabase.
 * Fire-and-forget — call without await so it never blocks the billing flow.
 */
async function pushDailySales({ date, totalRevenue, totalBills, totalExpenses }) {
  await upsert('daily_sales', {
    branch_id:      getBranchId(),
    date,
    total_revenue:  Math.max(0, totalRevenue  || 0),
    bill_count:     Math.max(0, totalBills    || 0),
    total_expenses: Math.max(0, totalExpenses || 0),
  }, 'branch_id,date');
}

// ─── expenses ────────────────────────────────────────────────────────────────

async function pushExpense(expense) {
  await upsert('expenses', {
    id:               expense.id,
    branch_id:        getBranchId(),
    category:         expense.category,
    description:      expense.description || null,
    amount:           expense.amount,
    date:             expense.date,
    source_type:      expense.sourceType || 'manual',
    source_entity_id: expense.sourceEntityId || null,
    source_record_id: expense.sourceRecordId || null,
  }, 'id');
}

async function deleteExpense(id) {
  await del('expenses', id);
}

// ─── menu categories ─────────────────────────────────────────────────────────

async function pushMenuCategory(cat) {
  await upsert('menu_categories', {
    id:        cat.id,
    branch_id: getBranchId(),
    name:      cat.name,
  }, 'id');
}

// ─── menu items ──────────────────────────────────────────────────────────────

async function pushMenuItem(item) {
  await upsert('menu_items', {
    id:          item.id,
    branch_id:   getBranchId(),
    category_id: item.categoryId || null,
    name:        item.name,
    price:       item.price,
    available:   item.isAvailable !== undefined ? Boolean(item.isAvailable) : true,
  }, 'id');
}

async function deleteMenuItem(id) {
  await del('menu_items', id);
}

// ─── khata profiles ──────────────────────────────────────────────────────────

async function pushKhataProfile(profile) {
  await upsert('khata_profiles', {
    id:           profile.id,
    branch_id:    getBranchId(),
    name:         profile.name,
    phone:        profile.phone || null,
    notes:        profile.businessDetails || null,
    profile_type: profile.profileType || 'supplier',
  }, 'id');
}

async function deleteKhataProfile(id) {
  await del('khata_profiles', id);
}

// ─── khata transactions ───────────────────────────────────────────────────────

async function pushKhataTransaction(tx) {
  await upsert('khata_transactions', {
    id:             tx.id,
    profile_id:     tx.khataId,
    branch_id:      getBranchId(),
    type:           tx.type,
    amount:         tx.amount,
    note:           tx.note || null,
    date:           tx.date,
    payment_source: tx.paymentSource || null,
    expense_id:     tx.expenseId || null,
  }, 'id');
}

async function deleteKhataTransaction(id) {
  await del('khata_transactions', id);
}

// ─── employees ───────────────────────────────────────────────────────────────

async function pushEmployee(employee) {
  await upsert('employees', {
    id:        employee.id,
    branch_id: getBranchId(),
    name:      employee.name,
    role:      employee.position || null,
    phone:     employee.phone || null,
    salary:    employee.monthlySalary || 0,
    hire_date: employee.hireDate || null,
    active:    employee.isActive !== undefined ? Boolean(employee.isActive) : true,
  }, 'id');
}

// ─── salary records ──────────────────────────────────────────────────────────

async function pushSalaryRecord(record) {
  // Supabase salary_records.month is 'YYYY-MM'; derive from payDate
  const month = record.payDate ? record.payDate.slice(0, 7) : new Date().toISOString().slice(0, 7);
  await upsert('salary_records', {
    id:          record.id,
    employee_id: record.employeeId,
    branch_id:   getBranchId(),
    amount:      record.amount,
    month,
    paid_at:     record.createdAt || new Date().toISOString(),
  }, 'id');
}

async function deleteSalaryRecord(id) {
  await del('salary_records', id);
}

async function pushDeletedItem({ branchId, itemType, itemId, itemData }) {
  const client = getClient();
  const resolvedBranchId = branchId || getBranchId();
  console.log(`[trash] pushDeletedItem called — type=${itemType} id=${itemId} branchId=${resolvedBranchId} hasClient=${!!client}`);
  if (!client || !resolvedBranchId) {
    console.error(`[trash] skipped — missing client or branchId`);
    return;
  }
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { error } = await client.from('deleted_items').insert({
      branch_id:  resolvedBranchId,
      item_type:  itemType,
      item_id:    String(itemId),
      item_data:  itemData,
      deleted_by: 'electron',
      expires_at: expiresAt,
    });
    if (error) {
      console.error(`[trash] insert failed:`, error.message, error.details, error.hint);
      logger.error(`[sync] deleted_items insert failed:`, error.message);
    } else {
      console.log(`[trash] insert success — type=${itemType} id=${itemId}`);
    }
  } catch (err) {
    console.error(`[trash] insert exception:`, err.message);
    logger.error(`[sync] deleted_items insert error:`, err.message);
  }
}

module.exports = {
  pushDailySales,
  pushExpense,
  deleteExpense,
  pushMenuCategory,
  pushMenuItem,
  deleteMenuItem,
  pushKhataProfile,
  deleteKhataProfile,
  pushKhataTransaction,
  deleteKhataTransaction,
  pushEmployee,
  pushSalaryRecord,
  deleteSalaryRecord,
  pushDeletedItem,
};
