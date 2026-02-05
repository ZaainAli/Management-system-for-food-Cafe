import React, { useState, useEffect } from 'react';

const StatCard = ({ label, value, sub, color = 'text-white' }) => (
  <div className="card">
    <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
  </div>
);

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState('today');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await window.api.report.getDashboardStats({ period });
      if (res.success) setStats(res.data);
      setLoading(false);
    })();
  }, [period]);

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
          {['today','week','month','year'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs rounded-md transition-colors capitalize
                ${period === p ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Revenue" value={fmt(stats?.totalRevenue)} sub={`This ${period}`} color="text-green-400" />
        <StatCard label="Total Expenses" value={fmt(stats?.totalExpenses)} sub={`This ${period}`} color="text-red-400" />
        <StatCard label="Net Profit" value={fmt(stats?.netProfit)} sub={stats?.netProfit >= 0 ? 'Profitable' : 'Loss'} color={stats?.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <StatCard label="Bills Served" value={stats?.totalBills} sub={`Avg ${fmt(stats?.averageBill)} / bill`} />
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
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Tips</h2>
          <ul className="text-xs text-slate-500 space-y-2">
            <li>• Use the POS module to create new bills quickly.</li>
            <li>• Track stock levels to avoid running out of ingredients.</li>
            <li>• Log expenses consistently for accurate P&L reports.</li>
            <li>• Check the Reports tab for detailed analytics.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
