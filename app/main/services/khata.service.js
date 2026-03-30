const { v4: uuidv4 } = require('uuid');
const khataModel = require('../models/khata.model');
const expenseModel = require('../models/expense.model');
const billModel = require('../models/bill.model');
const salesModel = require('../models/sales.model');
const billingService = require('./billing.service');
const syncService = require('./sync.service');
const { formatPkDate } = require('../utils/datetime');

async function getAllProfiles() {
  return khataModel.getAllProfiles();
}

async function getById(id) {
  const profile = khataModel.getProfileById(id);
  if (!profile) return null;
  const transactions = khataModel.getTransactionsByKhataId(id);
  const rawLinkedExpenses = expenseModel.findBySourceRecordIds(transactions.map((tx) => tx.id), 'khata');
  const linkedExpenses = rawLinkedExpenses.map((exp) => ({
    ...exp,
    sourceType: exp.source_type,
    sourceEntityId: exp.source_entity_id,
    sourceEntityName: exp.source_entity_name,
    sourceRecordId: exp.source_record_id,
  }));
  const linkedByRecordId = new Map(linkedExpenses.map((exp) => [exp.sourceRecordId, exp.id]));
  const enrichedTransactions = transactions.map((tx) => ({
    ...tx,
    linkedExpenseId: linkedByRecordId.get(tx.id) || null,
  }));
  return { profile, transactions: enrichedTransactions };
}

async function addProfile(payload) {
  if (!payload.name || !payload.name.trim()) throw new Error('Khata name is required');
  const existing = khataModel.getProfileByName(payload.name.trim());
  if (existing) throw new Error('Khata name must be unique');

  const profile = {
    id: uuidv4(),
    name: payload.name.trim(),
    phone: payload.phone ? String(payload.phone).trim() : '',
    businessDetails: payload.businessDetails ? String(payload.businessDetails).trim() : '',
    profileType: payload.profileType === 'customer' ? 'customer' : 'supplier',
    createdAt: new Date().toISOString(),
  };
  const created = khataModel.insertProfile(profile);
  syncService.pushKhataProfile(created).catch(() => {});
  return created;
}

function normalizeAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Amount must be a positive number');
  return parseFloat(value.toFixed(2));
}

async function addDue(payload) {
  if (!payload.khataId) throw new Error('Khata profile is required');
  const profile = khataModel.getProfileById(payload.khataId);
  if (!profile) throw new Error('Khata profile not found');

  const tx = {
    id: uuidv4(),
    khataId: payload.khataId,
    type: 'due',
    amount: normalizeAmount(payload.amount),
    paymentSource: null,
    note: payload.note ? String(payload.note).trim() : '',
    date: payload.date || formatPkDate(new Date()),
    createdAt: new Date().toISOString(),
  };
  const created = khataModel.insertTransaction(tx);
  syncService.pushKhataTransaction(created).catch(() => {});
  return created;
}

async function addPayment(payload) {
  if (!payload.khataId) throw new Error('Khata profile is required');
  const profile = khataModel.getProfileById(payload.khataId);
  if (!profile) throw new Error('Khata profile not found');
  // if (profile.balance <= 0) throw new Error('No outstanding dues to pay');

  const amount = normalizeAmount(payload.amount);
  // if (amount > profile.balance) throw new Error('Payment amount exceeds current dues');

  const source = payload.paymentSource || 'today_sale';
  if (!['today_sale', 'net_profit'].includes(source)) throw new Error('Invalid payment source');

  const tx = {
    id: uuidv4(),
    khataId: payload.khataId,
    type: 'payment',
    amount,
    paymentSource: source,
    note: payload.note ? String(payload.note).trim() : '',
    date: payload.date || formatPkDate(new Date()),
    createdAt: new Date().toISOString(),
  };
  const created = khataModel.insertTransaction(tx);
  syncService.pushKhataTransaction(created).catch(() => {});

  if (profile.profileType === 'customer') {
    // Seller paid us back → record as a sale/bill
    const dateStr = tx.date.replace(/-/g, '_');
    const billCount = billModel.getTodayBillCount(dateStr);
    const bill = {
      id: `${dateStr}-khata-${profile.name}-${created.id}`,
      tableId: null,
      customerName: profile.name,
      subtotal: amount,
      tax: 0,
      discount: 0,
      total: amount,
      paymentMethod: 'cash',
      status: 'completed',
      createdAt: new Date().toISOString(),
      items: [],
    };
    billModel.insertBill(bill);
    salesModel.addBillToDailySales({ date: tx.date, total: amount });
  } else if (source === 'today_sale') {
    // Buyer payment from today's sale → record as linked expense
    const expense = {
      id: uuidv4(),
      description: `Khata Payment: ${profile.name}`,
      amount,
      category: 'Khata Payment',
      date: tx.date,
      sourceType: 'khata',
      sourceEntityId: profile.id,
      sourceEntityName: profile.name,
      sourceRecordId: tx.id,
      notes: tx.note || '',
      createdAt: new Date().toISOString(),
    };
    expenseModel.insert(expense);
    salesModel.addExpenseToDailySales({ date: expense.date, amountDelta: expense.amount });
    syncService.pushExpense(expense).catch(() => {});
    syncService.pushKhataTransaction({ ...created, expenseId: expense.id }).catch(() => {});
  }

  return created;
}

async function updateDue(payload) {
  if (!payload?.id) throw new Error('Transaction id is required');
  const tx = khataModel.getTransactionById(payload.id);
  if (!tx) throw new Error('Transaction not found');
  if (tx.type !== 'due') throw new Error('Transaction is not a due type');

  const nextAmount = payload.amount !== undefined ? normalizeAmount(payload.amount) : tx.amount;
  const nextDate = payload.date || tx.date;
  const nextNote = payload.note !== undefined ? String(payload.note).trim() : tx.note;

  const updated = {
    ...tx,
    amount: nextAmount,
    date: nextDate,
    note: nextNote,
  };

  const saved = khataModel.updateTransaction(updated);
  syncService.pushKhataTransaction(saved).catch(() => {});
  return saved;
}

async function updateTransaction(payload) {
  if (!payload?.id) throw new Error('Transaction id is required');
  if (!payload.khataId) throw new Error('Khata profile is required');
  const profile = khataModel.getProfileById(payload.khataId);
  if (!profile) throw new Error('Khata profile not found');
  const tx = khataModel.getTransactionById(payload.id);
  if (!tx) throw new Error('Transaction not found');

  const nextAmount = payload.amount !== undefined ? normalizeAmount(payload.amount) : tx.amount;
  const nextDate = payload.date || tx.date;
  const nextNote = payload.note !== undefined ? String(payload.note).trim() : tx.note;

  let nextPaymentSource = tx.paymentSource;
  if (tx.type === 'payment') {
    if (payload.paymentSource !== undefined) {
      const source = payload.paymentSource || 'today_sale';
      if (!['today_sale', 'net_profit'].includes(source)) throw new Error('Invalid payment source');
      nextPaymentSource = source;
    } else if (!nextPaymentSource) {
      nextPaymentSource = 'today_sale';
    }
  } else {
    nextPaymentSource = null;
  }

  const updated = {
    ...tx,
    amount: nextAmount,
    date: nextDate,
    note: nextNote,
    paymentSource: nextPaymentSource,
  };
  const saved = khataModel.updateTransaction(updated);

  const amountChanged = tx.amount !== nextAmount;
  const dateChanged = tx.date !== nextDate;

  // ✅ Handle customer payment: update the linked bill
  if (profile.profileType === 'customer') {
    const billId = `${tx.date.replace(/-/g, '_')}-khata-${profile.name}-${tx.id}`;
    const existingBill = billModel.getBillById(billId);
    if (existingBill && (amountChanged || dateChanged)) {
      const updatedBill = {
        ...existingBill,
        subtotal: nextAmount,
        total: nextAmount,
        updatedAt: new Date().toISOString(),
      };
      billModel.updateBill(updatedBill);

      // Adjust daily_sales: reverse old bill total, apply new
      if (amountChanged || dateChanged) {
        salesModel.addBillToDailySales({ date: tx.date, total: -tx.amount });
        salesModel.addBillToDailySales({ date: nextDate, total: nextAmount });
      }
    }
    syncService.pushKhataTransaction({ ...saved, billId: existingBill ? existingBill.id : null }).catch(() => {});

  }
  else {
    // Handle supplier/buyer payment: update the linked expense
    const rawLinkedExpense = expenseModel.findBySourceRecordId(tx.id, 'khata');
    if (!rawLinkedExpense) throw new Error('Linked expense not found for the transaction');
   const linkedExpense = {
      ...rawLinkedExpense,
      sourceType: 'khata',
      sourceEntityId: profile.id,
      sourceEntityName: profile.name,
      sourceRecordId: tx.id,
    };
    
    if (amountChanged || dateChanged) {
      const updatedExpense = {
        ...linkedExpense,
        amount: nextAmount,
        date: nextDate,
        updatedAt: new Date().toISOString(),
      };
      expenseModel.update(updatedExpense);
      // Adjust daily_sales: reverse old, apply new
      salesModel.addExpenseToDailySales({ date: tx.date, amountDelta: -tx.amount });
      salesModel.addExpenseToDailySales({ date: nextDate, amountDelta: nextAmount });
      syncService.pushExpense(updatedExpense).catch(() => {});
    }
    syncService.pushKhataTransaction({ ...saved, expenseId: linkedExpense?.id || null }).catch(() => {});

  }
  return saved;
}

async function deleteTransaction(payload) {
  const id = payload?.id;
  if (!id) throw new Error('Transaction id is required');
  const tx = khataModel.getTransactionById(id);
  if (!tx) throw new Error('Transaction not found');

  if (tx.type === 'payment') {
    const profile = khataModel.getProfileById(tx.khataId);

    if (profile?.profileType === 'customer') {
      // Cancel the linked bill → shows in cancelled tab + subtracts from revenue
      const dateStr = tx.date.replace(/-/g, '_');
      const billId = `${dateStr}-khata-${profile.name}-${tx.id}`;
      const bill = billModel.getBillById(billId);
      if (bill && bill.status !== 'cancelled') {
        await billingService.cancelBill({
          billId,
          billAmount: tx.amount,
          returnAmount: 0,
          reason: `Khata transaction deleted: ${profile.name}`,
        });
      }
    } else {
      // Supplier: unlink the expense record
      const rawLinkedExpense = expenseModel.findBySourceRecordId(tx.id, 'khata');
      if (rawLinkedExpense) {
        const linkedExpense = {
          ...rawLinkedExpense,
          sourceType: rawLinkedExpense.source_type,
          sourceEntityId: rawLinkedExpense.source_entity_id,
          sourceEntityName: rawLinkedExpense.source_entity_name,
          sourceRecordId: rawLinkedExpense.source_record_id,
        };
        const unlinked = { ...linkedExpense, sourceType: 'manual', sourceEntityId: null, sourceEntityName: '', sourceRecordId: null, updatedAt: new Date().toISOString() };
        expenseModel.update(unlinked);
        syncService.pushExpense(unlinked).catch(() => {});
      }
    }
  }

  // Snapshot to trash before deleting
  syncService.pushDeletedItem({
    itemType: 'khata_transaction',
    itemId: tx.id,
    itemData: tx,
  }).catch(() => {});

  khataModel.removeTransaction(id);
  syncService.deleteKhataTransaction(id).catch(() => {});
  return { id };
}

async function deleteProfile(payload) {
  const id = payload?.id;
  if (!id) throw new Error('Khata profile id is required');
  const profile = khataModel.getProfileById(id);
  if (!profile) throw new Error('Khata profile not found');

  // Snapshot profile + all transactions to trash
  const transactions = khataModel.getTransactionsByKhataId(id);
  syncService.pushDeletedItem({
    itemType: 'khata_profile',
    itemId: profile.id,
    itemData: { ...profile, transactions },
  }).catch(() => {});

  expenseModel.unlinkKhataBySourceEntity(id, new Date().toISOString());

  khataModel.removeTransactionsByKhataId(id);
  khataModel.removeProfile(id);
  syncService.deleteKhataProfile(id).catch(() => {});
  return { id };
}

async function clearTransactions(payload) {
  const khataId = payload?.khataId;
  if (!khataId) throw new Error('Khata profile id is required');
  const profile = khataModel.getProfileById(khataId);
  if (!profile) throw new Error('Khata profile not found');

  // Keep expense history: convert khata-linked expenses to manual before clearing khata transactions.
  expenseModel.unlinkKhataBySourceEntity(khataId, new Date().toISOString());

  khataModel.removeTransactionsByKhataId(khataId);
  return { khataId };
}

module.exports = {
  getAllProfiles,
  getById,
  addProfile,
  addDue,
  updateDue,
  addPayment,
  updateTransaction,
  deleteTransaction,
  deleteProfile,
  clearTransactions,
};
