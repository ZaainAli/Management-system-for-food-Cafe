const employeeModel = require('../models/employee.model');
const expenseModel = require('../models/expense.model');
const salesModel = require('../models/sales.model');
const syncService = require('./sync.service');
const { v4: uuidv4 } = require('uuid');

const VALID_TYPES = ['salary', 'bonus', 'advance', 'repayment'];
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

async function addSalaryRecord({ employeeId, amount, payDate, notes = '', type = 'salary', paymentSource = 'manual', subtractFromAdvance = false }) {
  const employee = await employeeModel.findById(employeeId);
  if (!employee) throw new Error('Employee not found');
  if (!employee.isActive) throw new Error('Salary cannot be issued to a non-active employee');
  if (!amount || amount <= 0) throw new Error('Amount must be positive');
  if (!payDate) throw new Error('Pay date is required');
  if (paymentSource === 'subtract_advance' && type !== 'salary') {
    throw new Error('Subtract from Advance can only be used when type is Salary');
  }

  const recordType = VALID_TYPES.includes(type) ? type : 'salary';
  const source = paymentSource === 'subtract_advance' ? 'manual' : (VALID_SOURCES.includes(paymentSource) ? paymentSource : 'manual');

  const record = {
    id: uuidv4(),
    employeeId,
    employeeName: employee.name,
    amount: parseFloat(parseFloat(amount).toFixed(2)),
    payDate,
    notes,
    type: recordType,
    paymentSource: source,
    createdAt: new Date().toISOString(),
  };

  employeeModel.insertSalaryRecord(record);
  syncService.pushSalaryRecord(record).catch(() => {});

  if (subtractFromAdvance) {
    const advanceRecord = {
      id: uuidv4(),
      employeeId,
      employeeName: employee.name,
      amount: -parseFloat(parseFloat(amount).toFixed(2)),
      payDate,
      notes: notes || 'Advance repayment',
      type: 'repayment',
      paymentSource: 'manual',
      createdAt: new Date().toISOString(),
    };
    employeeModel.insertSalaryRecord(advanceRecord);
    syncService.pushSalaryRecord(advanceRecord).catch(() => {});
  }

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
    amount: parseFloat(parseFloat(amount).toFixed(2)),
    payDate,
    notes: notes || '',
    type: recordType,
  };

  employeeModel.updateSalaryRecord(updated);
  syncService.pushSalaryRecord(updated).catch(() => {});

  // Sync linked expense if exists
  const rawLinkedExpense = expenseModel.findBySourceRecordId(id, 'salary');
  if (rawLinkedExpense) {
    const linkedExpense = {
      ...rawLinkedExpense,
      sourceType: rawLinkedExpense.source_type,
      sourceEntityId: rawLinkedExpense.source_entity_id,
      sourceEntityName: rawLinkedExpense.source_entity_name,
      sourceRecordId: rawLinkedExpense.source_record_id,
    };
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
    syncService.pushExpense(newExpense).catch(() => {});
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
  const rawLinkedExpense = expenseModel.findBySourceRecordId(id, 'salary');
  if (rawLinkedExpense) {
    const linkedExpense = {
      ...rawLinkedExpense,
      sourceType: rawLinkedExpense.source_type,
      sourceEntityId: rawLinkedExpense.source_entity_id,
      sourceEntityName: rawLinkedExpense.source_entity_name,
      sourceRecordId: rawLinkedExpense.source_record_id,
    };
    expenseModel.remove(linkedExpense.id);
    // delete from sync and adjust daily sales
    syncService.deleteExpense(linkedExpense.id).catch(() => {});
    salesModel.addExpenseToDailySales({ date: linkedExpense.date, amountDelta: -linkedExpense.amount });
  }

  employeeModel.removeSalaryRecord(id);
  syncService.deleteSalaryRecord(id).catch(() => {});
}

module.exports = { addSalaryRecord, getSalaryHistory, updateSalaryRecord, deleteSalaryRecord };
