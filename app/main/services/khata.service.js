const { v4: uuidv4 } = require('uuid');
const khataModel = require('../models/khata.model');
const expenseService = require('./expense.service');

async function getAllProfiles() {
  return khataModel.getAllProfiles();
}

async function getById(id) {
  const profile = khataModel.getProfileById(id);
  if (!profile) return null;
  const transactions = khataModel.getTransactionsByKhataId(id);
  return { profile, transactions };
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
    createdAt: new Date().toISOString(),
  };
  return khataModel.insertProfile(profile);
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
    date: payload.date || new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  };
  return khataModel.insertTransaction(tx);
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
    date: payload.date || new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  };
  const created = khataModel.insertTransaction(tx);

  if (source === 'today_sale') {
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

module.exports = {
  getAllProfiles,
  getById,
  addProfile,
  addDue,
  addPayment,
};
