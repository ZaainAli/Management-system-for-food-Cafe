import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import LoginPage from './auth/LoginPage';
import SetupPage from './setup/SetupPage';
import SidebarLayout from '../layouts/SidebarLayout';
import TitleBar from '../components/TitleBar';
import Dashboard from './reports/Dashboard';
import POSPage from './pos/POSPage';
import MenuPage from './menu/MenuPage';
import StockPage from './stock/StockPage';
import ExpensesPage from './expenses/ExpensesPage';
import KhataPage from './khata/KhataPage';
import StaffPage from './staff/StaffPage';
import AttendancePage from './staff/AttendancePage';
import ReportsPage from './reports/ReportsPage';
import ExportReportsPage from './reports/ExportReportsPage';
import DiscountReportPage from './reports/DiscountReportPage';
import UsersPage from './users/UsersPage';
import BranchPage from './setup/BranchPage';
import EmailSettingsPage from './settings/EmailSettingsPage';

function ProtectedRoute({ permission, children }) {
  const { permissions } = useAuth();
  const fallbackPath = permissions.canAccessDashboard ? '/' : '/pos';
  if (permission && !permissions[permission]) {
    return <Navigate to={fallbackPath} replace />;
  }
  return children;
}

export default function App({ isPOSWindow }) {
  const { user, loading } = useAuth();
  const [branchConfigured, setBranchConfigured] = useState(null); // null = checking

  useEffect(() => {
    (async () => {
      try {
        const res = await window.api.setup.getBranchId();
        setBranchConfigured(res.success && !!res.data.branchId);
      } catch {
        setBranchConfigured(false);
      }
    })();
  }, []);

  if (loading || branchConfigured === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-lg">Loading...</div>
      </div>
    );
  }

  if (!branchConfigured) {
    return <SetupPage onSetupComplete={() => setBranchConfigured(true)} />;
  }

  if (!user) {
    return <LoginPage />;
  }

  const defaultPath = user.role === 'cashier' ? '/pos' : '/';

  // POS window: render only the POS page with TitleBar, no sidebar
  if (isPOSWindow) {
    return (
      <div className="flex flex-col h-screen bg-slate-900">
        <TitleBar />
        <div className="flex-1 overflow-y-auto">
          <main className="p-6">
            <POSPage />
          </main>
        </div>
      </div>
    );
  } 

  return (
    <SidebarLayout>
      <Routes>
        <Route path="/" element={user.role === 'cashier'
          ? <Navigate to="/pos" replace />
          : <ProtectedRoute permission="canAccessDashboard"><Dashboard /></ProtectedRoute>
        } />
        <Route path="/pos" element={<POSPage />} />
        <Route path="/menu" element={
          <ProtectedRoute permission="canManageMenu"><MenuPage /></ProtectedRoute>
        } />
        <Route path="/stock" element={
          <ProtectedRoute permission="canAccessStock"><StockPage /></ProtectedRoute>
        } />
        <Route path="/expenses" element={
          <ProtectedRoute permission="canAccessExpenses"><ExpensesPage /></ProtectedRoute>
        } />
        <Route path="/khata" element={
          <ProtectedRoute permission="canAccessKhata"><KhataPage /></ProtectedRoute>
        } />
        <Route path="/staff" element={
          <ProtectedRoute permission="canAccessStaff"><StaffPage /></ProtectedRoute>
        } />
        <Route path="/attendance" element={
          <ProtectedRoute permission="canAccessStaff"><AttendancePage /></ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute permission="canAccessReports"><ReportsPage /></ProtectedRoute>
        } />
        <Route path="/reports/export" element={
          <ProtectedRoute permission="canAccessExportReports"><ExportReportsPage /></ProtectedRoute>
        } />
        <Route path="/reports/discount" element={
          <ProtectedRoute permission="canAccessDiscountReports"><DiscountReportPage /></ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute permission="canManageUsers"><UsersPage /></ProtectedRoute>
        } />
        <Route path="/branch" element={
          <ProtectedRoute permission="canAccessDashboard"><BranchPage /></ProtectedRoute>
        } />
        <Route path="/settings/email" element={
          <ProtectedRoute permission="canAccessEmailReports"><EmailSettingsPage /></ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to={defaultPath} replace />} />
      </Routes>
    </SidebarLayout>
  );
}
