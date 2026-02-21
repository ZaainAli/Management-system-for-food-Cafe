import React, { useEffect, useMemo, useState } from 'react';

const DEFAULT_HOURS = 12;

export default function AttendancePage() {
  const [employees, setEmployees] = useState([]);
  const [attendanceByEmployee, setAttendanceByEmployee] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');

  const fetchEmployees = async () => {
    const res = await window.api.staff.getAll({ isActive: true });
    if (res.success) setEmployees(res.data || []);
  };

  const fetchAttendance = async (date) => {
    const res = await window.api.staff.getAttendance({ from: date, to: date });
    if (!res.success) return;
    const next = {};
    (res.data || []).forEach((row) => {
      next[row.employeeId] = row;
    });
    setAttendanceByEmployee(next);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchEmployees();
      await fetchAttendance(selectedDate);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    fetchAttendance(selectedDate);
  }, [selectedDate]);

  const rows = useMemo(() => {
    return employees.map((emp) => {
      const record = attendanceByEmployee[emp.id];
      const status = record?.status || 'absent';
      const hoursWorked = record?.hoursWorked ?? (status === 'present' ? DEFAULT_HOURS : 0);
      return { emp, record, status, hoursWorked };
    });
  }, [employees, attendanceByEmployee]);

  const saveAttendance = async (employeeId, status, hoursWorked, notes = '') => {
    setSavingId(employeeId);
    const payload = {
      id: attendanceByEmployee[employeeId]?.id,
      employeeId,
      date: selectedDate,
      status,
      hoursWorked: status === 'present' ? Math.max(0, Number(hoursWorked) || 0) : 0,
      notes,
    };
    const res = await window.api.staff.markAttendance(payload);
    if (res.success) {
      await fetchAttendance(selectedDate);
      setError('');
    } else {
      setError(res.error || 'Failed to save attendance');
    }
    setSavingId(null);
  };

  if (loading) return <div className="text-slate-400">Loading attendance...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Attendance</h1>
        <div className="flex items-center gap-2">
          <label className="text-slate-400 text-xs">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input-field py-1.5 text-xs w-40"
          />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {error && <p className="px-4 pt-4 text-xs text-red-400">{error}</p>}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Employee</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Status</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Hours</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ emp, status, hoursWorked }) => (
              <AttendanceRow
                key={emp.id}
                employee={emp}
                initialStatus={status}
                initialHours={hoursWorked}
                saving={savingId === emp.id}
                onSave={(nextStatus, nextHours) => saveAttendance(emp.id, nextStatus, nextHours)}
              />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-600 text-sm">No active employees</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AttendanceRow({ employee, initialStatus, initialHours, saving, onSave }) {
  const [status, setStatus] = useState(initialStatus || 'absent');
  const [hours, setHours] = useState(initialHours ?? 0);

  useEffect(() => {
    setStatus(initialStatus || 'absent');
    setHours(initialHours ?? 0);
  }, [initialStatus, initialHours]);

  return (
    <tr className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
      <td className="px-4 py-3 text-white font-medium">{employee.name}</td>
      <td className="px-4 py-3">
        <select
          value={status}
          onChange={(e) => {
            const nextStatus = e.target.value;
            setStatus(nextStatus);
            if (nextStatus === 'present' && Number(hours) === 0) setHours(DEFAULT_HOURS);
            if (nextStatus === 'absent') setHours(0);
          }}
          className="input-field py-1.5 text-xs bg-slate-700"
        >
          <option value="present">Present</option>
          <option value="absent">Absent</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min="0"
          step="0.5"
          disabled={status !== 'present'}
          value={status === 'present' ? hours : 0}
          onChange={(e) => setHours(e.target.value)}
          className="input-field py-1.5 text-xs w-28 disabled:opacity-50"
        />
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onSave(status, hours)}
          disabled={saving}
          className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </td>
    </tr>
  );
}
