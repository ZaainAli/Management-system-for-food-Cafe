import { useState, useEffect } from 'react';
import { formatPkDateTime, getPkDateUtcBounds, getPkToday, monthBounds, shiftDate } from '../../utils/datetime';

function curMonth() {
  return getPkToday().slice(0, 7);
}
function curYear() { return getPkToday().slice(0, 4); }
const YEAR_OPTIONS = Array.from(
  { length: Number(getPkToday().slice(0, 4)) - 2019 },
  (_, i) => String(Number(getPkToday().slice(0, 4)) - i)
);
const inputCls = 'bg-slate-800 border border-slate-700 text-white text-xs rounded-md px-2 py-1 focus:outline-none focus:border-primary-500';

export default function DiscountReportPage() {
  const [period, setPeriod]       = useState('today');
  const [selMonth, setSelMonth]   = useState(curMonth());
  const [selYear, setSelYear]     = useState(curYear());
  const [selDate, setSelDate]     = useState(getPkToday());
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const [data, setData] = useState([]);
  const [khataBills, setKhataBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (period === 'custom' && (!customFrom || !customTo)) {
      setLoading(false);
      setData([]);
      setKhataBills([]);
      return;
    }

    (async () => {
      setLoading(true);
      setError('');
      try {
        let from, to;
        const td = getPkToday();
        if (period === 'custom') {
          from = getPkDateUtcBounds(customFrom).from;
          to = getPkDateUtcBounds(customTo).to;
        } else if (period === 'today') {
          from = getPkDateUtcBounds(selDate).from;
          to = getPkDateUtcBounds(selDate).to;
        } else if (period === 'week') {
          const weekStart = shiftDate(td, -6);
          from = getPkDateUtcBounds(weekStart).from;
          to = getPkDateUtcBounds(td).to;
        } else if (period === 'month') {
          const range = monthBounds(selMonth);
          from = getPkDateUtcBounds(range.from).from;
          to = getPkDateUtcBounds(range.to).to;
        } else if (period === 'year') {
          from = getPkDateUtcBounds(`${selYear}-01-01`).from;
          to = getPkDateUtcBounds(`${selYear}-12-31`).to;
        }

        const res = await window.api.pos.getDiscountedBills({ from, to });
        if (res?.success) {
          setData(res.data);
          setKhataBills(res.khataBills || []);
        } else {
          setError(res?.error || 'Failed to load table & discount report.');
        }
      } catch (err) {
        setError(err.message || 'Failed to load table & discount report.');
      } finally {
        setLoading(false);
      }
    })();
  }, [period, selMonth, selYear, customFrom, customTo, selDate]);

  const totalBillAmount = data
    .filter(r => r.rowType !== 'cancelled')
    .reduce((sum, r) => sum + (Number(r.billAmount) || 0), 0);
  const totalDiscount = data
    .filter(r => r.rowType !== 'cancelled')
    .reduce((sum, r) => sum + (Number(r.discountAmount) || 0), 0);
  const totalFinal = data
    .filter(r => r.rowType !== 'cancelled')
    .reduce((sum, r) => sum + (Number(r.finalAmount) || 0), 0);
  const totalTableBills = data.filter(r => r.tableNum !== null && r.tableNum !== undefined && r.tableNum !== '' && r.rowType !== 'cancelled').length;
  const totalCancelledBills = data.filter(r => r.rowType === 'cancelled').length;
  const totalReturnAmount = data
    .filter(r => r.rowType === 'cancelled')
    .reduce((sum, r) => sum + (Number(r.returnAmount) || 0), 0);

  const totalKhataBills = khataBills.length;
  const totalKhataAmount = khataBills.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-white">Table & Discount Report</h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            {['today', 'week', 'month', 'year', 'custom'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs rounded-md transition-colors capitalize
                  ${period === p ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-white'}`}>{p}</button>
            ))}
          </div>
          {period === 'month' && (
            <input type="month" value={selMonth} max={curMonth()}
              onChange={e => setSelMonth(e.target.value)} className={inputCls} />
          )}
          {period === 'year' && (
            <select value={selYear} onChange={e => setSelYear(e.target.value)} className={inputCls}>
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className={inputCls} />
              <span className="text-slate-500 text-xs">to</span>
              <input type="date" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)} className={inputCls} />
            </div>
          )}
          {period === 'today' && (
            <div className="flex items-center gap-1">
              <button onClick={() => setSelDate(d => shiftDate(d, -1))}
                className="px-2 py-1 text-xs rounded-md bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors">
                &larr; Prev
              </button>
              <input type="date" value={selDate} max={getPkToday()}
                onChange={e => setSelDate(e.target.value)} className={inputCls} />
              <button onClick={() => { const next = shiftDate(selDate, 1); if (next <= getPkToday()) setSelDate(next); }}
                className="px-2 py-1 text-xs rounded-md bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors">
                Next &rarr;
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <p className="text-slate-500 text-xs mb-1">Total Bills</p>
          <p className="text-white text-lg font-bold">{data.length}</p>
        </div>
        <div className="card">
          <p className="text-slate-500 text-xs mb-1">Total Table Bills</p>
          <p className="text-white text-lg font-bold">{totalTableBills}</p>
        </div>
        <div className="card">
          <p className="text-slate-500 text-xs mb-1">Total Discount Given</p>
          <p className="text-green-400 text-lg font-bold">PKR {totalDiscount.toLocaleString()}</p>
        </div>
        <div className="card">
          <p className="text-slate-500 text-xs mb-1">Total After Discount</p>
          <p className="text-white text-lg font-bold">PKR {totalFinal.toLocaleString()}</p>
        </div>
        <div className="card">
          <p className="text-slate-500 text-xs mb-1">Khata Bills</p>
          <p className="text-amber-400 text-lg font-bold">{totalKhataBills}</p>
        </div>
        <div className="card">
          <p className="text-slate-500 text-xs mb-1">Khata Amount</p>
          <p className="text-amber-400 text-lg font-bold">PKR {totalKhataAmount.toLocaleString()}</p>
        </div>
        <div className="card">
          <p className="text-slate-500 text-xs mb-1">Cancelled Bills</p>
          <p className="text-red-400 text-lg font-bold">{totalCancelledBills}</p>
        </div>
        <div className="card">
          <p className="text-slate-500 text-xs mb-1">Total Return Amount</p>
          <p className="text-red-300 text-lg font-bold">PKR {totalReturnAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-slate-400 text-sm">Loading...</div>
      ) : error ? (
        <div className="text-red-400 text-sm">{error}</div>
      ) : data.length === 0 && khataBills.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-slate-500 text-sm">No table, discount, or khata bills found for this period.</p>
        </div>
      ) : (
        <>
          {data.length > 0 && (
            <div className="card overflow-x-auto mb-6">
              <h3 className="text-white font-semibold mb-3">Table & Discount Bills</h3>
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 text-xs">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Bill No</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Table No</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3 text-right">Bill Amount</th>
                    <th className="py-2 px-3 text-right">Discount</th>
                    <th className="py-2 px-3 text-right">Final Amount</th>
                    <th className="py-2 px-3 text-right">Return Amount</th>
                    <th className="py-2 px-3">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr key={`${row.rowType || 'record'}-${row.id}`} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-2 px-3 text-slate-500 text-xs">{idx + 1}</td>
                      <td className="py-2 px-3 text-white text-xs font-medium">{row.billId}</td>
                      <td className="py-2 px-3 text-xs">
                        <span className={
                          row.rowType === 'cancelled'
                            ? 'text-red-400'
                            : row.rowType === 'discounted'
                              ? 'text-green-400'
                              : 'text-slate-300'
                        }>
                          {row.rowType === 'cancelled' ? 'Cancelled' : row.rowType === 'discounted' ? 'Discounted' : 'Table'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-300 text-xs">{row.tableNum ?? ''}</td>
                      <td className="py-2 px-3 text-slate-400 text-xs">{formatPkDateTime(row.createdAt)}</td>
                      <td className="py-2 px-3 text-white text-xs text-right">PKR {Number(row.billAmount || 0).toLocaleString()}</td>
                      <td className="py-2 px-3 text-green-400 text-xs text-right">{row.rowType === 'cancelled' ? '-' : `PKR ${Number(row.discountAmount || 0).toLocaleString()}`}</td>
                      <td className="py-2 px-3 text-white text-xs text-right">{row.rowType === 'cancelled' ? '-' : `PKR ${Number(row.finalAmount || 0).toLocaleString()}`}</td>
                      <td className="py-2 px-3 text-red-300 text-xs text-right">{row.rowType === 'cancelled' ? `PKR ${Number(row.returnAmount || 0).toLocaleString()}` : '-'}</td>
                      <td className="py-2 px-3 text-slate-300 text-xs">{row.rowType === 'cancelled' ? (row.reason || '-') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-600 font-semibold text-xs">
                    <td className="py-2 px-3" colSpan="5">Totals</td>
                    <td className="py-2 px-3 text-white text-right">PKR {totalBillAmount.toLocaleString()}</td>
                    <td className="py-2 px-3 text-green-400 text-right">PKR {totalDiscount.toLocaleString()}</td>
                    <td className="py-2 px-3 text-white text-right">PKR {totalFinal.toLocaleString()}</td>
                    <td className="py-2 px-3 text-red-300 text-right">PKR {totalReturnAmount.toLocaleString()}</td>
                    <td className="py-2 px-3 text-slate-400 text-right">-</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Khata Bills Table */}
          {khataBills.length > 0 && (
            <div className="card overflow-x-auto">
              <h3 className="text-amber-400 font-semibold mb-3">POS Khata Bills (Customer Credit)</h3>
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 text-xs">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Bill No</th>
                    <th className="py-2 px-3">Customer</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3">Items</th>
                  </tr>
                </thead>
                <tbody>
                  {khataBills.map((row, idx) => (
                    <tr key={row.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-2 px-3 text-slate-500 text-xs">{idx + 1}</td>
                      <td className="py-2 px-3 text-white text-xs font-medium">{row.billId}</td>
                      <td className="py-2 px-3 text-amber-300 text-xs font-medium">{row.customerName}</td>
                      <td className="py-2 px-3 text-slate-400 text-xs">{formatPkDateTime(row.createdAt)}</td>
                      <td className="py-2 px-3 text-amber-400 text-xs text-right font-semibold">PKR {Number(row.totalAmount || 0).toLocaleString()}</td>
                      <td className="py-2 px-3 text-slate-300 text-xs">{row.itemsNote || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-600 font-semibold text-xs">
                    <td className="py-2 px-3" colSpan="4">Total Khata Bills: {totalKhataBills}</td>
                    <td className="py-2 px-3 text-amber-400 text-right">PKR {totalKhataAmount.toLocaleString()}</td>
                    <td className="py-2 px-3">-</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
