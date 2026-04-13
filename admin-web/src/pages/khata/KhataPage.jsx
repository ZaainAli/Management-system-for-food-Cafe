import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Pencil, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/AuthContext';
import { jsPDF } from 'jspdf';
import TransactionModal from './TransactionModal';
import ProfileModal from './ProfileModal';
import BranchSelector from '../../components/BranchSelector';
import { formatPkDateForView } from '@/utils/datetime';

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
  const [filter, setFilter]                 = useState('all'); // 'all', 'supplier', 'customer'

  const branchId = activeBranch?.id;

  const filteredProfiles = profiles.filter(p => {
    if (filter === 'all') return true;
    return p.profile_type === filter;
  });

  // ── Fetch profiles ────────────────────────────────────────────
  const fetchProfiles = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    const [{ data: profileData }, { data: txData }] = await Promise.all([
      supabase.from('khata_profiles').select('id, name, phone, notes, profile_type').eq('branch_id', branchId).order('name'),
      supabase.from('khata_transactions').select('profile_id, type, amount').eq('branch_id', branchId),
    ]);
    const balanceMap = {};
    (txData ?? []).forEach((t) => {
      if (!balanceMap[t.profile_id]) balanceMap[t.profile_id] = 0;
      balanceMap[t.profile_id] += t.type === 'due' ? Number(t.amount) : -Number(t.amount);
    });
    setProfiles((profileData ?? []).map((p) => ({ ...p, balance: balanceMap[p.id] ?? 0 })));
    setLoading(false);
  }, [branchId]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  // ── Fetch transactions for selected profile ───────────────────
  const fetchTransactions = useCallback(async (profileId) => {
    setTxLoading(true);
    const { data } = await supabase
      .from('khata_transactions')
      .select('id, type, amount, note, date, payment_source, expense_id')
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
  const txWithBalanceDesc = [...txWithBalance].reverse();

  const downloadSelectedProfilePdf = () => {
    if (!selected) return;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const PX = 30, PW = 595.28, PH = 841.89, CW = PW - PX * 2;

    // ── helpers ────────────────────────────────────────────────
    const fill = (x, y, w, h, color) => { doc.setFillColor(color); doc.rect(x, y, w, h, 'F'); };
    const hline = (y) => { doc.setDrawColor('#e2e8f0'); doc.setLineWidth(0.5); doc.line(PX, y, PX + CW, y); };
    const t = (str, x, y, size, color, bold = false, opts = {}) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor(color);
      doc.text(String(str ?? ''), x, y, { baseline: 'top', ...opts });
    };
    const truncate = (str, maxW) => {
      let s = String(str ?? '');
      if (doc.getTextWidth(s) <= maxW) return s;
      while (s.length > 0 && doc.getTextWidth(s + '...') > maxW) s = s.slice(0, -1);
      return s + '...';
    };
    const drawTypeTag = (x, y, profileType) => {
      const isCustomer = profileType === 'customer';
      const label = isCustomer ? 'Customer' : 'Supplier';
      const bg    = isCustomer ? '#064e3b' : '#1e3a5f';
      const fg    = isCustomer ? '#6ee7b7' : '#93c5fd';
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
      const tw = doc.getTextWidth(label);
      doc.setFillColor(bg);
      doc.roundedRect(x, y, tw + 8, 11, 5, 5, 'F');
      doc.setTextColor(fg);
      doc.text(label, x + 4, y + 2.5, { baseline: 'top' });
    };

    // ── page 1 background ──────────────────────────────────────
    fill(0, 0, PW, PH, '#f1f5f9');

    // ── cover header ───────────────────────────────────────────
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    fill(PX, 30, CW, 90, '#1e293b');
    t(activeBranch?.name ?? "Hamza & Brother's Food Chain", PX + 16, 44, 18, '#ffffff', true);
    t(selected.name, PX + 16, 66, 9, '#94a3b8');
    // profile type tag in header
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    drawTypeTag(PX + 16 + doc.getTextWidth(selected.name) + 6, 66, selected.profile_type);
    doc.setFillColor('#334155');
    doc.roundedRect(PX + 16, 86, 170, 20, 10, 10, 'F');
    t('Khata Transactions', PX + 24, 92, 8, '#94a3b8');
    t(dateStr, PX + CW - 10, 48, 13, '#ffffff', true, { align: 'right' });
    t(timeStr, PX + CW - 10, 68, 10, '#94a3b8', false, { align: 'right' });

    let y = 132;

    // ── khata banner ───────────────────────────────────────────
    fill(PX, y, CW, 34, '#d97706');
    doc.setFillColor('#ffffff');
    doc.circle(PX + 23, y + 17, 5, 'F');
    t('Khata', PX + 36, y + 11, 13, '#ffffff', true);
    y += 34;

    // ── profile info row ───────────────────────────────────────
    const INFO_H = 40;
    const balStr = `Rs ${Math.abs(finalBalance).toLocaleString()} ${finalBalance >= 0 ? '(-)' : '(+)'} `;
    const dateLabel = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const infoCards = [
      { label: 'Profile Name', value: selected.name },
      { label: 'Phone',        value: selected.phone || '\u2014' },
      { label: 'Date',         value: dateLabel },
    ];
    const infoW = CW / infoCards.length;
    fill(PX, y, CW, INFO_H, '#ffffff');
    infoCards.forEach((c, j) => {
      const cx = PX + infoW * j;
      if (j > 0) { doc.setDrawColor('#e2e8f0'); doc.setLineWidth(0.5); doc.line(cx, y + 6, cx, y + INFO_H - 6); }
      t(c.label.toUpperCase(), cx + 8, y + 7, 7, '#94a3b8', true);
      t(truncate(String(c.value), infoW - 16), cx + 8, y + 20, 12, '#1e293b', true);
      if (j === 0) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
        const nameW = doc.getTextWidth(truncate(String(c.value), infoW - 16));
        drawTypeTag(cx + 8 + nameW + 5, y + 20, selected.profile_type);
      }
    });
    hline(y + INFO_H);
    y += INFO_H;

    // ── summary bar (Due / Payment / Net Balance) ──────────────
    const totalDue     = transactions.filter(tx => tx.type === 'due').reduce((s, tx) => s + Number(tx.amount), 0);
    const totalPayment = transactions.filter(tx => tx.type === 'payment').reduce((s, tx) => s + Number(tx.amount), 0);
    const CELL_H = 46;
    const summaryCards = [
      { label: 'Total Due',     value: `Rs ${totalDue.toLocaleString()}`,     color: '#ef4444' },
      { label: 'Total Payment', value: `Rs ${totalPayment.toLocaleString()}`, color: '#22c55e' },
      { label: 'Net Balance',   value: balStr,                                color: finalBalance > 0 ? '#ef4444' : finalBalance < 0 ? '#22c55e' : '#64748b' },
    ];
    const cardW = CW / summaryCards.length;
    fill(PX, y, CW, CELL_H, '#f8fafc');
    summaryCards.forEach((c, j) => {
      const cx = PX + cardW * j;
      if (j > 0) { doc.setDrawColor('#e2e8f0'); doc.setLineWidth(0.5); doc.line(cx, y + 6, cx, y + CELL_H - 6); }
      t(c.label.toUpperCase(), cx + 8, y + 8, 7, '#94a3b8', true);
      t(truncate(String(c.value), cardW - 16), cx + 8, y + 22, 13, c.color, true);
    });
    hline(y + CELL_H);
    y += CELL_H;

    // ── sub-label ──────────────────────────────────────────────
    fill(PX, y, CW, 24, '#f8fafc');
    hline(y + 24);
    t('TRANSACTIONS', PX + 10, y + 8, 8, '#64748b', true);
    y += 24;

    // ── transaction table ──────────────────────────────────────
    const HEADERS = ['Date', 'Due', 'Payment', 'Note', 'Balance'];
    const COL_HDR_H = 22, ROW_PAD = 5, LINE_H = 10;
    // fixed col widths: Date, Due, Payment, Note (flexible), Balance
    const colWidths = [85, 70, 70, CW - 85 - 70 - 70 - 75, 75];
    const colX = colWidths.reduce((acc, w, i) => { acc.push(i === 0 ? PX : acc[i - 1] + colWidths[i - 1]); return acc; }, []);

    const drawHeaders = (atY) => {
      fill(PX, atY, CW, COL_HDR_H, '#f8fafc');
      HEADERS.forEach((h, i) => t(h.toUpperCase(), colX[i] + 6, atY + 7, 7.5, '#94a3b8', true));
      hline(atY + COL_HDR_H);
      return atY + COL_HDR_H;
    };

    y = drawHeaders(y);

    if (txWithBalance.length === 0) {
      fill(PX, y, CW, LINE_H + 10, '#ffffff');
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor('#94a3b8');
      doc.text('No data available', PX + CW / 2, y + 7, { baseline: 'top', align: 'center' });
      y += LINE_H + 10;
      hline(y);
    } else {
      [...txWithBalance].reverse().forEach((tx, idx) => {
        const noteW = colWidths[3] - 12;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
        const noteLines = doc.splitTextToSize(tx.note || '\u2014', noteW);
        const rowH = Math.max(LINE_H, noteLines.length * LINE_H) + ROW_PAD * 2;

        if (y + rowH > PH - 30) {
          doc.addPage();
          fill(0, 0, PW, PH, '#f1f5f9');
          y = 30;
          y = drawHeaders(y);
        }

        fill(PX, y, CW, rowH, idx % 2 === 0 ? '#ffffff' : '#f8fafc');
        const runBalStr = `Rs ${Math.abs(tx.runningBalance).toLocaleString()} ${tx.runningBalance >= 0 ? '(-)' : '(+)'}`;
        const dueStr  = tx.type === 'due'     ? `Rs ${Number(tx.amount).toLocaleString()}` : '\u2014';
        const payStr  = tx.type === 'payment' ? `Rs ${Number(tx.amount).toLocaleString()}` : '\u2014';
        const simpleCells = [formatPkDateForView(tx.date), dueStr, payStr, null, runBalStr];

        simpleCells.forEach((cell, i) => {
          if (cell === null) return; // note handled separately
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor('#334155');
          doc.text(truncate(String(cell ?? ''), colWidths[i] - 12), colX[i] + 6, y + ROW_PAD, { baseline: 'top' });
        });
        // note — wrapped
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor('#334155');
        doc.text(noteLines, colX[3] + 6, y + ROW_PAD, { baseline: 'top' });

        y += rowH;
      });
      hline(y);
    }

    // ── footer page ────────────────────────────────────────────
    doc.addPage();
    fill(0, 0, PW, PH, '#ffffff');
    hline(36);
    const dt = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
               ' at ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    t(`Generated on ${dt} \u2014 Confidential`, PX + CW / 2, 46, 8.5, '#94a3b8', false, { align: 'center' });

    const safeName = String(selected.name || 'khata').replace(/[^a-z0-9_-]+/gi, '_');
    doc.save(`${safeName}_transactions.pdf`);
  };

  const handleProfileCreated = async (profile) => {
    await fetchProfiles();
    if (profile?.id) selectProfile(profile);
  };

  // ── Delete transaction ────────────────────────────────────────
  const handleDeleteTx = async (tx) => {
    if (!confirm('Delete this transaction?')) return;

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('deleted_items').insert({
      branch_id:  branchId,
      item_type:  'khata_transaction',
      item_id:    tx.id,
      item_data:  { ...tx, profile_type: selected.profile_type, profile_name: selected.name, profile_id: selected.id },
      deleted_by: 'web',
      expires_at: expiresAt,
    });

    if (tx.type === 'payment') {
      await supabase.from('expenses').delete().eq('source_record_id', tx.id).eq('branch_id', branchId);
      const { data: ds } = await supabase
        .from('daily_sales').select('id, total_revenue, total_expenses, bill_count')
        .eq('branch_id', branchId).eq('date', tx.date).maybeSingle();
      if (ds) {
        if (selected.profile_type === 'customer') {
          await supabase.from('daily_sales').update({
            total_revenue: Math.max(0, parseFloat((ds.total_revenue - tx.amount).toFixed(2))),
            bill_count:    Math.max(0, ds.bill_count - 1),
          }).eq('id', ds.id);
        } else {
          await supabase.from('daily_sales').update({
            total_expenses: Math.max(0, parseFloat((ds.total_expenses - tx.amount).toFixed(2))),
          }).eq('id', ds.id);
        }
      }
    }

    await supabase.from('khata_transactions').delete().eq('id', tx.id);
    fetchTransactions(selected.id);
    fetchProfiles();
  };

  // ── Delete profile ────────────────────────────────────────────
  const handleDeleteProfile = async (p) => {
    if (!confirm(`Delete profile "${p.name}" and all its transactions?`)) return;
    // Fetch all transactions before deleting
    const { data: txs } = await supabase
      .from('khata_transactions').select('*')
      .eq('profile_id', p.id).eq('branch_id', branchId);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('deleted_items').insert({
      branch_id:  branchId,
      item_type:  'khata_profile',
      item_id:    p.id,
      item_data:  { ...p, transactions: txs ?? [] },
      deleted_by: 'web',
      expires_at: expiresAt,
    });
    await supabase.from('khata_profiles').delete().eq('id', p.id);
    if (selected?.id === p.id) { setSelected(null); setTransactions([]); }
    fetchProfiles();
  };

  if (!branchId) return <div className="text-slate-500 text-sm">Select a branch to view Khata.</div>;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Khata (Ledger)</h1>
          <p className="text-slate-500 text-sm mt-0.5">{activeBranch.name}</p>
        </div>
        <BranchSelector />
      </div>

      <div className="flex flex-col lg:flex-row gap-4 h-auto lg:h-[calc(100vh-10rem)]">

        {/* ── Profiles panel ── */}
        <div className="w-full lg:w-64 lg:flex-shrink-0 flex flex-col card p-0 overflow-hidden max-h-[40vh] lg:max-h-none">
          <div className="px-3 py-3 border-b border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 text-sm font-medium">Profiles</span>
              <button onClick={() => setShowProfileModal(true)} className="text-primary-400 hover:text-primary-300 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setFilter('all')} className={`flex-1 text-[10px] py-1 px-2 rounded transition-colors ${filter === 'all' ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'}`}>All</button>
              <button onClick={() => setFilter('supplier')} className={`flex-1 text-[10px] py-1 px-2 rounded transition-colors ${filter === 'supplier' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'}`}>Supplier</button>
              <button onClick={() => setFilter('customer')} className={`flex-1 text-[10px] py-1 px-2 rounded transition-colors ${filter === 'customer' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'}`}>Customer</button>
            </div>
          </div>

          {/* Profile list */}
          <div className="flex-1 overflow-y-auto">
            {loading
              ? [1,2,3].map((i) => <div key={i} className="mx-3 my-1.5 h-8 bg-slate-700/50 rounded animate-pulse" />)
              : filteredProfiles.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => selectProfile(p)}
                    className={`flex items-center justify-between px-3 py-2.5 cursor-pointer group transition-colors
                      ${selected?.id === p.id ? 'bg-primary-500/10 border-l-2 border-primary-500' : 'hover:bg-slate-700/50 border-l-2 border-transparent'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm truncate ${selected?.id === p.id ? 'text-primary-400' : 'text-slate-300'}`}>
                        {p.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${p.profile_type === 'customer' ? 'bg-emerald-700/50 text-emerald-300' : 'bg-blue-700/50 text-blue-300'}`}>
                          {p.profile_type === 'customer' ? 'Customer' : 'Supplier'}
                        </span>
                        <span className="text-[11px] text-slate-500 truncate">{p.phone || 'No phone'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {p.balance !== 0 && (
                        <span className={`text-[11px] font-semibold ${p.balance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          PKR {Math.abs(p.balance).toLocaleString()} {p.balance > 0 ? '(-)' : '(+)'}
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteProfile(p); }}
                        className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
            }
            {!loading && filteredProfiles.length === 0 && (
              <p className="px-3 py-4 text-slate-600 text-xs text-center">
                {filter === 'all' ? 'No profiles yet' : `No ${filter === 'supplier' ? 'supplier' : 'customer'} profiles`}
              </p>
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
                      ? `Main Laina ha == Rs ${finalBalance.toLocaleString()}`
                      : finalBalance < 0
                      ? `Main daina ha == Rs ${Math.abs(finalBalance).toLocaleString()}`
                      : 'Clear'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadSelectedProfilePdf}
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

              {/* ── Summary bar ── */}
              {(() => {
                const totalDue     = transactions.filter(tx => tx.type === 'due').reduce((s, tx) => s + Number(tx.amount), 0);
                const totalPayment = transactions.filter(tx => tx.type === 'payment').reduce((s, tx) => s + Number(tx.amount), 0);
                return (
                  <div className="grid grid-cols-3 border-b border-slate-700 divide-x divide-slate-700">
                    <div className="px-4 py-2.5 text-center">
                      <p className="text-[10px] text-slate-500 uppercase font-medium tracking-wide">Total Due</p>
                      <p className="text-sm font-semibold text-red-400 mt-0.5">Rs {totalDue.toLocaleString()}</p>
                    </div>
                    <div className="px-4 py-2.5 text-center">
                      <p className="text-[10px] text-slate-500 uppercase font-medium tracking-wide">Total Payment</p>
                      <p className="text-sm font-semibold text-green-400 mt-0.5">Rs {totalPayment.toLocaleString()}</p>
                    </div>
                    <div className="px-4 py-2.5 text-center">
                      <p className="text-[10px] text-slate-500 uppercase font-medium tracking-wide">Net Balance</p>
                      <p className={`text-sm font-semibold mt-0.5 ${finalBalance > 0 ? 'text-red-400' : finalBalance < 0 ? 'text-green-400' : 'text-slate-400'}`}>
                        Rs {Math.abs(finalBalance).toLocaleString()}
                        <span className="text-[10px] ml-1">{finalBalance > 0 ? '(-)' : finalBalance < 0 ? '(+)' : ''}</span>
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Transaction table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="sticky top-0 bg-slate-800">
                    <tr className="border-b border-slate-700">
                      <th className="text-left px-4 py-2.5 text-slate-400 font-medium text-xs uppercase">Date</th>
                      <th className="text-left px-4 py-2.5 text-red-400 font-medium text-xs uppercase">Due</th>
                      <th className="text-left px-4 py-2.5 text-green-400 font-medium text-xs uppercase">Payment</th>
                      <th className="text-left px-4 py-2.5 text-slate-400 font-medium text-xs uppercase">Note</th>
                      <th className="text-left px-4 py-2.5 text-slate-400 font-medium text-xs uppercase">Balance</th>
                      <th className="px-4 py-2.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {txLoading
                      ? [1,2].map((i) => <tr key={i}><td colSpan={6} className="px-4 py-2"><div className="h-4 bg-slate-700/50 rounded animate-pulse" /></td></tr>)
                      : txWithBalanceDesc.map((t) => (
                          <tr key={t.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                            <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">{formatPkDateForView(t.date)}</td>
                            <td className="px-4 py-2.5 text-red-400 font-medium whitespace-nowrap">
                              {t.type === 'due' ? `Rs ${Number(t.amount).toLocaleString()}` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-green-400 font-medium whitespace-nowrap">
                              {t.type === 'payment' ? `Rs ${Number(t.amount).toLocaleString()}` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 text-xs">{t.note || '—'}</td>
                            <td className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap ${t.runningBalance > 0 ? 'text-red-400' : t.runningBalance < 0 ? 'text-green-400' : 'text-slate-500'}`}>
                              Rs {Math.abs(t.runningBalance).toLocaleString()}
                              {t.runningBalance > 0 ? '(-)' : t.runningBalance < 0 ? '(+)' : ''}
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
                                <button onClick={() => handleDeleteTx(t)} className="text-slate-600 hover:text-red-400 transition-colors">
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
          profileType={selected.profile_type}
          profileName={selected.name}
          transaction={editingTx}
          onClose={() => { setShowTxModal(false); setEditingTx(null); }}
          onSaved={() => { fetchTransactions(selected.id); fetchProfiles(); }}
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
