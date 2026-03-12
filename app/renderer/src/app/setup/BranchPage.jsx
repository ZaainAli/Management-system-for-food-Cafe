import React, { useState, useEffect, useCallback } from 'react';

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex flex-col gap-1 py-3 border-b border-slate-700/50 last:border-0">
      <span className="text-slate-500 text-xs uppercase tracking-wide">{label}</span>
      <span className={`text-white text-sm ${mono ? 'font-mono text-slate-300' : 'font-medium'}`}>
        {value || <span className="text-slate-600 italic">Not set</span>}
      </span>
    </div>
  );
}

export default function BranchPage() {
  const [info, setInfo]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [syncMsg, setSyncMsg]   = useState('');
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await window.api.setup.getBranchInfo();
      if (res.success) {
        setInfo(res.data);
      } else {
        setError(res.error || 'Failed to load branch info.');
      }
    } catch {
      setError('Unexpected error loading branch info.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setSyncing(true);
    setSyncMsg('');
    setError('');
    try {
      const res = await window.api.sync.pull();
      if (res.success) {
        setSyncMsg('Sync complete. Data updated from cloud.');
      } else {
        setError(res.error || 'Sync failed.');
      }
    } catch {
      setError('Unexpected error during sync.');
    } finally {
      setSyncing(false);
      load();
    }
  }, [load]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Branch Info</h1>
          <p className="text-slate-500 text-sm mt-0.5">This device's cloud connection details</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={syncing || loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {syncing ? 'Syncing...' : 'Sync from Cloud'}
        </button>
      </div>

      {/* Cloud connection status banner */}
      {!loading && info && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-6 border ${
          info.connected
            ? 'bg-green-900/20 border-green-700/40'
            : 'bg-red-900/20 border-red-700/40'
        }`}>
          <span className={`relative flex h-2.5 w-2.5 flex-shrink-0`}>
            {info.connected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${info.connected ? 'bg-green-400' : 'bg-red-400'}`} />
          </span>
          <div>
            <p className={`text-sm font-medium ${info.connected ? 'text-green-300' : 'text-red-300'}`}>
              {info.connected ? 'Connected to Cloud' : 'Cloud Unreachable'}
            </p>
            <p className={`text-xs mt-0.5 ${info.connected ? 'text-green-500' : 'text-red-500'}`}>
              {info.connected
                ? 'Branch data is syncing with the admin portal'
                : 'Check internet connection or Branch ID'}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-sm rounded-lg px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {syncMsg && !error && (
        <div className="bg-green-900/20 border border-green-700/40 text-green-300 text-sm rounded-lg px-4 py-3 mb-6">
          {syncMsg}
        </div>
      )}

      {loading ? (
        <div className="card space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="py-3 border-b border-slate-700/50 last:border-0 space-y-2">
              <div className="h-2.5 w-20 bg-slate-700 rounded animate-pulse" />
              <div className="h-4 w-40 bg-slate-700/60 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : info && (
        <div className="card">
          <InfoRow label="Branch Name"     value={info.name} />
          <InfoRow label="Location / Address" value={info.address} />
          <InfoRow label="Phone"           value={info.phone} />
          <InfoRow label="Branch ID"       value={info.branchId} mono />
        </div>
      )}
    </div>
  );
}
