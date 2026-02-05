const stockModel = require('../models/stock.model');
const { v4: uuidv4 } = require('uuid');

async function getAll() {
  return stockModel.findAll();
}

async function getById(id) {
  return stockModel.findById(id);
}

async function add(item) {
  if (!item.name) throw new Error('Stock item must have a name');
  if (item.quantity < 0) throw new Error('Quantity cannot be negative');

  const newItem = {
    id: uuidv4(),
    name: item.name,
    category: item.category || 'General',
    quantity: parseInt(item.quantity) || 0,
    unit: item.unit || 'pcs',
    reorderLevel: parseInt(item.reorderLevel) || 5,
    unitPrice: parseFloat(item.unitPrice) || 0,
    createdAt: new Date().toISOString(),
  };
  return stockModel.insert(newItem);
}

async function update({ id, ...updates }) {
  const item = await stockModel.findById(id);
  if (!item) throw new Error('Stock item not found');
  return stockModel.update({ ...item, ...updates, updatedAt: new Date().toISOString() });
}

async function remove(id) {
  const item = await stockModel.findById(id);
  if (!item) throw new Error('Stock item not found');
  return stockModel.remove(id);
}

async function adjustQuantity(id, adjustment, reason = '') {
  const item = await stockModel.findById(id);
  if (!item) throw new Error('Stock item not found');

  const newQty = item.quantity + adjustment;
  if (newQty < 0) throw new Error('Adjustment would result in negative quantity');

  // Log the adjustment as an audit record
  const auditRecord = {
    id: uuidv4(),
    stockItemId: id,
    previousQty: item.quantity,
    adjustment,
    newQty,
    reason,
    createdAt: new Date().toISOString(),
  };
  await stockModel.insertAdjustmentLog(auditRecord);

  return stockModel.update({ ...item, quantity: newQty, updatedAt: new Date().toISOString() });
}

async function getLowStock(threshold) {
  return stockModel.findBelowThreshold(threshold);
}

async function getCategories() {
  return stockModel.getDistinctCategories();
}

module.exports = { getAll, getById, add, update, remove, adjustQuantity, getLowStock, getCategories };
