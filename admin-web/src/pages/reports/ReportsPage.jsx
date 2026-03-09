import React, { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, BookOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/AuthContext';
import { formatPkDate, shiftPkDate } from '@/utils/datetime';

// ── Helpers ──────────────────────────────────────────────────

const fmt     = (n) => `Rs ${Number(n || 0).toLocaleString()}`;
const fmtAxis = (n) => {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return `${v}`;
};
const today   = () => formatPkDate();
const curMonth = () => formatPkDate().slice(0, 7);
const curYear  = () => String(new Date().getFullYear());
const YEAR_OPTIONS = Array.from({ length: new Date().getFullYear() - 2019 }, (_, i) => String(new Date().getFullYear() - i));
const PERIODS = ['today', 'week', 'month', 'year', 'custom'];

function getRange(period, selMonth, selYear) {
  const pad = (n) => String(n).padStart(2, '0');
  const td  = formatPkDate();
  if (period === 'today') return { from: td, to: td };
  if (period === 'week') {
    return { from: shiftPkDate(td, -6), to: td };
  }
  if (period === 'month') {
    const [y, m] = selMonth.split('-').map(Number);
    const last   = pad(new Date(y, m, 0).getDate());
    return { from: `${selMonth}-01`, to: `${selMonth}-${last}` };
  }
  if (period === 'year') return { from: `${selYear}-01-01`, to: `${selYear}-12-31` };
  return { from: td, to: td };
}

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
  const [selMonth, setSelMonth]         = useState(curMonth());
  const [selYear, setSelYear]           = useState(curYear());
  const [customFrom, setCustomFrom]     = useState(today());
  const [customTo, setCustomTo]         = useState(today());
  const [branchFilter, setBranchFilter] = useState('all'); // 'all' | branch_id
  const [salesRows, setSalesRows]         = useState([]);
  const [expRows, setExpRows]             = useState([]);
  const [khataRows, setKhataRows]         = useState([]);
  const [allKhataRows, setAllKhataRows]   = useState([]);
  const [loading, setLoading]             = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { from, to } = period === 'custom'
      ? { from: customFrom, to: customTo }
      : getRange(period, selMonth, selYear);

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

    let khataQ = supabase
      .from('khata_transactions')
      .select('type, amount')
      .gte('date', from)
      .lte('date', to);

    // All-time khata (no date filter) for Total Due
    let allKhataQ = supabase
      .from('khata_transactions')
      .select('type, amount');

    if (branchFilter !== 'all') {
      salesQ    = salesQ.eq('branch_id', branchFilter);
      expQ      = expQ.eq('branch_id', branchFilter);
      khataQ    = khataQ.eq('branch_id', branchFilter);
      allKhataQ = allKhataQ.eq('branch_id', branchFilter);
    }

    const [salesRes, expRes, khataRes, allKhataRes] = await Promise.all([salesQ, expQ, khataQ, allKhataQ]);

    if (salesRes.error)    console.error('sales fetch error:', salesRes.error);
    if (expRes.error)      console.error('expenses fetch error:', expRes.error);
    if (khataRes.error)    console.error('khata fetch error:', khataRes.error);
    if (allKhataRes.error) console.error('all khata fetch error:', allKhataRes.error);

    setSalesRows(salesRes.data ?? []);
    setExpRows(expRes.data ?? []);
    setKhataRows(khataRes.data ?? []);
    setAllKhataRows(allKhataRes.data ?? []);
    setLoading(false);
  }, [period, selMonth, selYear, customFrom, customTo, branchFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Aggregations ─────────────────────────────────────────────

  const totalRevenue  = salesRows.reduce((s, r) => s + Number(r.total_revenue), 0);
  const totalExpenses = salesRows.reduce((s, r) => s + Number(r.total_expenses), 0);
  const netProfit     = totalRevenue - totalExpenses;
  const totalBills    = salesRows.reduce((s, r) => s + Number(r.bill_count), 0);
  const khataTotalDue = khataRows
    .filter((r) => r.type === 'due')
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const khataTotalPayment = khataRows
    .filter((r) => r.type === 'payment')
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const allTimeDue     = allKhataRows.filter((r) => r.type === 'due').reduce((s, r) => s + Number(r.amount || 0), 0);
  const allTimePayment = allKhataRows.filter((r) => r.type === 'payment').reduce((s, r) => s + Number(r.amount || 0), 0);
  const khataTotalBalance = allTimeDue - allTimePayment;
  // Daily trend chart data
  const dailyMap = {};
  salesRows.forEach((r) => {
    if (!dailyMap[r.date]) dailyMap[r.date] = { date: r.date, revenue: 0, expenses: 0, profit: 0 };
    dailyMap[r.date].revenue  += Number(r.total_revenue);
    dailyMap[r.date].expenses += Number(r.total_expenses);
    dailyMap[r.date].profit   += Number(r.total_revenue) - Number(r.total_expenses);
  });
  const dailyData = Object.values(dailyMap);
  const avgDailyExpense = dailyData.length > 0 ? totalExpenses / dailyData.length : 0;
  const billsByDate = salesRows.reduce((acc, row) => {
    acc[row.date] = (acc[row.date] || 0) + Number(row.bill_count || 0);
    return acc;
  }, {});

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
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
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

          {/* Month picker */}
          {period === 'month' && (
            <input
              type="month"
              value={selMonth}
              max={curMonth()}
              onChange={(e) => setSelMonth(e.target.value)}
              className="input-field !w-auto text-xs py-1.5"
            />
          )}

          {/* Year picker */}
          {period === 'year' && (
            <select
              value={selYear}
              onChange={(e) => setSelYear(e.target.value)}
              className="input-field !w-auto text-xs py-1.5"
            >
              {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}

          {/* Custom date range */}
          {period === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="input-field !w-auto text-xs py-1.5"
              />
              <span className="text-slate-500 text-xs">to</span>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={today()}
                onChange={(e) => setCustomTo(e.target.value)}
                className="input-field !w-auto text-xs py-1.5"
              />
            </div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 mb-5">
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
        <div className="card flex flex-col gap-3">
          {/* header row */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-purple-700">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-slate-400 text-xs uppercase tracking-wide">Khata</p>
            </div>
          </div>
          {/* due / payment row */}
          <div className="flex flex-col gap-2">
            <div className="bg-slate-800/60 rounded-lg px-2.5 py-2">
              <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-0.5">Total Due</p>
              <p className={`text-sm font-bold ${loading ? 'text-slate-700' : khataTotalBalance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {loading ? '—' : fmt(khataTotalBalance)}
              </p>
            </div>
            <div className="bg-slate-800/60 rounded-lg px-2.5 py-2">
              <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-0.5">Due</p>
              <p className={`text-sm font-bold ${loading ? 'text-slate-700' : 'text-red-400'}`}>
                {loading ? '—' : fmt(khataTotalDue)}
              </p>
            </div>
            <div className="bg-slate-800/60 rounded-lg px-2.5 py-2">
              <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-0.5">Payment</p>
              <p className={`text-sm font-bold ${loading ? 'text-slate-700' : 'text-green-400'}`}>
                {loading ? '—' : fmt(khataTotalPayment)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sales style section */}
      <div className="mb-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-3">Sales Daily Breakdown</h2>
          {loading ? (
            <p className="text-slate-600 text-sm text-center py-6">Loading...</p>
          ) : dailyData.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-6">No sales data</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 text-slate-400 text-xs">Date</th>
                    <th className="text-left py-2 text-slate-400 text-xs">Bills</th>
                    <th className="text-left py-2 text-slate-400 text-xs">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyData.map((d) => (
                    <tr key={d.date} className="border-b border-slate-700/40">
                      <td className="py-2 text-slate-300 text-xs">{d.date}</td>
                      <td className="py-2 text-white text-xs">{billsByDate[d.date] || 0}</td>
                      <td className="py-2 text-green-400 text-xs font-medium">{fmt(d.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Expense style section */}
      <div className="mb-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-3">Top Expense Categories</h2>
          {loading ? (
            <p className="text-slate-600 text-sm text-center py-6">Loading...</p>
          ) : catData.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-6">No expense data</p>
          ) : (
            <div className="space-y-2">
              {catData.map((c, i) => {
                const max = catData[0]?.amount || 0;
                const pct = max > 0 ? (c.amount / max) * 100 : 0;
                return (
                  <div key={`${c.category}-${i}`}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-white">{c.category}</span>
                      <span className="text-slate-500">{fmt(c.amount)}</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-1.5">
                      <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card mt-4">
          <h2 className="text-sm font-semibold text-white mb-3">Daily Expense Breakdown</h2>
          {loading ? (
            <p className="text-slate-600 text-sm text-center py-6">Loading...</p>
          ) : dailyData.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-6">No Expense data</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 text-slate-400 text-xs">Date</th>
                    <th className="text-left py-2 text-slate-400 text-xs">Expense</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyData.map((d) => (
                    <tr key={`expense-${d.date}`} className="border-b border-slate-700/40">
                      <td className="py-2 text-slate-300 text-xs">{d.date}</td>
                      <td className="py-2 text-red-400 text-xs font-medium">{fmt(d.expenses)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
                <BarChart data={dailyData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} width={48} tickFormatter={fmtAxis} />
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
                <LineChart data={dailyData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} width={48} tickFormatter={fmtAxis} />
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
      {branchFilter === 'all' && showAllBranches && branches.length > 1 && (
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
