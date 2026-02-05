import React, { useState, useEffect } from 'react';

const emptyForm = { username: '', password: '', role: 'cashier', canManage: false };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Reset password state
  const [resetPwUser, setResetPwUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  const fetchUsers = async () => {
    const res = await window.api.user.getAll();
    if (res.success) setUsers(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const openAdd = () => { setForm(emptyForm); setEditId(null); setError(''); setShowModal(true); };
  const openEdit = (user) => {
    setForm({
      username: user.username,
      password: '',
      role: user.role,
      canManage: !!user.canManage,
    });
    setEditId(user.id);
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setError('');
    let res;
    if (editId) {
      res = await window.api.user.update({ id: editId, username: form.username, role: form.role, canManage: form.canManage });
    } else {
      res = await window.api.user.create(form);
    }
    if (res.success) { setShowModal(false); await fetchUsers(); }
    else { setError(res.error); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this user account?')) return;
    const res = await window.api.user.delete({ id });
    if (!res.success) alert(res.error);
    await fetchUsers();
  };

  const handleResetPassword = async () => {
    if (!resetPwUser || !newPassword) return;
    setResetMsg('');
    const res = await window.api.user.resetPassword({ id: resetPwUser.id, newPassword });
    if (res.success) {
      setResetMsg('Password reset successfully');
      setNewPassword('');
      setTimeout(() => { setResetPwUser(null); setResetMsg(''); }, 1500);
    } else {
      setResetMsg(res.error);
    }
  };

  const roleBadge = (role, canManage) => {
    const colors = {
      admin: 'bg-red-900/40 text-red-400',
      manager: 'bg-blue-900/40 text-blue-400',
      cashier: 'bg-green-900/40 text-green-400',
      staff: 'bg-slate-700 text-slate-400',
    };
    return (
      <span className="flex items-center gap-1.5">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[role] || colors.staff}`}>
          {role}
        </span>
        {role === 'cashier' && canManage ? (
          <span className="px-1.5 py-0.5 rounded text-xs bg-purple-900/40 text-purple-400">+manager</span>
        ) : null}
      </span>
    );
  };

  if (loading) return <div className="text-slate-400">Loading users...</div>;

  return (
    <div className="flex gap-4">
      {/* Left: Users List */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white">User Accounts</h1>
          <button onClick={openAdd} className="btn-primary text-sm">+ Add User</button>
        </div>

        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Username</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Role</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{u.username}</td>
                  <td className="px-4 py-3">{roleBadge(u.role, u.canManage)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => openEdit(u)} className="text-xs text-slate-400 hover:text-white">Edit</button>
                      <button onClick={() => { setResetPwUser(u); setNewPassword(''); setResetMsg(''); }} className="text-xs text-blue-400 hover:text-blue-300">Password</button>
                      {u.username !== 'admin' && (
                        <button onClick={() => handleDelete(u.id)} className="text-xs text-red-400 hover:text-red-300">Del</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-600 text-sm">No users</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: Reset Password Panel */}
      {resetPwUser && (
        <div className="w-80 flex-shrink-0">
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-white font-semibold text-sm">Reset Password</h2>
              <button onClick={() => setResetPwUser(null)} className="text-slate-500 hover:text-white text-sm">&#x2715;</button>
            </div>
            <p className="text-slate-500 text-xs mb-3">User: <span className="text-white font-medium">{resetPwUser.username}</span></p>
            <div className="space-y-2">
              <div>
                <label className="label text-xs">New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="input-field py-1.5 text-xs" placeholder="Min 6 characters" />
              </div>
              <button onClick={handleResetPassword} className="btn-primary w-full text-xs py-1.5">Reset Password</button>
              {resetMsg && (
                <p className={`text-xs text-center ${resetMsg.includes('success') ? 'text-green-400' : 'text-red-400'}`}>{resetMsg}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="card w-96">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-semibold">{editId ? 'Edit User' : 'Add User'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white">&#x2715;</button>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-sm rounded-lg px-4 py-2 mb-3">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="label">Username</label>
                <input value={form.username} onChange={e => setForm({...form, username: e.target.value})} className="input-field" placeholder="Min 3 characters" />
              </div>
              {!editId && (
                <div>
                  <label className="label">Password</label>
                  <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="input-field" placeholder="Min 6 characters" />
                </div>
              )}
              <div>
                <label className="label">Role</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value, canManage: false})} className="input-field bg-slate-700">
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="cashier">Cashier</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
              {form.role === 'cashier' && (
                <div className="flex items-center gap-2 bg-slate-700/40 rounded-lg px-3 py-2.5">
                  <input
                    type="checkbox"
                    id="canManage"
                    checked={form.canManage}
                    onChange={e => setForm({...form, canManage: e.target.checked})}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-primary-500 focus:ring-primary-500"
                  />
                  <label htmlFor="canManage" className="text-sm text-slate-300 cursor-pointer">
                    Grant manager privileges
                    <span className="block text-xs text-slate-500">Can access staff, stock, expenses & reports</span>
                  </label>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleSave} className="btn-primary flex-1">Save</button>
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
