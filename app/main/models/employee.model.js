const { getDb } = require('../db/index');
const { v4: uuidv4 } = require('uuid');

// ─── Employees ──────────────────────────────────────────────

function findAll(filters = {}) {
  const db = getDb();
  let query = 'SELECT * FROM employees';
  const params = [];
  const conditions = [];

  if (filters.isActive !== undefined) {
    conditions.push('isActive = ?');
    params.push(filters.isActive ? 1 : 0);
  }
  if (filters.position) {
    conditions.push('position = ?');
    params.push(filters.position);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY name ASC';
  return db.prepare(query).all(...params);
}

function findById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM employees WHERE id = ?').get(id) || null;
}

function create(employee) {
  const db = getDb();
  const nextId = employee.id || uuidv4();
  db.prepare(`
    INSERT INTO employees (id, name, position, phone, email, monthlySalary, hireDate, isActive, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    nextId, employee.name, employee.position || 'Staff',
    employee.phone || '', employee.email || '',
    employee.monthlySalary || 0, employee.hireDate || new Date().toISOString().split('T')[0],
    employee.isActive !== undefined ? (employee.isActive ? 1 : 0) : 1,
    employee.createdAt || new Date().toISOString()
  );
  return { ...employee, id: nextId };
}

function update(employee) {
  const db = getDb();
  db.prepare(`
    UPDATE employees SET name = ?, position = ?, phone = ?, email = ?, monthlySalary = ?, hireDate = ?, isActive = ?, updatedAt = ?
    WHERE id = ?
  `).run(
    employee.name, employee.position, employee.phone, employee.email,
    employee.monthlySalary, employee.hireDate,
    employee.isActive ? 1 : 0, employee.updatedAt || new Date().toISOString(),
    employee.id
  );
  return employee;
}

function remove(id) {
  const db = getDb();
  db.prepare('DELETE FROM employees WHERE id = ?').run(id);
}

// ─── Salary Records ─────────────────────────────────────────

function insertSalaryRecord(record) {
  const db = getDb();
  db.prepare(`
    INSERT INTO salary_records (id, employeeId, employeeName, amount, payDate, notes, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(record.id, record.employeeId, record.employeeName, record.amount, record.payDate, record.notes, record.createdAt);
  return record;
}

function getSalaryRecords(employeeId, filters = {}) {
  const db = getDb();
  let query = 'SELECT * FROM salary_records WHERE employeeId = ?';
  const params = [employeeId];

  if (filters.from) {
    query += ' AND payDate >= ?';
    params.push(filters.from);
  }
  if (filters.to) {
    query += ' AND payDate <= ?';
    params.push(filters.to);
  }

  query += ' ORDER BY payDate DESC';
  return db.prepare(query).all(...params);
}

function getAllSalaryRecords(filters = {}) {
  const db = getDb();
  let query = 'SELECT * FROM salary_records';
  const params = [];
  const conditions = [];

  if (filters.from) {
    conditions.push('payDate >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push('payDate <= ?');
    params.push(filters.to);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY payDate DESC';
  return db.prepare(query).all(...params);
}

function getSalaryRecordById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM salary_records WHERE id = ?').get(id) || null;
}

function updateSalaryRecord(record) {
  const db = getDb();
  db.prepare(`
    UPDATE salary_records
    SET amount = ?, payDate = ?, notes = ?, employeeName = ?
    WHERE id = ?
  `).run(record.amount, record.payDate, record.notes || '', record.employeeName, record.id);
  return record;
}

function removeSalaryRecord(id) {
  const db = getDb();
  db.prepare('DELETE FROM salary_records WHERE id = ?').run(id);
}

// ─── Attendance ─────────────────────────────────────────────

function markAttendance({ id, employeeId, date, status, hoursWorked, notes }) {
  const db = getDb();
  const normalizedStatus = status || 'present';
  const normalizedHours = hoursWorked !== undefined
    ? Number(hoursWorked)
    : (normalizedStatus === 'present' ? 12 : 0);
  const recordId = id || uuidv4();

  db.prepare(`
    INSERT OR REPLACE INTO attendance (id, employeeId, date, status, hoursWorked, notes, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    recordId,
    employeeId,
    date,
    normalizedStatus,
    Number.isFinite(normalizedHours) ? Math.max(0, normalizedHours) : 0,
    notes || '',
    new Date().toISOString()
  );
  return {
    id: recordId,
    employeeId,
    date,
    status: normalizedStatus,
    hoursWorked: Number.isFinite(normalizedHours) ? Math.max(0, normalizedHours) : 0,
    notes: notes || '',
  };
}

function getAttendance(filters = {}) {
  const db = getDb();
  let query = 'SELECT * FROM attendance';
  const params = [];
  const conditions = [];

  if (filters.employeeId) {
    conditions.push('employeeId = ?');
    params.push(filters.employeeId);
  }
  if (filters.from) {
    conditions.push('date >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push('date <= ?');
    params.push(filters.to);
  }
  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY date DESC';
  return db.prepare(query).all(...params);
}

module.exports = {
  findAll, findById, create, update, remove,
  insertSalaryRecord, getSalaryRecords, getAllSalaryRecords,
  getSalaryRecordById, updateSalaryRecord, removeSalaryRecord,
  markAttendance, getAttendance,
};
