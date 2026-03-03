const billModel = require('../models/bill.model');
const stockModel = require('../models/stock.model');
const salesModel = require('../models/sales.model');
const syncService = require('./sync.service');
const { v4: uuidv4 } = require('uuid');

// ─── Menu Items ─────────────────────────────────────────────

async function getMenuItems() {
  return billModel.getAllMenuItems();
}

async function addMenuItem(item) {
  if (!item.name || !item.price) {
    throw new Error('Menu item must have a name and price');
  }
  if (item.price < 0) {
    throw new Error('Price cannot be negative');
  }
  if (item.halfPrice !== undefined && item.halfPrice !== null && item.halfPrice < 0) {
    throw new Error('Half price cannot be negative');
  }
  const newItem = {
    id: uuidv4(),
    name: item.name,
    description: item.description || '',
    price: parseFloat(item.price),
    halfPrice: item.halfPrice !== undefined && item.halfPrice !== null ? parseFloat(item.halfPrice) : null,
    categoryId: item.categoryId || null,
    isAvailable: item.isAvailable !== undefined ? item.isAvailable : true,
    createdAt: new Date().toISOString(),
  };
  const created = billModel.insertMenuItem(newItem);
  syncService.pushMenuItem(created).catch(() => {});
  return created;
}

async function updateMenuItem(id, updates) {
  const item = await billModel.getMenuItemById(id);
  if (!item) throw new Error('Menu item not found');
  if (updates.halfPrice !== undefined && updates.halfPrice !== null && updates.halfPrice < 0) {
    throw new Error('Half price cannot be negative');
  }
  const updated = { ...item, ...updates, updatedAt: new Date().toISOString() };
  const saved = billModel.updateMenuItem(updated);
  syncService.pushMenuItem(saved).catch(() => {});
  return saved;
}

async function deleteMenuItem(id) {
  const item = await billModel.getMenuItemById(id);
  if (!item) throw new Error('Menu item not found');
  const result = billModel.deleteMenuItem(id);
  syncService.deleteMenuItem(id).catch(() => {});
  return result;
}

// ─── Menu Categories ────────────────────────────────────────

async function getMenuCategories() {
  return billModel.getAllCategories();
}

async function addMenuCategory(category) {
  if (!category.name) throw new Error('Category must have a name');
  const newCategory = {
    id: uuidv4(),
    name: category.name,
    createdAt: new Date().toISOString(),
  };
  const created = billModel.insertCategory(newCategory);
  syncService.pushMenuCategory(created).catch(() => {});
  return created;
}

// ─── Bill Creation ──────────────────────────────────────────

async function createBill({ items, tableId, discount = 0, paymentMethod = 'cash', customerName = '' }) {
  if (!items || items.length === 0) {
    throw new Error('Bill must have at least one item');
  }

  // Validate all items exist and calculate subtotal
  let subtotal = 0;
  const lineItems = [];
  const stockConsumptionById = new Map();
  for (const item of items) {
    const menuItem = await billModel.getMenuItemById(item.menuItemId);
    if (!menuItem) throw new Error(`Menu item not found: ${item.menuItemId}`);
    if (!menuItem.isAvailable) throw new Error(`Item unavailable: ${menuItem.name}`);

    const qty = parseInt(item.quantity) || 1;
    const unitPrice = item.priceOverride !== undefined && item.priceOverride !== null
      ? Number(item.priceOverride)
      : menuItem.price;
    if (!Number.isFinite(unitPrice)) throw new Error('Invalid item price');
    if (unitPrice < 0) throw new Error('Item price cannot be negative');
    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;

    lineItems.push({
      id: uuidv4(),
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: unitPrice,
      quantity: qty,
      lineTotal,
    });

    // Link stock by exact item name (case-insensitive).
    const stockItem = stockModel.findByName(menuItem.name);
    if (stockItem) {
      const existing = stockConsumptionById.get(stockItem.id);
      if (existing) {
        existing.consumeQty += qty;
      } else {
        stockConsumptionById.set(stockItem.id, {
          stockItemId: stockItem.id,
          stockItemName: stockItem.name,
          stockUnit: stockItem.unit,
          availableQty: stockItem.quantity,
          consumeQty: qty,
        });
      }
    }
  }

  for (const linked of stockConsumptionById.values()) {
    if (linked.availableQty < linked.consumeQty) {
      throw new Error(`Not enough stock for ${linked.stockItemName}. Available ${linked.availableQty}, required ${linked.consumeQty}`);
    }
  }

  const discountAmount = Math.min(discount, subtotal); // flat discount, capped at subtotal
  const total = subtotal - discountAmount;

  const now = new Date();
  const dateStr = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}`;
  const billNum = billModel.getTodayBillCount(dateStr) + 1;
  const billId = `${dateStr}-${String(billNum).padStart(2, '0')}`;

  const bill = {
    id: billId,
    tableId: tableId || null,
    customerName,
    items: lineItems,
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: 0,
    discount: parseFloat(discountAmount.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
    paymentMethod,
    status: 'completed',
    createdAt: new Date().toISOString(),
  };

  const stockAdjustments = Array.from(stockConsumptionById.values()).map(linked => ({
    id: uuidv4(),
    stockItemId: linked.stockItemId,
    stockItemName: linked.stockItemName,
    consumeQty: linked.consumeQty,
    stockUnit: linked.stockUnit,
    reason: `Consumed by POS bill ${bill.id}`,
    createdAt: bill.createdAt,
  }));

  const saved = billModel.insertBill(bill, stockAdjustments);

  // Save discounted bill record if discount was applied
  if (discountAmount > 0) {
    const tableNum = billModel.getTableNumberById(saved.tableId);
    billModel.insertDiscountedBill({
      id: uuidv4(),
      billId: saved.id,
      tableNum,
      billAmount: parseFloat(subtotal.toFixed(2)),
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      finalAmount: parseFloat(total.toFixed(2)),
      createdAt: saved.createdAt,
    });
  }

  const billDate = saved.createdAt.split('T')[0];
  salesModel.addBillToDailySales({ date: billDate, total: saved.total });
  saved.stockAdjustments = stockAdjustments.map(adj => {
    const consumed = Math.abs(adj.consumeQty);
    const linked = stockConsumptionById.get(adj.stockItemId);
    return {
      stockItemId: adj.stockItemId,
      stockItemName: adj.stockItemName,
      stockUnit: adj.stockUnit,
      consumedQty: consumed,
      remainingQty: linked ? linked.availableQty - consumed : null,
    };
  });
  return saved;
}

async function holdBill({ items, tableId, discount = 0, paymentMethod = 'cash' }) {
  if (!items || items.length === 0) {
    throw new Error('Cannot hold an empty order');
  }

  const normalizedItems = [];
  let subtotal = 0;
  for (const item of items) {
    const menuItem = await billModel.getMenuItemById(item.menuItemId);
    if (!menuItem) throw new Error(`Menu item not found: ${item.menuItemId}`);

    const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
    const price = Number(item.price);
    if (!Number.isFinite(price) || price < 0) throw new Error('Invalid held item price');
    subtotal += price * quantity;

    normalizedItems.push({
      id: uuidv4(),
      menuItemId: item.menuItemId,
      name: item.name || menuItem.name,
      description: item.description || '',
      isAvailable: item.isAvailable !== undefined ? !!item.isAvailable : !!menuItem.isAvailable,
      basePrice: Number.isFinite(Number(item.basePrice)) ? Number(item.basePrice) : Number(menuItem.price),
      halfPrice: item.halfPrice !== undefined && item.halfPrice !== null ? Number(item.halfPrice) : null,
      price,
      quantity,
      createdAt: new Date().toISOString(),
    });
  }

  const discountAmount = Math.max(0, Math.min(Number(discount) || 0, subtotal));
  const total = subtotal - discountAmount;
  const now = new Date().toISOString();
  const heldBill = {
    id: uuidv4(),
    tableId: tableId || null,
    subtotal: parseFloat(subtotal.toFixed(2)),
    discount: parseFloat(discountAmount.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
    paymentMethod: paymentMethod || 'cash',
    createdAt: now,
    updatedAt: now,
    items: normalizedItems,
  };

  return billModel.insertHeldBill(heldBill);
}

async function getHeldBills() {
  return billModel.getHeldBills();
}

async function getHeldBillById(id) {
  return billModel.getHeldBillById(id);
}

async function deleteHeldBill(id) {
  return billModel.deleteHeldBill(id);
}

async function getBills(filters = {}) {
  return billModel.getBills(filters);
}

async function getBillById(id) {
  return billModel.getBillById(id);
}

// ─── Tables ─────────────────────────────────────────────────

async function getTables() {
  return billModel.getAllTables();
}

async function updateTableStatus({ tableId, status }) {
  return billModel.updateTableStatus(tableId, status);
}

async function getDiscountedBills(filters = {}) {
  return billModel.getDiscountedBills(filters);
}

// ─── Quick Keys ────────────────────────────────────────────

async function getQuickKeys() {
  return billModel.getQuickKeys();
}

async function setQuickKeys(assignments) {
  const validKeys = '123456789abcdefghijklmnopqrstuvwxyz'.split('');
  const filtered = assignments.filter(a => validKeys.includes(a.key) && a.menuItemId);
  const usedMenuItemIds = new Set();

  for (const a of filtered) {
    if (usedMenuItemIds.has(a.menuItemId)) {
      throw new Error(`One item can only be assigned to one quick key (menuItemId: ${a.menuItemId})`);
    }
    usedMenuItemIds.add(a.menuItemId);
  }

  // Validate all menu items exist
  for (const a of filtered) {
    const item = await billModel.getMenuItemById(a.menuItemId);
    if (!item) throw new Error(`Menu item not found: ${a.menuItemId}`);
  }
  billModel.setQuickKeys(filtered);
  return billModel.getQuickKeys();
}

module.exports = {
  getMenuItems, addMenuItem, updateMenuItem, deleteMenuItem,
  getMenuCategories, addMenuCategory,
  holdBill, getHeldBills, getHeldBillById, deleteHeldBill,
  createBill, getBills, getBillById,
  getTables, updateTableStatus,
  getDiscountedBills,
  getQuickKeys, setQuickKeys,
};
