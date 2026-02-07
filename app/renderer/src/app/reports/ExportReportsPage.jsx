import React, { useMemo, useState } from 'react';

const reportTypes = [
  { id: 'all', label: 'All Reports' },
  { id: 'sales', label: 'Sales' },
  { id: 'expense', label: 'Expenses' },
  { id: 'staff', label: 'Staff' },
  { id: 'pl', label: 'Profit & Loss' },
];

function toIsoStart(dateStr) {
  if (!dateStr) return '';
  return `${dateStr}T00:00:00.000Z`;
}

function toIsoEnd(dateStr) {
  if (!dateStr) return '';
  return `${dateStr}T23:59:59.999Z`;
}

export default function ExportReportsPage() {
  const [reportType, setReportType] = useState('sales');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canExport = useMemo(() => {
    if (!from || !to) return false;
    return new Date(from) <= new Date(to);
  }, [from, to]);

  const handleExport = async () => {
    if (!canExport || loading) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await window.api.report.exportReport({
        type: reportType,
        from: toIsoStart(from),
        to: toIsoEnd(to),
      });

      if (res?.canceled) {
        setMessage('Export canceled.');
        return;
      }

      if (res?.success) {
        setMessage(`Export saved to ${res.path}`);
      } else {
        setError(res?.error || 'Failed to export report.');
      }
    } catch (err) {
      setError(err.message || 'Failed to export report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-white">Export Reports</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="mb-4">
            <label className="label">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="input-field"
            >
              {reportTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                min={from || undefined}
                className="input-field"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={handleExport}
              disabled={!canExport || loading}
              className={`btn-primary ${(!canExport || loading) ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Exporting...' : 'Export CSV'}
            </button>
            <p className="text-xs text-slate-500">
              Choose a date range to export a CSV report.
            </p>
          </div>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-2">Notes</h2>
          <ul className="text-xs text-slate-400 space-y-1">
            <li>Exports include summary and detail sections based on the selected report type.</li>
            <li>Dates are inclusive of the entire day.</li>
            <li>Large ranges can take longer to export.</li>
          </ul>
        </div>
      </div>

      {message && (
        <div className="card mt-4 border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="card mt-4 border border-red-500/40 bg-red-500/10 text-red-300 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
