const { v4: uuidv4 } = require('uuid');
const khataModel = require('../models/khata.model');
const expenseService = require('./expense.service');
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
  const linkedExpenses = expenseModel.findBySourceRecordIds(transactions.map((tx) => tx.id), 'khata');
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
    // Buyer payment from today's sale → record as expense
    await expenseService.add({
      description: `Khata Payment: ${profile.name}`,
      amount,
      category: 'Khata Payment',
      date: tx.date,
      notes: tx.note || '',
    });
  }

  return created;
}

async function updateTransaction(payload) {
  if (!payload?.id) throw new Error('Transaction id is required');
  const tx = khataModel.getTransactionById(payload.id);
  if (!tx) throw new Error('Transaction not found');

  const linkedExpense = expenseModel.findBySourceRecordId(tx.id, 'khata');
  if (linkedExpense) {
    throw new Error('This transaction is linked to an expense. Edit it from Expenses tab.');
  }

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
  syncService.pushKhataTransaction(saved).catch(() => {});
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
      const linkedExpense = expenseModel.findBySourceRecordId(tx.id, 'khata');
      if (linkedExpense) {
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
  addPayment,
  updateTransaction,
  deleteTransaction,
  deleteProfile,
  clearTransactions,
};
