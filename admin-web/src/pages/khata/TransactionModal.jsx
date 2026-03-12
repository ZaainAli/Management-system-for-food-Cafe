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

export default function TransactionModal({ profileId, branchId, profileType, profileName, transaction, onClose, onSaved }) {
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
    if (!amount || isNaN(resolved) || resolved < 0) {
      setError('Enter a valid amount.'); return;
    }
    setSaving(true); setError('');

    const finalAmount = parseFloat(resolved.toFixed(2));
    const payload = {
      profile_id: profileId,
      branch_id:  branchId,
      type,
      amount:     finalAmount,
      note:       note.trim() || null,
      date,
    };

    const result = isEdit
      ? await supabase.from('khata_transactions').update(payload).eq('id', transaction.id)
      : await supabase.from('khata_transactions').insert(payload).select('id').single();

    if (result.error) { setError(result.error.message); setSaving(false); return; }
    const newTxId = !isEdit ? result.data?.id : null;

    // ── daily_sales side effects for payment transactions ──────
    if (type === 'payment') {
      const getDs = (d) => supabase
        .from('daily_sales').select('id, total_revenue, total_expenses, bill_count')
        .eq('branch_id', branchId).eq('date', d).maybeSingle()
        .then(({ data }) => data);

      const upsertDs = async (d, revDelta, expDelta, countDelta) => {
        const ds = await getDs(d);
        if (ds) {
          await supabase.from('daily_sales').update({
            total_revenue:  Math.max(0, parseFloat((ds.total_revenue  + revDelta).toFixed(2))),
            total_expenses: Math.max(0, parseFloat((ds.total_expenses + expDelta).toFixed(2))),
            bill_count:     Math.max(0, ds.bill_count + countDelta),
          }).eq('id', ds.id);
        } else if (revDelta > 0 || expDelta > 0) {
          await supabase.from('daily_sales').insert({
            branch_id: branchId, date: d,
            total_revenue:  Math.max(0, revDelta),
            total_expenses: Math.max(0, expDelta),
            bill_count:     Math.max(0, countDelta),
          });
        }
      };

      const isCustomer = profileType === 'customer';

      if (!isEdit) {
        // New payment
        if (isCustomer) {
          await upsertDs(date, finalAmount, 0, 1);
          // Generate a bill in Supabase so desktop pull can update its daily_sales
          await supabase.from('bills').insert({
            branch_id:           branchId,
            bill_number:         `KHATA-${date}-${newTxId.slice(-6).toUpperCase()}`,
            subtotal:            finalAmount,
            discount:            0,
            total:               finalAmount,
            source_type:         'khata',
            customer_name:       profileName,
            khata_transaction_id: newTxId,
            date,
          });
        } else {
          await upsertDs(date, 0, finalAmount, 0);
          await supabase.from('expenses').insert({
            branch_id: branchId, category: 'Khata Payment',
            description: note.trim() || null, amount: finalAmount,
            date, source_type: 'khata', source_record_id: newTxId,
          });
        }
      } else {
        // Edit: reverse old, apply new
        const oldAmount = parseFloat(Number(transaction.amount).toFixed(2));
        const oldDate   = transaction.date;

        if (isCustomer) {
          if (oldDate === date) {
            await upsertDs(date, finalAmount - oldAmount, 0, 0);
          } else {
            await upsertDs(oldDate, -oldAmount, 0, -1);
            await upsertDs(date,    finalAmount, 0,  1);
          }
        } else {
          if (oldDate === date) {
            await upsertDs(date, 0, finalAmount - oldAmount, 0);
          } else {
            await upsertDs(oldDate, 0, -oldAmount,   0);
            await upsertDs(date,    0,  finalAmount,  0);
          }
          // Update linked expense
          const { data: linkedExp } = await supabase
            .from('expenses').select('id')
            .eq('source_record_id', transaction.id).maybeSingle();
          if (linkedExp) {
            await supabase.from('expenses').update({
              amount: finalAmount, date, description: note.trim() || null,
            }).eq('id', linkedExp.id);
          }
        }
      }
    }

    onSaved(); onClose();
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
          {type === 'payment' && (
            <div>
              <label className="label">Payment</label>
              {profileType === 'customer' ? (
                <div className="input-field text-slate-400 cursor-not-allowed select-none">Added in Today Sale</div>
              ) : (
                <div className="input-field text-slate-400 cursor-not-allowed select-none">Today Sale</div>
              )}
            </div>
          )}
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
