import React, { useState, useEffect } from 'react';

const emptyForm = { name: '', category: 'General', quantity: 0, unit: 'pcs', reorderLevel: 5, unitPrice: 0 };

export default function StockPage() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  const fetchData = async () => {
    const [itemsRes, catsRes] = await Promise.all([
      window.api.stock.getAll(),
      window.api.stock.getCategories(),
    ]);
    if (itemsRes.success) setItems(itemsRes.data);
    if (catsRes.success) setCategories(catsRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = activeCategory === 'All' ? items : items.filter(i => i.category === activeCategory);
  const lowStock = items.filter(i => i.quantity <= i.reorderLevel);

  const openAdd = () => { setForm(emptyForm); setEditId(null); setShowModal(true); };
  const openEdit = (item) => { setForm({ name: item.name, category: item.category, quantity: item.quantity, unit: item.unit, reorderLevel: item.reorderLevel, unitPrice: item.unitPrice }); setEditId(item.id); setShowModal(true); };

  const handleSave = async () => {
    let res;
    if (editId) {
      res = await window.api.stock.update({ id: editId, ...form });
    } else {
      res = await window.api.stock.add(form);
    }
    if (res.success) { setShowModal(false); await fetchData(); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this stock item?')) return;
    await window.api.stock.delete({ id });
    await fetchData();
  };

  const handleAdjust = async () => {
    if (!adjustItem) return;
    const res = await window.api.stock.adjustQuantity({ id: adjustItem.id, adjustment: adjustQty, reason: adjustReason });
    if (res.success) { setAdjustItem(null); setAdjustQty(0); setAdjustReason(''); await fetchData(); }
  };

  if (loading) return <div className="text-slate-400">Loading inventory...</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Inventory</h1>
        <button onClick={openAdd} className="btn-primary text-sm">+ Add Item</button>
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg px-4 py-2.5 mb-4 flex items-center gap-2">
          <span className="text-amber-400 text-sm">⚠</span>
          <span className="text-amber-300 text-xs">{lowStock.length} item(s) are low on stock: {lowStock.map(i => i.name).join(', ')}</span>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['All', ...categories].map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
              ${activeCategory === cat ? 'bg-primary-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Name</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Category</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Qty</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Unit</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Price</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Reorder</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 text-white font-medium">{item.name}</td>
                <td className="px-4 py-3 text-slate-400">{item.category}</td>
                <td className="px-4 py-3">
                  <span className={`font-semibold ${item.quantity <= item.reorderLevel ? 'text-red-400' : 'text-green-400'}`}>{item.quantity}</span>
                </td>
                <td className="px-4 py-3 text-slate-400">{item.unit}</td>
                <td className="px-4 py-3 text-slate-400">PKR {item.unitPrice.toLocaleString()}</td>
                <td className="px-4 py-3 text-slate-500">{item.reorderLevel}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => setAdjustItem(item)} className="text-xs text-blue-400 hover:text-blue-300">Adj</button>
                    <button onClick={() => openEdit(item)} className="text-xs text-slate-400 hover:text-white">Edit</button>
                    <button onClick={() => handleDelete(item.id)} className="text-xs text-red-400 hover:text-red-300">Del</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-600 text-sm">No items found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="card w-96 max-h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-semibold">{editId ? 'Edit Item' : 'Add Item'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <div className="space-y-3">
              <div><label className="label">Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-field" /></div>
              <div><label className="label">Category</label><input value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="input-field" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Quantity</label><input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: Number(e.target.value)})} className="input-field" /></div>
                <div><label className="label">Unit</label><input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="input-field" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Unit Price (PKR)</label><input type="number" value={form.unitPrice} onChange={e => setForm({...form, unitPrice: Number(e.target.value)})} className="input-field" /></div>
                <div><label className="label">Reorder Level</label><input type="number" value={form.reorderLevel} onChange={e => setForm({...form, reorderLevel: Number(e.target.value)})} className="input-field" /></div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleSave} className="btn-primary flex-1">Save</button>
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Quantity Modal */}
      {adjustItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="card w-80">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-white font-semibold text-sm">Adjust: {adjustItem.name}</h2>
              <button onClick={() => setAdjustItem(null)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <p className="text-slate-500 text-xs mb-3">Current quantity: <span className="text-white">{adjustItem.quantity}</span></p>
            <div><label className="label">Adjustment (+/-)</label><input type="number" value={adjustQty} onChange={e => setAdjustQty(Number(e.target.value))} className="input-field" /></div>
            <div className="mt-2"><label className="label">Reason</label><input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="e.g. Used in kitchen" className="input-field" /></div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleAdjust} className="btn-primary flex-1 text-sm">Apply</button>
              <button onClick={() => setAdjustItem(null)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
