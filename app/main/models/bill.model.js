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

function getTableNumberById(tableId) {
  if (!tableId) return null;
  const db = getDb();
  const table = db.prepare('SELECT number FROM tables WHERE id = ?').get(tableId);
  return table ? table.number : null;
}

// ─── Bills ──────────────────────────────────────────────────

function getTodayBillCount(dateStr) {
  const db = getDb();
  const result = db.prepare(
    "SELECT COUNT(*) as count FROM bills WHERE id LIKE ? || '-%'"
  ).get(dateStr);
  return result.count;
}

function insertBill(bill, stockAdjustments = []) {
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

    if (stockAdjustments.length > 0) {
      const getStock = db.prepare('SELECT * FROM stock_items WHERE id = ?');
      const updateStock = db.prepare('UPDATE stock_items SET quantity = ?, updatedAt = ? WHERE id = ?');
      const insertAdjustment = db.prepare(`
        INSERT INTO stock_adjustments (id, stockItemId, previousQty, adjustment, newQty, reason, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const adjustment of stockAdjustments) {
        const stockItem = getStock.get(adjustment.stockItemId);
        if (!stockItem) throw new Error(`Linked stock item not found: ${adjustment.stockItemId}`);
        if (stockItem.quantity < adjustment.consumeQty) {
          throw new Error(`Not enough stock for ${stockItem.name}. Available ${stockItem.quantity}, required ${adjustment.consumeQty}`);
        }
        const nextQty = stockItem.quantity - adjustment.consumeQty;
        const updatedAt = adjustment.createdAt || new Date().toISOString();

        updateStock.run(nextQty, updatedAt, stockItem.id);
        insertAdjustment.run(
          adjustment.id,
          stockItem.id,
          stockItem.quantity,
          -adjustment.consumeQty,
          nextQty,
          adjustment.reason || '',
          adjustment.createdAt || new Date().toISOString()
        );
      }
    }
  });

  insertBillTx();
  return bill;
}

function updateBill(bill) {
  const db = getDb();

  db.prepare(`
    UPDATE bills 
    SET subtotal = ?, total = ?
    WHERE id = ?
  `).run(bill.subtotal, bill.total, bill.id);

  return bill;
}

function insertHeldBill(heldBill) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO held_bills (id, tableId, subtotal, discount, total, paymentMethod, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      heldBill.id,
      heldBill.tableId,
      heldBill.subtotal,
      heldBill.discount,
      heldBill.total,
      heldBill.paymentMethod,
      heldBill.createdAt,
      heldBill.updatedAt
    );

    const insertItem = db.prepare(`
      INSERT INTO held_bill_items (
        id, heldBillId, menuItemId, name, description, isAvailable, basePrice, halfPrice, price, quantity, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of heldBill.items) {
      insertItem.run(
        item.id,
        heldBill.id,
        item.menuItemId,
        item.name,
        item.description || '',
        item.isAvailable ? 1 : 0,
        item.basePrice,
        item.halfPrice,
        item.price,
        item.quantity,
        item.createdAt
      );
    }
  });

  tx();
  return heldBill;
}

function getHeldBills() {
  const db = getDb();
  return db.prepare(`
    SELECT hb.*, t.number as tableNumber, COUNT(hbi.id) as itemCount
    FROM held_bills hb
    LEFT JOIN tables t ON t.id = hb.tableId
    LEFT JOIN held_bill_items hbi ON hbi.heldBillId = hb.id
    GROUP BY hb.id
    ORDER BY hb.updatedAt DESC
  `).all();
}

function getHeldBillById(id) {
  const db = getDb();
  const heldBill = db.prepare(`
    SELECT hb.*, t.number as tableNumber
    FROM held_bills hb
    LEFT JOIN tables t ON t.id = hb.tableId
    WHERE hb.id = ?
  `).get(id);
  if (!heldBill) return null;
  heldBill.items = db.prepare(`
    SELECT *
    FROM held_bill_items
    WHERE heldBillId = ?
    ORDER BY createdAt ASC
  `).all(id);
  return heldBill;
}

function deleteHeldBill(id) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM held_bill_items WHERE heldBillId = ?').run(id);
    db.prepare('DELETE FROM held_bills WHERE id = ?').run(id);
  });
  tx();
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

function getRecentBills(limit = 20) {
  const db = getDb();
  return db.prepare(`
    SELECT
      b.id,
      b.tableId,
      t.number AS tableNum,
      b.customerName,
      b.subtotal,
      b.discount,
      b.total,
      b.paymentMethod,
      b.status,
      b.createdAt,
      cb.id AS cancelledId,
      cb.billAmount AS cancelledBillAmount,
      cb.returnAmount,
      cb.reason AS cancellationReason,
      cb.createdAt AS cancelledAt
    FROM bills b
    LEFT JOIN tables t ON t.id = b.tableId
    LEFT JOIN cancelled_bills cb ON cb.billId = b.id
    ORDER BY b.createdAt DESC
    LIMIT ?
  `).all(limit);
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
    INSERT INTO discounted_bills (id, billId, tableNum, billAmount, discountAmount, finalAmount, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(record.id, record.billId, record.tableNum, record.billAmount, record.discountAmount, record.finalAmount, record.createdAt);
  return record;
}

function getDiscountedBills(filters = {}) {
  const db = getDb();
  const discountedConditions = [];
  const discountedParams = [];

  if (filters.from) {
    discountedConditions.push('db.createdAt >= ?');
    discountedParams.push(filters.from);
  }
  if (filters.to) {
    discountedConditions.push('db.createdAt <= ?');
    discountedParams.push(filters.to);
  }

  const discountedWhere = discountedConditions.length > 0
    ? `WHERE ${discountedConditions.join(' AND ')} AND NOT EXISTS (SELECT 1 FROM cancelled_bills cbx WHERE cbx.billId = db.billId)`
    : 'WHERE NOT EXISTS (SELECT 1 FROM cancelled_bills cbx WHERE cbx.billId = db.billId)';

  const billConditions = [
    'b.tableId IS NOT NULL',
    'NOT EXISTS (SELECT 1 FROM discounted_bills db2 WHERE db2.billId = b.id)',
  ];
  const billParams = [];

  if (filters.from) {
    billConditions.push('b.createdAt >= ?');
    billParams.push(filters.from);
  }
  if (filters.to) {
    billConditions.push('b.createdAt <= ?');
    billParams.push(filters.to);
  }

  const query = `
    SELECT *
    FROM (
      SELECT
        db.id AS id,
        db.billId AS billId,
        db.tableNum AS tableNum,
        db.billAmount AS billAmount,
        db.discountAmount AS discountAmount,
        db.finalAmount AS finalAmount,
        db.createdAt AS createdAt,
        0 AS returnAmount,
        '' AS reason,
        'discounted' AS rowType
      FROM discounted_bills db
      ${discountedWhere}

      UNION ALL

      SELECT
        b.id AS id,
        b.id AS billId,
        t.number AS tableNum,
        b.subtotal AS billAmount,
        b.discount AS discountAmount,
        b.total AS finalAmount,
        b.createdAt AS createdAt,
        0 AS returnAmount,
        '' AS reason,
        'table' AS rowType
      FROM bills b
      LEFT JOIN tables t ON t.id = b.tableId
      WHERE ${billConditions.join(' AND ')}
        AND b.status != 'cancelled'

      UNION ALL

      SELECT
        cb.id AS id,
        cb.billId AS billId,
        t.number AS tableNum,
        cb.billAmount AS billAmount,
        0 AS discountAmount,
        0 AS finalAmount,
        cb.createdAt AS createdAt,
        cb.returnAmount AS returnAmount,
        cb.reason AS reason,
        'cancelled' AS rowType
      FROM cancelled_bills cb
      JOIN bills b ON b.id = cb.billId
      LEFT JOIN tables t ON t.id = b.tableId
      WHERE 1 = 1
        ${filters.from ? 'AND cb.createdAt >= ?' : ''}
        ${filters.to ? 'AND cb.createdAt <= ?' : ''}
    ) combined
    ORDER BY createdAt DESC
  `;

  const cancelledParams = [];
  if (filters.from) cancelledParams.push(filters.from);
  if (filters.to) cancelledParams.push(filters.to);

  return db.prepare(query).all(...discountedParams, ...billParams, ...cancelledParams);
}

function cancelBill({ id, billId, billAmount = 0, returnAmount = 0, reason = '', createdAt }) {
  const db = getDb();
  const tx = db.transaction((record) => {
    const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(record.billId);
    if (!bill) {
      throw new Error('Bill not found');
    }

    if (bill.status === 'cancelled') {
      throw new Error('Bill is already cancelled');
    }

    const exists = db.prepare('SELECT id FROM cancelled_bills WHERE billId = ?').get(record.billId);
    if (exists) {
      throw new Error('Bill is already cancelled');
    }

    db.prepare(`
      INSERT INTO cancelled_bills (id, billId, billAmount, returnAmount, reason, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.billId,
      record.billAmount,
      record.returnAmount,
      record.reason,
      record.createdAt
    );

    db.prepare('UPDATE bills SET status = ? WHERE id = ?').run('cancelled', record.billId);
    return db.prepare('SELECT * FROM cancelled_bills WHERE id = ?').get(record.id);
  });

  return tx({ id, billId, billAmount, returnAmount, reason, createdAt });
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

// ─── POS Khata Bills ───────────────────────────────────────

function insertPosKhataBill(record) {
  const db = getDb();
  db.prepare(`
    INSERT INTO pos_khata_bills (id, billId, khataId, customerName, totalAmount, itemsNote, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(record.id, record.billId, record.khataId, record.customerName, record.totalAmount, record.itemsNote || '', record.createdAt);
  return record;
}

function getPosKhataBillsByDateRange(filters = {}) {
  const db = getDb();
  let query = `
    SELECT pkb.*, kp.name as khataName
    FROM pos_khata_bills pkb
    JOIN khata_profiles kp ON kp.id = pkb.khataId
    WHERE 1 = 1
  `;
  const params = [];
  if (filters.from) { query += ' AND pkb.createdAt >= ?'; params.push(filters.from); }
  if (filters.to)   { query += ' AND pkb.createdAt <= ?'; params.push(filters.to); }
  query += ' ORDER BY pkb.createdAt DESC';
  return db.prepare(query).all(...params);
}

module.exports = {
  getAllMenuItems, getMenuItemById, insertMenuItem, updateMenuItem, deleteMenuItem,
  getAllCategories, insertCategory,
  getAllTables, updateTableStatus, getTableNumberById,
  insertBill, getBills, getBillById, getRecentBills, getTopItems, getTodayBillCount,
  insertHeldBill, getHeldBills, getHeldBillById, deleteHeldBill,
  insertDiscountedBill, getDiscountedBills, cancelBill,
  getQuickKeys, setQuickKeys, updateBill,
  insertPosKhataBill, getPosKhataBillsByDateRange,
};
