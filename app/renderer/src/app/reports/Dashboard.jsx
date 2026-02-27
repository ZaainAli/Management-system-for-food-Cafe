import { useState, useEffect } from 'react';

// ── Helpers ───────────────────────────────────────────────────

function curMonth() {
  const t = new Date(), p = n => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth()+1)}`;
}
function curYear() { return String(new Date().getFullYear()); }
const YEAR_OPTIONS = Array.from(
  { length: new Date().getFullYear() - 2019 },
  (_, i) => String(new Date().getFullYear() - i)
);

function computeRange(period, selMonth, selYear) {
  const t = new Date(), p = n => String(n).padStart(2, '0');
  const td = `${t.getFullYear()}-${p(t.getMonth()+1)}-${p(t.getDate())}`;
  if (period === 'today') return { from: td, to: td };
  if (period === 'week') {
    const d = new Date(t); d.setDate(t.getDate() - 6);
    return { from: d.toISOString().split('T')[0], to: td };
  }
  if (period === 'month') {
    const [y, m] = selMonth.split('-').map(Number);
    return { from: `${selMonth}-01`, to: `${selMonth}-${p(new Date(y, m, 0).getDate())}` };
  }
  if (period === 'year') return { from: `${selYear}-01-01`, to: `${selYear}-12-31` };
  return { from: td, to: td };
}

const StatCard = ({ label, value, sub, color = 'text-white' }) => (
  <div className="card">
    <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
  </div>
);

const inputCls = 'bg-slate-800 border border-slate-700 text-white text-xs rounded-md px-2 py-1 focus:outline-none focus:border-primary-500';

export default function Dashboard() {
  const [stats, setStats]       = useState(null);
  const [period, setPeriod]     = useState('today');
  const [selMonth, setSelMonth] = useState(curMonth());
  const [selYear, setSelYear]   = useState(curYear());
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { from, to } = computeRange(period, selMonth, selYear);
      const res = await window.api.report.getDashboardStats({
        from: new Date(`${from}T00:00:00`).toISOString(),
        to:   new Date(`${to}T23:59:59.999`).toISOString(),
      });
      if (res.success) setStats(res.data);
      setLoading(false);
    })();
  }, [period, selMonth, selYear]);

  const fmt = (n) => `PKR ${Number(n).toLocaleString()}`;

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-bold text-white mb-6">Dashboard</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="card h-24 animate-pulse bg-slate-700" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-bold text-white">Dashboard</h1>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period tabs */}
          <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            {['today', 'week', 'month', 'year'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs rounded-md transition-colors capitalize
                  ${period === p ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                {p}
              </button>
            ))}
          </div>

          {/* Month picker */}
          {period === 'month' && (
            <input type="month" value={selMonth} max={curMonth()}
              onChange={e => setSelMonth(e.target.value)} className={inputCls} />
          )}

          {/* Year picker */}
          {period === 'year' && (
            <select value={selYear} onChange={e => setSelYear(e.target.value)} className={inputCls}>
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Revenue"  value={fmt(stats?.totalRevenue)}  sub={`This ${period}`} color="text-green-400" />
        <StatCard label="Total Expenses" value={fmt(stats?.totalExpenses)} sub={`This ${period}`} color="text-red-400" />
        <StatCard label="Net Profit"     value={fmt(stats?.netProfit)}
          sub={stats?.netProfit >= 0 ? 'Profitable' : 'Loss'}
          color={stats?.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <StatCard label="Bills Served"   value={stats?.totalBills} sub={`Avg ${fmt(stats?.averageBill)} / bill`} />
      </div>

      {/* Secondary Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Quick Info</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total Staff</span>
              <span className="text-white font-medium">{stats?.totalEmployees}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Avg Bill Value</span>
              <span className="text-white font-medium">{fmt(stats?.averageBill)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Profit Margin</span>
              <span className={`font-medium ${stats?.totalRevenue > 0 && stats?.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats?.totalRevenue > 0 ? ((stats.netProfit / stats.totalRevenue) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
