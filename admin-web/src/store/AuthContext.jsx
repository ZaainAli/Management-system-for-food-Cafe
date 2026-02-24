import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession]           = useState(null);
  const [user, setUser]                 = useState(null);
  const [branches, setBranches]         = useState([]);
  const [activeBranch, setActiveBranchState] = useState(null);
  const [loading, setLoading]           = useState(true);

  // Fetch branch_users rows for the signed-in user, joining branches table
  const loadBranchData = useCallback(async (authUser) => {
    if (!authUser) {
      setBranches([]);
      setActiveBranchState(null);
      return;
    }

    const { data, error } = await supabase
      .from('branch_users')
      .select('id, role, can_manage, branches(id, name, address, phone)')
      .eq('user_id', authUser.id);

    if (error || !data) return;

    const branchList = data.map((row) => ({
      branchUserId: row.id,
      role:         row.role,
      canManage:    row.can_manage,
      ...row.branches,
    }));

    setBranches(branchList);

    // Restore previously selected branch from localStorage, fall back to first
    const saved = localStorage.getItem('activeBranchId');
    const found = branchList.find((b) => b.id === saved) || branchList[0] || null;
    setActiveBranchState(found);
  }, []);

  // On mount: restore existing session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      loadBranchData(session?.user ?? null).finally(() => setLoading(false));
    });

    // Listen for auth state changes (token refresh, sign-out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (!session) {
          setBranches([]);
          setActiveBranchState(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [loadBranchData]);

  const login = useCallback(async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };
    await loadBranchData(data.user);
    return { success: true };
  }, [loadBranchData]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('activeBranchId');
  }, []);

  const setActiveBranch = useCallback((branch) => {
    setActiveBranchState(branch);
    if (branch?.id) {
      localStorage.setItem('activeBranchId', branch.id);
    } else {
      localStorage.removeItem('activeBranchId');
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        branches,
        activeBranch,
        setActiveBranch,
        login,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
