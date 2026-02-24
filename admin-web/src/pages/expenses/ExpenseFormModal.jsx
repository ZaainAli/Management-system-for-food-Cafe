import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const CATEGORIES = ['Salary', 'Utilities', 'Rent', 'Raw Material', 'Maintenance', 'Marketing', 'Other'];
const SOURCE_TYPES = ['manual', 'khata', 'salary'];

const today = () => new Date().toISOString().split('T')[0];

export default function ExpenseFormModal({ expense, branchId, onClose, onSaved }) {
  const [form, setForm] = useState({ category: '', description: '', amount: '', date: today(), source_type: 'manual' });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    setForm(expense
      ? { category: expense.category, description: expense.description ?? '', amount: String(expense.amount), date: expense.date, source_type: expense.source_type }
      : { category: CATEGORIES[0], description: '', amount: '', date: today(), source_type: 'manual' }
    );
    setError('');
    setTimeout(() => firstRef.current?.focus(), 50);
  }, [expense]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.category.trim())  { setError('Category is required.'); return; }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      setError('Enter a valid amount.'); return;
    }
    setSaving(true); setError('');

    const payload = {
      branch_id:   branchId,
      category:    form.category.trim(),
      description: form.description.trim() || null,
      amount:      parseFloat(Number(form.amount).toFixed(2)),
      date:        form.date,
      source_type: form.source_type,
    };

    const result = expense?.id
      ? await supabase.from('expenses').update(payload).eq('id', expense.id)
      : await supabase.from('expenses').insert(payload);

    if (result.error) { setError(result.error.message); }
    else { onSaved(); onClose(); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
         onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className="card w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">{expense ? 'Edit Expense' : 'Add Expense'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {error && <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-sm rounded-lg px-4 py-2.5 mb-3">{error}</div>}

        <div className="space-y-3">
          <div>
            <label className="label">Category <span className="text-red-400">*</span></label>
            <input
              ref={firstRef}
              list="exp-cats"
              value={form.category}
              onChange={set('category')}
              className="input-field"
              placeholder="e.g. Utilities"
            />
            <datalist id="exp-cats">
              {CATEGORIES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="label">Description</label>
            <input value={form.description} onChange={set('description')} className="input-field" placeholder="Optional note" />
          </div>
          <div>
            <label className="label">Amount (Rs) <span className="text-red-400">*</span></label>
            <input type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} className="input-field" placeholder="0.00" />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" value={form.date} onChange={set('date')} className="input-field" />
          </div>
          <div>
            <label className="label">Source</label>
            <select value={form.source_type} onChange={set('source_type')} className="input-field">
              {SOURCE_TYPES.map((s) => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving...' : expense ? 'Save Changes' : 'Add Expense'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
