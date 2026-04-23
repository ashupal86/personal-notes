'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'sepia';

interface ThemeCtx { theme: Theme; setTheme: (t: Theme) => void; }

const Ctx = createContext<ThemeCtx>({ theme: 'light', setTheme: () => {} });

/** Key used in localStorage for all user preferences */
const PREFS_KEY = 'qa-prefs';

interface Prefs {
  theme: Theme;
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...{ theme: 'light' }, ...JSON.parse(raw) };
  } catch {}
  // Fallback: detect system preference
  const system = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return { theme: system as Theme };
}

function savePrefs(prefs: Partial<Prefs>) {
  try {
    const current = loadPrefs();
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
  } catch {}
}

function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  // Hydrate from localStorage on mount
  useEffect(() => {
    const prefs = loadPrefs();
    setThemeState(prefs.theme);
    applyTheme(prefs.theme);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    savePrefs({ theme: t });
  };

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

/**
 * Call this after login/signup to hydrate preferences from localStorage.
 * In future: pass userId to sync preferences to/from the database.
 */
export function syncPrefsOnLogin(_userId?: string) {
  const prefs = loadPrefs();
  applyTheme(prefs.theme);
  // TODO: if userId provided, fetch user preferences from DB and merge
  //       api.get(`/users/${userId}/prefs`).then(r => { if (r.data) { savePrefs(r.data); applyTheme(r.data.theme); } });
}
