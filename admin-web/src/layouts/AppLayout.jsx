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
  LogOut,
  ChefHat,
  Menu,
  X,
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
  const { user, activeBranch, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userInitial = user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 flex-shrink-0 flex flex-col
                    bg-slate-800 border-r border-slate-700 transform transition-transform duration-200
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >

        {/* Logo */}
        <div className="px-4 py-5 border-b border-slate-700">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <ChefHat className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-semibold text-sm leading-tight">
                Hamza & Brother's<br />
                <span className="text-primary-400">Food Chain</span>
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-slate-300 hover:text-white p-1"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>


        {/* Nav Links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ path, label, Icon, end }) => (
            <NavLink
              key={path}
              to={path}
              end={end}
              onClick={() => setSidebarOpen(false)}
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
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-300 hover:text-white p-1"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-white">Hamza & Brother Food Chain</span>
          <div className="w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">{userInitial}</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>

    </div>
  );
}
