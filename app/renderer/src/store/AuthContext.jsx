import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

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

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
