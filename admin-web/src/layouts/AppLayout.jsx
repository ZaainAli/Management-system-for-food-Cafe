import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart2,
  GitBranch,
  UtensilsCrossed,
  Receipt,
  BookOpen,
  User2,
  Users,
  ChevronDown,
  LogOut,
  ChefHat,
} from 'lucide-react';
import { useAuth } from '../store/AuthContext';

const navItems = [
  { path: '/',          label: 'Dashboard', Icon: LayoutDashboard, end: true },
  { path: '/reports',   label: 'Reports',   Icon: BarChart2,       end: false },
  { path: '/branches',  label: 'Branches',  Icon: GitBranch,       end: false },
  { path: '/menu',      label: 'Menu',      Icon: UtensilsCrossed, end: false },
  { path: '/expenses',  label: 'Expenses',  Icon: Receipt,         end: false },
  { path: '/khata',     label: 'Khata',     Icon: BookOpen,        end: false },
  { path: '/staff',     label: 'Staff',     Icon: User2,           end: false },
  { path: '/users',     label: 'Users',     Icon: Users,           end: false },
];

export default function AppLayout({ children }) {
  const { user, branches, activeBranch, setActiveBranch, logout } = useAuth();
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userInitial = user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-64 flex-shrink-0 flex flex-col bg-slate-800 border-r border-slate-700">

        {/* Logo */}
        <div className="px-4 py-5 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <ChefHat className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-semibold text-sm leading-tight">
              Restaurant<br />
              <span className="text-primary-400">Admin</span>
            </span>
          </div>
        </div>

        {/* Branch Switcher — only when user has access to multiple branches */}
        {branches.length > 1 && (
          <div className="relative px-3 py-3 border-b border-slate-700">
            <button
              onClick={() => setBranchMenuOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-700/60
                         rounded-lg text-sm text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <span className="truncate">{activeBranch?.name ?? 'Select Branch'}</span>
              <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 ml-1" />
            </button>

            {branchMenuOpen && (
              <div
                className="absolute left-3 right-3 top-full mt-1 bg-slate-700 border
                            border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden"
              >
                {branches.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setActiveBranch(b);
                      setBranchMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors
                      ${activeBranch?.id === b.id
                        ? 'bg-primary-500/20 text-primary-400'
                        : 'text-slate-300 hover:bg-slate-600'}`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Single branch label */}
        {branches.length === 1 && activeBranch && (
          <div className="px-4 py-2.5 border-b border-slate-700">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Branch</p>
            <p className="text-sm text-primary-400 font-medium truncate mt-0.5">
              {activeBranch.name}
            </p>
          </div>
        )}

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ path, label, Icon, end }) => (
            <NavLink
              key={path}
              to={path}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors duration-150
                 ${isActive
                   ? 'bg-primary-500/10 text-primary-400'
                   : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/50'}`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User + Logout */}
        <div className="border-t border-slate-700 px-3 py-3">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{userInitial}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{user?.email}</p>
              <p className="text-slate-500 text-xs capitalize">
                {activeBranch?.role ?? 'Admin'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full mt-1 flex items-center gap-2 px-2 py-1.5
                       text-slate-500 hover:text-red-400 text-xs rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

    </div>
  );
}
