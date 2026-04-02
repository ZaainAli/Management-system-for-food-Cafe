import { useState, useEffect, useRef } from 'react';

export default function CustomerKhataModal({ isOpen, onClose, onSelect, cart }) {
  const [profiles, setProfiles] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError('');
    setSearch('');
    window.api.khata.getAll().then(res => {
      if (res.success) {
        setProfiles(res.data.filter(p => p.profileType === 'customer'));
      } else {
        setError(res.error || 'Failed to load profiles');
      }
      setLoading(false);
    });
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

 const filtered = profiles.filter(p =>
  (p.name && p.name.toLowerCase().includes(search.toLowerCase())) ||
  (p.phone && p.phone.includes(search))
 );

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const handleSelect = (profile) => {
    onSelect(profile);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="card w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white font-semibold">Select Customer Khata</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-lg">✕</button>
        </div>

        <div className="mb-3 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-400">
          Bill Total: <span className="text-primary-400 font-semibold">PKR {cartTotal.toLocaleString()}</span>
          {' | '}Items: <span className="text-white">{cart.length}</span>
        </div>

        <input
          ref={searchRef}
          type="text"
          className="input-field mb-3"
          placeholder="Search customer by name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {loading && <div className="text-slate-400 text-sm text-center py-6">Loading customers...</div>}
        {error && <div className="text-red-300 text-sm text-center py-3">{error}</div>}

        {!loading && !error && (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {filtered.map(profile => (
              <button
                key={profile.id}
                onClick={() => handleSelect(profile)}
                className="w-full text-left px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-primary-500/10 hover:border-primary-500 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-white font-medium">{profile.name}</span>
                    <span className="text-xs text-slate-400 ml-2">{profile.phone || 'No phone'}</span>
                  </div>
                  <div className={`text-xs font-semibold ${profile.balance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    PKR {Math.abs(Number(profile.balance || 0)).toLocaleString()}
                    {profile.balance !== 0 && <span className="ml-0.5">{profile.balance > 0 ? '(-)' : '(+)'}</span>}
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-slate-500 text-sm text-center py-6">
                {profiles.length === 0 ? 'No customer profiles yet' : 'No matching customers'}
              </div>
            )}
          </div>
        )}

        <div className="mt-4">
          <button onClick={onClose} className="btn-secondary w-full">Cancel (Esc)</button>
        </div>
      </div>
    </div>
  );
}
