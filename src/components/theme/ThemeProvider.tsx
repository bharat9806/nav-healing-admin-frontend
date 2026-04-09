'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type Theme = 'dark' | 'light';

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = 'nav-admin-theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getPreferredTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const storedTheme = window.localStorage.getItem(STORAGE_KEY);
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const nextTheme = getPreferredTheme();
    setThemeState(nextTheme);
    applyTheme(nextTheme);
    setMounted(true);
  }, []);

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    }
    applyTheme(nextTheme);
  };

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    resolvedTheme: mounted ? theme : 'dark',
    setTheme,
    toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
  }), [mounted, theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}
