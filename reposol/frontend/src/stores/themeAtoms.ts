import { atom, useAtom } from 'jotai';
import { useEffect } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'reposol-theme';

export function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch (e) {
    // fallback if localStorage is restricted
  }
  return 'light';
}

export function applyThemeToDom(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute('content', theme);
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (e) {
    // ignore storage write errors
  }
}

export const themeAtom = atom<Theme>(getInitialTheme());

export function useTheme() {
  const [theme, setThemeState] = useAtom(themeAtom);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    applyThemeToDom(newTheme);
  };

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  useEffect(() => {
    // Ensure DOM is in sync on mount
    applyThemeToDom(theme);
  }, [theme]);

  return {
    theme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
    setTheme,
    toggleTheme,
  };
}
