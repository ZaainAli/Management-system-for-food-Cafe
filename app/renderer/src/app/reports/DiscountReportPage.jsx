import { useState, useEffect } from 'react';

function curMonth() {
  const t = new Date(), p = n => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth()+1)}`;
}
function curYear() { return String(new Date().getFullYear()); }
const YEAR_OPTIONS = Array.from(
  { length: new Date().getFullYear() - 2019 },
  (_, i) => String(new Date().getFullYear() - i)
);
const inputCls = 'bg-slate-800 border border-slate-700 text-white text-xs rounded-md px-2 py-1 focus:outline-none focus:border-primary-500';

export default function DiscountReportPage() {
  const [period, setPeriod]       = useState('today');
  const [selMonth, setSelMonth]   = useState(curMonth());
  const [selYear, setSelYear]     = useState(curYear());
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (period === 'custom' && (!customFrom || !customTo)) {
      setLoading(false);
      setData([]);
      return;
    }

    (async () => {
      setLoading(true);
      setError('');
      try {
        const now = new Date();
        let from, to;

        const pad = n => String(n).padStart(2, '0');
        const td  = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
        if (period === 'custom') {
          from = new Date(`${customFrom}T00:00:00`).toISOString();
          to   = new Date(`${customTo}T23:59:59.999`).toISOString();
        } else if (period === 'today') {
          from = new Date(`${td}T00:00:00`).toISOString();
          to   = new Date(`${td}T23:59:59.999`).toISOString();
        } else if (period === 'week') {
          const d = new Date(now); d.setDate(now.getDate() - 6);
          const weekStart = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
          from = new Date(`${weekStart}T00:00:00`).toISOString();
          to   = new Date(`${td}T23:59:59.999`).toISOString();
        } else if (period === 'month') {
          const [y, m] = selMonth.split('-').map(Number);
          const lastDay = pad(new Date(y, m, 0).getDate());
          from = new Date(`${selMonth}-01T00:00:00`).toISOString();
          to   = new Date(`${selMonth}-${lastDay}T23:59:59.999`).toISOString();
        } else if (period === 'year') {
          from = new Date(`${selYear}-01-01T00:00:00`).toISOString();
          to   = new Date(`${selYear}-12-31T23:59:59.999`).toISOString();
        }

        const res = await window.api.pos.getDiscountedBills({ from, to });
        if (res?.success) setData(res.data);
        else setError(res?.error || 'Failed to load table & discount report.');
      } catch (err) {
        setError(err.message || 'Failed to load table & discount report.');
      } finally {
        setLoading(false);
      }
    })();
  }, [period, selMonth, selYear, customFrom, customTo]);

  const totalBillAmount = data.reduce((sum, r) => sum + r.billAmount, 0);
  const totalDiscount = data.reduce((sum, r) => sum + r.discountAmount, 0);
  const totalFinal = data.reduce((sum, r) => sum + r.finalAmount, 0);
  const totalTableBills = data.filter(r => r.tableNum !== null && r.tableNum !== undefined && r.tableNum !== '').length;

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
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
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
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-slate-400 text-sm">Loading...</div>
      ) : error ? (
        <div className="text-red-400 text-sm">{error}</div>
      ) : data.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-slate-500 text-sm">No table or discounted bills found for this period.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs">
                <th className="py-2 px-3">#</th>
                <th className="py-2 px-3">Bill No</th>
                <th className="py-2 px-3">Table No</th>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3 text-right">Bill Amount</th>
                <th className="py-2 px-3 text-right">Discount</th>
                <th className="py-2 px-3 text-right">Final Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={row.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="py-2 px-3 text-slate-500 text-xs">{idx + 1}</td>
                  <td className="py-2 px-3 text-white text-xs font-medium">{row.billId}</td>
                  <td className="py-2 px-3 text-slate-300 text-xs">{row.tableNum ?? ''}</td>
                  <td className="py-2 px-3 text-slate-400 text-xs">{new Date(row.createdAt).toLocaleDateString()}</td>
                  <td className="py-2 px-3 text-white text-xs text-right">PKR {row.billAmount.toLocaleString()}</td>
                  <td className="py-2 px-3 text-green-400 text-xs text-right">PKR {row.discountAmount.toLocaleString()}</td>
                  <td className="py-2 px-3 text-white text-xs text-right">PKR {row.finalAmount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-600 font-semibold text-xs">
                <td className="py-2 px-3" colSpan="4">Totals</td>
                <td className="py-2 px-3 text-white text-right">PKR {totalBillAmount.toLocaleString()}</td>
                <td className="py-2 px-3 text-green-400 text-right">PKR {totalDiscount.toLocaleString()}</td>
                <td className="py-2 px-3 text-white text-right">PKR {totalFinal.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
