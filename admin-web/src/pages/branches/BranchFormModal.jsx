import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const emptyForm = { name: '', address: '', phone: '' };

export default function BranchFormModal({ branch, onClose, onSaved }) {
  const [form, setForm]     = useState(emptyForm);
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    if (branch) {
      setForm({
        name:    branch.name    ?? '',
        address: branch.address ?? '',
        phone:   branch.phone   ?? '',
      });
    } else {
      setForm(emptyForm);
    }
    setError('');
    setTimeout(() => nameRef.current?.focus(), 50);
  }, [branch]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Branch name is required.');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      name:    form.name.trim(),
      address: form.address.trim() || null,
      phone:   form.phone.trim()   || null,
    };

    let result;
    if (branch?.id) {
      result = await supabase.from('branches').update(payload).eq('id', branch.id);
    } else {
      result = await supabase.from('branches').insert(payload).select().single();
    }

    if (result.error) {
      setError(result.error.message);
    } else {
      onSaved();
      onClose();
    }
    setSaving(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
      onKeyDown={handleKeyDown}
    >
      <div className="card w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">
            {branch ? 'Edit Branch' : 'New Branch'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 text-red-300
                          text-sm rounded-lg px-4 py-2.5 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="label">Branch Name <span className="text-red-400">*</span></label>
            <input
              ref={nameRef}
              value={form.name}
              onChange={set('name')}
              placeholder="e.g. Main Branch"
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Address</label>
            <input
              value={form.address}
              onChange={set('address')}
              placeholder="Street address"
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              value={form.phone}
              onChange={set('phone')}
              placeholder="+92 300 0000000"
              className="input-field"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1"
          >
            {saving ? 'Saving...' : branch ? 'Save Changes' : 'Create Branch'}
          </button>
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
