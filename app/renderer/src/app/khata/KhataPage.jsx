import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { useAuth } from '../../store/AuthContext';
import { getPkToday } from '../../utils/datetime';

const today = () => getPkToday();

const emptyProfileForm = { name: '', phone: '', businessDetails: '', profileType: 'supplier' };
const emptyTxForm    = { id: '', type: 'due', amount: '', date: today(), note: '', paymentSource: 'today_sale' };
const emptyAddTxForm = { type: 'due', amount: '', date: today(), note: '', paymentSource: 'today_sale' };

const evalAmount = (expr) => {
  const parts = String(expr).split('+').map(p => parseFloat(p.trim()));
  if (parts.some(isNaN)) return NaN;
  return parts.reduce((a, b) => a + b, 0);
};

export default function KhataPage() {
  const { user } = useAuth();
  const isCashier = user?.role === 'cashier';

  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeData, setActiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branchName, setBranchName] = useState("Hamza & Brother's Food Chain");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showTxModal, setShowTxModal] = useState(false);
  const [txForm, setTxForm] = useState(emptyTxForm);
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [addTxForm, setAddTxForm] = useState(emptyAddTxForm);

  const fetchProfiles = async () => {
    const res = await window.api.khata.getAll();
    if (res.success) {
      setProfiles(res.data);
      if (res.data.length === 0) {
        setActiveId(null);
      } else if (!activeId || !res.data.some((p) => p.id === activeId)) {
        setActiveId(res.data[0].id);
      }
    }
    setLoading(false);
  };

  const fetchActive = async (id) => {
    if (!id) { setActiveData(null); return; }
    const res = await window.api.khata.getById({ id });
    if (res.success) setActiveData(res.data);
  };

  useEffect(() => {
    fetchProfiles();
    window.api.setup.getBranchInfo().then(res => {
      if (res.success && res.data?.name) setBranchName(res.data.name);
    });
  }, []);
  useEffect(() => { fetchActive(activeId); }, [activeId]);

  const activeProfile = activeData?.profile;
  const transactions = activeData?.transactions || [];
  const balance = useMemo(() => activeProfile?.balance || 0, [activeProfile]);

  // Running balance per row (ascending order)
  let running = 0;
  const txWithBalance = transactions.map((t) => {
    running = t.type === 'due' ? running + Number(t.amount) : running - Number(t.amount);
    return { ...t, runningBalance: running };
  });
  const txDesc = [...txWithBalance].reverse();

  // Summary totals
  const totalDue     = transactions.filter(t => t.type === 'due').reduce((s, t) => s + Number(t.amount), 0);
  const totalPayment = transactions.filter(t => t.type === 'payment').reduce((s, t) => s + Number(t.amount), 0);

  const handleAddProfile = async () => {
    setError(''); setMessage('');
    const res = await window.api.khata.addProfile(profileForm);
    if (res.success) {
      setShowProfileModal(false);
      setProfileForm(emptyProfileForm);
      await fetchProfiles();
    } else {
      setError(res.error || 'Failed to add profile');
    }
  };

  const handleAddTransaction = async () => {
    setError(''); setMessage('');
    const resolved = evalAmount(addTxForm.amount);
    if (isNaN(resolved) || resolved <= 0) { setError('Enter a valid amount.'); return; }
    const api = addTxForm.type === 'due' ? window.api.khata.addDue : window.api.khata.addPayment;
    const payload = addTxForm.type === 'due'
      ? { amount: resolved, date: addTxForm.date, note: addTxForm.note, khataId: activeId }
      : { amount: resolved, date: addTxForm.date, note: addTxForm.note, paymentSource: addTxForm.paymentSource, khataId: activeId };
    const res = await api(payload);
    if (res.success) {
      setShowAddTxModal(false);
      setAddTxForm(emptyAddTxForm);
      await Promise.all([fetchProfiles(), fetchActive(activeId)]);
    } else {
      setError(res.error || 'Failed to add transaction');
    }
  };


  const openEditTransaction = (tx) => {
    setError(''); setMessage('');
    setTxForm({
      id: tx.id,
      type: tx.type,
      amount: String(tx.amount),
      date: tx.date,
      note: tx.note || '',
      paymentSource: tx.paymentSource || 'today_sale',
    });
    setShowTxModal(true);
  };

 const handleSaveTransaction = async () => {
    setError(''); setMessage('');
    const resolved = evalAmount(txForm.amount);
    if (isNaN(resolved) || resolved <= 0) { setError('Enter a valid amount.'); return; }
    
    const api = txForm.type === 'due' ? window.api.khata.updateDue : window.api.khata.updateTransaction;
    const res = await api({
      id: txForm.id,
      amount: resolved,
      date: txForm.date,
      note: txForm.note,
      paymentSource: txForm.type === 'payment' ? txForm.paymentSource : null,
    });
    if (res.success) {
      setShowTxModal(false);
      setTxForm(emptyTxForm);
      await Promise.all([fetchProfiles(), fetchActive(activeId)]);
    } else {
      setError(res.error || 'Failed to update transaction');
    }
  };
  const handleDeleteTransaction = async (txId) => {
    if (!confirm('Delete this transaction?')) return;
    setError(''); setMessage('');
    const res = await window.api.khata.deleteTransaction({ id: txId });
    if (res.success) {
      await Promise.all([fetchProfiles(), fetchActive(activeId)]);
    } else {
      setError(res.error || 'Failed to delete transaction');
    }
  };

  const handleDeleteProfile = async () => {
    if (!activeProfile) return;
    if (!confirm(`Delete khata profile "${activeProfile.name}" and all its transactions?`)) return;
    setError(''); setMessage('');
    const res = await window.api.khata.deleteProfile({ id: activeProfile.id });
    if (res.success) {
      await Promise.all([fetchProfiles(), fetchActive(activeId)]);
    } else {
      setError(res.error || 'Failed to delete profile');
    }
  };

  const handleClearTransactions = async () => {
    if (!activeProfile) return;
    if (!confirm(`Clear all transactions for "${activeProfile.name}"?`)) return;
    setError(''); setMessage('');
    const res = await window.api.khata.clearTransactions({ khataId: activeProfile.id });
    if (res.success) {
      setMessage('All transactions cleared.');
      await Promise.all([fetchProfiles(), fetchActive(activeId)]);
    } else {
      setError(res.error || 'Failed to clear transactions');
    }
  };

  const downloadSelectedProfilePdf = () => {
    if (!activeProfile) return;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const PX = 30, PW = 595.28, PH = 841.89, CW = PW - PX * 2;

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

    // page background
    fill(0, 0, PW, PH, '#f1f5f9');

    // cover header
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    fill(PX, 30, CW, 90, '#1e293b');
    t(branchName, PX + 16, 44, 18, '#ffffff', true);
    t(activeProfile.name, PX + 16, 66, 9, '#94a3b8');
    // profile type tag in header
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    drawTypeTag(PX + 16 + doc.getTextWidth(activeProfile.name) + 6, 66, activeProfile.profileType);
    doc.setFillColor('#334155');
    doc.roundedRect(PX + 16, 86, 170, 20, 10, 10, 'F');
    t('Khata Transactions', PX + 24, 92, 8, '#94a3b8');
    t(dateStr, PX + CW - 10, 48, 13, '#ffffff', true, { align: 'right' });
    t(timeStr, PX + CW - 10, 68, 10, '#94a3b8', false, { align: 'right' });

    let y = 132;

    // khata banner
    fill(PX, y, CW, 34, '#d97706');
    doc.setFillColor('#ffffff');
    doc.circle(PX + 23, y + 17, 5, 'F');
    t('Khata', PX + 36, y + 11, 13, '#ffffff', true);
    y += 34;

    // profile info row
    const INFO_H = 40;
    const dateLabel = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const infoCards = [
      { label: 'Profile Name', value: activeProfile.name },
      { label: 'Phone',        value: activeProfile.phone || '\u2014' },
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
        drawTypeTag(cx + 8 + nameW + 5, y + 20, activeProfile.profileType);
      }
    });
    hline(y + INFO_H);
    y += INFO_H;

    // summary bar
    const balStr = `Rs ${Math.abs(balance).toLocaleString()} ${balance >= 0 ? '(-)' : '(+)'}`;
    const CELL_H = 46;
    const summaryCards = [
      { label: 'Total Due',     value: `Rs ${totalDue.toLocaleString()}`,     color: '#ef4444' },
      { label: 'Total Payment', value: `Rs ${totalPayment.toLocaleString()}`, color: '#22c55e' },
      { label: 'Net Balance',   value: balStr,                                color: balance > 0 ? '#ef4444' : balance < 0 ? '#22c55e' : '#64748b' },
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

    // sub-label
    fill(PX, y, CW, 24, '#f8fafc');
    hline(y + 24);
    t('TRANSACTIONS', PX + 10, y + 8, 8, '#64748b', true);
    y += 24;

    // transaction table
    const HEADERS = ['Date', 'Due', 'Payment', 'Note', 'Balance'];
    const COL_HDR_H = 22, ROW_PAD = 5, LINE_H = 10;
    const colWidths = [65, 70, 70, CW - 65 - 70 - 70 - 75, 75];
    const colX = colWidths.reduce((acc, _w, i) => { acc.push(i === 0 ? PX : acc[i - 1] + colWidths[i - 1]); return acc; }, []);

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
        const simpleCells = [tx.date, dueStr, payStr, null, runBalStr];

        simpleCells.forEach((cell, i) => {
          if (cell === null) return;
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor('#334155');
          doc.text(truncate(String(cell ?? ''), colWidths[i] - 12), colX[i] + 6, y + ROW_PAD, { baseline: 'top' });
        });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor('#334155');
        doc.text(noteLines, colX[3] + 6, y + ROW_PAD, { baseline: 'top' });

        y += rowH;
      });
      hline(y);
    }

    // footer page
    doc.addPage();
    fill(0, 0, PW, PH, '#ffffff');
    hline(36);
    const dt = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
               ' at ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    t(`Generated on ${dt} \u2014 Confidential`, PX + CW / 2, 46, 8.5, '#94a3b8', false, { align: 'center' });

    const safeName = String(activeProfile.name || 'khata').replace(/[^a-z0-9_-]+/gi, '_');
    doc.save(`${safeName}_transactions.pdf`);
  };

  if (loading) return <div className="text-slate-400">Loading khata...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Profiles */}
      <div className="card lg:col-span-1">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-white">Khata (Ledger)</h1>
          <button onClick={() => setShowProfileModal(true)} className="btn-primary text-xs">+ New</button>
        </div>
        {isCashier && (
          <p className="text-amber-400 text-xs mb-3">
            Cashier can create profiles and add transactions only. Edit/Delete actions are restricted.
          </p>
        )}
        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
          {profiles.map(profile => (
            <button
              key={profile.id}
              onClick={() => setActiveId(profile.id)}
              className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                activeId === profile.id
                  ? 'border-primary-500 bg-primary-500/10'
                  : 'border-slate-700 bg-slate-800/50 hover:bg-slate-700/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-white font-medium">{profile.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${profile.profileType === 'customer' ? 'bg-emerald-700/50 text-emerald-300' : 'bg-blue-700/50 text-blue-300'}`}>
                      {profile.profileType === 'customer' ? 'Customer' : 'Supplier'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">{profile.phone || 'No phone'}</div>
                </div>
                <div className={`text-xs font-semibold ${profile.balance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  PKR {Math.abs(Number(profile.balance || 0)).toLocaleString()}
                  {profile.balance !== 0 && <span className="ml-0.5">{profile.balance > 0 ? '(-)' : '(+)'}</span>}
                </div>
              </div>
            </button>
          ))}
          {profiles.length === 0 && (
            <div className="text-slate-500 text-sm text-center py-6">No khata profiles yet</div>
          )}
        </div>
      </div>

      {/* Right: Details */}
      <div className="lg:col-span-2 space-y-6">
        {!activeProfile && (
          <div className="card text-slate-400">Select a khata profile to view details.</div>
        )}

        {activeProfile && (
          <>
            <div className="card">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-white text-lg font-semibold">{activeProfile.name}</h2>
                  <div className="text-sm text-slate-400">{activeProfile.phone || 'No phone'}</div>
                  <div className="text-sm text-slate-400">{activeProfile.businessDetails || 'No business details'}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Outstanding</div>
                  <div className={`text-xl font-bold ${balance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    PKR {Math.abs(Number(balance || 0)).toLocaleString()}
                    {balance !== 0 && <span className="text-sm ml-1">{balance > 0 ? '(-)' : '(+)'}</span>}
                  </div>
                  <div className="mt-3 flex flex-col gap-2 items-end">
                    <button
                      onClick={downloadSelectedProfilePdf}
                      className="btn-secondary text-xs"
                    >
                      Export PDF
                    </button>
                    <button
                      onClick={handleClearTransactions}
                      disabled={isCashier}
                      className="text-xs px-3 py-1.5 rounded-md bg-amber-700/70 hover:bg-amber-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Clear Transactions
                    </button>
                    <button
                      onClick={handleDeleteProfile}
                      disabled={isCashier}
                      className="text-xs px-3 py-1.5 rounded-md bg-red-700/70 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Delete Profile
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {error && <div className="card border-red-600 text-red-300 text-sm">{error}</div>}
            {message && <div className="card border-emerald-600 text-emerald-300 text-sm">{message}</div>}


            {/* Transactions */}
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-white font-semibold">Transactions</h3>
                <button onClick={() => { setError(''); setShowAddTxModal(true); }} className="btn-primary text-xs py-1.5 px-3">
                  + Add Transaction
                </button>
              </div>

              {/* Summary bar */}
              <div className="grid grid-cols-3 border-b border-slate-700 divide-x divide-slate-700">
                <div className="px-4 py-2.5 text-center">
                  <p className="text-[10px] text-slate-500 uppercase font-medium tracking-wide">Total Due</p>
                  <p className="text-sm font-semibold text-red-400 mt-0.5">PKR {totalDue.toLocaleString()}</p>
                </div>
                <div className="px-4 py-2.5 text-center">
                  <p className="text-[10px] text-slate-500 uppercase font-medium tracking-wide">Total Payment</p>
                  <p className="text-sm font-semibold text-emerald-400 mt-0.5">PKR {totalPayment.toLocaleString()}</p>
                </div>
                <div className="px-4 py-2.5 text-center">
                  <p className="text-[10px] text-slate-500 uppercase font-medium tracking-wide">Net Balance</p>
                  <p className={`text-sm font-semibold mt-0.5 ${balance > 0 ? 'text-red-400' : balance < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                    PKR {Math.abs(balance).toLocaleString()}
                    {balance !== 0 && <span className="text-[10px] ml-1">{balance > 0 ? '(-)' : '(+)'}</span>}
                  </p>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Date</th>
                    <th className="text-left px-4 py-3 text-red-400 font-medium text-xs uppercase">Due</th>
                    <th className="text-left px-4 py-3 text-emerald-400 font-medium text-xs uppercase">Payment</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Note</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Source</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium text-xs uppercase">Balance</th>
                    <th className="text-right px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {txDesc.map(tx => (
                    <tr key={tx.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 text-slate-400 text-xs">{tx.date}</td>
                      <td className="px-4 py-3 text-red-400 font-medium whitespace-nowrap">
                        {tx.type === 'due' ? `PKR ${Number(tx.amount).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-emerald-400 font-medium whitespace-nowrap">
                        {tx.type === 'payment' ? `PKR ${Number(tx.amount).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs">{tx.note || '—'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {tx.type === 'payment' ? (tx.paymentSource === 'net_profit' ? 'Net Profit' : 'Today Sale') : '—'}
                      </td>
                      <td className={`px-4 py-3 text-right text-xs font-semibold whitespace-nowrap ${tx.runningBalance > 0 ? 'text-red-400' : tx.runningBalance < 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                        PKR {Math.abs(tx.runningBalance).toLocaleString()}
                        {tx.runningBalance !== 0 && <span className="ml-1">{tx.runningBalance > 0 ? '(-)' : '(+)'}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditTransaction(tx)}
                            className="text-xs text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={Boolean(tx.linkedExpenseId) || isCashier}
                            title={
                              isCashier
                                ? 'Cashier cannot edit transactions'
                                : tx.linkedExpenseId
                                  ? 'Linked to expense, edit from Expenses tab'
                                  : 'Edit transaction'
                            }
                          >
                            Edit
                          </button>
                          {!isCashier && (
                            <button
                              onClick={() => handleDeleteTransaction(tx.id)}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-600 text-sm">No transactions yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="card w-96">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-semibold">New Khata Profile</h2>
              <button onClick={() => setShowProfileModal(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            {error && <div className="mb-3 text-red-300 text-sm">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="label">Profile Type</label>
                <div className="flex rounded-lg overflow-hidden border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setProfileForm({ ...profileForm, profileType: 'supplier' })}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${profileForm.profileType === 'supplier' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    Supplier
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileForm({ ...profileForm, profileType: 'customer' })}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${profileForm.profileType === 'customer' ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    Customer
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {profileForm.profileType === 'customer'
                    ? 'Customer: payments will be added to Sales.'
                    : 'Supplier: payments will be added to Expenses.'}
                </p>
              </div>
              <div>
                <label className="label">Name (Unique)</label>
                <input className="input-field" value={profileForm.name}
                  onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input-field" value={profileForm.phone}
                  onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">Business Details</label>
                <input className="input-field" value={profileForm.businessDetails}
                  onChange={e => setProfileForm({ ...profileForm, businessDetails: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleAddProfile} className="btn-primary flex-1">Save</button>
              <button onClick={() => setShowProfileModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddTxModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="card w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-semibold">Add Transaction</h2>
              <button onClick={() => setShowAddTxModal(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            {error && <div className="mb-3 bg-red-900/30 border border-red-700/50 text-red-300 text-sm rounded-lg px-4 py-2.5">{error}</div>}

            {/* Type toggle */}
            <div className="flex rounded-lg overflow-hidden border border-slate-700 mb-4">
              <button onClick={() => setAddTxForm({ ...addTxForm, type: 'due' })}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${addTxForm.type === 'due' ? 'bg-red-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                Due
              </button>
              <button onClick={() => setAddTxForm({ ...addTxForm, type: 'payment' })}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${addTxForm.type === 'payment' ? 'bg-green-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                Payment
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label">Amount (PKR) <span className="text-red-400">*</span></label>
                <input type="text" inputMode="decimal" className="input-field" placeholder="e.g. 300+200+100"
                  value={addTxForm.amount} onChange={e => setAddTxForm({ ...addTxForm, amount: e.target.value })} autoFocus />
                {addTxForm.amount.includes('+') && !isNaN(evalAmount(addTxForm.amount)) && (
                  <p className="text-xs text-green-400 mt-1">= PKR {evalAmount(addTxForm.amount).toFixed(2)}</p>
                )}
                {addTxForm.amount.includes('+') && isNaN(evalAmount(addTxForm.amount)) && (
                  <p className="text-xs text-red-400 mt-1">Invalid expression</p>
                )}
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input-field" value={addTxForm.date} max={getPkToday()}
                  onChange={e => setAddTxForm({ ...addTxForm, date: e.target.value })} />
              </div>
              {addTxForm.type === 'payment' && (
                <div>
                  <label className="label">Payment</label>
                  {activeProfile?.profileType === 'customer' ? (
                    <div className="input-field text-slate-400 cursor-not-allowed select-none">Added in Today Sale</div>
                  ) : (
                    <select className="input-field" value={addTxForm.paymentSource}
                      onChange={e => setAddTxForm({ ...addTxForm, paymentSource: e.target.value })}>
                      <option value="today_sale">Today Sale</option>
                      <option value="net_profit">Net Profit</option>
                    </select>
                  )}
                </div>
              )}
              <div>
                <label className="label">Note</label>
                <textarea className="input-field resize-none" rows={3} placeholder="Optional note"
                  value={addTxForm.note} onChange={e => setAddTxForm({ ...addTxForm, note: e.target.value })} />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={handleAddTransaction} className="btn-primary flex-1">Add Transaction</button>
              <button onClick={() => setShowAddTxModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {showTxModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="card w-96">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-semibold">Edit Transaction</h2>
              <button onClick={() => setShowTxModal(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            {error && <div className="mb-3 text-red-300 text-sm">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="label">Type</label>
                <input className="input-field" value={txForm.type} disabled />
              </div>
              <div>
                <label className="label">Amount (PKR)</label>
                <input
                  type="text" inputMode="decimal" className="input-field"
                  placeholder="e.g. 300+200+100"
                  value={txForm.amount}
                  onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                />
                {String(txForm.amount).includes('+') && !isNaN(evalAmount(txForm.amount)) && (
                  <p className="text-xs text-green-400 mt-1">= PKR {evalAmount(txForm.amount).toFixed(2)}</p>
                )}
                {String(txForm.amount).includes('+') && isNaN(evalAmount(txForm.amount)) && (
                  <p className="text-xs text-red-400 mt-1">Invalid expression</p>
                )}
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input-field" value={txForm.date} max={getPkToday()}
                  onChange={e => setTxForm({ ...txForm, date: e.target.value })} />
              </div>
              {txForm.type === 'payment' && (
                <div>
                  <label className="label">Payment Source</label>
                  <select className="input-field" value={txForm.paymentSource}
                    onChange={e => setTxForm({ ...txForm, paymentSource: e.target.value })}>
                    <option value="today_sale">Today Sale</option>
                    <option value="net_profit">Net Profit</option>
                  </select>
                </div>
              )}
              <div>
                <label className="label">Note</label>
                <textarea className="input-field resize-none" rows={3} value={txForm.note}
                  onChange={e => setTxForm({ ...txForm, note: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleSaveTransaction} className="btn-primary flex-1">Save</button>
              <button onClick={() => setShowTxModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
