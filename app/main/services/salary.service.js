const employeeModel = require('../models/employee.model');
const { v4: uuidv4 } = require('uuid');

async function addSalaryRecord({ employeeId, amount, payDate, notes = '' }) {
  const employee = await employeeModel.findById(employeeId);
  if (!employee) throw new Error('Employee not found');
  if (!amount || amount <= 0) throw new Error('Salary amount must be positive');
  if (!payDate) throw new Error('Pay date is required');

  const record = {
    id: uuidv4(),
    employeeId,
    employeeName: employee.name,
    amount: parseFloat(amount),
    payDate,
    notes,
    createdAt: new Date().toISOString(),
  };

  return employeeModel.insertSalaryRecord(record);
}

async function getSalaryHistory(employeeId, filters = {}) {
  const employee = await employeeModel.findById(employeeId);
  if (!employee) throw new Error('Employee not found');

  const records = await employeeModel.getSalaryRecords(employeeId, filters);

  // Compute totals
  const totalPaid = records.reduce((sum, r) => sum + r.amount, 0);

  return {
    employee: { id: employee.id, name: employee.name, position: employee.position },
    records,
    totalPaid: parseFloat(totalPaid.toFixed(2)),
  };
}

module.exports = { addSalaryRecord, getSalaryHistory };
