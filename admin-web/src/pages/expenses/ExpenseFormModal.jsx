import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatPkDate ,formatPkDateTime } from '@/utils/datetime';

const CATEGORIES = ['manual', 'Other', 'Utilities', 'Rent', 'Raw Material', 'khata payment', 'salary payment'];
const SOURCE_TYPES = ['manual', 'khata', 'salary'];

const today = () => formatPkDate();
const now = () => formatPkDateTime();

export default function ExpenseFormModal({ expense, branchId, onClose, onSaved }) {
  const [form, setForm] = useState({ category: '', description: '', amount: '', date: today(), source_type: 'manual' });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  const [khataProfiles, setKhataProfiles]       = useState([]);
  const [employees, setEmployees]               = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [loadingProfiles, setLoadingProfiles]   = useState(false);

  const firstRef = useRef(null);

  useEffect(() => {
    setForm(expense
      ? { category: expense.category, description: expense.description ?? '', amount: String(expense.amount), date: expense.date, source_type: expense.source_type }
      : { category: CATEGORIES[0], description: '', amount: '', date: today(), source_type: 'manual' }
    );
    setError('');
    setSelectedProfileId(expense?.source_entity_id ?? '');
    setSelectedEmployeeId(expense?.source_entity_id ?? '');
    setTimeout(() => firstRef.current?.focus(), 50);
  }, [expense]);

  // Fetch khata profiles or employees when source_type changes
  useEffect(() => {
    if (form.source_type === 'khata') {
      setLoadingProfiles(true);
      supabase
        .from('khata_profiles')
        .select('id, name, profile_type')
        .eq('branch_id', branchId)
        .eq('profile_type', 'supplier')
        .order('name')
        .then(({ data }) => { setKhataProfiles(data ?? []); setLoadingProfiles(false); });
    } else if (form.source_type === 'salary') {
      setLoadingProfiles(true);
      supabase
        .from('employees')
        .select('id, name, role')
        .eq('branch_id', branchId)
        .eq('active', true)
        .order('name')
        .then(({ data }) => { setEmployees(data ?? []); setLoadingProfiles(false); });
    }
  }, [form.source_type, branchId]);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => {
      const updated = { ...f, [key]: value };
      if (key === 'source_type') {
        if (value === 'manual') {
          updated.category = 'manual';
          updated.description = '';
        } else if (value === 'khata') {
          updated.category = 'khata payment';
          updated.description = 'khata payment (exp:web)';
        } else if (value === 'salary') {
          updated.category = 'salary payment';
          updated.description = 'Salary payment (exp:web)';
        }
      }
      return updated;
    });
  };

  const handleSave = async () => {
    if (!form.category.trim())  { setError('Category is required.'); return; }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      setError('Enter a valid amount.'); return;
    }
    if (form.source_type === 'khata' && !selectedProfileId) {
      setError('Select a Khata profile.'); return;
    }
    if (form.source_type === 'salary' && !selectedEmployeeId) {
      setError('Select an employee.'); return;
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
      : await supabase.from('expenses').insert(payload).select('id');

    if (result.error) { setError(result.error.message); setSaving(false); return; }

    // Update daily_sales total_expenses
    if (!expense?.id) {
      // New expense: add amount to daily_sales
      const amt = parseFloat(Number(form.amount).toFixed(2));
      const { data: ds } = await supabase
        .from('daily_sales').select('id, total_expenses')
        .eq('branch_id', branchId).eq('date', form.date).maybeSingle();
      if (ds) {
        await supabase.from('daily_sales').update({
          total_expenses: parseFloat((ds.total_expenses + amt).toFixed(2)),
        }).eq('id', ds.id);
      } else {
        await supabase.from('daily_sales').insert({
          branch_id: branchId, date: form.date,
          total_revenue: 0, total_expenses: amt, bill_count: 0,
        });
      }
    } else {
      // Edit: adjust daily_sales by the delta
      const oldAmt = parseFloat(Number(expense.amount).toFixed(2));
      const newAmt = parseFloat(Number(form.amount).toFixed(2));
      const oldDate = expense.date;
      const newDate = form.date;

      if (oldDate === newDate) {
        const delta = newAmt - oldAmt;
        if (delta !== 0) {
          const { data: ds } = await supabase
            .from('daily_sales').select('id, total_expenses')
            .eq('branch_id', branchId).eq('date', newDate).maybeSingle();
          if (ds) {
            await supabase.from('daily_sales').update({
              total_expenses: parseFloat((ds.total_expenses + delta).toFixed(2)),
            }).eq('id', ds.id);
          }
        }
      } else {
        // Date changed: subtract from old date, add to new date
        const { data: oldDs } = await supabase
          .from('daily_sales').select('id, total_expenses')
          .eq('branch_id', branchId).eq('date', oldDate).maybeSingle();
        if (oldDs) {
          await supabase.from('daily_sales').update({
            total_expenses: parseFloat((oldDs.total_expenses - oldAmt).toFixed(2)),
          }).eq('id', oldDs.id);
        }
        const { data: newDs } = await supabase
          .from('daily_sales').select('id, total_expenses')
          .eq('branch_id', branchId).eq('date', newDate).maybeSingle();
        if (newDs) {
          await supabase.from('daily_sales').update({
            total_expenses: parseFloat((newDs.total_expenses + newAmt).toFixed(2)),
          }).eq('id', newDs.id);
        } else {
          await supabase.from('daily_sales').insert({
            branch_id: branchId, date: newDate,
            total_revenue: 0, total_expenses: newAmt, bill_count: 0,
          });
        }
      }
    }

// Side-effects: create or update linked records
  if (!expense?.id) {
    // ── NEW EXPENSE ──────────────────────────────────────────────
    if (form.source_type === 'khata' && selectedProfileId) {
      const { data: txData, error: txError } = await supabase
        .from('khata_transactions')
        .insert({
          profile_id: selectedProfileId,
          branch_id:  branchId,
          type:       'payment',
          amount:     parseFloat(Number(form.amount).toFixed(2)),
          note:       form.description.trim() || form.category.trim(),
          date:       form.date,
        }).select('id').single();

      if (txError) {
        setError('Expense saved but failed to create khata transaction: ' + txError.message);
        setSaving(false);
        onSaved(); onClose();
        return;
      }

      if (txData?.id && result.data?.[0]?.id) {
        // Get the profile name for source_entity_name
        const profileName = khataProfiles.find(p => p.id === selectedProfileId)?.name || '';
        const { error: linkError } = await supabase.from('expenses').update({
            source_entity_id: selectedProfileId,
            source_record_id: txData.id,
            source_entity_name: profileName,
          }).eq('id', result.data[0].id);

        if (linkError) {
          setError('Khata transaction created but failed to link to expense: ' + linkError.message);
          setSaving(false);
          onSaved(); onClose();
          return;
        }
      }

    } else if (form.source_type === 'salary' && selectedEmployeeId) {
        const { data: salaryData, error: salaryError } = await supabase.from('salary_records').insert({
            employee_id: selectedEmployeeId,
            branch_id:  branchId,
            amount:      parseFloat(Number(form.amount).toFixed(2)),
            month:       form.date.slice(0, 7),
            paid_at:     now(),
          }).select('id').single();

      if (salaryError) {
        setError('Expense saved but failed to create salary record: ' + salaryError.message);
        setSaving(false);
        onSaved(); onClose();
        return;
      }

      if ( salaryData?.id && result.data?.[0]?.id) {
        // Get the employee name for source_entity_name
        const employeeName = employees.find(e => e.id === selectedEmployeeId)?.name || '';
        const { error: linkError } = await supabase
          .from('expenses')
          .update({ source_entity_id: selectedEmployeeId, source_record_id: salaryData.id, source_entity_name: employeeName })
          .eq('id', result.data[0].id);

        if (linkError) {
          setError('Salary record created but failed to link employee to expense: ' + linkError.message);
          setSaving(false);
          onSaved(); onClose();
          return;
        }
      }
    }

  } else {
    // ── EDIT EXISTING EXPENSE ────────────────────────────────────

    if (expense.source_type === 'khata' && expense.source_record_id) {
      const { error: txError } = await supabase.from('khata_transactions').update({
          amount: parseFloat(Number(form.amount).toFixed(2)),
          note:   form.description.trim() || form.category.trim(),
          date:   form.date,
        }).eq('id', expense.source_record_id);

      if (txError) {
        setError('Expense updated but failed to sync khata transaction: ' + txError.message);
        setSaving(false);
        onSaved(); onClose();
        return;
      }

    } else if (expense.source_type === 'salary' && expense.source_entity_id) {
      // ✅ Fix: update the latest salary record for this employee+month
      const { error: salaryError } = await supabase.from('salary_records').update({
          amount:  parseFloat(Number(form.amount).toFixed(2)),
          month:   form.date.slice(0, 7),
          paid_at: now(),
        }).eq('id', expense.source_record_id)

      if (salaryError) {
        setError('Expense updated but failed to sync salary record: ' + salaryError.message);
        setSaving(false);
        onSaved(); onClose();
        return;
      }
    }
  }

  onSaved(); onClose();
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
            <input type="date" value={form.date} max={today()} onChange={set('date')} className="input-field" />
          </div>
          <div>
            <label className="label">Source</label>
            <select value={form.source_type} onChange={set('source_type')} className="input-field">
              {SOURCE_TYPES.map((s) => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>

          {/* Khata profile selector */}
          {form.source_type === 'khata' && (
            <div>
              <label className="label">Khata Profile <span className="text-red-400">*</span></label>
              {loadingProfiles ? (
                <div className="input-field text-slate-500 text-sm">Loading profiles...</div>
              ) : (
                <select value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)} className="input-field">
                  <option value="">Select a profile</option>
                  {khataProfiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              {!loadingProfiles && khataProfiles.length === 0 && (
                <p className="text-slate-500 text-xs mt-1">No khata profiles found for this branch.</p>
              )}
            </div>
          )}

          {/* Employee selector */}
          {form.source_type === 'salary' && (
            <div>
              <label className="label">Employee <span className="text-red-400">*</span></label>
              {loadingProfiles ? (
                <div className="input-field text-slate-500 text-sm">Loading employees...</div>
              ) : (
                <select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)} className="input-field">
                  <option value="">Select an employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}{emp.role ? ` — ${emp.role}` : ''}
                    </option>
                  ))}
                </select>
              )}
              {!loadingProfiles && employees.length === 0 && (
                <p className="text-slate-500 text-xs mt-1">No active employees found for this branch.</p>
              )}
            </div>
          )}
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