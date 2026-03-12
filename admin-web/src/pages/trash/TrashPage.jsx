import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, RotateCcw, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/AuthContext';
import BranchSelector from '../../components/BranchSelector';

const TYPE_LABELS = {
  khata_transaction: 'Khata Transaction',
  khata_profile:     'Khata Profile',
  expense:           'Expense',
};

const TYPE_COLORS = {
  khata_transaction: 'bg-blue-900/30 text-blue-400',
  khata_profile:     'bg-purple-900/30 text-purple-400',
  expense:           'bg-orange-900/30 text-orange-400',
};

function daysLeft(expiresAt) {
  const diff = new Date(expiresAt) - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatAmount(data) {
  const amt = data.amount ?? data.total ?? data.billAmount ?? null;
  return amt !== null ? `PKR ${Number(amt).toLocaleString()}` : null;
}

function itemSummary(item) {
  const d = item.item_data;
  switch (item.item_type) {
    case 'khata_transaction':
      return `${d.profile_name ?? ''} — ${d.type === 'due' ? 'Due' : 'Payment'} ${formatAmount(d) ?? ''} on ${d.date ?? ''}`;
    case 'khata_profile':
      return `${d.name ?? ''} (${d.profile_type ?? 'supplier'})${d.phone ? ` · ${d.phone}` : ''}`;
    case 'expense':
      return `${d.category ?? ''} — ${formatAmount(d) ?? ''} on ${d.date ?? ''}${d.description ? ` · ${d.description}` : ''}`;
    default:
      return item.item_id;
  }
}

export default function TrashPage() {
  const { activeBranch } = useAuth();
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [restoring, setRestoring] = useState(null); // id being restored
  const [error, setError]       = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const branchId = activeBranch?.id;

  const fetchItems = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('deleted_items')
      .select('*')
      .eq('branch_id', branchId)
      .gt('expires_at', new Date().toISOString())
      .order('deleted_at', { ascending: false });
    if (err) setError(err.message);
    else setItems(data ?? []);
    setLoading(false);
  }, [branchId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleRestore = async (item) => {
    setRestoring(item.id);
    setError('');
    setSuccessMsg('');
    try {
      const d = item.item_data;

      if (item.item_type === 'khata_profile') {
        await supabase.from('khata_profiles').upsert({
          id:           d.id,
          branch_id:    branchId,
          name:         d.name,
          phone:        d.phone || null,
          notes:        d.notes || d.businessDetails || null,
          profile_type: d.profile_type || d.profileType || 'supplier',
        }, { onConflict: 'id' });

        // 1. Restore transactions embedded in the snapshot
        const snapshotTxs = (d.transactions ?? []).map((t) => ({
          id:         t.id,
          profile_id: t.profile_id || t.khataId || d.id,
          branch_id:  branchId,
          type:       t.type,
          amount:     t.amount,
          note:       t.note || null,
          date:       t.date,
        }));

        // 2. Also look for separate khata_transaction entries in deleted_items for this profile
        const { data: orphanItems } = await supabase
          .from('deleted_items')
          .select('*')
          .eq('branch_id', branchId)
          .eq('item_type', 'khata_transaction')
          .gt('expires_at', new Date().toISOString());

        const orphanTxs = (orphanItems ?? [])
          .filter((oi) => {
            const td = oi.item_data;
            return (td.profile_id || td.khataId) === d.id;
          })
          .map((oi) => {
            const t = oi.item_data;
            return {
              id:         t.id,
              profile_id: t.profile_id || t.khataId || d.id,
              branch_id:  branchId,
              type:       t.type,
              amount:     t.amount,
              note:       t.note || null,
              date:       t.date,
            };
          });

        // Merge, deduplicate by id
        const allTxMap = {};
        [...snapshotTxs, ...orphanTxs].forEach((t) => { allTxMap[t.id] = t; });
        const allTxs = Object.values(allTxMap);

        if (allTxs.length > 0) {
          await supabase.from('khata_transactions').upsert(allTxs, { onConflict: 'id' });
        }

        // Remove orphan deleted_item entries that were restored
        const orphanIds = (orphanItems ?? [])
          .filter((oi) => {
            const td = oi.item_data;
            return (td.profile_id || td.khataId) === d.id;
          })
          .map((oi) => oi.id);
        if (orphanIds.length > 0) {
          await supabase.from('deleted_items').delete().in('id', orphanIds);
        }
      }

      if (item.item_type === 'khata_transaction') {
        await supabase.from('khata_transactions').upsert({
          id:         d.id,
          profile_id: d.profile_id || d.khataId,
          branch_id:  branchId,
          type:       d.type,
          amount:     d.amount,
          note:       d.note || null,
          date:       d.date,
        }, { onConflict: 'id' });

        // Re-apply daily_sales if payment
        if (d.type === 'payment') {
          const { data: ds } = await supabase
            .from('daily_sales').select('id, total_revenue, total_expenses, bill_count')
            .eq('branch_id', branchId).eq('date', d.date).maybeSingle();
          const amt = parseFloat(Number(d.amount).toFixed(2));
          if (ds) {
            if ((d.profile_type || d.profileType) === 'customer') {
              await supabase.from('daily_sales').update({
                total_revenue: parseFloat((ds.total_revenue + amt).toFixed(2)),
                bill_count:    ds.bill_count + 1,
              }).eq('id', ds.id);
            } else {
              await supabase.from('daily_sales').update({
                total_expenses: parseFloat((ds.total_expenses + amt).toFixed(2)),
              }).eq('id', ds.id);
            }
          } else {
            const isCustomer = (d.profile_type || d.profileType) === 'customer';
            await supabase.from('daily_sales').insert({
              branch_id: branchId, date: d.date,
              total_revenue:  isCustomer ? amt : 0,
              total_expenses: isCustomer ? 0  : amt,
              bill_count:     isCustomer ? 1  : 0,
            });
          }
        }
      }

      if (item.item_type === 'expense') {
        await supabase.from('expenses').upsert({
          id:               d.id,
          branch_id:        branchId,
          category:         d.category,
          description:      d.description || null,
          amount:           d.amount,
          date:             d.date,
          source_type:      d.source_type || d.sourceType || 'manual',
          source_record_id: d.source_record_id || d.sourceRecordId || null,
        }, { onConflict: 'id' });

        // Re-apply daily_sales expenses
        const { data: ds } = await supabase
          .from('daily_sales').select('id, total_expenses')
          .eq('branch_id', branchId).eq('date', d.date).maybeSingle();
        const amt = parseFloat(Number(d.amount).toFixed(2));
        if (ds) {
          await supabase.from('daily_sales').update({
            total_expenses: parseFloat((ds.total_expenses + amt).toFixed(2)),
          }).eq('id', ds.id);
        } else {
          await supabase.from('daily_sales').insert({
            branch_id: branchId, date: d.date,
            total_revenue: 0, total_expenses: amt, bill_count: 0,
          });
        }
      }

      // Remove from trash
      await supabase.from('deleted_items').delete().eq('id', item.id);
      setSuccessMsg(`"${itemSummary(item)}" restored successfully.`);
      fetchItems();
    } catch (err) {
      setError(err.message || 'Restore failed.');
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = async (item) => {
    if (!confirm('Permanently delete this item? It cannot be recovered.')) return;
    await supabase.from('deleted_items').delete().eq('id', item.id);
    fetchItems();
  };

  const filtered = typeFilter === 'all' ? items : items.filter(i => i.item_type === typeFilter);

  if (!branchId) return <div className="text-slate-500 text-sm">Select a branch to view trash.</div>;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Trash</h1>
          <p className="text-slate-500 text-sm mt-0.5">Deleted items — auto-removed after 30 days</p>
        </div>
        <BranchSelector />
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
      )}
      {successMsg && (
        <div className="bg-green-900/20 border border-green-700/40 text-green-300 text-sm rounded-lg px-4 py-3 mb-4">{successMsg}</div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['all', 'khata_transaction', 'khata_profile', 'expense'].map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${typeFilter === t ? 'bg-primary-500/20 text-primary-400 border border-primary-500/40' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}>
            {t === 'all' ? 'All' : TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Trash2 className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-slate-400 font-medium">Trash is empty</p>
          <p className="text-slate-600 text-sm mt-1">Deleted items will appear here for 30 days</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <div key={item.id} className="card flex items-center gap-3 py-3 px-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[item.item_type] ?? 'bg-slate-700 text-slate-300'}`}>
                    {TYPE_LABELS[item.item_type] ?? item.item_type}
                  </span>
                  <span className="text-xs text-slate-500">
                    {item.deleted_by === 'web' ? 'Web' : 'Desktop'}
                  </span>
                </div>
                <p className="text-white text-sm truncate">{itemSummary(item)}</p>
                <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                  <Clock className="w-3 h-3" />
                  <span>{daysLeft(item.expires_at)} days left</span>
                  <span className="mx-1">·</span>
                  <span>Deleted {new Date(item.deleted_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleRestore(item)}
                  disabled={restoring === item.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded-lg transition-colors disabled:opacity-50"
                  title="Restore"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${restoring === item.id ? 'animate-spin' : ''}`} />
                  {restoring === item.id ? 'Restoring...' : 'Restore'}
                </button>
                <button
                  onClick={() => handlePermanentDelete(item)}
                  className="p-1.5 text-slate-600 hover:text-red-400 transition-colors"
                  title="Delete permanently"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
