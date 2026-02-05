import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import LoginPage from './auth/LoginPage';
import SidebarLayout from '../layouts/SidebarLayout';
import Dashboard from './reports/Dashboard';
import POSPage from './pos/POSPage';
import StockPage from './stock/StockPage';
import ExpensesPage from './expenses/ExpensesPage';
import StaffPage from './staff/StaffPage';
import ReportsPage from './reports/ReportsPage';

export default function App() {
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

  return (
    <SidebarLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pos" element={<POSPage />} />
        <Route path="/stock" element={<StockPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SidebarLayout>
  );
}
