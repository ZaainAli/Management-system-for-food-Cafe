import React, { useState, useEffect } from 'react';

const emptyForm = { description: '', amount: '', category: '', date: new Date().toISOString().split('T')[0], notes: '' };

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const filters = activeCategory !== 'All' ? { category: activeCategory } : {};
    const [expRes, catRes] = await Promise.all([
      window.api.expense.getAll(filters),
      window.api.expense.getCategories(),
    ]);
    if (expRes.success) setExpenses(expRes.data);
    if (catRes.success) setCategories(catRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [activeCategory]);

  const openAdd = () => { setForm(emptyForm); setEditId(null); setShowModal(true); };
  const openEdit = (exp) => {
    setForm({ description: exp.description, amount: exp.amount, category: exp.category, date: exp.date, notes: exp.notes || '' });
    setEditId(exp.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    let res;
    if (editId) res = await window.api.expense.update({ id: editId, ...form });
    else res = await window.api.expense.add(form);
    if (res.success) { setShowModal(false); await fetchData(); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this expense?')) return;
    await window.api.expense.delete({ id });
    await fetchData();
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  if (loading) return <div className="text-slate-400">Loading expenses...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Expenses</h1>
        <button onClick={openAdd} className="btn-primary text-sm">+ Add Expense</button>
      </div>

      {/* Summary Bar */}
      <div className="card mb-4 flex items-center justify-between">
        <span className="text-slate-400 text-sm">{expenses.length} expense(s) found</span>
        <span className="text-red-400 font-semibold text-sm">Total: PKR {total.toLocaleString()}</span>
      </div>

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
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Date</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Description</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Category</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Amount</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map(exp => (
              <tr key={exp.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 text-slate-400 text-xs">{exp.date}</td>
                <td className="px-4 py-3 text-white">{exp.description}</td>
                <td className="px-4 py-3"><span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">{exp.category}</span></td>
                <td className="px-4 py-3 text-red-400 font-medium">PKR {exp.amount.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(exp)} className="text-xs text-slate-400 hover:text-white">Edit</button>
                    <button onClick={() => handleDelete(exp.id)} className="text-xs text-red-400 hover:text-red-300">Del</button>
                  </div>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-600 text-sm">No expenses found</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="card w-96">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-semibold">{editId ? 'Edit Expense' : 'Add Expense'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <div className="space-y-3">
              <div><label className="label">Description</label><input value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="input-field" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Amount (PKR)</label><input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="input-field" /></div>
                <div><label className="label">Date</label><input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="input-field" /></div>
              </div>
              <div>
                <label className="label">Category</label>
                <input value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="e.g. Utilities, Rent" className="input-field" list="exp-cats" />
                <datalist id="exp-cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              <div><label className="label">Notes</label><input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="input-field" /></div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleSave} className="btn-primary flex-1">Save</button>
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
