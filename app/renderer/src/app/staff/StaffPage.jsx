import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { getPkToday, monthBounds } from '../../utils/datetime';

const POSITION_OPTIONS = ['Staff', 'Waiter', 'Cook', 'Manager', 'Cashier'];
const emptyForm = {
  name: '',
  position: POSITION_OPTIONS[0],
  phone: '',
  email: '',
  monthlySalary: 0,
  hireDate: getPkToday(),
  isActive: true,
};

function getMonthRange(monthValue) {
  const range = monthBounds(monthValue);
  if (!range.from || !range.to) return null;
  return range;
}

function toMonthValue(dateString) {
  return (dateString || getPkToday()).slice(0, 7);
}

function round2(value) {
  return Number((Number(value) || 0).toFixed(2));
}

function isDateInMonth(dateString, monthValue) {
  return typeof dateString === 'string' && dateString.slice(0, 7) === monthValue;
}

export default function StaffPage() {
  const { user } = useAuth();
  const canChangeEmployeeStatus = user?.role === 'admin' || user?.role === 'manager';
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [customPosition, setCustomPosition] = useState('');
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Salary panel
  const [salaryEmp, setSalaryEmp] = useState(null);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [salaryMonth, setSalaryMonth] = useState(toMonthValue(getPkToday()));
  const [salaryForm, setSalaryForm] = useState({ amount: '', payDate: getPkToday(), notes: '' });
  const [attendanceSummary, setAttendanceSummary] = useState({
    from: '',
    to: '',
    presentDays: 0,
    absentDays: 0,
    totalHours: 0,
    hourlyRate: 0,
    calculatedSalary: 0,
  });

  const fetchEmployees = async () => {
    const res = await window.api.staff.getAll({});
    if (res.success) setEmployees(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchEmployees(); }, []);

  const openAdd = () => {
    setForm(emptyForm);
    setCustomPosition('');
    setEditId(null);
    setShowModal(true);
  };
  const openEdit = (emp) => {
    const isKnownPosition = POSITION_OPTIONS.includes(emp.position);
    setForm({
      name: emp.name,
      position: isKnownPosition ? emp.position : '__custom__',
      phone: emp.phone,
      email: emp.email,
      monthlySalary: emp.monthlySalary,
      hireDate: emp.hireDate,
      isActive: !!emp.isActive,
    });
    setCustomPosition(isKnownPosition ? '' : emp.position);
    setEditId(emp.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    const finalPosition = form.position === '__custom__' ? customPosition.trim() : form.position;
    if (!finalPosition) return;
    const payload = { ...form, position: finalPosition };
    let res;
    if (editId) res = await window.api.staff.update({ id: editId, ...payload });
    else res = await window.api.staff.add(payload);
    if (res.success) { setShowModal(false); await fetchEmployees(); }
  };

  const refreshAttendanceSummary = async (emp, monthValue) => {
    const range = getMonthRange(monthValue);
    if (!emp || !range) return;

    const res = await window.api.staff.getAttendance({
      employeeId: emp.id,
      from: range.from,
      to: range.to,
    });

    const records = res.success ? (res.data || []) : [];
    const presentDays = records.filter((r) => r.status === 'present').length;
    const absentDays = records.filter((r) => r.status === 'absent').length;
    const totalHours = round2(records.reduce((sum, r) => sum + (Number(r.hoursWorked) || 0), 0));
    const hourlyRate = round2((Number(emp.monthlySalary) || 0) / 30 / 12);
    const calculatedSalary = round2(hourlyRate * totalHours);

    setAttendanceSummary({
      from: range.from,
      to: range.to,
      presentDays,
      absentDays,
      totalHours,
      hourlyRate,
      calculatedSalary,
    });
  };

  // Salary panel handlers
  const openSalary = async (emp) => {
    setSalaryEmp(emp);
    const now = toMonthValue(getPkToday());
    setSalaryMonth(now);

    const [historyRes] = await Promise.all([
      window.api.staff.getSalaryHistory({ employeeId: emp.id, filters: {} }),
      refreshAttendanceSummary(emp, now),
    ]);
    if (historyRes.success) setSalaryHistory(historyRes.data.records);
  };

  const addSalary = async () => {
    if (!salaryForm.amount || !salaryEmp) return;
    if (!salaryEmp.isActive) return;
    const res = await window.api.staff.addSalaryRecord({ employeeId: salaryEmp.id, ...salaryForm });
    if (res.success) {
      setSalaryForm({ amount: '', payDate: getPkToday(), notes: '' });
      const hRes = await window.api.staff.getSalaryHistory({ employeeId: salaryEmp.id, filters: {} });
      if (hRes.success) setSalaryHistory(hRes.data.records);
      await refreshAttendanceSummary(salaryEmp, salaryMonth);
    }
  };

  const useCalculatedMonthSalary = () => {
    setSalaryForm((prev) => ({
      ...prev,
      amount: attendanceSummary.calculatedSalary ? String(attendanceSummary.calculatedSalary) : '',
      notes: prev.notes || `Calculated from attendance (${salaryMonth})`,
    }));
  };

  const onSalaryMonthChange = async (monthValue) => {
    setSalaryMonth(monthValue);
    if (salaryEmp) {
      await refreshAttendanceSummary(salaryEmp, monthValue);
    }
  };

  const salaryPaidSummary = useMemo(() => {
    const monthPaid = round2(
      salaryHistory
        .filter((rec) => isDateInMonth(rec.payDate, salaryMonth))
        .reduce((sum, rec) => sum + (Number(rec.amount) || 0), 0)
    );
    const monthSalary = Number(attendanceSummary.calculatedSalary) || 0;
    const advance = round2(Math.max(0, monthPaid - monthSalary));
    const remaining = round2(Math.max(0, monthSalary - monthPaid));
    return { monthPaid, advance, remaining };
  }, [salaryHistory, salaryMonth, attendanceSummary.calculatedSalary]);

  const filteredEmployees = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((emp) => {
      const name = String(emp.name || '').toLowerCase();
      const position = String(emp.position || '').toLowerCase();
      return name.includes(query) || position.includes(query);
    });
  }, [employees, searchTerm]);

  const employeeStats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((emp) => !!emp.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [employees]);

  if (loading) return <div className="text-slate-400">Loading staff...</div>;

  return (
    <div className="flex gap-4">
      {/* Left: Employee List */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white">Staff</h1>
          <div className="flex items-center gap-2">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or position"
              className="input-field py-1.5 text-sm w-64"
            />
            <button onClick={openAdd} className="btn-primary text-sm">+ Add Employee</button>
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="grid grid-cols-3 gap-2 p-3 border-b border-slate-700 bg-slate-800/40">
            <div className="bg-slate-700/40 rounded-lg px-3 py-2">
              <p className="text-slate-500 text-xs">Total Employees</p>
              <p className="text-white font-semibold text-sm">{employeeStats.total}</p>
            </div>
            <div className="bg-slate-700/40 rounded-lg px-3 py-2">
              <p className="text-slate-500 text-xs">Active Employees</p>
              <p className="text-green-400 font-semibold text-sm">{employeeStats.active}</p>
            </div>
            <div className="bg-slate-700/40 rounded-lg px-3 py-2">
              <p className="text-slate-500 text-xs">Non Active Employees</p>
              <p className="text-amber-400 font-semibold text-sm">{employeeStats.inactive}</p>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Name</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Position</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Phone</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Monthly Salary</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Hire Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${salaryEmp?.id === emp.id ? 'bg-slate-700/40' : ''}`}>
                  <td className="px-4 py-3 text-white font-medium">{emp.name}</td>
                  <td className="px-4 py-3 text-slate-400">{emp.position}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{emp.phone || '—'}</td>
                  <td className="px-4 py-3 text-green-400 font-medium">PKR {Number(emp.monthlySalary || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{emp.hireDate}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => openSalary(emp)}
                        disabled={!emp.isActive}
                        className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Salary
                      </button>
                      <button onClick={() => openEdit(emp)} className="text-xs text-slate-400 hover:text-white">Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-600 text-sm">
                    {employees.length === 0 ? 'No employees' : 'No employee matches your search'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: Salary Panel */}
      {salaryEmp && (
        <div className="w-96 flex-shrink-0">
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-white font-semibold text-sm">Salary — {salaryEmp.name}</h2>
              <button onClick={() => setSalaryEmp(null)} className="text-slate-500 hover:text-white text-sm">✕</button>
            </div>
            <p className="text-slate-500 text-xs mb-3">Monthly: <span className="text-green-400 font-medium">PKR {Number(salaryEmp.monthlySalary || 0).toLocaleString()}</span></p>

            <div className="bg-slate-700/40 rounded-lg p-3 mb-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="label text-xs mb-0">Attendance Month</label>
                <input
                  type="month"
                  value={salaryMonth}
                  onChange={(e) => onSalaryMonthChange(e.target.value)}
                  className="input-field py-1.5 text-xs w-40"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-800/60 rounded p-2">
                  <p className="text-slate-500">Present Days</p>
                  <p className="text-white font-medium">{attendanceSummary.presentDays}</p>
                </div>
                <div className="bg-slate-800/60 rounded p-2">
                  <p className="text-slate-500">Absent Days</p>
                  <p className="text-white font-medium">{attendanceSummary.absentDays}</p>
                </div>
                <div className="bg-slate-800/60 rounded p-2">
                  <p className="text-slate-500">Total Hours</p>
                  <p className="text-white font-medium">{attendanceSummary.totalHours}</p>
                </div>
                <div className="bg-slate-800/60 rounded p-2">
                  <p className="text-slate-500">Hourly Rate</p>
                  <p className="text-white font-medium">PKR {attendanceSummary.hourlyRate.toLocaleString()}</p>
                </div>
              </div>

              <div className="bg-slate-800/60 rounded p-2">
                <p className="text-slate-500 text-xs">Salary from attendance ({attendanceSummary.from} to {attendanceSummary.to})</p>
                <p className="text-green-400 font-semibold text-sm">PKR {attendanceSummary.calculatedSalary.toLocaleString()}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-800/60 rounded p-2">
                  <p className="text-slate-500">Salary Paid</p>
                  <p className="text-green-400 font-semibold">PKR {salaryPaidSummary.monthPaid.toLocaleString()}</p>
                </div>
                <div className="bg-slate-800/60 rounded p-2">
                  <p className="text-slate-500">Advance</p>
                  <p className="text-amber-400 font-semibold">PKR {salaryPaidSummary.advance.toLocaleString()}</p>
                </div>
                <div className="bg-slate-800/60 rounded p-2">
                  <p className="text-slate-500">Remaining</p>
                  <p className="text-white font-semibold">PKR {salaryPaidSummary.remaining.toLocaleString()}</p>
                </div>
              </div>

              <button onClick={useCalculatedMonthSalary} className="btn-secondary w-full text-xs py-1.5">
                Use Calculated Month Salary
              </button>
              {!salaryEmp.isActive && (
                <p className="text-xs text-amber-400">This employee is non-active. Salary cannot be issued.</p>
              )}
            </div>

            {/* Add Salary Form */}
            <div className="bg-slate-700/40 rounded-lg p-3 mb-3 space-y-2">
              <div><label className="label text-xs">Amount</label><input type="number" disabled={!salaryEmp.isActive} value={salaryForm.amount} onChange={(e) => setSalaryForm({ ...salaryForm, amount: e.target.value })} className="input-field py-1.5 text-xs disabled:opacity-50" /></div>
              <div><label className="label text-xs">Pay Date</label><input type="date" disabled={!salaryEmp.isActive} value={salaryForm.payDate} onChange={(e) => setSalaryForm({ ...salaryForm, payDate: e.target.value })} className="input-field py-1.5 text-xs disabled:opacity-50" /></div>
              <div><label className="label text-xs">Notes</label><input disabled={!salaryEmp.isActive} value={salaryForm.notes} onChange={(e) => setSalaryForm({ ...salaryForm, notes: e.target.value })} className="input-field py-1.5 text-xs disabled:opacity-50" /></div>
              <button onClick={addSalary} disabled={!salaryEmp.isActive} className="btn-primary w-full text-xs py-1.5 disabled:opacity-50">Record Payment</button>
            </div>

            {/* History */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {salaryHistory.length === 0 && <p className="text-slate-600 text-xs text-center py-3">No records</p>}
              {salaryHistory.map((rec) => (
                <div key={rec.id} className="flex justify-between items-center bg-slate-700/30 rounded px-2.5 py-1.5">
                  <div>
                    <p className="text-white text-xs font-medium">PKR {Number(rec.amount || 0).toLocaleString()}</p>
                    <p className="text-slate-600 text-xs">{rec.payDate} {rec.notes && `— ${rec.notes}`}</p>
                  </div>
                  <span className="text-green-400 text-xs">✓ Paid</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="card w-96">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-semibold">{editId ? 'Edit Employee' : 'Add Employee'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <div className="space-y-3">
              <div><label className="label">Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" /></div>
              <div>
                <label className="label">Position</label>
                <select
                  value={form.position}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm({ ...form, position: value });
                    if (value !== '__custom__') setCustomPosition('');
                  }}
                  className="input-field bg-slate-700"
                >
                  {POSITION_OPTIONS.map((pos) => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                  <option value="__custom__">Custom Position</option>
                </select>
              </div>
              {form.position === '__custom__' && (
                <div>
                  <label className="label">New Position Name</label>
                  <input
                    value={customPosition}
                    onChange={(e) => setCustomPosition(e.target.value)}
                    placeholder="Enter position name"
                    className="input-field"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" /></div>
                <div><label className="label">Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Monthly Salary (PKR)</label><input type="number" value={form.monthlySalary} onChange={(e) => setForm({ ...form, monthlySalary: Number(e.target.value) })} className="input-field" /></div>
                <div><label className="label">Hire Date</label><input type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} className="input-field" /></div>
              </div>
              {editId && (
                <div>
                  <label className="label">Employee Status</label>
                  <select
                    value={form.isActive ? 'active' : 'inactive'}
                    onChange={(e) => setForm({ ...form, isActive: e.target.value === 'active' })}
                    disabled={!canChangeEmployeeStatus}
                    className="input-field bg-slate-700 disabled:opacity-50"
                  >
                    <option value="active">Active Employee</option>
                    <option value="inactive">Non Active Employee</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleSave} className="btn-primary flex-1">Save</button>
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
