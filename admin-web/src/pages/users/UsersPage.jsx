import React, { useState, useEffect, useCallback } from 'react';
import { Pencil } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import UserFormModal from './UserFormModal';

const roleBadge = {
  admin:   'bg-red-900/40 text-red-400',
  manager: 'bg-blue-900/40 text-blue-400',
  cashier: 'bg-green-900/40 text-green-400',
  staff:   'bg-slate-700 text-slate-400',
};

export default function UsersPage() {
  const [branchUsers, setBranchUsers] = useState([]);
  const [branches, setBranches]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState(null);

  const fetchData = useCallback(async () => {
    const [buRes, bRes] = await Promise.all([
      supabase
        .from('branch_users')
        .select(`
          id,
          role,
          can_manage,
          user_id,
          branch_id,
          branches ( id, name ),
          profiles ( email )
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('branches')
        .select('id, name')
        .order('name'),
    ]);

    setBranchUsers(buRes.data ?? []);
    setBranches(bRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openEdit = (bu) => {
    setEditing({
      ...bu,
      email: bu.profiles?.email ?? null,
    });
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card h-14 animate-pulse bg-slate-700/50" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Users</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {branchUsers.length} user assignment{branchUsers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="btn-primary text-sm"
        >
          + Assign User
        </button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">Email</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide hidden sm:table-cell">Branch</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">Role</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {branchUsers.map((bu) => (
              <tr
                key={bu.id}
                className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <span className="text-white">
                    {bu.profiles?.email ?? (
                      <span className="text-slate-500 text-xs font-mono">{bu.user_id?.slice(0, 8)}…</span>
                    )}
                  </span>
                  {/* Mobile: branch inline */}
                  <span className="text-slate-500 text-xs block sm:hidden mt-0.5">
                    {bu.branches?.name ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden sm:table-cell">
                  {bu.branches?.name ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${roleBadge[bu.role] ?? roleBadge.staff}`}>
                    {bu.role}
                  </span>
                  {bu.role === 'cashier' && bu.can_manage && (
                    <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-purple-900/40 text-purple-400">
                      +mgr
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => openEdit(bu)}
                    className="text-slate-400 hover:text-white transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}

            {branchUsers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-600 text-sm">
                  No users assigned yet.
                  <br />
                  Invite users via the Supabase Dashboard, then assign them here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <UserFormModal
          branchUserRecord={editing}
          branches={branches}
          onClose={() => setShowModal(false)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
