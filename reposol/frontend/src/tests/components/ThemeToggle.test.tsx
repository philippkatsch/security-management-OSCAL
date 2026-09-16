import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ThemeToggle } from '@components/layout/ThemeToggle';

describe('ThemeToggle Component & Theming Engine', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.clearAllMocks();
  });

  it('renders theme toggle button with initial light mode state (default)', () => {
    render(<ThemeToggle />);
    const button = screen.getByTestId('theme-toggle');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Switch to dark mode');
    expect(screen.getByText('Dark')).toBeInTheDocument();
  });

  it('toggles from light to dark mode on click and updates DOM attribute and localStorage', () => {
    render(<ThemeToggle />);
    const button = screen.getByTestId('theme-toggle');

    // Click to switch to dark mode
    fireEvent.click(button);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('reposol-theme')).toBe('dark');
    expect(button).toHaveAttribute('aria-label', 'Switch to light mode');
    expect(screen.getByText('Light')).toBeInTheDocument();

    // Click again to switch back to light mode
    fireEvent.click(button);

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('reposol-theme')).toBe('light');
    expect(button).toHaveAttribute('aria-label', 'Switch to dark mode');
    expect(screen.getByText('Dark')).toBeInTheDocument();
  });

  it('renders compact mode without text label', () => {
    render(<ThemeToggle compact />);
    const button = screen.getByTestId('theme-toggle');
    expect(button).toBeInTheDocument();
    expect(screen.queryByText('Light')).toBeNull();
    expect(screen.queryByText('Dark')).toBeNull();
  });
});
