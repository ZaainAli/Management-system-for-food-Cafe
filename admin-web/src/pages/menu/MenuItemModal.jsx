import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function MenuItemModal({ item, categories, branchId, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', price: '', category_id: '', available: true });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    setForm(item
      ? { name: item.name, price: String(item.price), category_id: item.category_id ?? '', available: item.available }
      : { name: '', price: '', category_id: categories[0]?.id ?? '', available: true }
    );
    setError('');
    setTimeout(() => nameRef.current?.focus(), 50);
  }, [item, categories]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim())    { setError('Name is required.'); return; }
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) < 0) {
      setError('Enter a valid price.'); return;
    }
    setSaving(true); setError('');

    const payload = {
      branch_id:   branchId,
      name:        form.name.trim(),
      price:       parseFloat(Number(form.price).toFixed(2)),
      category_id: form.category_id || null,
      available:   form.available,
    };

    const result = item?.id
      ? await supabase.from('menu_items').update(payload).eq('id', item.id)
      : await supabase.from('menu_items').insert(payload);

    if (result.error) { setError(result.error.message); }
    else { onSaved(); onClose(); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
         onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className="card w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">{item ? 'Edit Item' : 'New Menu Item'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {error && <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-sm rounded-lg px-4 py-2.5 mb-3">{error}</div>}

        <div className="space-y-3">
          <div>
            <label className="label">Name <span className="text-red-400">*</span></label>
            <input ref={nameRef} value={form.name} onChange={set('name')} className="input-field" placeholder="e.g. Chicken Karahi" />
          </div>
          <div>
            <label className="label">Price (Rs) <span className="text-red-400">*</span></label>
            <input type="number" min="0" step="0.01" value={form.price} onChange={set('price')} className="input-field" placeholder="0.00" />
          </div>
          <div>
            <label className="label">Category</label>
            <select value={form.category_id} onChange={set('category_id')} className="input-field">
              <option value="">— No category —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2.5 bg-slate-700/40 rounded-lg px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.available}
              onChange={(e) => setForm((f) => ({ ...f, available: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-primary-500 focus:ring-primary-500"
            />
            <span className="text-sm text-slate-300">Available for ordering</span>
          </label>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving...' : item ? 'Save Changes' : 'Add Item'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
