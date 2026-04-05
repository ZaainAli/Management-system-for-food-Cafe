import { useEffect, useMemo, useState } from 'react';
import { getPkDateUtcBounds, getPkToday, monthBounds, shiftDate } from '../../utils/datetime';

// ── Helpers ───────────────────────────────────────────────────

function curMonth() {
  return getPkToday().slice(0, 7);
}
function curYear() { return getPkToday().slice(0, 4); }
function todayStr() {
  return getPkToday();
}
const YEAR_OPTIONS = Array.from(
  { length: Number(getPkToday().slice(0, 4)) - 2019 },
  (_, i) => String(Number(getPkToday().slice(0, 4)) - i)
);

function rangeForPeriod(period, selMonth, selYear) {
  const td = getPkToday();
  if (period === 'today') return { from: td, to: td };
  if (period === 'week') return { from: shiftDate(td, -6), to: td };
  if (period === 'month') return monthBounds(selMonth);
  if (period === 'year')  return { from: `${selYear}-01-01`, to: `${selYear}-12-31` };
  return { from: '', to: '' };
}

function toIsoStart(dateStr) { return dateStr ? getPkDateUtcBounds(dateStr).from : ''; }
function toIsoEnd(dateStr)   { return dateStr ? getPkDateUtcBounds(dateStr).to : ''; }

const reportTypes = [
  { id: 'all',       label: 'All Reports' },
  { id: 'sales',     label: 'Sales' },
  { id: 'expense',   label: 'Expenses' },
  { id: 'staff',     label: 'Staff' },
  { id: 'pl',        label: 'Profit & Loss' },
  { id: 'discounted',label: 'Table & Discount Report' },
  { id: 'khata',     label: 'Khata' },
];

export default function ExportReportsPage() {
  const [reportType, setReportType] = useState('all');
  const [period, setPeriod]         = useState('today');
  const [selMonth, setSelMonth]     = useState(curMonth());
  const [selYear, setSelYear]       = useState(curYear());
  const [from, setFrom]             = useState('');
  const [to, setTo]                 = useState('');
  const [loading, setLoading]       = useState(false);
  const [message, setMessage]       = useState('');
  const [error, setError]           = useState('');

  // Auto-fill from/to when period changes to 'today'
  useEffect(() => {
    if (period === 'today') {
      const td = getPkToday();
      setFrom(td);
      setTo(td);
    }
  }, [period]);

  // When period (other than custom) changes, auto-fill from/to
  const handlePeriodChange = (p) => {
    setPeriod(p);
    if (p !== 'custom') {
      const { from: f, to: t } = rangeForPeriod(p, selMonth, selYear);
      setFrom(f);
      setTo(t);
    }
  };

  const handleMonthChange = (val) => {
    setSelMonth(val);
    if (period === 'month') {
      const { from: f, to: t } = rangeForPeriod('month', val, selYear);
      setFrom(f); setTo(t);
    }
  };

  const handleYearChange = (val) => {
    setSelYear(val);
    if (period === 'year') {
      const { from: f, to: t } = rangeForPeriod('year', selMonth, val);
      setFrom(f); setTo(t);
    }
  };

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
        to:   toIsoEnd(to),
      });
      if (res?.canceled)  { setMessage('Export canceled.'); return; }
      if (res?.success)   { setMessage(`Export saved to ${res.path}`); }
      else                { setError(res?.error || 'Failed to export report.'); }
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
          {/* Report type */}
          <div className="mb-4">
            <label className="label">Report Type</label>
            <select value={reportType} onChange={e => setReportType(e.target.value)} className="input-field">
              {reportTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          {/* Period buttons */}
          <div className="mb-4">
            <label className="label">Period</label>
            <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700 flex-wrap">
              {['today','week','month','year','custom'].map(p => (
                <button key={p} onClick={() => handlePeriodChange(p)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors capitalize
                    ${period === p ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Month / Year pickers */}
          {period === 'month' && (
            <div className="mb-4">
              <label className="label">Month</label>
              <input type="month" value={selMonth} max={curMonth()}
                onChange={e => handleMonthChange(e.target.value)} className="input-field" />
            </div>
          )}
          {period === 'year' && (
            <div className="mb-4">
              <label className="label">Year</label>
              <select value={selYear} onChange={e => handleYearChange(e.target.value)} className="input-field">
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {/* From / To — always visible, editable in custom mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">From</label>
              <input type="date" value={from} max={to || todayStr()}
                onChange={e => setFrom(e.target.value)}
                readOnly={period !== 'custom'}
                className={`input-field ${period !== 'custom' ? 'opacity-60 cursor-default' : ''}`} />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" value={to} min={from} max={todayStr()}
                onChange={e => setTo(e.target.value)}
                readOnly={period !== 'custom'}
                className={`input-field ${period !== 'custom' ? 'opacity-60 cursor-default' : ''}`} />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button onClick={handleExport} disabled={!canExport || loading}
              className={`btn-primary ${(!canExport || loading) ? 'opacity-60 cursor-not-allowed' : ''}`}>
              {loading ? 'Exporting...' : 'Export PDF'}
            </button>
            <p className="text-xs text-slate-500">Choose a period or date range to export a PDF report.</p>
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
        <div className="card mt-4 border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-sm">{message}</div>
      )}
      {error && (
        <div className="card mt-4 border border-red-500/40 bg-red-500/10 text-red-300 text-sm">{error}</div>
      )}
    </div>
  );
}
