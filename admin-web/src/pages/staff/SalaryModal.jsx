import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

function todayStr() {
  const t = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

function currentMonth() {
  const t = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}`;
}

export default function SalaryModal({ employee, onClose, onSaved }) {
  const [form, setForm] = useState({ amount: '', month: currentMonth(), paidAt: todayStr() });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ amount: '', month: currentMonth(), paidAt: todayStr() });
  }, [employee]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.amount || Number(form.amount) <= 0) { setError('Enter a valid amount.'); return; }
    if (!form.month)  { setError('Select a month.'); return; }
    setSaving(true); setError('');

    const { error: err } = await supabase.from('salary_records').insert({
      employee_id: employee.id,
      branch_id:   employee.branch_id,
      amount:      parseFloat(Number(form.amount).toFixed(2)),
      month:       form.month,
      paid_at:     form.paidAt || todayStr(),
    });

    if (err) { setError(err.message); setSaving(false); return; }
    onSaved();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="card w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-semibold">Pay Salary</h2>
            <p className="text-slate-500 text-xs mt-0.5">{employee.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-sm rounded-lg px-4 py-2.5 mb-3">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="label">Amount (Rs) <span className="text-red-400">*</span></label>
            <input
              autoFocus
              type="number"
              min="1"
              step="0.01"
              value={form.amount}
              onChange={set('amount')}
              className="input-field"
              placeholder="0"
            />
            {employee.salary > 0 && (
              <p className="text-slate-600 text-xs mt-1">
                Scheduled salary: Rs {Number(employee.salary).toLocaleString()}
              </p>
            )}
          </div>

          <div>
            <label className="label">Month <span className="text-red-400">*</span></label>
            <input
              type="month"
              value={form.month}
              max={currentMonth()}
              onChange={set('month')}
              className="input-field"
            />
          </div>

          <div>
            <label className="label">Payment Date</label>
            <input
              type="date"
              value={form.paidAt}
              max={todayStr()}
              onChange={set('paidAt')}
              className="input-field"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving...' : 'Record Payment'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
