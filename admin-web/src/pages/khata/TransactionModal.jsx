import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatPkDate } from '@/utils/datetime';

const todayStr = () => formatPkDate();

const evalAmount = (expr) => {
  const parts = String(expr).split('+').map(p => parseFloat(p.trim()));
  if (parts.some(isNaN)) return NaN;
  return parts.reduce((a, b) => a + b, 0);
};

export default function TransactionModal({ profileId, branchId, profileType, profileName, transaction, onClose, onSaved }) {
  const [type, setType]                 = useState('due');
  const [amount, setAmount]             = useState('');
  const [note, setNote]                 = useState('');
  const [date, setDate]                 = useState(todayStr());
  const [paymentSource, setPaymentSource] = useState('today_sale');
  const [error, setError]               = useState('');
  const [saving, setSaving]             = useState(false);
  const amountRef = useRef(null);
  const isEdit = Boolean(transaction?.id);

  const calcResult = evalAmount(amount);
  const hasExpr = amount.includes('+');
  const isToday = date === todayStr();

  useEffect(() => {
    const txDate = transaction?.date || todayStr();
    setType(transaction?.type || 'due');
    setAmount(transaction?.amount !== undefined ? String(transaction.amount) : '');
    setNote(transaction?.note || '');
    setDate(txDate);
    setPaymentSource(txDate === todayStr() ? (transaction?.payment_source || 'today_sale') : 'net_profit');
    setError('');
    setTimeout(() => amountRef.current?.focus(), 50);
  }, [transaction]);

  const handleDateChange = (newDate) => {
    setDate(newDate);
    if (newDate !== todayStr()) setPaymentSource('net_profit');
  };

  const handleSave = async () => {
    const resolved = evalAmount(amount);
    if (!amount || isNaN(resolved) || resolved < 0) {
      setError('Enter a valid amount.'); return;
    }
    setSaving(true); setError('');

    const amt = parseFloat(resolved.toFixed(2));
    const payload = {
      profile_id:     profileId,
      branch_id:      branchId,
      type,
      amount:         amt,
      note:           note.trim() || null,
      date,
      payment_source: type === 'payment' ? paymentSource : null,
    };

    const fetchDs = (d, cols = 'id, total_revenue, bill_count') =>
      supabase.from('daily_sales').select(cols).eq('branch_id', branchId).eq('date', d).maybeSingle();

    const txOp = isEdit
      ? supabase.from('khata_transactions').update(payload).eq('id', transaction.id)
      : supabase.from('khata_transactions').insert(payload).select('id').single();

    if (type === 'payment' && profileType === 'customer') {
      // ── Customer payment ─────────────────────────────────────────────────
      if (!isEdit) {
        // Run tx insert + daily_sales fetch in parallel
        const [result, { data: ds }] = await Promise.all([txOp, fetchDs(date)]);
        if (result.error) { setError(result.error.message); setSaving(false); return; }

        if (ds) {
          await supabase.from('daily_sales').update({
            total_revenue: parseFloat((ds.total_revenue + amt).toFixed(2)),
            bill_count:    ds.bill_count + 1,
          }).eq('id', ds.id);
        } else {
          await supabase.from('daily_sales').insert({
            branch_id: branchId, date, total_revenue: amt, total_expenses: 0, bill_count: 1,
          });
        }
      } else {
        const oldAmt      = parseFloat(transaction.amount);
        const oldDate     = transaction.date;
        const amountChanged = oldAmt !== amt;
        const dateChanged   = oldDate !== date;

        if (!amountChanged && !dateChanged) {
          // Nothing to reconcile — just save
          const result = await txOp;
          if (result.error) { setError(result.error.message); setSaving(false); return; }
        } else if (dateChanged) {
          // Run tx update + both daily_sales fetches in parallel
          const [result, { data: oldDs }, { data: newDs }] = await Promise.all([
            txOp, fetchDs(oldDate), fetchDs(date),
          ]);
          if (result.error) { setError(result.error.message); setSaving(false); return; }

          const effectiveAmt = amountChanged ? amt : oldAmt;
          await Promise.all([
            oldDs
              ? supabase.from('daily_sales').update({
                  total_revenue: Math.max(0, parseFloat((oldDs.total_revenue - oldAmt).toFixed(2))),
                  bill_count:    Math.max(0, oldDs.bill_count - 1),
                }).eq('id', oldDs.id)
              : Promise.resolve(),
            newDs
              ? supabase.from('daily_sales').update({
                  total_revenue: parseFloat((newDs.total_revenue + effectiveAmt).toFixed(2)),
                  bill_count:    newDs.bill_count + 1,
                }).eq('id', newDs.id)
              : supabase.from('daily_sales').insert({
                  branch_id: branchId, date, total_revenue: effectiveAmt, total_expenses: 0, bill_count: 1,
                }),
          ]);
        } else {
          // Same date, only amount changed — run tx update + fetch in parallel
          const [result, { data: ds }] = await Promise.all([txOp, fetchDs(date, 'id, total_revenue')]);
          if (result.error) { setError(result.error.message); setSaving(false); return; }

          if (ds) {
            await supabase.from('daily_sales').update({
              total_revenue: Math.max(0, parseFloat((ds.total_revenue + (amt - oldAmt)).toFixed(2))),
            }).eq('id', ds.id);
          }
        }
      }
    } else {
      // ── Non-customer payment or due ───────────────────────────────────────
      const result = await txOp;
      if (result.error) { setError(result.error.message); setSaving(false); return; }

      // New supplier payment from Today Sale → record expense + update daily_sales
      if (!isEdit && type === 'payment' && paymentSource === 'today_sale') {
        const txId = result.data?.id;
        const [{ data: expData }, { data: ds }] = await Promise.all([
          supabase.from('expenses').insert({
            branch_id:        branchId,
            category:         'Khata Payment',
            description:      note.trim() || profileName || 'Khata Payment',
            amount:           amt,
            date,
            source_type:      'khata',
            source_entity_id: profileId,
            source_record_id: txId || null,
          }).select('id'),
          fetchDs(date, 'id, total_expenses'),
        ]);

        await Promise.all([
          ds
            ? supabase.from('daily_sales').update({
                total_expenses: parseFloat((ds.total_expenses + amt).toFixed(2)),
              }).eq('id', ds.id)
            : supabase.from('daily_sales').insert({
                branch_id: branchId, date, total_revenue: 0, total_expenses: amt, bill_count: 0,
              }),
          txId && expData?.[0]?.id
            ? supabase.from('khata_transactions').update({ expense_id: expData[0].id }).eq('id', txId)
            : Promise.resolve(),
        ]);

      // Edit existing supplier payment that originally had a linked expense
      } else if (isEdit && type === 'payment' && transaction?.payment_source === 'today_sale') {
        const oldAmt      = parseFloat(transaction.amount);
        const oldDate     = transaction.date;
        const amountChanged = oldAmt !== amt;
        const dateChanged   = oldDate !== date;
        const noteChanged   = (note.trim() || profileName || 'Khata Payment') !== (transaction.note?.trim() || profileName || 'Khata Payment');

        if (amountChanged || dateChanged || noteChanged) {
          const expenseUpdates = {};
          if (amountChanged) expenseUpdates.amount = amt;
          if (dateChanged)   expenseUpdates.date   = date;
          if (noteChanged)   expenseUpdates.description = note.trim() || profileName || 'Khata Payment';

          const ops = [
            supabase.from('expenses')
              .update(expenseUpdates)
              .eq('source_record_id', transaction.id)
              .eq('branch_id', branchId),
          ];

          if (dateChanged) {
            const [{ data: oldDs }, { data: newDs }] = await Promise.all([
              fetchDs(oldDate, 'id, total_expenses'),
              fetchDs(date, 'id, total_expenses'),
            ]);
            if (oldDs) {
              ops.push(supabase.from('daily_sales').update({
                total_expenses: Math.max(0, parseFloat((oldDs.total_expenses - oldAmt).toFixed(2))),
              }).eq('id', oldDs.id));
            }
            ops.push(
              newDs
                ? supabase.from('daily_sales').update({
                    total_expenses: parseFloat((newDs.total_expenses + amt).toFixed(2)),
                  }).eq('id', newDs.id)
                : supabase.from('daily_sales').insert({
                    branch_id: branchId, date, total_revenue: 0, total_expenses: amt, bill_count: 0,
                  })
            );
          } else if (amountChanged) {
            const { data: ds } = await fetchDs(date, 'id, total_expenses');
            if (ds) {
              ops.push(supabase.from('daily_sales').update({
                total_expenses: Math.max(0, parseFloat((ds.total_expenses + (amt - oldAmt)).toFixed(2))),
              }).eq('id', ds.id));
            }
          }

          await Promise.all(ops);
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
            <input type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} className="input-field" />
          </div>
          {type === 'payment' && profileType !== 'customer' && (
            <div>
              <label className="label">Payment Source</label>
              <div className="flex rounded-lg overflow-hidden border border-slate-700">
                <button
                  type="button"
                  disabled={!isToday}
                  onClick={() => setPaymentSource('today_sale')}
                  className={`flex-1 py-2 text-sm font-medium transition-colors
                    ${paymentSource === 'today_sale' ? 'bg-primary-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}
                    ${!isToday ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  Today Sale
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentSource('net_profit')}
                  className={`flex-1 py-2 text-sm font-medium transition-colors
                    ${paymentSource === 'net_profit' ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  Net Profit
                </button>
              </div>
              {!isToday && (
                <p className="text-xs text-slate-500 mt-1">Past date — source locked to Net Profit</p>
              )}
              {paymentSource === 'today_sale' && isToday && (
                <p className="text-xs text-slate-500 mt-1">Will also record as an expense in today's sales</p>
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
