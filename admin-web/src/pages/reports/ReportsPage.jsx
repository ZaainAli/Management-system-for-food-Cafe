import React, { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/AuthContext';

// ── Helpers ──────────────────────────────────────────────────

function getRange(period) {
  const t   = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const today = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  if (period === 'today') return { from: today, to: today };
  if (period === 'week') {
    const d = new Date(t);
    d.setDate(t.getDate() - 6);
    return { from: d.toISOString().split('T')[0], to: today };
  }
  if (period === 'month') return { from: today.slice(0, 8) + '01', to: today };
  if (period === 'year')  return { from: today.slice(0, 5) + '01-01', to: today };
  return { from: today, to: today };
}

const fmt   = (n) => `Rs ${Number(n || 0).toLocaleString()}`;
const today = () => { const t = new Date(), p = (n) => String(n).padStart(2,'0'); return `${t.getFullYear()}-${p(t.getMonth()+1)}-${p(t.getDate())}`; };
const PERIODS = ['today', 'week', 'month', 'year', 'custom'];

// ── Custom tooltip ────────────────────────────────────────────

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────

function StatCard({ label, value, Icon, colorClass, loading }) {
  return (
    <div className="card flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-slate-400 text-xs uppercase tracking-wide truncate">{label}</p>
        <p className={`text-lg sm:text-xl font-bold mt-0.5 break-words ${loading ? 'text-slate-700' : 'text-white'}`}>
          {loading ? '—' : fmt(value)}
        </p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function ReportsPage() {
  const { activeBranch, branches } = useAuth();
  const [period, setPeriod]             = useState('month');
  const [customDate, setCustomDate]     = useState(today());
  const [branchFilter, setBranchFilter] = useState('active'); // 'active' | 'all'
  const [salesRows, setSalesRows]       = useState([]);
  const [expRows, setExpRows]           = useState([]);
  const [loading, setLoading]           = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { from, to } = period === 'custom'
      ? { from: customDate, to: customDate }
      : getRange(period);

    // Build branch filter
    let salesQ = supabase
      .from('daily_sales')
      .select('date, total_revenue, total_expenses, bill_count, branch_id')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true });

    let expQ = supabase
      .from('expenses')
      .select('category, amount')
      .gte('date', from)
      .lte('date', to);

    if (branchFilter === 'active' && activeBranch?.id) {
      salesQ = salesQ.eq('branch_id', activeBranch.id);
      expQ   = expQ.eq('branch_id', activeBranch.id);
    }

    const [salesRes, expRes] = await Promise.all([salesQ, expQ]);
    setSalesRows(salesRes.data ?? []);
    setExpRows(expRes.data ?? []);
    setLoading(false);
  }, [period, customDate, branchFilter, activeBranch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Aggregations ─────────────────────────────────────────────

  const totalRevenue  = salesRows.reduce((s, r) => s + Number(r.total_revenue), 0);
  const totalExpenses = salesRows.reduce((s, r) => s + Number(r.total_expenses), 0);
  const netProfit     = totalRevenue - totalExpenses;
  const totalBills    = salesRows.reduce((s, r) => s + Number(r.bill_count), 0);

  // Daily trend chart data
  const dailyMap = {};
  salesRows.forEach((r) => {
    if (!dailyMap[r.date]) dailyMap[r.date] = { date: r.date, revenue: 0, expenses: 0, profit: 0 };
    dailyMap[r.date].revenue  += Number(r.total_revenue);
    dailyMap[r.date].expenses += Number(r.total_expenses);
    dailyMap[r.date].profit   += Number(r.total_revenue) - Number(r.total_expenses);
  });
  const dailyData = Object.values(dailyMap);

  // Expense category breakdown
  const catMap = {};
  expRows.forEach((r) => {
    catMap[r.category] = (catMap[r.category] || 0) + Number(r.amount);
  });
  const catData = Object.entries(catMap)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const showAllBranches = branches.length > 1;

  // Per-branch breakdown (used when branchFilter === 'all')
  const branchSalesMap = {};
  salesRows.forEach((r) => {
    if (!branchSalesMap[r.branch_id]) branchSalesMap[r.branch_id] = { revenue: 0, expenses: 0, bills: 0 };
    branchSalesMap[r.branch_id].revenue  += Number(r.total_revenue);
    branchSalesMap[r.branch_id].expenses += Number(r.total_expenses);
    branchSalesMap[r.branch_id].bills    += Number(r.bill_count);
  });
  const branchBreakdown = branches.map((b) => ({
    id:       b.id,
    name:     b.name,
    revenue:  branchSalesMap[b.id]?.revenue  ?? 0,
    expenses: branchSalesMap[b.id]?.expenses ?? 0,
    bills:    branchSalesMap[b.id]?.bills    ?? 0,
    profit:   (branchSalesMap[b.id]?.revenue ?? 0) - (branchSalesMap[b.id]?.expenses ?? 0),
  }));

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-xl font-bold text-white">Reports</h1>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Branch filter */}
          {showAllBranches && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="input-field !w-auto text-xs py-1.5"
            >
              <option value="active">{activeBranch?.name ?? 'Active branch'}</option>
              <option value="all">All Branches</option>
            </select>
          )}

          {/* Period tabs */}
          <div className="flex bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors
                  ${period === p
                    ? 'bg-primary-500 text-white'
                    : 'text-slate-400 hover:text-white'}`}
              >
                {p === 'custom' ? 'Custom' : p}
              </button>
            ))}
          </div>

          {/* Date picker — only visible when custom is selected */}
          {period === 'custom' && (
            <input
              type="date"
              value={customDate}
              max={today()}
              onChange={(e) => setCustomDate(e.target.value)}
              className="input-field !w-auto text-xs py-1.5"
            />
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <StatCard label="Revenue"   value={totalRevenue}  Icon={TrendingUp}   colorClass="bg-green-700"    loading={loading} />
        <StatCard label="Expenses"  value={totalExpenses} Icon={TrendingDown} colorClass="bg-red-700"      loading={loading} />
        <StatCard label="Net Profit" value={netProfit}    Icon={DollarSign}   colorClass="bg-primary-600"  loading={loading} />
        <div className="card flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-700">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-slate-400 text-xs uppercase tracking-wide truncate">Bills</p>
            <p className={`text-lg sm:text-xl font-bold mt-0.5 break-words ${loading ? 'text-slate-700' : 'text-white'}`}>
              {loading ? '—' : totalBills.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* Revenue vs Expenses bar chart */}
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4">Revenue vs Expenses</h2>
          {dailyData.length === 0
            ? <EmptyChart loading={loading} />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip content={<DarkTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                  <Bar dataKey="revenue"  name="Revenue"  fill="#f97316" radius={[3,3,0,0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </div>

        {/* Net Profit line chart */}
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4">Net Profit Trend</h2>
          {dailyData.length === 0
            ? <EmptyChart loading={loading} />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dailyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip content={<DarkTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    name="Net Profit"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#f97316' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
        </div>
      </div>

      {/* Expense category breakdown */}
      {catData.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4">Expense Breakdown by Category</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={catData} layout="vertical" margin={{ top: 0, right: 20, left: 60, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis type="category" dataKey="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={55} />
              <Tooltip content={<DarkTooltip />} />
              <Bar dataKey="amount" name="Amount" fill="#f97316" radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-branch breakdown — only when All Branches is selected */}
      {branchFilter === 'all' && showAllBranches && (
        <div className="card mt-4">
          <h2 className="text-sm font-semibold text-white mb-4">Branch-wise Breakdown</h2>
          {loading ? (
            <p className="text-slate-600 text-sm text-center py-8">Loading...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-700">
                    <th className="pb-3 pr-4 text-slate-400 font-medium">Branch</th>
                    <th className="pb-3 px-4 text-slate-400 font-medium text-right">Revenue</th>
                    <th className="pb-3 px-4 text-slate-400 font-medium text-right">Expenses</th>
                    <th className="pb-3 px-4 text-slate-400 font-medium text-right">Net Profit</th>
                    <th className="pb-3 pl-4 text-slate-400 font-medium text-right">Bills</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {branchBreakdown.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 pr-4 text-white font-medium">{b.name}</td>
                      <td className="py-3 px-4 text-green-400 text-right">{fmt(b.revenue)}</td>
                      <td className="py-3 px-4 text-red-400 text-right">{fmt(b.expenses)}</td>
                      <td className={`py-3 px-4 text-right font-semibold ${b.profit >= 0 ? 'text-primary-400' : 'text-red-400'}`}>
                        {fmt(b.profit)}
                      </td>
                      <td className="py-3 pl-4 text-slate-400 text-right">{b.bills.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-600 font-semibold">
                    <td className="pt-3 pr-4 text-slate-300">Total</td>
                    <td className="pt-3 px-4 text-green-400 text-right">{fmt(totalRevenue)}</td>
                    <td className="pt-3 px-4 text-red-400 text-right">{fmt(totalExpenses)}</td>
                    <td className={`pt-3 px-4 text-right ${netProfit >= 0 ? 'text-primary-400' : 'text-red-400'}`}>
                      {fmt(netProfit)}
                    </td>
                    <td className="pt-3 pl-4 text-slate-400 text-right">{totalBills.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
              {branchBreakdown.every((b) => b.revenue === 0 && b.expenses === 0) && (
                <p className="text-slate-600 text-sm text-center py-6">No data for selected period.</p>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && dailyData.length === 0 && catData.length === 0 && (
        <div className="card text-center py-10 text-slate-600 text-sm">
          No data found for the selected period.<br />
          Bills created in the Electron POS will appear here after syncing.
        </div>
      )}
    </div>
  );
}

function EmptyChart({ loading }) {
  return (
    <div className="h-[220px] flex items-center justify-center text-slate-600 text-sm">
      {loading ? 'Loading...' : 'No data for this period'}
    </div>
  );
}
