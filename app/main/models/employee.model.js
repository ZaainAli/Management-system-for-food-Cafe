const { getDb } = require('../db/index');

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
  db.prepare(`
    INSERT INTO employees (id, name, position, phone, email, monthlySalary, hireDate, isActive, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    employee.id, employee.name, employee.position || 'Staff',
    employee.phone || '', employee.email || '',
    employee.monthlySalary || 0, employee.hireDate || new Date().toISOString().split('T')[0],
    employee.isActive !== undefined ? (employee.isActive ? 1 : 0) : 1,
    employee.createdAt || new Date().toISOString()
  );
  return employee;
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

// ─── Attendance ─────────────────────────────────────────────

function markAttendance({ id, employeeId, date, status, notes }) {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO attendance (id, employeeId, date, status, notes, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, employeeId, date, status || 'present', notes || '', new Date().toISOString());
  return { id, employeeId, date, status, notes };
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
  markAttendance, getAttendance,
};
