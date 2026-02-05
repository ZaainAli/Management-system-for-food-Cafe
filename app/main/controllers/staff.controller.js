const salaryService = require('../services/salary.service');
const employeeModel = require('../models/employee.model');
const logger = require('../utils/logger');

async function getAll(filters = {}) {
  try {
    const employees = await employeeModel.findAll(filters);
    return { success: true, data: employees };
  } catch (err) {
    logger.error('staff:getAll failed', err);
    return { success: false, error: err.message };
  }
}

async function getById(id) {
  try {
    const employee = await employeeModel.findById(id);
    if (!employee) return { success: false, error: 'Employee not found' };
    return { success: true, data: employee };
  } catch (err) {
    logger.error('staff:getById failed', err);
    return { success: false, error: err.message };
  }
}

async function add(employee) {
  try {
    const created = await employeeModel.create(employee);
    logger.info(`Employee added: ${created.name}`);
    return { success: true, data: created };
  } catch (err) {
    logger.error('staff:add failed', err);
    return { success: false, error: err.message };
  }
}

async function update(payload) {
  try {
    const updated = await employeeModel.update(payload);
    return { success: true, data: updated };
  } catch (err) {
    logger.error('staff:update failed', err);
    return { success: false, error: err.message };
  }
}

async function remove(id) {
  try {
    await employeeModel.remove(id);
    logger.info(`Employee removed: ID ${id}`);
    return { success: true };
  } catch (err) {
    logger.error('staff:delete failed', err);
    return { success: false, error: err.message };
  }
}

async function addSalaryRecord(salary) {
  try {
    const record = await salaryService.addSalaryRecord(salary);
    logger.info(`Salary record added for employee ${salary.employeeId}`);
    return { success: true, data: record };
  } catch (err) {
    logger.error('staff:addSalaryRecord failed', err);
    return { success: false, error: err.message };
  }
}

async function getSalaryHistory(employeeId, filters = {}) {
  try {
    const history = await salaryService.getSalaryHistory(employeeId, filters);
    return { success: true, data: history };
  } catch (err) {
    logger.error('staff:getSalaryHistory failed', err);
    return { success: false, error: err.message };
  }
}

async function markAttendance(attendance) {
  try {
    const record = await employeeModel.markAttendance(attendance);
    return { success: true, data: record };
  } catch (err) {
    logger.error('staff:markAttendance failed', err);
    return { success: false, error: err.message };
  }
}

async function getAttendance(filters = {}) {
  try {
    const records = await employeeModel.getAttendance(filters);
    return { success: true, data: records };
  } catch (err) {
    logger.error('staff:getAttendance failed', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  getAll, getById, add, update, remove,
  addSalaryRecord, getSalaryHistory,
  markAttendance, getAttendance,
};
