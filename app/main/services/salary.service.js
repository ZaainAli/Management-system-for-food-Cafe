const employeeModel = require('../models/employee.model');
const expenseModel = require('../models/expense.model');
const salesModel = require('../models/sales.model');
const syncService = require('./sync.service');
const { v4: uuidv4 } = require('uuid');

const VALID_TYPES = ['salary', 'bonus', 'advance'];
const VALID_SOURCES = ['manual', 'today_sale'];

function buildExpenseForSalaryRecord(record, employee) {
  const typeLabel = record.type === 'bonus' ? 'Bonus' : record.type === 'advance' ? 'Advance' : 'Salary';
  return {
    id: uuidv4(),
    description: `${typeLabel} - ${employee.name}`,
    amount: record.amount,
    category: 'Salary',
    date: record.payDate,
    sourceType: 'salary',
    sourceEntityId: employee.id,
    sourceEntityName: employee.name,
    sourceRecordId: record.id,
    notes: record.notes || '',
    createdAt: new Date().toISOString(),
  };
}

async function addSalaryRecord({ employeeId, amount, payDate, notes = '', type = 'salary', paymentSource = 'manual' }) {
  const employee = await employeeModel.findById(employeeId);
  if (!employee) throw new Error('Employee not found');
  if (!employee.isActive) throw new Error('Salary cannot be issued to a non-active employee');
  if (!amount || amount <= 0) throw new Error('Amount must be positive');
  if (!payDate) throw new Error('Pay date is required');

  const recordType = VALID_TYPES.includes(type) ? type : 'salary';
  const source = VALID_SOURCES.includes(paymentSource) ? paymentSource : 'manual';

  const record = {
    id: uuidv4(),
    employeeId,
    employeeName: employee.name,
    amount: parseFloat(amount),
    payDate,
    notes,
    type: recordType,
    paymentSource: source,
    createdAt: new Date().toISOString(),
  };

  employeeModel.insertSalaryRecord(record);
  syncService.pushSalaryRecord(record).catch(() => {});

  if (source === 'today_sale') {
    const expense = buildExpenseForSalaryRecord(record, employee);
    expenseModel.insert(expense);
    salesModel.addExpenseToDailySales({ date: expense.date, amountDelta: expense.amount });
    syncService.pushExpense(expense).catch(() => {});
  }

  return record;
}

async function getSalaryHistory(employeeId, filters = {}) {
  const employee = await employeeModel.findById(employeeId);
  if (!employee) throw new Error('Employee not found');

  const records = await employeeModel.getSalaryRecords(employeeId, filters);
  const totalPaid = records.reduce((sum, r) => sum + r.amount, 0);

  return {
    employee: { id: employee.id, name: employee.name, position: employee.position },
    records,
    totalPaid: parseFloat(totalPaid.toFixed(2)),
  };
}

async function updateSalaryRecord({ id, amount, payDate, notes, type }) {
  const existing = employeeModel.getSalaryRecordById(id);
  if (!existing) throw new Error('Salary record not found');
  if (!amount || amount <= 0) throw new Error('Amount must be positive');
  if (!payDate) throw new Error('Pay date is required');

  const recordType = VALID_TYPES.includes(type) ? type : existing.type || 'salary';

  const updated = {
    ...existing,
    amount: parseFloat(amount),
    payDate,
    notes: notes || '',
    type: recordType,
  };

  employeeModel.updateSalaryRecord(updated);
  syncService.pushSalaryRecord(updated).catch(() => {});

  // Sync linked expense if exists
  const linkedExpense = expenseModel.findBySourceRecordId(id, 'salary');
  if (linkedExpense) {
    const typeLabel = recordType === 'bonus' ? 'Bonus' : recordType === 'advance' ? 'Advance' : 'Salary';
    const oldDate = linkedExpense.date;
    const newExpense = {
      ...linkedExpense,
      description: `${typeLabel} - ${existing.employeeName}`,
      amount: updated.amount,
      date: payDate,
      notes: notes || '',
      updatedAt: new Date().toISOString(),
    };
    expenseModel.update(newExpense);
    // Adjust daily_sales if amount or date changed
    if (oldDate !== payDate || linkedExpense.amount !== updated.amount) {
      salesModel.addExpenseToDailySales({ date: oldDate, amountDelta: -linkedExpense.amount });
      salesModel.addExpenseToDailySales({ date: payDate, amountDelta: updated.amount });
    }
  }

  return updated;
}

async function deleteSalaryRecord(id) {
  const existing = employeeModel.getSalaryRecordById(id);
  if (!existing) throw new Error('Salary record not found');

  // Remove linked expense first
  const linkedExpense = expenseModel.findBySourceRecordId(id, 'salary');
  if (linkedExpense) {
    expenseModel.remove(linkedExpense.id);
    salesModel.addExpenseToDailySales({ date: linkedExpense.date, amountDelta: -linkedExpense.amount });
  }

  employeeModel.removeSalaryRecord(id);
  syncService.deleteSalaryRecord(id).catch(() => {});
}

module.exports = { addSalaryRecord, getSalaryHistory, updateSalaryRecord, deleteSalaryRecord };
