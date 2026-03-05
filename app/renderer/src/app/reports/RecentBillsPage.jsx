import { useEffect, useMemo, useState } from 'react';
import { formatPkDateTime } from '../../utils/datetime';

function formatAmount(value) {
  return `PKR ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value) {
  if (!value) return '';
  return formatPkDateTime(value);
}

export default function RecentBillsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeBillId, setActiveBillId] = useState('');
  const [form, setForm] = useState({ billAmount: '', reason: '' });
  const [saving, setSaving] = useState(false);

  const fetchBills = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await window.api.pos.getRecentBills({ limit: 20 });
      if (res?.success) {
        setRows(res.data || []);
      } else {
        setError(res?.error || 'Failed to load bills.');
      }
    } catch (err) {
      setError(err.message || 'Failed to load bills.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const activeBill = useMemo(
    () => rows.find((row) => row.id === activeBillId) || null,
    [rows, activeBillId]
  );

  function openCancelModal(row) {
    const billTotal = Number(row?.total || 0);
    const prefill = billTotal > 0 ? String(billTotal) : '';
    setActiveBillId(row.id);
    setForm({ billAmount: prefill, returnAmount: prefill, reason: '' });
  }

  function closeCancelModal() {
    setActiveBillId('');
    setForm({ billAmount: '', returnAmount: '', reason: '' });
  }

  async function submitCancel(e) {
    e.preventDefault();
    if (!activeBill) return;

    setSaving(true);
    setError('');
    try {
      const payload = {
        billId: activeBill.id,
        billAmount: form.billAmount,
        returnAmount: form.returnAmount,
        reason: form.reason,
      };
      const res = await window.api.pos.cancelBill(payload);
      if (!res?.success) {
        throw new Error(res?.error || 'Failed to cancel bill.');
      }

      closeCancelModal();
      await fetchBills();
    } catch (err) {
      setError(err.message || 'Failed to cancel bill.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-white">Last 20 Bills</h1>
      </div>

      {error && (
        <div className="card border border-red-500/40 bg-red-500/10 text-red-300 text-sm mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-slate-400 text-sm">Loading...</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs">
                <th className="py-2 px-3">Bill ID</th>
                <th className="py-2 px-3">Table</th>
                <th className="py-2 px-3">Amount</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-700/40 hover:bg-slate-700/20">
                  <td className="py-2 px-3 text-white text-xs font-medium">{row.id}</td>
                  <td className="py-2 px-3 text-slate-300 text-xs">{row.tableNum ?? ''}</td>
                  <td className="py-2 px-3 text-white text-xs">{formatAmount(row.total)}</td>
                  <td className="py-2 px-3 text-xs">
                    <span className={row.status === 'cancelled' ? 'text-red-400' : 'text-green-400'}>
                      {row.status === 'cancelled' ? 'Cancelled' : 'Completed'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-400 text-xs">{formatDate(row.createdAt)}</td>
                  <td className="py-2 px-3 text-right">
                    {row.status === 'cancelled' ? (
                      <span className="text-slate-500 text-xs">Already cancelled</span>
                    ) : (
                      <button
                        onClick={() => {
                          openCancelModal(row);
                        }}
                        className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-300 hover:bg-red-500/30"
                      >
                        Cancel Bill
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500 text-sm">No bills found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeCancelModal} />
          <div className="relative w-full max-w-lg card border border-red-500/30">
            <h2 className="text-sm font-semibold text-white mb-3">Cancel Bill: {activeBill.id}</h2>
            <form onSubmit={submitCancel} className="grid grid-cols-1 gap-3">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount (optional)"
                value={form.billAmount}
                onChange={(e) => setForm((prev) => ({ ...prev, billAmount: e.target.value }))}
                className="bg-slate-800 border border-slate-700 text-white text-xs rounded-md px-2 py-2 focus:outline-none focus:border-primary-500"
              />
              <input
                type="text"
                placeholder="Reason (optional)"
                value={form.reason}
                onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                className="bg-slate-800 border border-slate-700 text-white text-xs rounded-md px-2 py-2 focus:outline-none focus:border-primary-500"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3 py-2 text-xs rounded bg-red-500 text-white hover:bg-red-400 disabled:opacity-50"
                >
                  {saving ? 'Cancelling...' : 'Confirm Cancel'}
                </button>
                <button
                  type="button"
                  onClick={closeCancelModal}
                  className="px-3 py-2 text-xs rounded bg-slate-700 text-slate-200 hover:bg-slate-600"
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
