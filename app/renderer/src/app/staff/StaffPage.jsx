import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { getPkToday } from '../../utils/datetime';

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


export default function StaffPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canChangeEmployeeStatus = user?.role === 'admin' || user?.role === 'manager';
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [customPosition, setCustomPosition] = useState('');
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

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

  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (!showInactive) list = list.filter((emp) => !!emp.isActive);
    else list = list.filter((emp) => !emp.isActive);
    const query = searchTerm.trim().toLowerCase();
    if (!query) return list;
    return list.filter((emp) => {
      const name = String(emp.name || '').toLowerCase();
      const position = String(emp.position || '').toLowerCase();
      return name.includes(query) || position.includes(query);
    });
  }, [employees, searchTerm, showInactive]);

  const employeeStats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((emp) => !!emp.isActive).length;
    const inactive = total - active;
    const showing = filteredEmployees.length;
    return { total, active, inactive, showing };
  }, [employees, filteredEmployees]);

  if (loading) return <div className="text-slate-400">Loading staff...</div>;

  return (
    <div>
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white">Staff</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`btn-secondary text-sm ${
                showInactive ? "!bg-slate-600 !text-white" : ""
              }`}
            >
              {showInactive ? "Hide Inactive" : "Show Inactive"}
            </button>
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
          <div className="grid grid-cols-2 gap-2 p-3 border-b border-slate-700 bg-slate-800/40">
            <div className="bg-slate-700/40 rounded-lg px-3 py-2">
              <p className="text-slate-500 text-xs">Total Employees</p>
              <p className="text-white font-semibold text-sm">{employeeStats.total}</p>
            </div>
            <div className="bg-slate-700/40 rounded-lg px-3 py-2">
              <p className="text-slate-500 text-xs">Active Employees</p>
              <p className="text-green-400 font-semibold text-sm">{employeeStats.active}</p>
            </div>
          </div>

          <div className="px-4 py-2 border-b border-slate-700 bg-slate-800/30 flex items-center justify-between">
            <span className="text-slate-400 text-sm">
              Showing {employeeStats.showing} of {employeeStats.total} employees
              {!showInactive && employeeStats.inactive > 0 && (
                <span className="ml-2">- {employeeStats.inactive} inactive hidden</span>
              )}
            </span>
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
                <tr key={emp.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{emp.name}</td>
                  <td className="px-4 py-3 text-slate-400">{emp.position}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{emp.phone || '—'}</td>
                  <td className="px-4 py-3 text-green-400 font-medium">PKR {Number(emp.monthlySalary || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{emp.hireDate}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => navigate(`/staff/salary/${emp.id}`)}
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
