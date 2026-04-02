import { useState, useEffect, useRef } from 'react';
import { getPkToday, monthBounds, shiftDate } from '../../utils/datetime';
import { useAuth } from '../../store/AuthContext';

function localToday() {
  return getPkToday();
}

const emptyForm = {
  description: '',
  amount: '',
  category: 'General',
  date: localToday(),
  notes: '',
  sourceType: 'manual',
  sourceEntityId: '',
};

function curMonth() {
  return getPkToday().slice(0, 7);
}
function curYear() { return getPkToday().slice(0, 4); }
const YEAR_OPTIONS = Array.from(
  { length: Number(getPkToday().slice(0, 4)) - 2019 },
  (_, i) => String(Number(getPkToday().slice(0, 4)) - i)
);
const inputCls = 'bg-slate-800 border border-slate-700 text-white text-xs rounded-md px-2 py-1 focus:outline-none focus:border-primary-500';

function getDateRange(period, selMonth, selYear, customFrom, customTo, selDate) {
  const today = getPkToday();
  if (period === 'today') return { from: selDate, to: selDate };
  if (period === 'week') return { from: shiftDate(today, -6), to: today };
  if (period === 'month') return monthBounds(selMonth);
  if (period === 'year') {
    return { from: `${selYear}-01-01`, to: `${selYear}-12-31` };
  }
  if (period === 'custom') {
    if (!customFrom || !customTo) return {};
    return { from: customFrom, to: customTo };
  }
  return {};
}

export default function ExpensesPage() {
  const { permissions } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [khataProfiles, setKhataProfiles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [formError, setFormError] = useState('');
  const [permError, setPermError] = useState('');
  const permErrorTimer = useRef(null);
  const [period, setPeriod]         = useState('today');
  const [selMonth, setSelMonth]     = useState(curMonth());
  const [selYear, setSelYear]       = useState(curYear());
  const [selDate, setSelDate]       = useState(getPkToday());
  const [customFrom, setCustomFrom] = useState(`${getPkToday().slice(0, 7)}-01`);
  const [customTo, setCustomTo]     = useState(getPkToday());

  const fetchData = async () => {
    const periodFilters = getDateRange(period, selMonth, selYear, customFrom, customTo, selDate);
    const filters = {
      ...(activeCategory !== 'All' ? { category: activeCategory } : {}),
      ...periodFilters,
    };
    const [expRes, catRes, khataRes, staffRes] = await Promise.all([
      window.api.expense.getAll(filters),
      window.api.expense.getCategories(),
      window.api.khata.getAll(),
      window.api.staff.getAll({ isActive: true }),
    ]);
    if (expRes.success) setExpenses(expRes.data);
    if (catRes.success) setCategories(catRes.data);
    if (khataRes.success) setKhataProfiles(khataRes.data || []);
    if (staffRes.success) setEmployees(staffRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [activeCategory, period, selMonth, selYear, customFrom, customTo, selDate]);

  const showPermError = (msg) => {
    setPermError(msg);
    clearTimeout(permErrorTimer.current);
    permErrorTimer.current = setTimeout(() => setPermError(''), 3000);
  };

  const openAdd = () => {
    setFormError('');
    setForm({ ...emptyForm, date: localToday() });
    setEditId(null);
    setShowModal(true);
  };
  const openEdit = (exp) => {
    if (!permissions.canManageExpenses) {
      showPermError('Access denied: Only managers and admins can edit expenses.');
      return;
    } 
    setFormError('');
    setForm({
      description: exp.description,
      amount: exp.amount,
      category: exp.category,
      date: exp.date,
      notes: exp.notes || '',
      sourceType: exp.sourceType || 'manual',
      sourceEntityId: exp.sourceEntityId || '',
    });
    setEditId(exp.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    setFormError('');
    let description;
    if (form.sourceType === 'khata') {
      const profile = khataProfiles.find(p => p.id === form.sourceEntityId);
      const name = profile?.name || ' ---';
      description = `Khata Payment: ${name}`.trim();
    } else if (form.sourceType === 'salary') {
      const emp = employees.find(e => e.id === form.sourceEntityId);
      const name = emp?.name || ' ---';
      description = `Salary Payment: ${name}`.trim();
    } else {
      description = form.description?.trim() || 'Manual EXP (app:exp)';
    }
    if (!form.amount || Number(form.amount) <= 0) {
      setFormError('Amount must be greater than 0.');
      return;
    }
    if (!form.category?.trim()) {
      setFormError('Category is required.');
      return;
    }
    if (form.sourceType !== 'manual' && !form.sourceEntityId) {
      setFormError(form.sourceType === 'khata' ? 'Select a khata profile.' : 'Select an employee.');
      return;
    }

    const payload = { ...form, description };
    let res;
    if (editId) res = await window.api.expense.update({ id: editId, ...payload });
    else res = await window.api.expense.add(payload);
    if (res.success) {
      setShowModal(false);
      await fetchData();
    } else {
      setFormError(res?.error || 'Failed to save expense.');
    }
  };

  const handleDelete = async (id) => {
    if (!permissions.canManageExpenses) {
      showPermError('Access denied: Only managers and admins can delete expenses.');
      return;
    }
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

      {/* Permission Error */}
      {permError && (
        <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-sm rounded-lg px-4 py-3 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
          {permError}
        </div>
      )}

      {/* Summary Bar */}
      <div className="card mb-4 flex items-center justify-between">
        <span className="text-slate-400 text-sm">{expenses.length} expense(s) found</span>
        <span className="text-red-400 font-semibold text-sm">Total: PKR {total.toLocaleString()}</span>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {/* Period Selector */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            {['today', 'week', 'month', 'year', 'custom'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs rounded-md transition-colors capitalize ${
                  period === p ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          {period === 'month' && (
            <input type="month" value={selMonth} max={curMonth()}
              onChange={e => setSelMonth(e.target.value)} className={inputCls} />
          )}
          {period === 'year' && (
            <select value={selYear} onChange={e => setSelYear(e.target.value)} className={inputCls}>
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} max={getPkToday()} onChange={e => setCustomFrom(e.target.value)} className={inputCls} />
              <span className="text-slate-500 text-xs">to</span>
              <input type="date" value={customTo} min={customFrom} max={getPkToday()} onChange={e => setCustomTo(e.target.value)} className={inputCls} />
            </div>
          )}
          {period === 'today' && (
            <div className="flex items-center gap-1">
              <button onClick={() => setSelDate(d => shiftDate(d, -1))}
                className="px-2 py-1 text-xs rounded-md bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors">
                &larr; Prev
              </button>
              <input type="date" value={selDate} max={getPkToday()}
                onChange={e => setSelDate(e.target.value)} className={inputCls} />
              <button onClick={() => { const next = shiftDate(selDate, 1); if (next <= getPkToday()) setSelDate(next); }}
                className="px-2 py-1 text-xs rounded-md bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors">
                Next &rarr;
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-xs rounded-md px-3 py-1.5 focus:outline-none focus:border-primary-500 min-w-36"
          >
            <option value="All">All</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Date</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Description</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Category</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Source</th>
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
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {exp.sourceType === 'khata' ? `Khata: ${exp.sourceEntityName || '-'}` : exp.sourceType === 'salary' ? `Salary: ${exp.sourceEntityName || '-'}` : 'Manual'}
                </td>
                <td className="px-4 py-3 text-red-400 font-medium">PKR {exp.amount.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(exp)} className="text-xs text-slate-400 hover:text-white">Edit</button>
                    <button onClick={() => handleDelete(exp.id)} className="text-xs text-red-400 hover:text-red-300">Del</button>
                  </div>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-600 text-sm">No expenses found</td></tr>}
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
            {formError && <div className="mb-3 text-red-300 text-sm">{formError}</div>}
            <div className="space-y-3">
              <div><label className="label">Description</label><input value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="input-field" /></div>
              <div>
                <label className="label">Expense On Behalf Of</label>
                <select
                  value={form.sourceType}
                  onChange={(e) => {
                    const sourceType = e.target.value;
                    const categoryMap = { manual: 'General', khata: 'Khata Payment', salary: 'Salary' };
                    setForm({ ...form, sourceType, sourceEntityId: '', category: categoryMap[sourceType] });
                  }}
                  className="input-field"
                >
                  <option value="manual">Manual Expense</option>
                  <option value="khata">Khata</option>
                  <option value="salary">Salary</option>
                </select>
              </div>
              {form.sourceType === 'khata' && (
                <div>
                  <label className="label">Khata Profile</label>
                  <select
                    value={form.sourceEntityId}
                    onChange={e => setForm({ ...form, sourceEntityId: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Select khata profile</option>
                    {khataProfiles.filter(p => p.profileType !== 'customer').map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {form.sourceType === 'salary' && (
                <div>
                  <label className="label">Employee</label>
                  <select
                    value={form.sourceEntityId}
                    onChange={e => setForm({ ...form, sourceEntityId: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Select employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Amount (PKR)</label><input type="number" min={0} value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()} className="input-field" /></div>
                <div><label className="label">Date</label><input type="date" value={form.date} max={localToday()} onChange={e => setForm({...form, date: e.target.value})} className="input-field" /></div>
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
