import React, { useEffect, useMemo, useState } from 'react';

const today = () => new Date().toISOString().split('T')[0];

const emptyProfileForm = { name: '', phone: '', businessDetails: '' };
const emptyDueForm = { amount: '', date: today(), note: '' };
const emptyPaymentForm = { amount: '', date: today(), note: '', paymentSource: 'today_sale' };
const emptyTxForm = { id: '', type: 'due', amount: '', date: today(), note: '', paymentSource: 'today_sale' };

export default function KhataPage() {
  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeData, setActiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [dueForm, setDueForm] = useState(emptyDueForm);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const [showTxModal, setShowTxModal] = useState(false);
  const [txForm, setTxForm] = useState(emptyTxForm);

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
    if (!id) {
      setActiveData(null);
      return;
    }
    const res = await window.api.khata.getById({ id });
    if (res.success) setActiveData(res.data);
  };

  useEffect(() => { fetchProfiles(); }, []);
  useEffect(() => { fetchActive(activeId); }, [activeId]);

  const activeProfile = activeData?.profile;
  const transactions = activeData?.transactions || [];
  const balance = useMemo(() => activeProfile?.balance || 0, [activeProfile]);

  const handleAddProfile = async () => {
    setError('');
    setMessage('');
    const res = await window.api.khata.addProfile(profileForm);
    if (res.success) {
      setShowProfileModal(false);
      setProfileForm(emptyProfileForm);
      await fetchProfiles();
    } else {
      setError(res.error || 'Failed to add profile');
    }
  };

  const handleAddDue = async () => {
    setError('');
    setMessage('');
    const res = await window.api.khata.addDue({ ...dueForm, khataId: activeId });
    if (res.success) {
      setDueForm(emptyDueForm);
      await fetchProfiles();
      await fetchActive(activeId);
    } else {
      setError(res.error || 'Failed to add due');
    }
  };

  const handleAddPayment = async () => {
    setError('');
    setMessage('');
    const res = await window.api.khata.addPayment({ ...paymentForm, khataId: activeId });
    if (res.success) {
      setPaymentForm(emptyPaymentForm);
      await fetchProfiles();
      await fetchActive(activeId);
    } else {
      setError(res.error || 'Failed to add payment');
    }
  };

  const handlePayFull = () => {
    if (balance > 0) setPaymentForm({ ...paymentForm, amount: balance });
  };

  const openEditTransaction = (tx) => {
    setError('');
    setMessage('');
    setTxForm({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      date: tx.date,
      note: tx.note || '',
      paymentSource: tx.paymentSource || 'today_sale',
    });
    setShowTxModal(true);
  };

  const handleSaveTransaction = async () => {
    setError('');
    setMessage('');
    const res = await window.api.khata.updateTransaction({
      id: txForm.id,
      amount: txForm.amount,
      date: txForm.date,
      note: txForm.note,
      paymentSource: txForm.type === 'payment' ? txForm.paymentSource : null,
    });
    if (res.success) {
      setShowTxModal(false);
      setTxForm(emptyTxForm);
      await fetchProfiles();
      await fetchActive(activeId);
    } else {
      setError(res.error || 'Failed to update transaction');
    }
  };

  const handleDeleteTransaction = async (txId) => {
    if (!confirm('Delete this transaction?')) return;
    setError('');
    setMessage('');
    const res = await window.api.khata.deleteTransaction({ id: txId });
    if (res.success) {
      await fetchProfiles();
      await fetchActive(activeId);
    } else {
      setError(res.error || 'Failed to delete transaction');
    }
  };

  const handleDeleteProfile = async () => {
    if (!activeProfile) return;
    if (!confirm(`Delete khata profile "${activeProfile.name}" and all its transactions?`)) return;
    setError('');
    setMessage('');
    const res = await window.api.khata.deleteProfile({ id: activeProfile.id });
    if (res.success) {
      await fetchProfiles();
      await fetchActive(activeId);
    } else {
      setError(res.error || 'Failed to delete profile');
    }
  };

  const handleExportProfile = async () => {
    if (!activeId || exporting) return;
    setError('');
    setMessage('');
    setExporting(true);
    try {
      const res = await window.api.khata.exportProfile({ id: activeId });
      if (res?.canceled) {
        setMessage('Export canceled.');
      } else if (res?.success) {
        setMessage(`Khata exported to ${res.path}`);
      } else {
        setError(res?.error || 'Failed to export khata.');
      }
    } catch (err) {
      setError(err.message || 'Failed to export khata.');
    } finally {
      setExporting(false);
    }
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
                  <div className="text-sm text-white font-medium">{profile.name}</div>
                  <div className="text-xs text-slate-400">{profile.phone || 'No phone'}</div>
                </div>
                <div className={`text-xs font-semibold ${profile.balance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  PKR {Number(profile.balance || 0).toLocaleString()}
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
                    PKR {Number(balance || 0).toLocaleString()}
                  </div>
                  <div className="mt-3 flex flex-col gap-2 items-end">
                    <button
                      onClick={handleExportProfile}
                      disabled={exporting}
                      className={`btn-secondary text-xs ${exporting ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {exporting ? 'Exporting...' : 'Export Khata CSV'}
                    </button>
                    <button
                      onClick={handleDeleteProfile}
                      className="text-xs px-3 py-1.5 rounded-md bg-red-700/70 hover:bg-red-600 text-white"
                    >
                      Delete Profile
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {error && <div className="card border-red-600 text-red-300 text-sm">{error}</div>}
            {message && <div className="card border-emerald-600 text-emerald-300 text-sm">{message}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="text-white font-semibold mb-3">Add Due</h3>
                <div className="space-y-3">
                  <div>
                    <label className="label">Amount (PKR)</label>
                    <input type="number" className="input-field" value={dueForm.amount}
                      onChange={e => setDueForm({ ...dueForm, amount: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Date</label>
                    <input type="date" className="input-field" value={dueForm.date}
                      onChange={e => setDueForm({ ...dueForm, date: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Note</label>
                    <input className="input-field" value={dueForm.note}
                      onChange={e => setDueForm({ ...dueForm, note: e.target.value })} />
                  </div>
                  <button onClick={handleAddDue} className="btn-primary w-full text-sm">Add Due</button>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold">Add Payment</h3>
                  <button onClick={handlePayFull} className="text-xs text-primary-400 hover:text-primary-300">Pay Full Due</button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="label">Amount (PKR)</label>
                    <input type="number" className="input-field" value={paymentForm.amount}
                      onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Date</label>
                    <input type="date" className="input-field" value={paymentForm.date}
                      onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Payment Source</label>
                    <select className="input-field" value={paymentForm.paymentSource}
                      onChange={e => setPaymentForm({ ...paymentForm, paymentSource: e.target.value })}>
                      <option value="today_sale">Today Sale</option>
                      <option value="net_profit">Net Profit</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Note</label>
                    <input className="input-field" value={paymentForm.note}
                      onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })} />
                  </div>
                  <button onClick={handleAddPayment} className="btn-primary w-full text-sm">Add Payment</button>
                </div>
              </div>
            </div>

            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700">
                <h3 className="text-white font-semibold">Transactions</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Date</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Type</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Note</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Source</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium text-xs uppercase">Amount</th>
                    <th className="text-right px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 text-slate-400 text-xs">{tx.date}</td>
                      <td className="px-4 py-3 text-white capitalize">{tx.type}</td>
                      <td className="px-4 py-3 text-slate-300">{tx.note || '-'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {tx.type === 'payment' ? (tx.paymentSource === 'net_profit' ? 'Net Profit' : 'Today Sale') : '-'}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${tx.type === 'payment' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {tx.type === 'payment' ? '-' : '+'}PKR {Number(tx.amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditTransaction(tx)}
                            className="text-xs text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={Boolean(tx.linkedExpenseId)}
                            title={tx.linkedExpenseId ? 'Linked to expense, edit from Expenses tab' : 'Edit transaction'}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={Boolean(tx.linkedExpenseId)}
                            title={tx.linkedExpenseId ? 'Linked to expense, delete from Expenses tab' : 'Delete transaction'}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-600 text-sm">No transactions yet</td></tr>
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

      {showTxModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="card w-96">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-semibold">Edit Transaction</h2>
              <button onClick={() => setShowTxModal(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Type</label>
                <input className="input-field" value={txForm.type} disabled />
              </div>
              <div>
                <label className="label">Amount (PKR)</label>
                <input
                  type="number"
                  className="input-field"
                  value={txForm.amount}
                  onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={txForm.date}
                  onChange={e => setTxForm({ ...txForm, date: e.target.value })}
                />
              </div>
              {txForm.type === 'payment' && (
                <div>
                  <label className="label">Payment Source</label>
                  <select
                    className="input-field"
                    value={txForm.paymentSource}
                    onChange={e => setTxForm({ ...txForm, paymentSource: e.target.value })}
                  >
                    <option value="today_sale">Today Sale</option>
                    <option value="net_profit">Net Profit</option>
                  </select>
                </div>
              )}
              <div>
                <label className="label">Note</label>
                <input
                  className="input-field"
                  value={txForm.note}
                  onChange={e => setTxForm({ ...txForm, note: e.target.value })}
                />
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
