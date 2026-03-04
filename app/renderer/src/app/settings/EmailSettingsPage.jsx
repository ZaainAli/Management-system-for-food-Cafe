import { useState, useEffect } from 'react';
import { useAuth } from '../../store/AuthContext';

const inputCls = 'w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 placeholder-slate-500';
const labelCls = 'block text-xs font-medium text-slate-400 mb-1';

function Field({ label, children }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function StatusMsg({ msg }) {
  if (!msg) return null;
  const isErr = msg.type === 'error';
  return (
    <div className={`mt-3 px-3 py-2 rounded-lg text-sm border ${isErr
      ? 'bg-red-900/30 border-red-700/50 text-red-300'
      : 'bg-green-900/30 border-green-700/50 text-green-300'}`}>
      {msg.text}
    </div>
  );
}

const GMAIL_HOST = 'smtp.gmail.com';
const GMAIL_PORT = 587;

export default function EmailSettingsPage() {
  const { user } = useAuth();
  const isCashier = user?.role === 'cashier';

  const [form, setForm] = useState({
    provider: 'gmail',
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: '',
    smtp_pass: '',
    from_name: 'Restaurant Manager',
    recipient_email: '',
    schedule_time: '23:55',
    is_enabled: false,
  });
  const [lastSent, setLastSent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  const [saveMsg, setSaveMsg] = useState(null);
  const [testMsg, setTestMsg] = useState(null);
  const [sendMsg, setSendMsg] = useState(null);
  const [testBusy, setTestBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [logs, setLogs] = useState(null);
  const [logsBusy, setLogsBusy] = useState(false);

  async function refreshStatus() {
    const res = await window.api.email.schedulerStatus();
    if (res.success) setStatus(res.data);
  }

  useEffect(() => {
    (async () => {
      const [settingsRes] = await Promise.all([
        window.api.email.getSettings(),
        refreshStatus(),
      ]);
      if (settingsRes.success && settingsRes.data) {
        const d = settingsRes.data;
        setForm({
          provider: d.provider || 'gmail',
          smtp_host: d.smtp_host || '',
          smtp_port: d.smtp_port || 587,
          smtp_secure: !!d.smtp_secure,
          smtp_user: d.smtp_user || '',
          smtp_pass: d.smtp_pass || '',
          from_name: d.from_name || 'Restaurant Manager',
          recipient_email: d.recipient_email || '',
          schedule_time: d.schedule_time || '23:55',
          is_enabled: !!d.is_enabled,
        });
        setLastSent(d.last_sent_at || d.last_sent_date || null);
      }
      setLoading(false);
    })();
  }, []);

  // Auto-refresh diagnostics every 30 seconds
  useEffect(() => {
    const id = setInterval(refreshStatus, 30_000);
    return () => clearInterval(id);
  }, []);

  async function handleLoadLogs() {
    setLogsBusy(true);
    const res = await window.api.email.getLogs();
    setLogsBusy(false);
    if (res.success) setLogs(res.data);
  }

  async function handleResetLastSent() {
    if (isCashier) return;
    await window.api.email.resetLastSent();
    setLastSent(null);
    await refreshStatus();
  }

  function set(key, val) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  function handleProviderChange(provider) {
    setForm(prev => ({
      ...prev,
      provider,
      smtp_host: provider === 'gmail' ? GMAIL_HOST : '',
      smtp_port: GMAIL_PORT,
      smtp_secure: false,
    }));
  }

  async function handleSave() {
    if (isCashier) {
      setSaveMsg({ type: 'error', text: 'Cashier cannot change SMTP or delivery settings.' });
      return;
    }
    setSaveBusy(true);
    setSaveMsg(null);
    const res = await window.api.email.saveSettings(form);
    setSaveBusy(false);
    setSaveMsg(res.success
      ? { type: 'success', text: 'Settings saved successfully.' }
      : { type: 'error', text: res.error || 'Failed to save settings.' });
    if (res.success) refreshStatus();
  }

  async function handleTest() {
    setTestBusy(true);
    setTestMsg(null);
    const res = await window.api.email.sendTestEmail(form);
    setTestBusy(false);
    setTestMsg(res.success
      ? { type: 'success', text: `Test email sent to ${form.recipient_email}` }
      : { type: 'error', text: res.error || 'Failed to send test email.' });
  }

  async function handleSendNow() {
    setSendBusy(true);
    setSendMsg(null);
    const res = await window.api.email.sendNow();
    setSendBusy(false);
    if (res.success) {
      setLastSent(res.data?.date || null);
      setSendMsg({ type: 'success', text: `Report sent to ${res.data?.sentTo || form.recipient_email}` });
    } else {
      setSendMsg({ type: 'error', text: res.error || 'Failed to send report.' });
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-bold text-white mb-6">Email Reports</h1>
        <div className="card h-64 animate-pulse bg-slate-700" />
      </div>
    );
  }

  const isGmail = form.provider === 'gmail';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Email Reports</h1>
        <p className="text-slate-500 text-sm mt-1">Send automated daily performance reports to the owner's email.</p>
        {isCashier && (
          <p className="text-amber-400 text-xs mt-2">
            Cashier access is limited to Actions only. SMTP and delivery settings are read-only.
          </p>
        )}
      </div>

      <div className="grid gap-6 max-w-2xl">

        {/* SMTP Provider */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">SMTP Provider</h2>
          <div className="flex gap-2 mb-4">
            {['gmail', 'custom'].map(p => (
              <button
                key={p}
                onClick={() => handleProviderChange(p)}
                disabled={isCashier}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors capitalize ${
                  form.provider === p
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                } ${isCashier ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {p === 'gmail' ? 'Gmail' : 'Custom SMTP'}
              </button>
            ))}
          </div>

          <div className="grid gap-4">
            {isGmail ? (
              <>
                <Field label="Gmail Address (your sending email)">
                  <input
                    type="email"
                    value={form.smtp_user}
                    onChange={e => set('smtp_user', e.target.value)}
                    placeholder="yourname@gmail.com"
                    className={inputCls}
                    disabled={isCashier}
                  />
                </Field>
                <Field label="App Password (not your regular Gmail password)">
                  <input
                    type="password"
                    value={form.smtp_pass}
                    onChange={e => set('smtp_pass', e.target.value)}
                    placeholder="16-character App Password from Google"
                    className={inputCls}
                    disabled={isCashier}
                  />
                  <p className="text-slate-600 text-xs mt-1">
                    Generate at: Google Account → Security → 2-Step Verification → App Passwords
                  </p>
                </Field>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="SMTP Host">
                    <input
                      type="text"
                      value={form.smtp_host}
                      onChange={e => set('smtp_host', e.target.value)}
                      placeholder="smtp.yourprovider.com"
                      className={inputCls}
                      disabled={isCashier}
                    />
                  </Field>
                  <Field label="Port">
                    <input
                      type="number"
                      value={form.smtp_port}
                      onChange={e => set('smtp_port', Number(e.target.value))}
                      placeholder="587"
                      className={inputCls}
                      disabled={isCashier}
                    />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.smtp_secure}
                    onChange={e => set('smtp_secure', e.target.checked)}
                    className="w-4 h-4 accent-indigo-500"
                    disabled={isCashier}
                  />
                  Use SSL (port 465)
                </label>
                <Field label="Username">
                  <input
                    type="text"
                    value={form.smtp_user}
                    onChange={e => set('smtp_user', e.target.value)}
                    placeholder="SMTP username"
                    className={inputCls}
                    disabled={isCashier}
                  />
                </Field>
                <Field label="Password">
                  <input
                    type="password"
                    value={form.smtp_pass}
                    onChange={e => set('smtp_pass', e.target.value)}
                    placeholder="SMTP password"
                    className={inputCls}
                    disabled={isCashier}
                  />
                </Field>
              </>
            )}

            <Field label="Sender Name">
              <input
                type="text"
                value={form.from_name}
                onChange={e => set('from_name', e.target.value)}
                placeholder="Restaurant Manager"
                className={inputCls}
                disabled={isCashier}
              />
            </Field>
          </div>
        </div>

        {/* Recipient & Schedule */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Delivery Settings</h2>
          <div className="grid gap-4">
            <Field label="Recipient Email (owner's email)">
              <input
                type="email"
                value={form.recipient_email}
                onChange={e => set('recipient_email', e.target.value)}
                placeholder="owner@example.com"
                className={inputCls}
                disabled={isCashier}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Daily Send Time">
                <input
                  type="time"
                  value={form.schedule_time}
                  onChange={e => set('schedule_time', e.target.value)}
                  className={inputCls}
                  disabled={isCashier}
                />
              </Field>
              <div className="flex items-end pb-0.5">
                <label className={`flex items-center gap-3 text-sm text-slate-400 ${isCashier ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                  <div
                    onClick={() => !isCashier && set('is_enabled', !form.is_enabled)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${isCashier ? 'cursor-not-allowed' : 'cursor-pointer'} ${
                      form.is_enabled ? 'bg-indigo-600' : 'bg-slate-700'
                    }`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      form.is_enabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </div>
                  <span>{form.is_enabled ? 'Scheduling enabled' : 'Scheduling disabled'}</span>
                </label>
              </div>
            </div>

            {lastSent && (
              <div className="flex justify-between text-sm py-2 border-t border-slate-700">
                <span className="text-slate-500">Last report sent</span>
                <span className="text-slate-300 font-medium">
                  {(() => {
                    const d = new Date(lastSent);
                    return isNaN(d)
                      ? lastSent
                      : d.toLocaleString('en-PK', {
                          year: 'numeric', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                          hour12: false,
                        });
                  })()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSave}
              disabled={saveBusy || isCashier}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saveBusy ? 'Saving…' : 'Save Settings'}
            </button>

            <button
              onClick={handleTest}
              disabled={testBusy}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testBusy ? 'Sending…' : 'Send Test Email'}
            </button>

            <button
              onClick={handleSendNow}
              disabled={sendBusy}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendBusy ? 'Sending…' : 'Send Report Now'}
            </button>
          </div>

          <StatusMsg msg={saveMsg} />
          <StatusMsg msg={testMsg} />
          <StatusMsg msg={sendMsg} />
        </div>

        {/* Scheduler Status */}
        {status && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-300">Scheduler Diagnostics</h2>
              <button onClick={refreshStatus} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
            </div>

            {/* Issues */}
            {status.issues?.length > 0 && (
              <div className="mb-4 space-y-1.5">
                {status.issues.map(issue => (
                  <div key={issue} className="flex items-start gap-2 px-3 py-2 bg-red-900/30 border border-red-700/50 rounded-lg text-xs text-red-300">
                    <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    {issue}
                  </div>
                ))}
              </div>
            )}

            {/* Current status banner */}
            {status.issues?.length === 0 && (
              <div className={`mb-4 px-3 py-2 rounded-lg text-xs border ${
                status.willFireToday
                  ? 'bg-green-900/30 border-green-700/50 text-green-300'
                  : 'bg-yellow-900/30 border-yellow-700/50 text-yellow-300'
              }`}>
                {status.willFireToday
                  ? 'Ready — will send at the next scheduler check (every 60s).'
                  : (status.reasonNotFiring || 'Waiting…')}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Scheduler running', value: status.schedulerRunning ? 'Yes' : 'No', ok: status.schedulerRunning },
                { label: 'Enabled in settings', value: status.isEnabled ? 'Yes' : 'No', ok: status.isEnabled },
                { label: 'Configured time', value: status.scheduleTime || '—', ok: !!status.scheduleTime },
                { label: 'Current time', value: status.currentTime, ok: true },
                { label: 'Today fires at', value: status.scheduledAt ? new Date(status.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—', ok: !!status.scheduledAt },
                { label: 'Last sent', value: status.lastSentDate || 'Never', ok: true },
                {
                  label: 'Will fire today?',
                  value: status.willFireToday
                    ? 'Yes — waiting for next tick'
                    : (status.reasonNotFiring || 'No'),
                  ok: status.willFireToday,
                },
              ].map(({ label, value, ok }) => (
                <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-700/50 col-span-2">
                  <span className="text-slate-500 shrink-0">{label}</span>
                  <span className={`text-right ml-4 ${ok === false ? 'text-red-400 font-medium' : ok === true && value.startsWith('Yes') ? 'text-green-400 font-medium' : 'text-slate-300'}`}>{value}</span>
                </div>
              ))}
            </div>

            {/* Reset last sent */}
            {status.lastSentDate && (
              <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                <span className="text-xs text-slate-500">Already sent today? Clear it to allow re-firing.</span>
                <button
                  onClick={handleResetLastSent}
                  disabled={isCashier}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset Last Sent
                </button>
              </div>
            )}

            {/* Log viewer */}
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <button
                onClick={handleLoadLogs}
                disabled={logsBusy}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
              >
                {logsBusy ? 'Loading…' : logs ? 'Reload Scheduler Logs' : 'Show Scheduler Logs'}
              </button>
              {logs !== null && (
                <div className="mt-2 bg-slate-950 rounded-lg p-3 max-h-64 overflow-y-auto">
                  {logs.length === 0 ? (
                    <p className="text-slate-500 text-xs">No scheduler log entries found.</p>
                  ) : (
                    logs.map((line, i) => {
                      let parsed;
                      try { parsed = JSON.parse(line); } catch { parsed = null; }
                      const isError = parsed?.level === 'error' || /error/i.test(line);
                      const isWarn  = parsed?.level === 'warn'  || /warn/i.test(line);
                      const ts = parsed?.timestamp || '';
                      const msg = parsed?.message || line;
                      return (
                        <div key={i} className={`font-mono text-xs py-0.5 ${isError ? 'text-red-400' : isWarn ? 'text-yellow-400' : 'text-slate-400'}`}>
                          {ts && <span className="text-slate-600 mr-2">{ts}</span>}
                          {msg}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* What gets sent */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">What Gets Sent</h2>
          <ul className="space-y-1.5">
            {[
              'KPI Summary — Revenue, Expenses, Net Profit, Bills Served',
              'Top 5 Selling Items with quantity and revenue',
              'Expense Breakdown by Category',
              'Profit & Loss with margin %',
              'Staff summary and total salary paid',
              'Full All-Reports CSV attached (same as Export Reports page)',
            ].map(item => (
              <li key={item} className="flex items-start gap-2 text-sm text-slate-400">
                <svg className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}
