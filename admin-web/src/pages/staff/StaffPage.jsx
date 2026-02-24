import React, { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/AuthContext';
import EmployeeModal from './EmployeeModal';

export default function StaffPage() {
  const { branches } = useAuth();
  const [employees, setEmployees]   = useState([]);
  const [allBranches, setAllBranches] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [branchFilter, setBranchFilter] = useState('all');
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [salaryMap, setSalaryMap]   = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [empRes, brRes] = await Promise.all([
      supabase
        .from('employees')
        .select('id, name, role, phone, salary, hire_date, active, branch_id, branches(name)')
        .order('name'),
      supabase.from('branches').select('id, name').order('name'),
    ]);
    setEmployees(empRes.data ?? []);
    setAllBranches(brRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch salary records for an employee when row expands
  const loadSalaryRecords = async (employeeId) => {
    if (salaryMap[employeeId]) return;
    const { data } = await supabase
      .from('salary_records')
      .select('id, amount, month, paid_at')
      .eq('employee_id', employeeId)
      .order('paid_at', { ascending: false });
    setSalaryMap((m) => ({ ...m, [employeeId]: data ?? [] }));
  };

  const toggleExpand = (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    loadSalaryRecords(id);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this employee and their salary records?')) return;
    await supabase.from('employees').delete().eq('id', id);
    fetchData();
  };

  const visible = branchFilter === 'all'
    ? employees
    : employees.filter((e) => e.branch_id === branchFilter);

  // All branches (from auth context or fetched list)
  const branchOptions = allBranches.length ? allBranches : branches;

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map((i) => <div key={i} className="card h-14 animate-pulse bg-slate-700/50" />)}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Staff</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {visible.length} employee{visible.length !== 1 ? 's' : ''}
            {branchFilter !== 'all' && ` — ${branchOptions.find((b) => b.id === branchFilter)?.name}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {branchOptions.length > 1 && (
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="input-field !w-auto text-xs py-1.5">
              <option value="all">All Branches</option>
              {branchOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary text-sm">+ Add Employee</button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="w-8 px-2 py-3"></th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Name</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase hidden sm:table-cell">Branch</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase hidden md:table-cell">Role</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Salary</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase hidden lg:table-cell">Status</th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((emp) => (
              <React.Fragment key={emp.id}>
                <tr className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer"
                    onClick={() => toggleExpand(emp.id)}>
                  <td className="px-2 py-3 text-slate-500">
                    {expandedId === emp.id
                      ? <ChevronDown className="w-3.5 h-3.5" />
                      : <ChevronRight className="w-3.5 h-3.5" />}
                  </td>
                  <td className="px-4 py-3 text-white font-medium">{emp.name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden sm:table-cell">{emp.branches?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">{emp.role || '—'}</td>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    {emp.salary ? `Rs ${Number(emp.salary).toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${emp.active ? 'bg-green-900/40 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                      {emp.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => { setEditing(emp); setShowModal(true); }} className="text-slate-400 hover:text-white transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(emp.id)} className="text-slate-400 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>

                {/* Expanded salary records */}
                {expandedId === emp.id && (
                  <tr className="bg-slate-900/40">
                    <td colSpan={7} className="px-8 py-3">
                      <p className="text-slate-400 text-xs font-medium mb-2 uppercase tracking-wide">Salary Records</p>
                      {!salaryMap[emp.id]
                        ? <p className="text-slate-600 text-xs">Loading...</p>
                        : salaryMap[emp.id].length === 0
                        ? <p className="text-slate-600 text-xs">No salary records yet.</p>
                        : (
                          <div className="space-y-1">
                            {salaryMap[emp.id].map((s) => (
                              <div key={s.id} className="flex items-center gap-4 text-xs">
                                <span className="text-slate-500 w-16">{s.month}</span>
                                <span className="text-slate-300">Rs {Number(s.amount).toLocaleString()}</span>
                                <span className="text-slate-600">{new Date(s.paid_at).toLocaleDateString()}</span>
                              </div>
                            ))}
                          </div>
                        )
                      }
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}

            {visible.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-600 text-sm">
                No employees found. Click <strong className="text-slate-500">+ Add Employee</strong>.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <EmployeeModal
          employee={editing}
          branches={branchOptions}
          onClose={() => setShowModal(false)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
