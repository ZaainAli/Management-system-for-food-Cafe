import React, { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/AuthContext';
import ExpenseFormModal from './ExpenseFormModal';
import BranchSelector from '../../components/BranchSelector';
import { formatPkDate, shiftPkDate } from '@/utils/datetime';

const PERIODS = ['today', 'week', 'month', 'year', 'custom'];
const SOURCE_COLORS = { manual: 'bg-slate-700 text-slate-300', khata: 'bg-blue-900/40 text-blue-400', salary: 'bg-purple-900/40 text-purple-400' };

function todayStr() {
  return formatPkDate();
}
function curMonth() {
  return formatPkDate().slice(0, 7);
}
function curYear() { return String(new Date().getFullYear()); }
const YEAR_OPTIONS = Array.from({ length: new Date().getFullYear() - 2019 }, (_, i) => String(new Date().getFullYear() - i));

function getRange(period, selMonth, selYear, customFrom, customTo) {
  const today = todayStr();
  const pad   = (n) => String(n).padStart(2, '0');
  if (period === 'today')  return { from: today, to: today };
  if (period === 'week')   return { from: shiftPkDate(today, -6), to: today };
  if (period === 'month')  {
    const [y, m] = selMonth.split('-').map(Number);
    return { from: `${selMonth}-01`, to: `${selMonth}-${pad(new Date(y, m, 0).getDate())}` };
  }
  if (period === 'year')   return { from: `${selYear}-01-01`, to: `${selYear}-12-31` };
  if (period === 'custom') return { from: customFrom, to: customTo };
  return { from: today, to: today };
}

export default function ExpensesPage() {
  const { activeBranch } = useAuth();
  const [expenses, setExpenses]   = useState([]);
  const [period, setPeriod]         = useState('today');
  const [selMonth, setSelMonth]     = useState(curMonth());
  const [selYear, setSelYear]       = useState(curYear());
  const [customFrom, setCustomFrom] = useState(todayStr);
  const [customTo, setCustomTo]     = useState(todayStr);
  const [catFilter, setCatFilter] = useState('all');
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);

  const branchId = activeBranch?.id;

  const fetchExpenses = useCallback(async () => {
    if (!branchId) return;
    if (period === 'custom' && (!customFrom || !customTo)) return;
    setLoading(true);
    const { from, to } = getRange(period, selMonth, selYear, customFrom, customTo);
    const { data } = await supabase
      .from('expenses')
      .select('id, category, description, amount, date, source_type')
      .eq('branch_id', branchId)
      .gte('date', from).lte('date', to)
      .order('date', { ascending: false });
    setExpenses(data ?? []);
    setLoading(false);
  }, [branchId, period, selMonth, selYear, customFrom, customTo]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  // Category summary totals
  const catTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
    return acc;
  }, {});
  const categories = Object.keys(catTotals);
  const grandTotal = Object.values(catTotals).reduce((s, v) => s + v, 0);

  const visible = catFilter === 'all' ? expenses : expenses.filter((e) => e.category === catFilter);

  const handleDelete = async (expense) => {
    if (!confirm('Delete this expense?')) return;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('deleted_items').insert({
      branch_id:  branchId,
      item_type:  'expense',
      item_id:    expense.id,
      item_data:  expense,
      deleted_by: 'web',
      expires_at: expiresAt,
    });
    await supabase.from('expenses').delete().eq('id', expense.id);
    // Reverse daily_sales
    const { data: ds } = await supabase
      .from('daily_sales').select('id, total_expenses')
      .eq('branch_id', branchId).eq('date', expense.date).maybeSingle();
    if (ds) {
      await supabase.from('daily_sales').update({
        total_expenses: Math.max(0, parseFloat((ds.total_expenses - expense.amount).toFixed(2))),
      }).eq('id', ds.id);
    }
    fetchExpenses();
  };

  if (!branchId) return <div className="text-slate-500 text-sm">Select a branch to manage expenses.</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Expenses</h1>
            <p className="text-slate-500 text-sm mt-0.5">{activeBranch.name}</p>
          </div>
          <BranchSelector />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            {PERIODS.map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors
                  ${period === p ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                {p}
              </button>
            ))}
          </div>
          {period === 'month' && (
            <input
              type="month"
              value={selMonth}
              max={curMonth()}
              onChange={(e) => setSelMonth(e.target.value)}
              className="input-field !w-auto text-xs py-1.5"
            />
          )}
          {period === 'year' && (
            <select
              value={selYear}
              onChange={(e) => setSelYear(e.target.value)}
              className="input-field !w-auto text-xs py-1.5"
            >
              {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          {period === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="input-field py-1.5 text-xs w-36"
              />
              <span className="text-slate-500 text-xs">to</span>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={todayStr()}
                onChange={(e) => setCustomTo(e.target.value)}
                className="input-field py-1.5 text-xs w-36"
              />
            </div>
          )}
          <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary text-sm">+ Add</button>
        </div>
      </div>

      {/* Summary chips */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setCatFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
              ${catFilter === 'all' ? 'bg-primary-500 text-white border-primary-500' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
          >
            All — Rs {grandTotal.toLocaleString()}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Date</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Category</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase hidden sm:table-cell">Description</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Amount</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase hidden md:table-cell">Source</th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? [1,2,3].map((i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-slate-700/50 rounded animate-pulse" /></td></tr>
                ))
              : visible.map((e) => (
                  <tr key={e.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{e.date}</td>
                    <td className="px-4 py-3 text-white font-medium">{e.category}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs hidden sm:table-cell">{e.description || '—'}</td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">Rs {Number(e.amount).toLocaleString()}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${SOURCE_COLORS[e.source_type] ?? SOURCE_COLORS.manual}`}>
                        {e.source_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => { setEditing(e); setShowModal(true); }} className="text-slate-400 hover:text-white transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(e)} className="text-slate-400 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))
            }
            {!loading && visible.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-600 text-sm">No expenses found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <ExpenseFormModal expense={editing} branchId={branchId} onClose={() => setShowModal(false)} onSaved={fetchExpenses} />
      )}
    </div>
  );
}
