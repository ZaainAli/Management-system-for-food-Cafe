const billModel = require('../models/bill.model');
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
  const newItem = {
    id: uuidv4(),
    name: item.name,
    description: item.description || '',
    price: parseFloat(item.price),
    categoryId: item.categoryId || null,
    isAvailable: item.isAvailable !== undefined ? item.isAvailable : true,
    createdAt: new Date().toISOString(),
  };
  return billModel.insertMenuItem(newItem);
}

async function updateMenuItem(id, updates) {
  const item = await billModel.getMenuItemById(id);
  if (!item) throw new Error('Menu item not found');
  const updated = { ...item, ...updates, updatedAt: new Date().toISOString() };
  return billModel.updateMenuItem(updated);
}

async function deleteMenuItem(id) {
  const item = await billModel.getMenuItemById(id);
  if (!item) throw new Error('Menu item not found');
  return billModel.deleteMenuItem(id);
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
  return billModel.insertCategory(newCategory);
}

// ─── Bill Creation ──────────────────────────────────────────

async function createBill({ items, tableId, discount = 0, paymentMethod = 'cash', customerName = '' }) {
  if (!items || items.length === 0) {
    throw new Error('Bill must have at least one item');
  }

  // Validate all items exist and calculate subtotal
  let subtotal = 0;
  const lineItems = [];
  for (const item of items) {
    const menuItem = await billModel.getMenuItemById(item.menuItemId);
    if (!menuItem) throw new Error(`Menu item not found: ${item.menuItemId}`);
    if (!menuItem.isAvailable) throw new Error(`Item unavailable: ${menuItem.name}`);

    const qty = parseInt(item.quantity) || 1;
    const lineTotal = menuItem.price * qty;
    subtotal += lineTotal;

    lineItems.push({
      id: uuidv4(),
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: qty,
      lineTotal,
    });
  }

  const TAX_RATE = 0.05; // 5% tax — adjust as needed
  const tax = subtotal * TAX_RATE;
  const discountAmount = subtotal * (discount / 100);
  const total = subtotal + tax - discountAmount;

  const bill = {
    id: uuidv4(),
    tableId: tableId || null,
    customerName,
    items: lineItems,
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    discount: parseFloat(discountAmount.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
    paymentMethod,
    status: 'completed',
    createdAt: new Date().toISOString(),
  };

  return billModel.insertBill(bill);
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

module.exports = {
  getMenuItems, addMenuItem, updateMenuItem, deleteMenuItem,
  getMenuCategories, addMenuCategory,
  createBill, getBills, getBillById,
  getTables, updateTableStatus,
};
