/**
 * Tests for the Navigation component.
 * Covers: sidebar collapse/expand, active tab highlighting,
 * localStorage persistence, brand click, router integration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navigation from '@components/layout/Navigation';

const renderWithRouter = (ui: React.ReactElement, initialEntries = ['/catalogs']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      {ui}
    </MemoryRouter>
  );
};

describe('Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders all navigation items', () => {
    renderWithRouter(<Navigation />);
    expect(screen.getByText('Catalogs')).toBeInTheDocument();
    expect(screen.getByText('Profiles')).toBeInTheDocument();
    expect(screen.getByText('SSPs')).toBeInTheDocument();
    expect(screen.getByText('Components')).toBeInTheDocument();
    expect(screen.getByText('Assessment Plans')).toBeInTheDocument();
    expect(screen.getByText('Assessment Results')).toBeInTheDocument();
    expect(screen.getByText('POA&Ms')).toBeInTheDocument();
  });

  it('renders the brand name "Reposol"', () => {
    renderWithRouter(<Navigation />);
    expect(screen.getByText('Reposol')).toBeInTheDocument();
  });

  it('navigates when a nav item is clicked', () => {
    renderWithRouter(<Navigation />);
    fireEvent.click(screen.getByText('Profiles'));
    expect(screen.getByText('Profiles')).toBeInTheDocument();
  });

  it('navigates to dashboard when brand logo is clicked', () => {
    renderWithRouter(<Navigation />);
    const brandLeft = document.querySelector('.clickable-brand');
    fireEvent.click(brandLeft!);
    expect(screen.getByText('Reposol')).toBeInTheDocument();
  });

  it('highlights the active tab with "active" class', () => {
    renderWithRouter(<Navigation />, ['/profiles']);
    const profilesButton = screen.getByRole('button', { name: /Profiles/i });
    expect(profilesButton).toHaveClass('active');
  });

  it('toggling sidebar saves collapsed state to localStorage', () => {
    renderWithRouter(<Navigation />);
    const toggleButton = document.querySelector('.btn-sidebar-toggle');
    fireEvent.click(toggleButton!);
    expect(localStorage.getItem('sidebar-collapsed')).toBe('true');
    fireEvent.click(toggleButton!);
    expect(localStorage.getItem('sidebar-collapsed')).toBe('false');
  });

  it('reads collapsed state from localStorage on mount', () => {
    localStorage.setItem('sidebar-collapsed', 'true');
    renderWithRouter(<Navigation />);
    const sidebar = document.querySelector('.navigation-sidebar');
    expect(sidebar?.classList.contains('collapsed')).toBe(true);
  });

  it('starts expanded by default when localStorage has no entry', () => {
    renderWithRouter(<Navigation />);
    const sidebar = document.querySelector('.navigation-sidebar');
    expect(sidebar?.classList.contains('collapsed')).toBe(false);
  });

  it('toggle button has correct title when collapsed', () => {
    localStorage.setItem('sidebar-collapsed', 'true');
    renderWithRouter(<Navigation />);
    const toggleButton = document.querySelector('.btn-sidebar-toggle') as HTMLButtonElement;
    expect(toggleButton?.title).toBe('Expand sidebar');
  });

  it('toggle button has correct title when expanded', () => {
    renderWithRouter(<Navigation />);
    const toggleButton = document.querySelector('.btn-sidebar-toggle') as HTMLButtonElement;
    expect(toggleButton?.title).toBe('Collapse sidebar');
  });

  it('renders Under Development badges for uncompleted stages', () => {
    renderWithRouter(<Navigation />);
    const devBadges = screen.getAllByText('🚧 Dev');
    expect(devBadges.length).toBe(6); // Components, Control Mappings, SSPs, Assessment Plans, Assessment Results, POA&Ms
  });

  it('renders share workspace button with btn-share-workspace class', () => {
    renderWithRouter(<Navigation />);
    const shareBtn = screen.getByRole('button', { name: /Share Workspace Link/i });
    expect(shareBtn).toBeInTheDocument();
    expect(shareBtn).toHaveClass('btn-share-workspace');
  });
});
