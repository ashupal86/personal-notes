'use client';
import {
  createContext, useContext, useEffect, useState,
  type ReactNode,
} from 'react';
import type { User, UserRole } from '@/types';
import { syncPrefsOnLogin } from '@/context/ThemeContext';

interface Workspace { id: string; name: string; slug: string; icon: string; color: string; }

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  avatar_url?: string;
  workspaces: Workspace[];
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  role: UserRole | null;
  /** workspace the current user belongs to (first one) */
  primaryWorkspace: Workspace | null;
  refresh: () => void;
  logout: () => Promise<void>;
}

const Context = createContext<AuthCtx>({
  user: null, loading: true, role: null, primaryWorkspace: null,
  refresh: () => {}, logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(() => {
    if (typeof window !== 'undefined') {
      try { const cached = localStorage.getItem('cache_user'); if (cached) return JSON.parse(cached); } catch {}
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      if (res.ok) {
        const { data } = await res.json();
        setUser(data);
        if (typeof window !== 'undefined') localStorage.setItem('cache_user', JSON.stringify(data));
        // Sync localStorage preferences when session is restored
        syncPrefsOnLogin(data?.id);
      } else {
        setUser(null);
        if (typeof window !== 'undefined') localStorage.removeItem('cache_user');
      }
    } catch {
      setUser(null);
      if (typeof window !== 'undefined') localStorage.removeItem('cache_user');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    window.location.href = '/login';
  };

  useEffect(() => { fetchMe(); }, []);

  return (
    <Context.Provider value={{
      user,
      loading,
      role: user?.role ?? null,
      primaryWorkspace: user?.workspaces?.[0] ?? null,
      refresh: fetchMe,
      logout,
    }}>
      {children}
    </Context.Provider>
  );
}

export const useAuth = () => useContext(Context);
