import React, { useState, useEffect } from 'react';
import { X, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const ROLES = ['admin', 'manager', 'cashier', 'staff'];

export default function UserFormModal({ branchUserRecord, branches, onClose, onSaved }) {
  const isEdit = !!branchUserRecord;

  const [branchId, setBranchId]   = useState('');
  const [role, setRole]           = useState('cashier');
  const [canManage, setCanManage] = useState(false);
  const [error, setError]         = useState('');
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    if (branchUserRecord) {
      setBranchId(branchUserRecord.branch_id ?? '');
      setRole(branchUserRecord.role ?? 'cashier');
      setCanManage(branchUserRecord.can_manage ?? false);
    } else {
      setBranchId(branches[0]?.id ?? '');
      setRole('cashier');
      setCanManage(false);
    }
    setError('');
  }, [branchUserRecord, branches]);

  const handleSave = async () => {
    if (!branchId) { setError('Please select a branch.'); return; }
    setSaving(true);
    setError('');

    if (isEdit) {
      const { error: err } = await supabase
        .from('branch_users')
        .update({ role, can_manage: canManage, branch_id: branchId })
        .eq('id', branchUserRecord.id);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    // New user creation requires server-side invite (Edge Function) — see note below
    onSaved();
    onClose();
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="card w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">
            {isEdit ? 'Edit User Access' : 'Assign User to Branch'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 text-red-300
                          text-sm rounded-lg px-4 py-2.5 mb-4">
            {error}
          </div>
        )}

        {/* New user notice */}
        {!isEdit && (
          <div className="bg-blue-900/20 border border-blue-700/40 text-blue-300
                          text-xs rounded-lg px-3 py-3 mb-4 flex gap-2">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              The user must first create an account via Supabase Auth (email sign-up).
              After they sign up, their record will appear here to be assigned to a branch.
              <br /><br />
              Alternatively, invite them via the{' '}
              <strong className="text-blue-200">Supabase Dashboard → Authentication → Users → Invite</strong>.
            </span>
          </div>
        )}

        <div className="space-y-3">
          {isEdit && branchUserRecord?.email && (
            <div>
              <label className="label">User</label>
              <p className="text-slate-300 text-sm">{branchUserRecord.email}</p>
            </div>
          )}

          <div>
            <label className="label">Branch</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="input-field"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="input-field"
            >
              {ROLES.map((r) => (
                <option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </div>

          {role === 'cashier' && (
            <label className="flex items-center gap-2.5 bg-slate-700/40 rounded-lg px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={canManage}
                onChange={(e) => setCanManage(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-300">Grant manager privileges</span>
            </label>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={handleSave}
            disabled={saving || !isEdit}
            className="btn-primary flex-1"
            title={!isEdit ? 'Use Supabase Dashboard to invite new users' : ''}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>

        {!isEdit && (
          <p className="text-slate-600 text-xs text-center mt-3">
            Save is only available when editing existing user records.
          </p>
        )}
      </div>
    </div>
  );
}
