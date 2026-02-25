import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Store, ArrowRight } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { supabase } from '../lib/supabase';

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
  const { activeBranch, branches } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeBranch?.id) return;
    setLoading(true);

    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.slice(0, 8) + '01';

    Promise.all([
      supabase
        .from('daily_sales')
        .select('total_revenue, total_expenses, bill_count')
        .eq('branch_id', activeBranch.id)
        .gte('date', monthStart)
        .lte('date', today),
      supabase
        .from('branches')
        .select('id', { count: 'exact', head: true }),
    ]).then(([salesRes, branchCountRes]) => {
      const rows = salesRes.data ?? [];
      const revenue  = rows.reduce((s, r) => s + Number(r.total_revenue), 0);
      const expenses = rows.reduce((s, r) => s + Number(r.total_expenses), 0);
      setStats({
        revenue:       `Rs ${revenue.toLocaleString()}`,
        expenses:      `Rs ${expenses.toLocaleString()}`,
        netProfit:     `Rs ${(revenue - expenses).toLocaleString()}`,
        activeBranches: branchCountRes.count ?? branches.length,
      });
      setLoading(false);
    });
  }, [activeBranch, branches.length]);

  const now = new Date();
  const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {activeBranch
              ? <>Viewing <span className="text-primary-400 font-medium">{activeBranch.name}</span> — {monthName}</>
              : 'No branch selected'}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Revenue (month)"
          value={loading ? null : (stats?.revenue ?? null)}
          sub={loading ? 'Loading...' : 'This month'}
          Icon={TrendingUp}
          colorClass="bg-green-700"
        />
        <StatCard
          label="Expenses (month)"
          value={loading ? null : (stats?.expenses ?? null)}
          sub={loading ? 'Loading...' : 'This month'}
          Icon={TrendingDown}
          colorClass="bg-red-700"
        />
        <StatCard
          label="Net Profit"
          value={loading ? null : (stats?.netProfit ?? null)}
          sub={loading ? 'Loading...' : 'Revenue − expenses'}
          Icon={DollarSign}
          colorClass="bg-primary-600"
        />
        <StatCard
          label="Active Branches"
          value={loading ? null : (stats?.activeBranches ?? null)}
          sub="Total branches"
          Icon={Store}
          colorClass="bg-blue-700"
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-1">Branch Management</h2>
          <p className="text-slate-400 text-xs mb-3">
            Create and manage restaurant branches, assign users and roles.
          </p>
          <a href="/branches" className="inline-flex items-center gap-1 text-primary-400 text-xs hover:text-primary-300 transition-colors">
            Go to Branches <ArrowRight className="w-3 h-3" />
          </a>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-1">User Management</h2>
          <p className="text-slate-400 text-xs mb-3">
            Assign users to branches with specific roles and permissions.
          </p>
          <a href="/users" className="inline-flex items-center gap-1 text-primary-400 text-xs hover:text-primary-300 transition-colors">
            Go to Users <ArrowRight className="w-3 h-3" />
          </a>
        </div>

        <div className="card sm:col-span-2 border-dashed border-slate-600">
          <p className="text-slate-600 text-sm text-center py-2">
            Reports, analytics, menu management, and more — coming in the next session.
          </p>
        </div>
      </div>
    </div>
  );
}
