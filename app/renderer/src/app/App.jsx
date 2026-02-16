import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import LoginPage from './auth/LoginPage';
import SidebarLayout from '../layouts/SidebarLayout';
import TitleBar from '../components/TitleBar';
import Dashboard from './reports/Dashboard';
import POSPage from './pos/POSPage';
import MenuPage from './menu/MenuPage';
import StockPage from './stock/StockPage';
import ExpensesPage from './expenses/ExpensesPage';
import KhataPage from './khata/KhataPage';
import StaffPage from './staff/StaffPage';
import ReportsPage from './reports/ReportsPage';
import ExportReportsPage from './reports/ExportReportsPage';
import DiscountReportPage from './reports/DiscountReportPage';
import UsersPage from './users/UsersPage';

function ProtectedRoute({ permission, children }) {
  const { permissions } = useAuth();
  if (permission && !permissions[permission]) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App({ isPOSWindow }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

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
        <Route path="/" element={<Dashboard />} />
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
        <Route path="/reports" element={
          <ProtectedRoute permission="canAccessReports"><ReportsPage /></ProtectedRoute>
        } />
        <Route path="/reports/export" element={
          <ProtectedRoute permission="canAccessReports"><ExportReportsPage /></ProtectedRoute>
        } />
        <Route path="/reports/discount" element={
          <ProtectedRoute permission="canAccessReports"><DiscountReportPage /></ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute permission="canManageUsers"><UsersPage /></ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SidebarLayout>
  );
}
