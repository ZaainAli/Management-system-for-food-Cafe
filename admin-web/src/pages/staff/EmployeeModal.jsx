import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function EmployeeModal({ employee, branches, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', role: '', phone: '', salary: '', hire_date: '', branch_id: '', active: true });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    setForm(employee
      ? { name: employee.name, role: employee.role ?? '', phone: employee.phone ?? '', salary: String(employee.salary ?? ''), hire_date: employee.hire_date ?? '', branch_id: employee.branch_id, active: employee.active }
      : { name: '', role: '', phone: '', salary: '', hire_date: '', branch_id: branches[0]?.id ?? '', active: true }
    );
    setError('');
    setTimeout(() => nameRef.current?.focus(), 50);
  }, [employee, branches]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!form.branch_id)   { setError('Select a branch.'); return; }
    setSaving(true); setError('');

    const payload = {
      branch_id:  form.branch_id,
      name:       form.name.trim(),
      role:       form.role.trim() || null,
      phone:      form.phone.trim() || null,
      salary:     form.salary ? parseFloat(Number(form.salary).toFixed(2)) : 0,
      hire_date:  form.hire_date || null,
      active:     form.active,
    };

    const result = employee?.id
      ? await supabase.from('employees').update(payload).eq('id', employee.id)
      : await supabase.from('employees').insert(payload);

    if (result.error) { setError(result.error.message); }
    else { onSaved(); onClose(); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
         onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className="card w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">{employee ? 'Edit Employee' : 'New Employee'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {error && <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-sm rounded-lg px-4 py-2.5 mb-3">{error}</div>}

        <div className="space-y-3">
          <div>
            <label className="label">Name <span className="text-red-400">*</span></label>
            <input ref={nameRef} value={form.name} onChange={set('name')} className="input-field" placeholder="Full name" />
          </div>
          <div>
            <label className="label">Branch <span className="text-red-400">*</span></label>
            <select value={form.branch_id} onChange={set('branch_id')} className="input-field">
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Role</label>
              <input value={form.role} onChange={set('role')} className="input-field" placeholder="e.g. Cashier" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input value={form.phone} onChange={set('phone')} className="input-field" placeholder="03XX-XXXXXXX" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Salary (Rs)</label>
              <input type="number" min="0" value={form.salary} onChange={set('salary')} className="input-field" placeholder="0" />
            </div>
            <div>
              <label className="label">Hire Date</label>
              <input type="date" value={form.hire_date} onChange={set('hire_date')} className="input-field" />
            </div>
          </div>
          <label className="flex items-center gap-2.5 bg-slate-700/40 rounded-lg px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-primary-500 focus:ring-primary-500"
            />
            <span className="text-sm text-slate-300">Active employee</span>
          </label>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving...' : employee ? 'Save Changes' : 'Add Employee'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
