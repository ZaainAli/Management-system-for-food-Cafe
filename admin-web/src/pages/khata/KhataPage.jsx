import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Pencil, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/AuthContext';
import TransactionModal from './TransactionModal';
import ProfileModal from './ProfileModal';

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export default function KhataPage() {
  const { activeBranch } = useAuth();
  const [profiles, setProfiles]             = useState([]);
  const [selected, setSelected]             = useState(null);   // active profile
  const [transactions, setTransactions]     = useState([]);
  const [loading, setLoading]               = useState(true);
  const [txLoading, setTxLoading]           = useState(false);
  const [showTxModal, setShowTxModal]       = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingTx, setEditingTx]           = useState(null);

  const branchId = activeBranch?.id;

  // ── Fetch profiles ────────────────────────────────────────────
  const fetchProfiles = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    const { data } = await supabase
      .from('khata_profiles')
      .select('id, name, phone, notes')
      .eq('branch_id', branchId)
      .order('name');
    setProfiles(data ?? []);
    setLoading(false);
  }, [branchId]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  // ── Fetch transactions for selected profile ───────────────────
  const fetchTransactions = useCallback(async (profileId) => {
    setTxLoading(true);
    const { data } = await supabase
      .from('khata_transactions')
      .select('id, type, amount, note, date')
      .eq('profile_id', profileId)
      .order('date', { ascending: true });
    setTransactions(data ?? []);
    setTxLoading(false);
  }, []);

  const selectProfile = (p) => { setSelected(p); fetchTransactions(p.id); };

  // ── Balance calculation ───────────────────────────────────────
  const balanceFor = (txs) =>
    txs.reduce((sum, t) => t.type === 'due' ? sum + Number(t.amount) : sum - Number(t.amount), 0);

  const profileBalance = (pid) => {
    // We'll compute per-profile balance only for the selected one in real time
    // For the list we show the sum from all transactions fetched
    return 0; // placeholder — computed below for selected
  };

  // Running balance per transaction row
  let running = 0;
  const txWithBalance = transactions.map((t) => {
    running = t.type === 'due' ? running + Number(t.amount) : running - Number(t.amount);
    return { ...t, runningBalance: running };
  });
  const finalBalance = txWithBalance[txWithBalance.length - 1]?.runningBalance ?? 0;

  const downloadSelectedProfileCsv = () => {
    if (!selected) return;

    const rows = [
      ['Profile Name', selected.name],
      ['Phone', selected.phone || ''],
      ['Notes', selected.notes || ''],
      ['Current Balance', finalBalance],
      [],
      ['Date', 'Type', 'Amount', 'Note', 'Running Balance'],
      ...txWithBalance.map((t) => [t.date, t.type, t.amount, t.note || '', t.runningBalance]),
    ];

    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = String(selected.name || 'khata_profile').replace(/[^a-z0-9_-]+/gi, '_');
    a.href = url;
    a.download = `${safeName}_transactions.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleProfileCreated = async (profile) => {
    await fetchProfiles();
    if (profile?.id) selectProfile(profile);
  };

  // ── Delete transaction ────────────────────────────────────────
  const handleDeleteTx = async (id) => {
    if (!confirm('Delete this transaction?')) return;
    await supabase.from('khata_transactions').delete().eq('id', id);
    fetchTransactions(selected.id);
  };

  // ── Delete profile ────────────────────────────────────────────
  const handleDeleteProfile = async (p) => {
    if (!confirm(`Delete profile "${p.name}" and all its transactions?`)) return;
    await supabase.from('khata_profiles').delete().eq('id', p.id);
    if (selected?.id === p.id) { setSelected(null); setTransactions([]); }
    fetchProfiles();
  };

  if (!branchId) return <div className="text-slate-500 text-sm">Select a branch to view Khata.</div>;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Khata (Ledger)</h1>
        <p className="text-slate-500 text-sm mt-0.5">{activeBranch.name}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 h-auto lg:h-[calc(100vh-10rem)]">

        {/* ── Profiles panel ── */}
        <div className="w-full lg:w-64 lg:flex-shrink-0 flex flex-col card p-0 overflow-hidden max-h-[40vh] lg:max-h-none">
          <div className="px-3 py-3 border-b border-slate-700 flex items-center justify-between">
            <span className="text-slate-300 text-sm font-medium">Profiles</span>
            <button onClick={() => setShowProfileModal(true)} className="text-primary-400 hover:text-primary-300 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Profile list */}
          <div className="flex-1 overflow-y-auto">
            {loading
              ? [1,2,3].map((i) => <div key={i} className="mx-3 my-1.5 h-8 bg-slate-700/50 rounded animate-pulse" />)
              : profiles.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => selectProfile(p)}
                    className={`flex items-center justify-between px-3 py-2.5 cursor-pointer group transition-colors
                      ${selected?.id === p.id ? 'bg-primary-500/10 border-l-2 border-primary-500' : 'hover:bg-slate-700/50 border-l-2 border-transparent'}`}
                  >
                    <div className="min-w-0">
                      <p className={`text-sm truncate ${selected?.id === p.id ? 'text-primary-400' : 'text-slate-300'}`}>
                        {p.name}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {p.phone || 'No phone'}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteProfile(p); }}
                      className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
            }
            {!loading && profiles.length === 0 && (
              <p className="px-3 py-4 text-slate-600 text-xs text-center">No profiles yet</p>
            )}
          </div>
        </div>

        {/* ── Transactions panel ── */}
        <div className="flex-1 min-w-0 flex flex-col card p-0 overflow-hidden h-[55vh] lg:h-auto">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
              Select a profile to view transactions
            </div>
          ) : (
            <>
              {/* Panel header */}
              <div className="px-4 py-3 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-white font-semibold">{selected.name}</h2>
                  <p className={`text-xs mt-0.5 font-medium ${finalBalance > 0 ? 'text-red-400' : finalBalance < 0 ? 'text-green-400' : 'text-slate-500'}`}>
                    {finalBalance > 0
                      ? `Owes Rs ${finalBalance.toLocaleString()}`
                      : finalBalance < 0
                      ? `Credit Rs ${Math.abs(finalBalance).toLocaleString()}`
                      : 'Settled'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadSelectedProfileCsv}
                    className="px-3 py-1.5 rounded-md border border-slate-600 text-slate-300 text-xs hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </button>
                  <button onClick={() => { setEditingTx(null); setShowTxModal(true); }} className="btn-primary text-xs py-1.5 px-3">
                    + Transaction
                  </button>
                </div>
              </div>

              {/* Transaction table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="sticky top-0 bg-slate-800">
                    <tr className="border-b border-slate-700">
                      <th className="text-left px-4 py-2.5 text-slate-400 font-medium text-xs uppercase">Date</th>
                      <th className="text-left px-4 py-2.5 text-slate-400 font-medium text-xs uppercase">Type</th>
                      <th className="text-left px-4 py-2.5 text-slate-400 font-medium text-xs uppercase">Amount</th>
                      <th className="text-left px-4 py-2.5 text-slate-400 font-medium text-xs uppercase hidden sm:table-cell">Note</th>
                      <th className="text-left px-4 py-2.5 text-slate-400 font-medium text-xs uppercase">Balance</th>
                      <th className="px-4 py-2.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {txLoading
                      ? [1,2].map((i) => <tr key={i}><td colSpan={6} className="px-4 py-2"><div className="h-4 bg-slate-700/50 rounded animate-pulse" /></td></tr>)
                      : txWithBalance.map((t) => (
                          <tr key={t.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                            <td className="px-4 py-2.5 text-slate-400 text-xs">{t.date}</td>
                            <td className="px-4 py-2.5">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.type === 'due' ? 'bg-red-900/40 text-red-400' : 'bg-green-900/40 text-green-400'}`}>
                                {t.type}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">Rs {Number(t.amount).toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-slate-500 text-xs hidden sm:table-cell">{t.note || '—'}</td>
                            <td className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap ${t.runningBalance > 0 ? 'text-red-400' : t.runningBalance < 0 ? 'text-green-400' : 'text-slate-500'}`}>
                              Rs {Math.abs(t.runningBalance).toLocaleString()}
                              {t.runningBalance > 0 ? ' DR' : t.runningBalance < 0 ? ' CR' : ''}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => { setEditingTx(t); setShowTxModal(true); }}
                                  className="text-slate-600 hover:text-primary-400 transition-colors"
                                  title="Edit transaction"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button onClick={() => handleDeleteTx(t.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    }
                    {!txLoading && transactions.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-600 text-sm">
                        No transactions yet. Click <strong className="text-slate-500">+ Transaction</strong>.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {showTxModal && selected && (
        <TransactionModal
          profileId={selected.id}
          branchId={branchId}
          transaction={editingTx}
          onClose={() => { setShowTxModal(false); setEditingTx(null); }}
          onSaved={() => fetchTransactions(selected.id)}
        />
      )}

      {showProfileModal && (
        <ProfileModal
          branchId={branchId}
          onClose={() => setShowProfileModal(false)}
          onSaved={handleProfileCreated}
        />
      )}
    </div>
  );
}
