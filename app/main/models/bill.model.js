const { getDb } = require('../db/index');

// ─── Menu Items ─────────────────────────────────────────────

function getAllMenuItems() {
  const db = getDb();
  return db.prepare(`
    SELECT mi.*, mc.name as categoryName
    FROM menu_items mi
    LEFT JOIN menu_categories mc ON mi.categoryId = mc.id
    ORDER BY mc.name ASC, mi.name ASC
  `).all();
}

function getMenuItemById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id) || null;
}

function insertMenuItem(item) {
  const db = getDb();
  db.prepare(`
    INSERT INTO menu_items (id, name, description, price, halfPrice, categoryId, isAvailable, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(item.id, item.name, item.description, item.price, item.halfPrice, item.categoryId, item.isAvailable ? 1 : 0, item.createdAt);
  return item;
}

function updateMenuItem(item) {
  const db = getDb();
  db.prepare(`
    UPDATE menu_items SET name = ?, description = ?, price = ?, halfPrice = ?, categoryId = ?, isAvailable = ?, updatedAt = ?
    WHERE id = ?
  `).run(item.name, item.description, item.price, item.halfPrice, item.categoryId, item.isAvailable ? 1 : 0, item.updatedAt, item.id);
  return item;
}

function deleteMenuItem(id) {
  const db = getDb();
  const tx = db.transaction((menuItemId) => {
    const usage = db.prepare('SELECT COUNT(*) as count FROM bill_items WHERE menuItemId = ?').get(menuItemId);
    if (usage.count > 0) {
      throw new Error('Cannot delete this item because it exists in previous bills. Mark it unavailable instead.');
    }

    // Remove shortcut mappings first to satisfy FK constraints.
    db.prepare('DELETE FROM quick_keys WHERE menuItemId = ?').run(menuItemId);
    db.prepare('DELETE FROM menu_items WHERE id = ?').run(menuItemId);
  });

  tx(id);
}

// ─── Menu Categories ────────────────────────────────────────

function getAllCategories() {
  const db = getDb();
  return db.prepare('SELECT * FROM menu_categories ORDER BY name ASC').all();
}

function insertCategory(category) {
  const db = getDb();
  db.prepare('INSERT INTO menu_categories (id, name, createdAt) VALUES (?, ?, ?)')
    .run(category.id, category.name, category.createdAt);
  return category;
}

// ─── Tables ─────────────────────────────────────────────────

function getAllTables() {
  const db = getDb();
  return db.prepare('SELECT * FROM tables ORDER BY number ASC').all();
}

function updateTableStatus(tableId, status) {
  const db = getDb();
  db.prepare('UPDATE tables SET status = ? WHERE id = ?').run(status, tableId);
  return db.prepare('SELECT * FROM tables WHERE id = ?').get(tableId);
}

// ─── Bills ──────────────────────────────────────────────────

function getTodayBillCount(dateStr) {
  const db = getDb();
  const result = db.prepare(
    "SELECT COUNT(*) as count FROM bills WHERE id LIKE ? || '-%'"
  ).get(dateStr);
  return result.count;
}

function insertBill(bill) {
  const db = getDb();

  // Use a transaction to insert bill + line items atomically
  const insertBillTx = db.transaction(() => {
    db.prepare(`
      INSERT INTO bills (id, tableId, customerName, subtotal, tax, discount, total, paymentMethod, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(bill.id, bill.tableId, bill.customerName, bill.subtotal, bill.tax, bill.discount, bill.total, bill.paymentMethod, bill.status, bill.createdAt);

    const insertItem = db.prepare(`
      INSERT INTO bill_items (id, billId, menuItemId, name, price, quantity, lineTotal)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of bill.items) {
      insertItem.run(item.id, bill.id, item.menuItemId, item.name, item.price, item.quantity, item.lineTotal);
    }
  });

  insertBillTx();
  return bill;
}

function getBills(filters = {}) {
  const db = getDb();
  let query = 'SELECT * FROM bills';
  const params = [];
  const conditions = [];

  if (filters.from) {
    conditions.push('createdAt >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push('createdAt <= ?');
    params.push(filters.to);
  }
  if (filters.paymentMethod) {
    conditions.push('paymentMethod = ?');
    params.push(filters.paymentMethod);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY createdAt DESC';

  const bills = db.prepare(query).all(...params);

  // Attach line items to each bill
  const getItems = db.prepare('SELECT * FROM bill_items WHERE billId = ?');
  return bills.map(bill => ({
    ...bill,
    items: getItems.all(bill.id),
  }));
}

function getBillById(id) {
  const db = getDb();
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(id);
  if (!bill) return null;
  bill.items = db.prepare('SELECT * FROM bill_items WHERE billId = ?').all(id);
  return bill;
}

function getTopItems(filters = {}) {
  const db = getDb();
  let query = `
    SELECT bi.name as name, SUM(bi.quantity) as quantity, SUM(bi.lineTotal) as revenue
    FROM bill_items bi
    JOIN bills b ON b.id = bi.billId
  `;
  const params = [];
  const conditions = [];

  if (filters.from) {
    conditions.push('b.createdAt >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push('b.createdAt <= ?');
    params.push(filters.to);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' GROUP BY bi.name ORDER BY revenue DESC';
  if (filters.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }

  return db.prepare(query).all(...params);
}

// ─── Discounted Bills ──────────────────────────────────────

function insertDiscountedBill(record) {
  const db = getDb();
  db.prepare(`
    INSERT INTO discounted_bills (id, billId, billAmount, discountAmount, finalAmount, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(record.id, record.billId, record.billAmount, record.discountAmount, record.finalAmount, record.createdAt);
  return record;
}

function getDiscountedBills(filters = {}) {
  const db = getDb();
  let query = 'SELECT * FROM discounted_bills';
  const params = [];
  const conditions = [];

  if (filters.from) {
    conditions.push('createdAt >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push('createdAt <= ?');
    params.push(filters.to);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY createdAt DESC';
  return db.prepare(query).all(...params);
}

// ─── Quick Keys ────────────────────────────────────────────

function getQuickKeys() {
  const db = getDb();
  return db.prepare(`
    SELECT qk.key, qk.menuItemId, mi.name, mi.price, mi.halfPrice, mi.isAvailable
    FROM quick_keys qk
    JOIN menu_items mi ON qk.menuItemId = mi.id
    ORDER BY qk.key ASC
  `).all();
}

function setQuickKeys(assignments) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM quick_keys').run();
    const insert = db.prepare('INSERT INTO quick_keys (key, menuItemId) VALUES (?, ?)');
    for (const { key, menuItemId } of assignments) {
      insert.run(key, menuItemId);
    }
  });
  tx();
}

module.exports = {
  getAllMenuItems, getMenuItemById, insertMenuItem, updateMenuItem, deleteMenuItem,
  getAllCategories, insertCategory,
  getAllTables, updateTableStatus,
  insertBill, getBills, getBillById, getTopItems, getTodayBillCount,
  insertDiscountedBill, getDiscountedBills,
  getQuickKeys, setQuickKeys,
};
