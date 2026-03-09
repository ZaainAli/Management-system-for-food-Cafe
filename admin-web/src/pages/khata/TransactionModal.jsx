import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatPkDate } from '@/utils/datetime';

const today = () => formatPkDate();

const evalAmount = (expr) => {
  const parts = String(expr).split('+').map(p => parseFloat(p.trim()));
  if (parts.some(isNaN)) return NaN;
  return parts.reduce((a, b) => a + b, 0);
};

export default function TransactionModal({ profileId, branchId, transaction, onClose, onSaved }) {
  const [type, setType]       = useState('due');
  const [amount, setAmount]   = useState('');
  const [note, setNote]       = useState('');
  const [date, setDate]       = useState(today());
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState(false);
  const amountRef = useRef(null);
  const isEdit = Boolean(transaction?.id);

  const calcResult = evalAmount(amount);
  const hasExpr = amount.includes('+');

  useEffect(() => {
    setType(transaction?.type || 'due');
    setAmount(transaction?.amount !== undefined ? String(transaction.amount) : '');
    setNote(transaction?.note || '');
    setDate(transaction?.date || today());
    setError('');
    setTimeout(() => amountRef.current?.focus(), 50);
  }, [transaction]);

  const handleSave = async () => {
    const resolved = evalAmount(amount);
    if (!amount || isNaN(resolved) || resolved <= 0) {
      setError('Enter a valid amount.'); return;
    }
    setSaving(true); setError('');

    const payload = {
      profile_id: profileId,
      branch_id:  branchId,
      type,
      amount:     parseFloat(resolved.toFixed(2)),
      note:       note.trim() || null,
      date,
    };

    const result = isEdit
      ? await supabase.from('khata_transactions').update(payload).eq('id', transaction.id)
      : await supabase.from('khata_transactions').insert(payload);

    const err = result.error;

    if (err) { setError(err.message); }
    else { onSaved(); onClose(); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
         onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className="card w-full max-w-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">{isEdit ? 'Edit Transaction' : 'Add Transaction'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {error && <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-sm rounded-lg px-4 py-2.5 mb-3">{error}</div>}

        {/* Type toggle */}
        <div className="flex rounded-lg overflow-hidden border border-slate-700 mb-4">
          <button onClick={() => setType('due')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${type === 'due' ? 'bg-red-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            Due (Credit)
          </button>
          <button onClick={() => setType('payment')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${type === 'payment' ? 'bg-green-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            Payment
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">Amount (Rs) <span className="text-red-400">*</span></label>
            <input ref={amountRef} type="text" inputMode="decimal" value={amount}
              onChange={(e) => setAmount(e.target.value)} className="input-field" placeholder="e.g. 300+200+100"
              autoFocus />
            {hasExpr && !isNaN(calcResult) && (
              <p className="text-xs text-green-400 mt-1">= Rs {calcResult.toFixed(2)}</p>
            )}
            {hasExpr && isNaN(calcResult) && (
              <p className="text-xs text-red-400 mt-1">Invalid expression</p>
            )}
          </div>
          <div>
            <label className="label">Note</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} className="input-field resize-none" placeholder="Optional note" rows={3} />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Transaction'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
