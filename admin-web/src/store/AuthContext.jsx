import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession]           = useState(null);
  const [user, setUser]                 = useState(null);
  const [branches, setBranches]         = useState([]);
  const [activeBranch, setActiveBranchState] = useState(null);
  const [loading, setLoading]           = useState(true);

  // Fetch branches for the signed-in user.
  // If the user has 'admin' role in any branch they are treated as a global
  // admin and all branches are loaded (so the dashboard shows every branch).
  const loadBranchData = useCallback(async (authUser) => {
    if (!authUser) {
      setBranches([]);
      setActiveBranchState(null);
      return;
    }

    const { data, error } = await supabase
      .from('branch_users')
      .select('id, role, can_manage, branch_id, branches(id, name, address, phone)')
      .eq('user_id', authUser.id);

    if (error || !data) return;

    const isGlobalAdmin = data.some((row) => row.role === 'admin');

    let branchList;

    if (isGlobalAdmin) {
      // Load every branch so the admin dashboard can see all branches
      const { data: allBranches, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, address, phone')
        .order('name');

      if (branchesError || !allBranches) return;

      branchList = allBranches.map((branch) => {
        const userRow = data.find((r) => r.branch_id === branch.id);
        return {
          branchUserId: userRow?.id    ?? null,
          role:         userRow?.role  ?? 'admin',
          canManage:    userRow?.can_manage ?? true,
          ...branch,
        };
      });
    } else {
      branchList = data.map((row) => ({
        branchUserId: row.id,
        role:         row.role,
        canManage:    row.can_manage,
        ...row.branches,
      }));
    }

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
