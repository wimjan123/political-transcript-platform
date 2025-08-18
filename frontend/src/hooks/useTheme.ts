import { useEffect, useState, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';

function getSystemPrefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const isDark = theme === 'dark' || (theme === 'system' && getSystemPrefersDark());
  root.classList.toggle('dark', isDark);
}

export default function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY) as Theme | null) : null;
    return saved || 'system';
  });

  const setAndApply = useCallback((next: Theme) => {
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }, []);

  // Apply on mount and when system preference changes
  useEffect(() => {
    applyTheme(theme);
    if (theme === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mql.addEventListener?.('change', handler);
      return () => mql.removeEventListener?.('change', handler);
    }
  }, [theme]);

  return {
    theme,
    isDark: document.documentElement.classList.contains('dark'),
    setTheme: setAndApply,
  } as const;
}

