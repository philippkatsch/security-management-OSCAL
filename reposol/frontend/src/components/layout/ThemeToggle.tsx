import React from 'react';
import { useTheme } from '@stores/themeAtoms';
import styles from './ThemeToggle.module.css';

export interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ compact = false, className = '', style }) => {
  const { theme, toggleTheme, isDark } = useTheme();

  const title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  const ariaLabel = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`${styles.themeToggle} ${compact ? styles.compact : ''} ${className}`}
      style={style}
      title={title}
      aria-label={ariaLabel}
      data-testid="theme-toggle"
    >
      <span className={styles.iconWrapper}>
        {isDark ? (
          // Sun icon when in dark mode, indicating switch to light
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        ) : (
          // Moon icon when in light mode, indicating switch to dark
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        )}
      </span>
      {!compact && (
        <span className={styles.label}>
          {isDark ? 'Light' : 'Dark'}
        </span>
      )}
    </button>
  );
};
