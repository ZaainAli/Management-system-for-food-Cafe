import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const AuthContext = createContext(null);

function getEffectiveRoles(user) {
  if (!user) return [];
  const { role, canManage } = user;
  switch (role) {
    case 'admin':   return ['admin', 'manager', 'cashier', 'staff'];
    case 'manager': return ['manager', 'cashier'];
    case 'cashier': return canManage ? ['cashier', 'manager'] : ['cashier'];
    default:        return [role];
  }
}

function hasRole(user, ...roles) {
  const effective = getEffectiveRoles(user);
  return roles.some(r => effective.includes(r));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, check if there's an active session
  useEffect(() => {
    (async () => {
      try {
        const res = await window.api.auth.getCurrentUser();
        if (res.success) {
          setUser(res.data);
        }
      } catch (err) {
        console.error('Session check failed', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (credentials) => {
    const res = await window.api.auth.login(credentials);
    if (res.success) {
      setUser(res.data);
    }
    return res;
  }, []);

  const logout = useCallback(async () => {
    await window.api.auth.logout();
    setUser(null);
  }, []);

  const changePassword = useCallback(async (payload) => {
    return window.api.auth.changePassword(payload);
  }, []);

  const permissions = useMemo(() => {
    if (!user) return {};
    return {
      canAccessPOS: true,
      canManageMenu: hasRole(user, 'admin', 'manager'),
      canAccessStaff: hasRole(user, 'admin', 'manager'),
      canAccessStock: hasRole(user, 'admin', 'manager'),
      canAccessExpenses: hasRole(user, 'admin', 'manager'),
      canAccessReports: hasRole(user, 'admin', 'manager'),
      canAccessDashboard: true,
      canManageUsers: hasRole(user, 'admin'),
      isAdmin: hasRole(user, 'admin'),
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, changePassword, permissions }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
