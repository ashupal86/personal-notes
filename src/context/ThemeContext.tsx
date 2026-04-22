'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'sepia';

interface ThemeCtx { theme: Theme; setTheme: (t: Theme) => void; }

const Ctx = createContext<ThemeCtx>({ theme: 'light', setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const stored = localStorage.getItem('qa-theme') as Theme | null;
    const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const t = stored ?? system;
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('qa-theme', t);
    document.documentElement.setAttribute('data-theme', t);
  };

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
