import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Phone, Pencil, Trash2, Copy, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import BranchFormModal from './BranchFormModal';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy Branch ID"
      className="ml-1 text-slate-600 hover:text-primary-400 transition-colors flex-shrink-0"
    >
      {copied
        ? <Check className="w-3 h-3 text-green-400" />
        : <Copy className="w-3 h-3" />}
    </button>
  );
}

export default function BranchesPage() {
  const [branches, setBranches]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [deleting, setDeleting]   = useState(null);

  const fetchBranches = useCallback(async () => {
    const { data, error } = await supabase
      .from('branches')
      .select('id, name, address, phone, created_at')
      .order('created_at', { ascending: false });

    if (!error) setBranches(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  const openAdd  = () => { setEditing(null);  setShowModal(true); };
  const openEdit = (b) => { setEditing(b);    setShowModal(true); };

  const handleDelete = async (branch) => {
    if (!confirm(`Delete "${branch.name}"? This will remove all its data permanently.`)) return;
    setDeleting(branch.id);
    await supabase.from('branches').delete().eq('id', branch.id);
    await fetchBranches();
    setDeleting(null);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card h-16 animate-pulse bg-slate-700/50" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Branches</h1>
          <p className="text-slate-500 text-sm mt-0.5">{branches.length} branch{branches.length !== 1 ? 'es' : ''}</p>
        </div>
        <button onClick={openAdd} className="btn-primary text-sm">
          + New Branch
        </button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">Name</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide hidden sm:table-cell">Address</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide hidden md:table-cell">Phone</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide hidden lg:table-cell">Created</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr
                key={b.id}
                className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <span className="text-white font-medium">{b.name}</span>
                  <span className="flex items-center gap-0.5 mt-0.5">
                    <span className="font-mono text-slate-600 text-xs truncate max-w-[180px]">{b.id}</span>
                    <CopyButton text={b.id} />
                  </span>
                  {/* Mobile: show address inline */}
                  {b.address && (
                    <span className="flex items-center gap-1 text-slate-500 text-xs mt-0.5 sm:hidden">
                      <MapPin className="w-3 h-3" />
                      {b.address}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  {b.address
                    ? <span className="flex items-center gap-1 text-slate-400 text-xs"><MapPin className="w-3 h-3 flex-shrink-0" />{b.address}</span>
                    : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {b.phone
                    ? <span className="flex items-center gap-1 text-slate-400 text-xs"><Phone className="w-3 h-3 flex-shrink-0" />{b.phone}</span>
                    : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
                  {new Date(b.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => openEdit(b)}
                      className="text-slate-400 hover:text-white transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(b)}
                      disabled={deleting === b.id}
                      className="text-slate-400 hover:text-red-400 transition-colors disabled:opacity-40"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {branches.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-600 text-sm">
                  No branches yet. Click <strong className="text-slate-500">+ New Branch</strong> to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <BranchFormModal
          branch={editing}
          onClose={() => setShowModal(false)}
          onSaved={fetchBranches}
        />
      )}
    </div>
  );
}
