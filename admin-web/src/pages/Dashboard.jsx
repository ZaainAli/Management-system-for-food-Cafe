import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Store } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { supabase } from '../lib/supabase';

const fmt = (n) => `Rs ${Number(n || 0).toLocaleString()}`;

function StatCard({ label, value, sub, Icon, colorClass }) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wide truncate">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${value === null ? 'text-slate-700' : 'text-white'}`}>
          {value === null ? '—' : value}
        </p>
        {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { branches } = useAuth();
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(false);

  const now        = new Date();
  const monthName  = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  const today      = now.toISOString().split('T')[0];
  const monthStart = today.slice(0, 8) + '01';

  useEffect(() => {
    if (!branches.length) return;
    setLoading(true);
    const ids = branches.map((b) => b.id);
    supabase
      .from('daily_sales')
      .select('branch_id, total_revenue, total_expenses, bill_count')
      .in('branch_id', ids)
      .gte('date', monthStart)
      .lte('date', today)
      .then(({ data }) => {
        setRows(data ?? []);
        setLoading(false);
      });
  }, [branches]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Combined totals ──────────────────────────────────────────
  const totalRevenue  = rows.reduce((s, r) => s + Number(r.total_revenue),  0);
  const totalExpenses = rows.reduce((s, r) => s + Number(r.total_expenses), 0);
  const totalBills    = rows.reduce((s, r) => s + Number(r.bill_count),     0);

  // ── Per-branch breakdown ─────────────────────────────────────
  const bmap = {};
  rows.forEach((r) => {
    if (!bmap[r.branch_id]) bmap[r.branch_id] = { revenue: 0, expenses: 0, bills: 0 };
    bmap[r.branch_id].revenue  += Number(r.total_revenue);
    bmap[r.branch_id].expenses += Number(r.total_expenses);
    bmap[r.branch_id].bills    += Number(r.bill_count);
  });

  const branchStats = branches.map((b) => ({
    id:       b.id,
    name:     b.name,
    revenue:  bmap[b.id]?.revenue  ?? 0,
    expenses: bmap[b.id]?.expenses ?? 0,
    bills:    bmap[b.id]?.bills    ?? 0,
    profit:   (bmap[b.id]?.revenue ?? 0) - (bmap[b.id]?.expenses ?? 0),
  }));

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          All branches combined —{' '}
          <span className="text-primary-400 font-medium">{monthName}</span>
        </p>
      </div>

      {/* ── Combined summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Revenue"
          value={loading ? null : fmt(totalRevenue)}
          sub="All branches this month"
          Icon={TrendingUp}
          colorClass="bg-green-700"
        />
        <StatCard
          label="Total Expenses"
          value={loading ? null : fmt(totalExpenses)}
          sub="All branches this month"
          Icon={TrendingDown}
          colorClass="bg-red-700"
        />
        <StatCard
          label="Net Profit"
          value={loading ? null : fmt(totalRevenue - totalExpenses)}
          sub="Revenue − expenses"
          Icon={DollarSign}
          colorClass="bg-primary-600"
        />
        <StatCard
          label="Active Branches"
          value={loading ? null : branches.length}
          sub={loading ? 'Loading...' : `${totalBills.toLocaleString()} bills total`}
          Icon={Store}
          colorClass="bg-blue-700"
        />
      </div>

      {/* ── Per-branch breakdown table ── */}
      <div className="card">
        <h2 className="text-sm font-semibold text-white mb-4">
          Branch-wise Breakdown —{' '}
          <span className="text-slate-400 font-normal">{monthName}</span>
        </h2>

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
                {branchStats.map((b) => (
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
              {branchStats.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-600 font-semibold">
                    <td className="pt-3 pr-4 text-slate-300">Total</td>
                    <td className="pt-3 px-4 text-green-400 text-right">{fmt(totalRevenue)}</td>
                    <td className="pt-3 px-4 text-red-400 text-right">{fmt(totalExpenses)}</td>
                    <td className={`pt-3 px-4 text-right ${(totalRevenue - totalExpenses) >= 0 ? 'text-primary-400' : 'text-red-400'}`}>
                      {fmt(totalRevenue - totalExpenses)}
                    </td>
                    <td className="pt-3 pl-4 text-slate-400 text-right">{totalBills.toLocaleString()}</td>
                  </tr>
                </tfoot>
              )}
            </table>

            {branchStats.length === 0 && (
              <p className="text-slate-600 text-sm text-center py-8">
                No sales data for this month yet.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
