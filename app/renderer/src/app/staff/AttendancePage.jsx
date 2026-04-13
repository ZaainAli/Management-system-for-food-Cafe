import React, { useEffect, useMemo, useState } from 'react';
import { getPkToday } from '../../utils/datetime';

const DEFAULT_HOURS = 12;

export default function AttendancePage() {
  const [employees, setEmployees] = useState([]);
  const [attendanceByEmployee, setAttendanceByEmployee] = useState({});
  const [draftByEmployee, setDraftByEmployee] = useState({});
  const [selectedDate, setSelectedDate] = useState(getPkToday());
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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

  useEffect(() => {
    const nextDraft = {};
    employees.forEach((emp) => {
      const record = attendanceByEmployee[emp.id];
      const status = record?.status || 'present';
      const hoursWorked = record?.hoursWorked ?? (status === 'present' ? DEFAULT_HOURS : 0);
      nextDraft[emp.id] = { status, hoursWorked };
    });
    setDraftByEmployee(nextDraft);
  }, [employees, attendanceByEmployee]);

  const rows = useMemo(() => {
    return employees.map((emp) => {
      const record = attendanceByEmployee[emp.id];
      const originalStatus = record?.status || 'present';
      const originalHours = record?.hoursWorked ?? (originalStatus === 'present' ? DEFAULT_HOURS : 0);
      const draft = draftByEmployee[emp.id] || { status: originalStatus, hoursWorked: originalHours };
      const normalizedOriginalHours = originalStatus === 'present' ? Number(originalHours) || 0 : 0;
      const normalizedDraftHours = draft.status === 'present' ? Number(draft.hoursWorked) || 0 : 0;
      const isDirty = !record || draft.status !== originalStatus || normalizedDraftHours !== normalizedOriginalHours;
      return { emp, draft, isDirty };
    });
  }, [employees, attendanceByEmployee, draftByEmployee]);

  const hasChanges = rows.some((row) => row.isDirty);

  const updateDraft = (employeeId, next) => {
    setDraftByEmployee((prev) => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        ...next,
      },
    }));
  };

  const saveAllAttendance = async () => {
    const dirtyRows = rows.filter((row) => row.isDirty);
    if (dirtyRows.length === 0) return;

    setSavingAll(true);
    setError('');
    setMessage('');

    const failed = [];
    for (const row of dirtyRows) {
      const employeeId = row.emp.id;
      const draft = row.draft;
      const payload = {
        id: attendanceByEmployee[employeeId]?.id,
        employeeId,
        date: selectedDate,
        status: draft.status,
        hoursWorked: draft.status === 'present' ? Math.max(0, Number(draft.hoursWorked) || 0) : 0,
        notes: attendanceByEmployee[employeeId]?.notes || '',
      };
      const res = await window.api.staff.markAttendance(payload);
      if (!res.success) {
        failed.push(`${row.emp.name}: ${res.error || 'Failed to save'}`);
      }
    }

    await fetchAttendance(selectedDate);

    if (failed.length > 0) {
      setError(failed[0]);
      setMessage(`Saved ${dirtyRows.length - failed.length} of ${dirtyRows.length} attendance records.`);
    } else {
      setMessage(`Saved ${dirtyRows.length} attendance record${dirtyRows.length > 1 ? 's' : ''}.`);
    }

    setSavingAll(false);
  };

  if (loading) return <div className="text-slate-400">Loading attendance...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Attendance</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d.toISOString().split('T')[0]);
              setError('');
              setMessage('');
            }}
            className="btn-secondary text-xs py-1.5 px-2"
          >
            Prev
          </button>
          <input
            type="date"
            value={selectedDate}
            max={getPkToday()}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setError('');
              setMessage('');
            }}
            className="input-field py-1.5 text-xs w-40"
          />
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(d.toISOString().split('T')[0]);
              setError('');
              setMessage('');
            }}
            disabled={selectedDate >= getPkToday()}
            className="btn-secondary text-xs py-1.5 px-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
          <button
            onClick={saveAllAttendance}
            disabled={savingAll || !hasChanges}
            className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingAll ? 'Saving All...' : 'Save All'}
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {error && <p className="px-4 pt-4 text-xs text-red-400">{error}</p>}
        {message && <p className="px-4 pt-4 text-xs text-emerald-400">{message}</p>}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Employee</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Status</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Hours</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">State</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ emp, draft, isDirty }) => (
              <tr key={emp.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 text-white font-medium">{emp.name}</td>
                <td className="px-4 py-3">
                  <select
                    value={draft.status}
                    onChange={(e) => {
                      const nextStatus = e.target.value;
                      updateDraft(emp.id, {
                        status: nextStatus,
                        hoursWorked: nextStatus === 'absent'
                          ? 0
                          : ((Number(draft.hoursWorked) || 0) === 0 ? DEFAULT_HOURS : draft.hoursWorked),
                      });
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
                    disabled={draft.status !== 'present'}
                    value={draft.status === 'present' ? draft.hoursWorked : 0}
                    onChange={(e) => updateDraft(emp.id, { hoursWorked: e.target.value })}
                    className="input-field py-1.5 text-xs w-28 disabled:opacity-50"
                  />
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${isDirty ? 'text-amber-400' : 'text-slate-500'}`}>
                    {isDirty ? (attendanceByEmployee[emp.id] ? 'Unsaved changes' : 'Not saved') : 'Saved'}
                  </span>
                </td>
              </tr>
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
