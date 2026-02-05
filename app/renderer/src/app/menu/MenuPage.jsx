import React, { useEffect, useState } from 'react';

const emptyForm = {
  name: '',
  description: '',
  price: 0,
  halfPrice: '',
  categoryId: '',
  isAvailable: true,
};

export default function MenuPage() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const fetchData = async () => {
    const [itemsRes, catsRes] = await Promise.all([
      window.api.pos.getMenuItems(),
      window.api.pos.getMenuCategories(),
    ]);
    if (itemsRes.success) setItems(itemsRes.data);
    if (catsRes.success) setCategories(catsRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = activeCategory === 'All'
    ? items
    : items.filter(i => i.categoryId === activeCategory);

  const openAdd = () => {
    setForm(emptyForm);
    setEditId(null);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setForm({
      name: item.name || '',
      description: item.description || '',
      price: Number(item.price) || 0,
      halfPrice: item.halfPrice !== null && item.halfPrice !== undefined ? Number(item.halfPrice) : '',
      categoryId: item.categoryId || '',
      isAvailable: item.isAvailable !== undefined ? !!item.isAvailable : true,
    });
    setEditId(item.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    const payload = {
      ...form,
      price: Number(form.price) || 0,
      halfPrice: form.halfPrice === '' ? null : Number(form.halfPrice) || 0,
      categoryId: form.categoryId || null,
      isAvailable: !!form.isAvailable,
    };

    let res;
    if (editId) {
      res = await window.api.pos.updateMenuItem({ id: editId, ...payload });
    } else {
      res = await window.api.pos.addMenuItem(payload);
    }
    if (res.success) {
      setShowModal(false);
      await fetchData();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this menu item?')) return;
    await window.api.pos.deleteMenuItem({ id });
    await fetchData();
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const res = await window.api.pos.addMenuCategory({ name: newCategoryName.trim() });
    if (res.success) {
      setNewCategoryName('');
      setShowCategoryModal(false);
      await fetchData();
      if (res.data?.id) {
        setForm(prev => ({ ...prev, categoryId: res.data.id }));
      }
    }
  };

  if (loading) return <div className="text-slate-400">Loading menu...</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Menu</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowCategoryModal(true)} className="btn-secondary text-sm">+ Add Category</button>
          <button onClick={openAdd} className="btn-primary text-sm">+ Add Item</button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['All', ...categories.map(c => c.id)].map((catId) => {
          const label = catId === 'All' ? 'All' : categories.find(c => c.id === catId)?.name;
          return (
            <button
              key={catId}
              onClick={() => setActiveCategory(catId)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                ${activeCategory === catId ? 'bg-primary-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              {label || 'Uncategorized'}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Name</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Category</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Price</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Half Price</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 text-white font-medium">
                  <div className="flex flex-col">
                    <span>{item.name}</span>
                    {item.description && <span className="text-xs text-slate-500">{item.description}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-400">{item.categoryName || 'Uncategorized'}</td>
                <td className="px-4 py-3 text-slate-400">PKR {Number(item.price).toLocaleString()}</td>
                <td className="px-4 py-3 text-slate-400">
                  {item.halfPrice !== null && item.halfPrice !== undefined ? `PKR ${Number(item.halfPrice).toLocaleString()}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${item.isAvailable ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                    {item.isAvailable ? 'Available' : 'Unavailable'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(item)} className="text-xs text-slate-400 hover:text-white">Edit</button>
                    <button onClick={() => handleDelete(item.id)} className="text-xs text-red-400 hover:text-red-300">Del</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-600 text-sm">No menu items found</td></tr>
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
              <div>
                <label className="label">Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="label">Description</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Price (PKR)</label>
                  <input type="number" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} className="input-field" />
                </div>
                <div>
                  <label className="label">Half Price (PKR)</label>
                  <input type="number" value={form.halfPrice} onChange={e => setForm({ ...form, halfPrice: e.target.value === '' ? '' : Number(e.target.value) })} className="input-field" />
                </div>
              </div>
              <div>
                <label className="label">Category</label>
                <select
                  value={form.categoryId || ''}
                  onChange={e => setForm({ ...form, categoryId: e.target.value })}
                  className="input-field bg-slate-700"
                >
                  <option value="">Uncategorized</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={form.isAvailable}
                  onChange={e => setForm({ ...form, isAvailable: e.target.checked })}
                />
                Available for sale
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleSave} className="btn-primary flex-1">Save</button>
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="card w-80">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-white font-semibold text-sm">Add Category</h2>
              <button onClick={() => setShowCategoryModal(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <div>
              <label className="label">Category Name</label>
              <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="input-field" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleAddCategory} className="btn-primary flex-1 text-sm">Add</button>
              <button onClick={() => setShowCategoryModal(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
