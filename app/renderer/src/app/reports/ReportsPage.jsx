import React, { useState, useEffect } from 'react';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('sales');
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let res;
      switch (activeTab) {
        case 'sales':   res = await window.api.report.getSalesReport({ period }); break;
        case 'expense': res = await window.api.report.getExpenseReport({ period }); break;
        case 'staff':   res = await window.api.report.getStaffReport({ period }); break;
        case 'pl':      res = await window.api.report.getProfitLoss({ period }); break;
        default: break;
      }
      if (res?.success) setData(res.data);
      setLoading(false);
    })();
  }, [activeTab, period]);

  const fmt = (n) => `PKR ${Number(n).toLocaleString()}`;

  const tabs = [
    { id: 'sales', label: 'Sales' },
    { id: 'expense', label: 'Expenses' },
    { id: 'staff', label: 'Staff' },
    { id: 'pl', label: 'Profit & Loss' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-white">Reports</h1>
        {/* Period Selector */}
        <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
          {['week','month','year'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs rounded-md transition-colors capitalize
                ${period === p ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-white'}`}>{p}</button>
          ))}
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-1 mb-5">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors
              ${activeTab === tab.id ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card h-48 animate-pulse bg-slate-700" />
      ) : (
        <div>
          {/* ── Sales Report ── */}
          {activeTab === 'sales' && data && (
            <div>
              <div className="grid grid-cols-3 gap-4 mb-5">
                <div className="card"><p className="text-slate-400 text-xs">Total Revenue</p><p className="text-green-400 text-xl font-bold mt-1">{fmt(data.totalRevenue)}</p></div>
                <div className="card"><p className="text-slate-400 text-xs">Total Bills</p><p className="text-white text-xl font-bold mt-1">{data.totalBills}</p></div>
                <div className="card"><p className="text-slate-400 text-xs">Avg Bill</p><p className="text-white text-xl font-bold mt-1">{fmt(data.totalRevenue / (data.totalBills || 1))}</p></div>
              </div>

              {/* Top Items */}
              <div className="card">
                <h2 className="text-sm font-semibold text-slate-300 mb-3">Top Selling Items</h2>
                {data.topItems.length === 0 ? (
                  <p className="text-slate-600 text-sm text-center py-4">No sales data</p>
                ) : (
                  <div className="space-y-2">
                    {data.topItems.map((item, i) => {
                      const maxRev = data.topItems[0].revenue;
                      const pct = maxRev > 0 ? (item.revenue / maxRev) * 100 : 0;
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-white">{item.name}</span>
                            <span className="text-slate-500">{fmt(item.revenue)} ({item.quantity} sold)</span>
                          </div>
                          <div className="w-full bg-slate-700 rounded-full h-1.5">
                            <div className="bg-primary-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Daily Totals */}
              {data.dailyTotals.length > 0 && (
                <div className="card mt-4">
                  <h2 className="text-sm font-semibold text-slate-300 mb-3">Daily Breakdown</h2>
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-700">
                      <th className="text-left py-2 text-slate-500 text-xs">Date</th>
                      <th className="text-left py-2 text-slate-500 text-xs">Bills</th>
                      <th className="text-left py-2 text-slate-500 text-xs">Revenue</th>
                    </tr></thead>
                    <tbody>
                      {data.dailyTotals.map(d => (
                        <tr key={d.date} className="border-b border-slate-700/40">
                          <td className="py-2 text-slate-400 text-xs">{d.date}</td>
                          <td className="py-2 text-slate-300 text-xs">{d.bills}</td>
                          <td className="py-2 text-green-400 text-xs font-medium">{fmt(d.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Expense Report ── */}
          {activeTab === 'expense' && data && (
            <div>
              <div className="card mb-5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Total Expenses ({period})</span>
                  <span className="text-red-400 text-xl font-bold">{fmt(data.totalExpenses)}</span>
                </div>
              </div>
              <div className="card">
                <h2 className="text-sm font-semibold text-slate-300 mb-3">By Category</h2>
                {data.byCategory.length === 0 ? (
                  <p className="text-slate-600 text-sm text-center py-4">No expense data</p>
                ) : (
                  <div className="space-y-2">
                    {data.byCategory.map((cat, i) => {
                      const maxAmt = data.byCategory[0].total;
                      const pct = maxAmt > 0 ? (cat.total / maxAmt) * 100 : 0;
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-white">{cat.category}</span>
                            <span className="text-slate-500">{fmt(cat.total)} ({cat.count} entries)</span>
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
            </div>
          )}

          {/* ── Staff Report ── */}
          {activeTab === 'staff' && data && (
            <div>
              <div className="card mb-5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Total Salary Paid ({period})</span>
                  <span className="text-green-400 text-xl font-bold">{fmt(data.totalSalaryPaid)}</span>
                </div>
              </div>
              <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-700">
                    <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Name</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Position</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Monthly Salary</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Total Paid</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Payments</th>
                  </tr></thead>
                  <tbody>
                    {data.employees.map(emp => (
                      <tr key={emp.id} className="border-b border-slate-700/50">
                        <td className="px-4 py-3 text-white">{emp.name}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{emp.position}</td>
                        <td className="px-4 py-3 text-slate-300 text-xs">{fmt(emp.monthlySalary)}</td>
                        <td className="px-4 py-3 text-green-400 font-medium text-xs">{fmt(emp.salaryInfo.totalPaid)}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{emp.salaryInfo.payments}</td>
                      </tr>
                    ))}
                    {data.employees.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-600 text-sm">No staff data</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Profit & Loss ── */}
          {activeTab === 'pl' && data && (
            <div className="grid grid-cols-2 gap-4">
              <div className="card">
                <p className="text-slate-400 text-xs uppercase tracking-wide">Revenue</p>
                <p className="text-green-400 text-3xl font-bold mt-1">{fmt(data.totalRevenue)}</p>
              </div>
              <div className="card">
                <p className="text-slate-400 text-xs uppercase tracking-wide">Expenses</p>
                <p className="text-red-400 text-3xl font-bold mt-1">{fmt(data.totalExpenses)}</p>
              </div>
              <div className="card col-span-2">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wide">Net Profit / Loss</p>
                    <p className={`text-4xl font-bold mt-1 ${data.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {data.netProfit < 0 ? '−' : ''}{fmt(Math.abs(data.netProfit))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500 text-xs">Profit Margin</p>
                    <p className={`text-2xl font-bold ${data.profitMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {data.profitMargin}%
                    </p>
                  </div>
                </div>

                {/* Visual bar */}
                <div className="mt-4">
                  <div className="flex h-3 rounded-full overflow-hidden bg-slate-700">
                    <div className="bg-green-500" style={{ width: `${data.totalRevenue > 0 ? (data.totalRevenue - data.totalExpenses) / data.totalRevenue * 100 : 0}%`, minWidth: data.netProfit >= 0 ? '2%' : '0%' }} />
                    <div className="bg-red-500 flex-1" />
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-green-400">Profit</span>
                    <span className="text-red-400">Expenses</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
