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
  const [viewBillId, setViewBillId] = useState('');
  const [viewBillData, setViewBillData] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [form, setForm] = useState({ billAmount: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({
    totalCount: 0,
    totalAmount: 0,
    cancelledCount: 0,
    cancelledAmount: 0,
    totalDiscount: 0,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Initialize date to today
  const getTodayDateString = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  };

  const [dateFrom, setDateFrom] = useState(getTodayDateString());
  const [dateTo, setDateTo] = useState(getTodayDateString());

  const fetchBills = async (fromDateStr = dateFrom, toDateStr = dateTo) => {
    setLoading(true);
    setError('');
    try {
      // Parse the selected dates and create date range
      const fromDate = new Date(fromDateStr);
      const toDate = new Date(toDateStr);
      toDate.setDate(toDate.getDate() + 1); // Add 1 day to include the entire toDate day

      const fromISO = fromDate.toISOString();
      const toISO = toDate.toISOString();

      const res = await window.api.pos.getBills({
        from: fromISO,
        to: toISO,
      });

      if (res?.success) {
        const allBills = res.data || [];
        setRows(allBills);

        // Calculate statistics
        const totalCount = allBills.length;
        const totalAmount = allBills
          .filter(b => b.status !== 'cancelled')
          .reduce((sum, b) => sum + (Number(b.total) || 0), 0);
        const cancelledCount = allBills.filter(b => b.status === 'cancelled').length;
        const cancelledAmount = allBills
          .filter(b => b.status === 'cancelled')
          .reduce((sum, b) => sum + (Number(b.total) || 0), 0);
        const totalDiscount = allBills
          .filter(b => b.status !== 'cancelled')
          .reduce((sum, b) => sum + (Number(b.discount) || 0), 0);

        setStats({
          totalCount,
          totalAmount,
          cancelledCount,
          cancelledAmount,
          totalDiscount,
        });
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

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return rows.slice(startIndex, endIndex);
  }, [rows, currentPage]);

  const totalPages = Math.ceil(rows.length / itemsPerPage);

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

  function openViewModal(row) {
    setViewBillId(row.id);
    setViewingLoading(true);
    window.api.pos.getBillById({ id: row.id }).then(res => {
      if (res?.success) {
        setViewBillData(res.data);
      }
      setViewingLoading(false);
    }).catch(() => {
      setViewingLoading(false);
    });
  }

  function closeViewModal() {
    setViewBillId('');
    setViewBillData(null);
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
      <div className="mb-5">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white">Bills</h1>
          <button
            onClick={() => {
              setDateFrom(getTodayDateString());
              setDateTo(getTodayDateString());
              fetchBills(getTodayDateString(), getTodayDateString());
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs rounded bg-slate-700 text-slate-200 hover:bg-slate-600"
          >
            Today
          </button>
        </div>

        {/* Date Range Picker */}
        <div className="card border border-slate-700 p-4 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-xs text-slate-400 mb-2 block">From Date</label>
              <input
                type="date"
                value={dateFrom}
                max={getTodayDateString()}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-md px-3 py-2 focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-2 block">To Date</label>
              <input
                type="date"
                value={dateTo}
                max={getTodayDateString()}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-md px-3 py-2 focus:outline-none focus:border-primary-500"
              />
            </div>
            <button
              onClick={() => {
                fetchBills(dateFrom, dateTo);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 text-xs rounded bg-blue-500 text-white hover:bg-blue-400"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <div className="card border border-blue-500/30 p-4">
          <p className="text-xs text-slate-400 mb-1">Total Bills</p>
          <p className="text-2xl font-bold text-blue-300">{stats.totalCount}</p>
        </div>
        <div className="card border border-green-500/30 p-4">
          <p className="text-xs text-slate-400 mb-1">Total Amount</p>
          <p className="text-lg font-bold text-green-300">{formatAmount(stats.totalAmount)}</p>
        </div>
        <div className="card border border-yellow-500/30 p-4">
          <p className="text-xs text-slate-400 mb-1">Total Discount</p>
          <p className="text-lg font-bold text-yellow-300">{formatAmount(stats.totalDiscount)}</p>
        </div>
        <div className="card border border-red-500/30 p-4">
          <p className="text-xs text-slate-400 mb-1">Cancelled Bills</p>
          <p className="text-2xl font-bold text-red-300">{stats.cancelledCount}</p>
        </div>
        <div className="card border border-orange-500/30 p-4">
          <p className="text-xs text-slate-400 mb-1">Cancelled Amount</p>
          <p className="text-lg font-bold text-orange-300">{formatAmount(stats.cancelledAmount)}</p>
        </div>
      </div>

      {error && (
        <div className="card border border-red-500/40 bg-red-500/10 text-red-300 text-sm mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-slate-400 text-sm">Loading...</div>
      ) : (
        <div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-xs">
                  <th className="py-2 px-3">Bill ID</th>
                  <th className="py-2 px-3">Table</th>
                  <th className="py-2 px-3">Amount</th>
                  <th className="py-2 px-3">Discount</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
            <tbody>
              {paginatedRows.map((row) => (
                <tr key={row.id} className="border-b border-slate-700/40 hover:bg-slate-700/20">
                  <td className="py-2 px-3 text-white text-xs font-medium">{row.id}</td>
                  <td className="py-2 px-3 text-slate-300 text-xs">{row.tableNum ?? ''}</td>
                  <td className="py-2 px-3 text-white text-xs">{formatAmount(row.total)}</td>
                  <td className="py-2 px-3 text-orange-300 text-xs">{formatAmount(row.discount)}</td>
                  <td className="py-2 px-3 text-xs">
                    <span className={row.status === 'cancelled' ? 'text-red-400' : 'text-green-400'}>
                      {row.status === 'cancelled' ? 'Cancelled' : 'Completed'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-400 text-xs">{formatDate(row.createdAt)}</td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openViewModal(row)}
                        className="px-2 py-1 text-xs rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
                      >
                        View
                      </button>
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
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500 text-sm">No bills found for today.</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {rows.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700 px-4 pb-3">
              <div className="text-xs text-slate-400">
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, rows.length)} - {Math.min(currentPage * itemsPerPage, rows.length)} of {rows.length} bills
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-xs rounded bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 text-xs rounded bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
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

      {viewBillId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeViewModal} />
          <div className="relative w-full max-w-2xl card border border-blue-500/30 max-h-[90vh] overflow-y-auto">
            <h2 className="text-sm font-semibold text-white mb-4 sticky top-0 bg-slate-900 p-4 -m-4 mb-0 border-b border-slate-700">Bill Details: {viewBillId}</h2>
            {viewingLoading ? (
              <div className="p-4 text-slate-400 text-sm">Loading bill details...</div>
            ) : viewBillData ? (
              <div className="p-4 space-y-4">
                {/* Header Info */}
                <div className="grid grid-cols-2 gap-4 text-xs border-b border-slate-700 pb-4">
                  <div>
                    <span className="text-slate-400">Bill ID:</span>
                    <p className="text-white font-medium">{viewBillData.id}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Table:</span>
                    <p className="text-white font-medium">{viewBillData.tableNum ?? 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Status:</span>
                    <p className={viewBillData.status === 'cancelled' ? 'text-red-400 font-medium' : 'text-green-400 font-medium'}>
                      {viewBillData.status === 'cancelled' ? 'Cancelled' : 'Completed'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Date:</span>
                    <p className="text-white font-medium">{formatDate(viewBillData.createdAt)}</p>
                  </div>
                </div>

                {/* Bill Items */}
                {viewBillData.items && viewBillData.items.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-300 mb-3">Items</h3>
                    <div className="space-y-2 text-xs">
                      {viewBillData.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center bg-slate-800/50 p-2 rounded">
                          <div>
                            <p className="text-white font-medium">{item.name}</p>
                            <p className="text-slate-400">Qty: {item.quantity}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-white font-medium">{formatAmount(item.lineTotal)}</p>
                            <p className="text-slate-400">{formatAmount(item.price)} each</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Totals */}
                <div className="border-t border-slate-700 pt-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Subtotal:</span>
                    <span className="text-white font-medium">{formatAmount(viewBillData.subtotal)}</span>
                  </div>
                  {viewBillData.discount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Discount:</span>
                      <span className="text-white font-medium">{formatAmount(viewBillData.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm border-t border-slate-700 pt-2">
                    <span className="text-slate-300 font-semibold">Total:</span>
                    <span className="text-white font-bold">{formatAmount(viewBillData.total)}</span>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="bg-slate-800/50 p-2 rounded text-xs">
                  <span className="text-slate-400">Payment Method: </span>
                  <span className="text-white font-medium capitalize">{viewBillData.paymentMethod}</span>
                </div>
              </div>
            ) : null}
            <div className="mt-4 flex items-center gap-2 p-4 border-t border-slate-700">
              <button
                type="button"
                onClick={closeViewModal}
                className="px-3 py-2 text-xs rounded bg-blue-500 text-white hover:bg-blue-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
