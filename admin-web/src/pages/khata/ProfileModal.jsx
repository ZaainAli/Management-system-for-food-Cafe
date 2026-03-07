import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const emptyForm = { name: '', phone: '', notes: '' };

export default function ProfileModal({ branchId, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef(null);

  useEffect(() => {
    setForm(emptyForm);
    setError('');
    setTimeout(() => nameRef.current?.focus(), 50);
  }, []);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      setError('Name is required.');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      branch_id: branchId,
      name,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
    };

    const { data, error: insertError } = await supabase
      .from('khata_profiles')
      .insert(payload)
      .select('id, name, phone, notes')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        setError('Name already exists. Please use a unique name.');
      } else {
        setError(insertError.message);
      }
      setSaving(false);
      return;
    }

    onSaved(data);
    onClose();
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
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">New Khata Profile</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-sm rounded-lg px-4 py-2.5 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="label">Name (Unique)</label>
            <input
              ref={nameRef}
              value={form.name}
              onChange={set('name')}
              placeholder="Enter profile name"
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              value={form.phone}
              onChange={set('phone')}
              placeholder="+92..."
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Business Details</label>
            <textarea
              value={form.notes}
              onChange={set('notes')}
              placeholder="Optional details"
              className="input-field min-h-20 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
