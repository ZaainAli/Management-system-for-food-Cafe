import React, { useState, useEffect } from 'react';

const emptyForm = { name: '', position: 'Staff', phone: '', email: '', monthlySalary: 0, hireDate: new Date().toISOString().split('T')[0] };

export default function StaffPage() {
  const [employees, setEmployees] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Salary panel
  const [salaryEmp, setSalaryEmp] = useState(null);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [salaryForm, setSalaryForm] = useState({ amount: '', payDate: new Date().toISOString().split('T')[0], notes: '' });

  const fetchEmployees = async () => {
    const res = await window.api.staff.getAll({});
    if (res.success) setEmployees(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchEmployees(); }, []);

  const openAdd = () => { setForm(emptyForm); setEditId(null); setShowModal(true); };
  const openEdit = (emp) => {
    setForm({ name: emp.name, position: emp.position, phone: emp.phone, email: emp.email, monthlySalary: emp.monthlySalary, hireDate: emp.hireDate });
    setEditId(emp.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    let res;
    if (editId) res = await window.api.staff.update({ id: editId, ...form });
    else res = await window.api.staff.add(form);
    if (res.success) { setShowModal(false); await fetchEmployees(); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this employee?')) return;
    await window.api.staff.delete({ id });
    await fetchEmployees();
  };

  // Salary panel handlers
  const openSalary = async (emp) => {
    setSalaryEmp(emp);
    const res = await window.api.staff.getSalaryHistory({ employeeId: emp.id, filters: {} });
    if (res.success) setSalaryHistory(res.data.records);
  };

  const addSalary = async () => {
    if (!salaryForm.amount) return;
    const res = await window.api.staff.addSalaryRecord({ employeeId: salaryEmp.id, ...salaryForm });
    if (res.success) {
      setSalaryForm({ amount: '', payDate: new Date().toISOString().split('T')[0], notes: '' });
      // Refresh history
      const hRes = await window.api.staff.getSalaryHistory({ employeeId: salaryEmp.id, filters: {} });
      if (hRes.success) setSalaryHistory(hRes.data.records);
    }
  };

  if (loading) return <div className="text-slate-400">Loading staff...</div>;

  return (
    <div className="flex gap-4">
      {/* Left: Employee List */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white">Staff</h1>
          <button onClick={openAdd} className="btn-primary text-sm">+ Add Employee</button>
        </div>

        <div className="card p-0 overflow-hidden">
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
              {employees.map(emp => (
                <tr key={emp.id} className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${salaryEmp?.id === emp.id ? 'bg-slate-700/40' : ''}`}>
                  <td className="px-4 py-3 text-white font-medium">{emp.name}</td>
                  <td className="px-4 py-3 text-slate-400">{emp.position}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{emp.phone || '—'}</td>
                  <td className="px-4 py-3 text-green-400 font-medium">PKR {emp.monthlySalary.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{emp.hireDate}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => openSalary(emp)} className="text-xs text-blue-400 hover:text-blue-300">Salary</button>
                      <button onClick={() => openEdit(emp)} className="text-xs text-slate-400 hover:text-white">Edit</button>
                      <button onClick={() => handleDelete(emp.id)} className="text-xs text-red-400 hover:text-red-300">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-600 text-sm">No employees</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: Salary Panel */}
      {salaryEmp && (
        <div className="w-80 flex-shrink-0">
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-white font-semibold text-sm">Salary — {salaryEmp.name}</h2>
              <button onClick={() => setSalaryEmp(null)} className="text-slate-500 hover:text-white text-sm">✕</button>
            </div>
            <p className="text-slate-500 text-xs mb-3">Monthly: <span className="text-green-400 font-medium">PKR {salaryEmp.monthlySalary.toLocaleString()}</span></p>

            {/* Add Salary Form */}
            <div className="bg-slate-700/40 rounded-lg p-3 mb-3 space-y-2">
              <div><label className="label text-xs">Amount</label><input type="number" value={salaryForm.amount} onChange={e => setSalaryForm({...salaryForm, amount: e.target.value})} className="input-field py-1.5 text-xs" /></div>
              <div><label className="label text-xs">Pay Date</label><input type="date" value={salaryForm.payDate} onChange={e => setSalaryForm({...salaryForm, payDate: e.target.value})} className="input-field py-1.5 text-xs" /></div>
              <div><label className="label text-xs">Notes</label><input value={salaryForm.notes} onChange={e => setSalaryForm({...salaryForm, notes: e.target.value})} className="input-field py-1.5 text-xs" /></div>
              <button onClick={addSalary} className="btn-primary w-full text-xs py-1.5">Record Payment</button>
            </div>

            {/* History */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {salaryHistory.length === 0 && <p className="text-slate-600 text-xs text-center py-3">No records</p>}
              {salaryHistory.map(rec => (
                <div key={rec.id} className="flex justify-between items-center bg-slate-700/30 rounded px-2.5 py-1.5">
                  <div>
                    <p className="text-white text-xs font-medium">PKR {rec.amount.toLocaleString()}</p>
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
              <div><label className="label">Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-field" /></div>
              <div>
                <label className="label">Position</label>
                <select value={form.position} onChange={e => setForm({...form, position: e.target.value})} className="input-field bg-slate-700">
                  <option value="Staff">Staff</option>
                  <option value="Waiter">Waiter</option>
                  <option value="Cook">Cook</option>
                  <option value="Manager">Manager</option>
                  <option value="Cashier">Cashier</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Phone</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input-field" /></div>
                <div><label className="label">Email</label><input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input-field" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Monthly Salary (PKR)</label><input type="number" value={form.monthlySalary} onChange={e => setForm({...form, monthlySalary: Number(e.target.value)})} className="input-field" /></div>
                <div><label className="label">Hire Date</label><input type="date" value={form.hireDate} onChange={e => setForm({...form, hireDate: e.target.value})} className="input-field" /></div>
              </div>
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
