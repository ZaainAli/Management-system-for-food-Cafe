import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { getPkToday, monthBounds } from '../../utils/datetime';

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

const TYPE_LABELS = { salary: 'Salary', bonus: 'Bonus', advance: 'Advance' };
const TYPE_COLORS = { salary: 'text-blue-400', bonus: 'text-emerald-400', advance: 'text-amber-400' };

const emptyForm = () => ({ amount: '', payDate: getPkToday(), notes: '', type: 'salary', paymentSource: 'manual' });

export default function SalaryPage() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEditDelete = user?.role === 'admin' || user?.role === 'manager';

  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);

  const [salaryHistory, setSalaryHistory] = useState([]);
  const [salaryMonth, setSalaryMonth] = useState(toMonthValue(getPkToday()));
  const [form, setForm] = useState(emptyForm());
  const [attendanceSummary, setAttendanceSummary] = useState({
    from: '', to: '', presentDays: 0, absentDays: 0,
    totalHours: 0, hourlyRate: 0, calculatedSalary: 0,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Edit modal
  const [editRec, setEditRec] = useState(null);
  const [editForm, setEditForm] = useState({ amount: '', payDate: '', notes: '', type: 'salary' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete confirm
  const [deleteId, setDeleteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const refreshAttendanceSummary = async (employee, monthValue) => {
    const range = getMonthRange(monthValue);
    if (!employee || !range) return;
    const res = await window.api.staff.getAttendance({ employeeId: employee.id, from: range.from, to: range.to });
    const records = res.success ? (res.data || []) : [];
    const presentDays = records.filter((r) => r.status === 'present').length;
    const absentDays = records.filter((r) => r.status === 'absent').length;
    const totalHours = round2(records.reduce((sum, r) => sum + (Number(r.hoursWorked) || 0), 0));
    const hourlyRate = round2((Number(employee.monthlySalary) || 0) / 30 / 12);
    const calculatedSalary = round2(hourlyRate * totalHours);
    setAttendanceSummary({ from: range.from, to: range.to, presentDays, absentDays, totalHours, hourlyRate, calculatedSalary });
  };

  const refreshHistory = async (employee) => {
    const hRes = await window.api.staff.getSalaryHistory({ employeeId: employee.id, filters: {} });
    if (hRes.success) setSalaryHistory(hRes.data.records);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await window.api.staff.getAll({});
      if (res.success) {
        const found = (res.data || []).find((e) => String(e.id) === String(employeeId));
        setEmp(found || null);
        if (found) {
          const now = toMonthValue(getPkToday());
          await Promise.all([refreshHistory(found), refreshAttendanceSummary(found, now)]);
        }
      }
      setLoading(false);
    })();
  }, [employeeId]);

  const onSalaryMonthChange = async (monthValue) => {
    setSalaryMonth(monthValue);
    if (emp) await refreshAttendanceSummary(emp, monthValue);
  };

  const useCalculatedMonthSalary = () => {
    setForm((prev) => ({
      ...prev,
      amount: attendanceSummary.calculatedSalary ? String(attendanceSummary.calculatedSalary) : '',
      notes: prev.notes || `Calculated from attendance (${salaryMonth})`,
    }));
  };

  const recordPayment = async () => {
    if (!form.amount || !emp || !emp.isActive) return;
    setSaving(true);
    setError('');
    setMessage('');
    const res = await window.api.staff.addSalaryRecord({
      employeeId: emp.id,
      amount: form.amount,
      payDate: form.payDate,
      notes: form.notes,
      type: form.type,
      paymentSource: form.paymentSource,
    });
    if (res.success) {
      setForm(emptyForm());
      await Promise.all([refreshHistory(emp), refreshAttendanceSummary(emp, salaryMonth)]);
      setMessage('Payment recorded.');
      setTimeout(() => setMessage(''), 3000);
    } else {
      setError(res.error || 'Failed to record payment.');
    }
    setSaving(false);
  };

  const openEdit = (rec) => {
    setEditRec(rec);
    setEditForm({ amount: String(rec.amount), payDate: rec.payDate, notes: rec.notes || '', type: rec.type || 'salary' });
    setEditError('');
  };

  const saveEdit = async () => {
    if (!editForm.amount || !editRec) return;
    setEditSaving(true);
    setEditError('');
    const res = await window.api.staff.updateSalaryRecord({
      id: editRec.id,
      amount: editForm.amount,
      payDate: editForm.payDate,
      notes: editForm.notes,
      type: editForm.type,
    });
    if (res.success) {
      setEditRec(null);
      await Promise.all([refreshHistory(emp), refreshAttendanceSummary(emp, salaryMonth)]);
    } else {
      setEditError(res.error || 'Failed to update.');
    }
    setEditSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    const res = await window.api.staff.deleteSalaryRecord({ id: deleteId });
    if (res.success) {
      setDeleteId(null);
      await Promise.all([refreshHistory(emp), refreshAttendanceSummary(emp, salaryMonth)]);
    }
    setDeleteLoading(false);
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

  if (loading) return <div className="text-slate-400">Loading...</div>;
  if (!emp) return (
    <div>
      <p className="text-red-400 mb-3">Employee not found.</p>
      <button onClick={() => navigate('/staff')} className="btn-secondary text-sm">← Back to Staff</button>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/staff')} className="text-slate-400 hover:text-white text-sm">← Back</button>
          <h1 className="text-xl font-bold text-white">Salary — {emp.name}</h1>
          <span className="text-slate-500 text-sm">Monthly: <span className="text-green-400 font-medium">PKR {Number(emp.monthlySalary || 0).toLocaleString()}</span></span>
        </div>
        {!emp.isActive && (
          <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded px-2 py-1">
            Non-active — salary cannot be issued
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Left */}
        <div className="space-y-4">
          {/* Attendance Summary */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold text-sm">Attendance Summary</h2>
              <input type="month" value={salaryMonth} onChange={(e) => onSalaryMonthChange(e.target.value)} className="input-field py-1.5 text-xs w-40" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div className="bg-slate-700/40 rounded p-3">
                <p className="text-slate-500 mb-1">Present Days</p>
                <p className="text-white font-semibold text-base">{attendanceSummary.presentDays}</p>
              </div>
              <div className="bg-slate-700/40 rounded p-3">
                <p className="text-slate-500 mb-1">Absent Days</p>
                <p className="text-white font-semibold text-base">{attendanceSummary.absentDays}</p>
              </div>
              <div className="bg-slate-700/40 rounded p-3">
                <p className="text-slate-500 mb-1">Total Hours</p>
                <p className="text-white font-semibold text-base">{attendanceSummary.totalHours}</p>
              </div>
              <div className="bg-slate-700/40 rounded p-3">
                <p className="text-slate-500 mb-1">Hourly Rate</p>
                <p className="text-white font-semibold text-base">PKR {attendanceSummary.hourlyRate.toLocaleString()}</p>
              </div>
            </div>
            <div className="bg-slate-700/40 rounded p-3 mb-3">
              <p className="text-slate-500 text-xs mb-1">Salary from attendance ({attendanceSummary.from} to {attendanceSummary.to})</p>
              <p className="text-green-400 font-bold text-lg">PKR {attendanceSummary.calculatedSalary.toLocaleString()}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-700/40 rounded p-3">
                <p className="text-slate-500 mb-1">Salary Paid</p>
                <p className="text-green-400 font-semibold">PKR {salaryPaidSummary.monthPaid.toLocaleString()}</p>
              </div>
              <div className="bg-slate-700/40 rounded p-3">
                <p className="text-slate-500 mb-1">Advance</p>
                <p className="text-amber-400 font-semibold">PKR {salaryPaidSummary.advance.toLocaleString()}</p>
              </div>
              <div className="bg-slate-700/40 rounded p-3">
                <p className="text-slate-500 mb-1">Remaining</p>
                <p className="text-white font-semibold">PKR {salaryPaidSummary.remaining.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Payment Form */}
          <div className="card">
            <h2 className="text-white font-semibold text-sm mb-3">Record Payment</h2>
            {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
            {message && <p className="text-emerald-400 text-xs mb-2">{message}</p>}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} disabled={!emp.isActive} className="input-field bg-slate-700 disabled:opacity-50 text-sm">
                    <option value="salary">Salary</option>
                    <option value="bonus">Bonus</option>
                    <option value="advance">Advance</option>
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Payment Source</label>
                  <select value={form.paymentSource} onChange={(e) => setForm({ ...form, paymentSource: e.target.value })} disabled={!emp.isActive} className="input-field bg-slate-700 disabled:opacity-50 text-sm">
                    <option value="manual">Manual</option>
                    <option value="today_sale">From Today's Sale</option>
                  </select>
                </div>
              </div>
              {form.paymentSource === 'today_sale' && (
                <p className="text-xs text-blue-400 bg-blue-400/10 border border-blue-400/20 rounded px-2 py-1.5">
                  This payment will also be recorded as an expense deducted from today's sale.
                </p>
              )}
              <button onClick={useCalculatedMonthSalary} disabled={!emp.isActive} className="btn-secondary w-full text-xs py-2 disabled:opacity-50">
                Use Calculated Month Salary
              </button>
              <div>
                <label className="label text-xs">Amount</label>
                <input type="number" disabled={!emp.isActive} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input-field disabled:opacity-50" />
              </div>
              <div>
                <label className="label text-xs">Pay Date</label>
                <input type="date" disabled={!emp.isActive} value={form.payDate} onChange={(e) => setForm({ ...form, payDate: e.target.value })} className="input-field disabled:opacity-50" />
              </div>
              <div>
                <label className="label text-xs">Notes</label>
                <input disabled={!emp.isActive} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field disabled:opacity-50" />
              </div>
              <button onClick={recordPayment} disabled={!emp.isActive || saving || !form.amount} className="btn-primary w-full disabled:opacity-50">
                {saving ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Payment History */}
        <div className="card">
          <h2 className="text-white font-semibold text-sm mb-3">Payment History</h2>
          {salaryHistory.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-6">No payment records</p>
          ) : (
            <div className="space-y-2">
              {salaryHistory.map((rec) => (
                <div key={rec.id} className="bg-slate-700/30 rounded px-3 py-2.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-white text-sm font-medium">PKR {Number(rec.amount || 0).toLocaleString()}</p>
                        <span className={`text-xs font-medium ${TYPE_COLORS[rec.type] || 'text-blue-400'}`}>
                          {TYPE_LABELS[rec.type] || 'Salary'}
                        </span>
                        {rec.paymentSource === 'today_sale' && (
                          <span className="text-xs text-slate-400 bg-slate-600/50 rounded px-1.5 py-0.5">From Sale</span>
                        )}
                      </div>
                      <p className="text-slate-500 text-xs">{rec.payDate}{rec.notes && ` — ${rec.notes}`}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-green-400 text-xs">✓ Paid</span>
                      {canEditDelete && (
                        <>
                          <button onClick={() => openEdit(rec)} className="text-xs text-slate-400 hover:text-white">Edit</button>
                          <button onClick={() => setDeleteId(rec.id)} className="text-xs text-red-500 hover:text-red-400">Delete</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editRec && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="card w-80">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-semibold">Edit Payment</h2>
              <button onClick={() => setEditRec(null)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            {editError && <p className="text-red-400 text-xs mb-3">{editError}</p>}
            {editRec.paymentSource === 'today_sale' && (
              <p className="text-xs text-blue-400 bg-blue-400/10 border border-blue-400/20 rounded px-2 py-1.5 mb-3">
                Linked expense will also be updated.
              </p>
            )}
            <div className="space-y-3">
              <div>
                <label className="label text-xs">Type</label>
                <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} className="input-field bg-slate-700 text-sm">
                  <option value="salary">Salary</option>
                  <option value="bonus">Bonus</option>
                  <option value="advance">Advance</option>
                </select>
              </div>
              <div>
                <label className="label text-xs">Amount</label>
                <input type="number" autoFocus value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="label text-xs">Pay Date</label>
                <input type="date" value={editForm.payDate} onChange={(e) => setEditForm({ ...editForm, payDate: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="label text-xs">Notes</label>
                <input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="input-field" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveEdit} disabled={editSaving || !editForm.amount} className="btn-primary flex-1 disabled:opacity-50">
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => setEditRec(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="card w-72">
            <h2 className="text-white font-semibold mb-2">Delete Payment?</h2>
            <p className="text-slate-400 text-sm mb-1">This will permanently delete the record.</p>
            {salaryHistory.find((r) => r.id === deleteId)?.paymentSource === 'today_sale' && (
              <p className="text-amber-400 text-xs mb-3">The linked expense entry will also be removed.</p>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={confirmDelete} disabled={deleteLoading} className="btn-primary flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50">
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
              <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
