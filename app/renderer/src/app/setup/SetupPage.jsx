import React, { useState, useRef, useEffect } from 'react';
import TitleBar from '../../components/TitleBar';

function Logo() {
  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500 rounded-2xl mb-4 mx-auto">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-white">Hamza & Brother Food Chain</h1>
    </div>
  );
}

function SupabaseStep({ onSaved }) {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await window.api.setup.saveSupabaseConfig({ supabaseUrl, supabaseKey });
    if (res.success) {
      onSaved();
    } else {
      setError(res.error || 'Failed to save. Please try again.');
    }
    setLoading(false);
  };

  return (
    <>
      <p className="text-slate-500 text-sm mt-1 mb-8 text-center">Cloud Connection Setup</p>
      <div className="card">
        <p className="text-slate-400 text-sm mb-5">
          Enter your Supabase project credentials. These are stored locally on this machine only.
        </p>

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Supabase Project URL</label>
            <input
              ref={inputRef}
              type="url"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://xxxxxxxxxxxx.supabase.co"
              className="input-field font-mono"
              required
            />
          </div>
          <div>
            <label className="label">Service Role Key</label>
            <input
              type="password"
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="input-field font-mono"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Saving...' : 'Save & Continue'}
          </button>
        </form>
      </div>
      <p className="text-center text-slate-600 text-xs mt-6">
        Find these in your Supabase project under Settings → API.
      </p>
    </>
  );
}

function BranchStep({ onSaved }) {
  const [branchId, setBranchId] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = branchId.trim();
    if (!trimmed) { setError('Branch ID is required.'); return; }
    setLoading(true);
    setError('');
    const res = await window.api.setup.saveBranchId({ branchId: trimmed });
    if (res.success) {
      onSaved();
    } else {
      setError(res.error || 'Failed to save Branch ID. Please try again.');
    }
    setLoading(false);
  };

  return (
    <>
      <p className="text-slate-500 text-sm mt-1 mb-8 text-center">Branch Setup</p>
      <div className="card">
        <p className="text-slate-400 text-sm mb-5">
          Enter the Branch ID for this location. You can find it in the admin portal under Branch Settings.
        </p>

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Branch ID</label>
            <input
              ref={inputRef}
              type="text"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="input-field font-mono"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Connecting...' : 'Connect Branch'}
          </button>
        </form>
      </div>
      <p className="text-center text-slate-600 text-xs mt-6">
        Contact your administrator to get the Branch ID for this location.
      </p>
    </>
  );
}

export default function SetupPage({ supabaseConfigured, branchConfigured, onSupabaseSaved, onBranchSaved }) {
  const [step, setStep] = useState(!supabaseConfigured ? 1 : 2);

  const handleSupabaseSaved = () => {
    onSupabaseSaved();
    if (!branchConfigured) setStep(2);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      <TitleBar />
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <Logo />
          {step === 1
            ? <SupabaseStep onSaved={handleSupabaseSaved} />
            : <BranchStep onSaved={onBranchSaved} />
          }
        </div>
      </div>
    </div>
  );
}
