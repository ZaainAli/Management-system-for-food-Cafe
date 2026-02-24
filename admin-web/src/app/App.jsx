import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import AppLayout from '../layouts/AppLayout';
import LoadingSpinner from '../components/LoadingSpinner';
import LoginPage    from '../pages/LoginPage';
import Dashboard    from '../pages/Dashboard';
import BranchesPage from '../pages/branches/BranchesPage';
import UsersPage    from '../pages/users/UsersPage';
import ReportsPage  from '../pages/reports/ReportsPage';
import MenuPage     from '../pages/menu/MenuPage';
import ExpensesPage from '../pages/expenses/ExpensesPage';
import KhataPage    from '../pages/khata/KhataPage';
import StaffPage    from '../pages/staff/StaffPage';

function ProtectedPage({ children }) {
  return (
    <ProtectedRoute>
      <AppLayout>
        {children}
      </AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  const { loading } = useAuth();

  if (loading) return <LoadingSpinner />;

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected */}
      <Route path="/" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
      <Route path="/reports"  element={<ProtectedPage><ReportsPage /></ProtectedPage>} />
      <Route path="/branches" element={<ProtectedPage><BranchesPage /></ProtectedPage>} />
      <Route path="/menu"     element={<ProtectedPage><MenuPage /></ProtectedPage>} />
      <Route path="/expenses" element={<ProtectedPage><ExpensesPage /></ProtectedPage>} />
      <Route path="/khata"    element={<ProtectedPage><KhataPage /></ProtectedPage>} />
      <Route path="/staff"    element={<ProtectedPage><StaffPage /></ProtectedPage>} />
      <Route path="/users"    element={<ProtectedPage><UsersPage /></ProtectedPage>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
