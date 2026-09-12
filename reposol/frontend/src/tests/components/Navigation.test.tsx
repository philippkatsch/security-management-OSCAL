/**
 * Tests for the Navigation component.
 * Covers: sidebar collapse/expand, active tab highlighting,
 * localStorage persistence, brand click, router integration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfirmProvider } from '@components/shared/ui/ConfirmProvider';
import Navigation from '@components/layout/Navigation';

const renderWithRouter = (ui: React.ReactElement, initialEntries = ['/catalogs']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ConfirmProvider>
        {ui}
      </ConfirmProvider>
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
    expect(screen.getByText('Components')).toBeInTheDocument();
    expect(screen.getByText('SSPs')).toBeInTheDocument();
    expect(screen.getByText('Assessment Plans')).toBeInTheDocument();
    expect(screen.getByText('Assessment Results')).toBeInTheDocument();
    expect(screen.getByText('POA&Ms')).toBeInTheDocument();
    expect(screen.getByText('Control Mappings')).toBeInTheDocument();
    expect(screen.getByText('Traceability')).toBeInTheDocument();
  });

  it('renders navigation section titles including Tools & Crosswalks', () => {
    renderWithRouter(<Navigation />);
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Design & Tailor' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Implement' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Assess & Audit' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tools & Crosswalks' })).toBeInTheDocument();
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

  it('renders Option A navigation grouping with correct items per section', () => {
    renderWithRouter(<Navigation />);

    // Design & Tailor: Catalogs, Profiles
    const designHeading = screen.getByRole('heading', { name: 'Design & Tailor' });
    const designSection = designHeading.closest('div');
    expect(designSection).toHaveTextContent('Catalogs');
    expect(designSection).toHaveTextContent('Profiles');
    expect(designSection).not.toHaveTextContent('Components');
    expect(designSection).not.toHaveTextContent('Control Mappings');

    // Implement: Components, SSPs
    const implementHeading = screen.getByRole('heading', { name: 'Implement' });
    const implementSection = implementHeading.closest('div');
    expect(implementSection).toHaveTextContent('Components');
    expect(implementSection).toHaveTextContent('SSPs');
    expect(implementSection).not.toHaveTextContent('Catalogs');

    // Assess & Audit: Assessment Plans, Assessment Results, POA&Ms
    const assessHeading = screen.getByRole('heading', { name: 'Assess & Audit' });
    const assessSection = assessHeading.closest('div');
    expect(assessSection).toHaveTextContent('Assessment Plans');
    expect(assessSection).toHaveTextContent('Assessment Results');
    expect(assessSection).toHaveTextContent('POA&Ms');
    expect(assessSection).not.toHaveTextContent('Traceability');

    // Tools & Crosswalks: Control Mappings, Traceability
    const toolsHeading = screen.getByRole('heading', { name: 'Tools & Crosswalks' });
    const toolsSection = toolsHeading.closest('div');
    expect(toolsSection).toHaveTextContent('Control Mappings');
    expect(toolsSection).toHaveTextContent('Traceability');
    expect(toolsSection).not.toHaveTextContent('SSPs');
  });

  it('renders Under Development badges for stages 3 to 8 in development', () => {
    renderWithRouter(<Navigation />);
    const devBadges = screen.getAllByText('🚧 Dev');
    expect(devBadges.length).toBe(6);

    const devItems = ['Components', 'SSPs', 'Assessment Plans', 'Assessment Results', 'POA&Ms', 'Control Mappings'];
    for (const name of devItems) {
      const button = screen.getByRole('button', { name: new RegExp(name, 'i') });
      expect(button).toHaveTextContent('🚧 Dev');
    }

    const stableItems = ['Catalogs', 'Profiles', 'Traceability'];
    for (const name of stableItems) {
      const button = screen.getByRole('button', { name: new RegExp(name, 'i') });
      expect(button).not.toHaveTextContent('🚧 Dev');
    }
  });

  it('renders share workspace button with btn-share-workspace class', () => {
    renderWithRouter(<Navigation />);
    const shareBtn = screen.getByRole('button', { name: /Share Workspace Link/i });
    expect(shareBtn).toBeInTheDocument();
    expect(shareBtn).toHaveClass('btn-share-workspace');
  });

  it('sets appropriate title attributes for dev items in both expanded and collapsed modes', () => {
    // 1. Expanded mode
    const { unmount } = renderWithRouter(<Navigation />);
    const expandedDevBtn = screen.getByRole('button', { name: /Components/i });
    const expandedStableBtn = screen.getByRole('button', { name: /Catalogs/i });
    expect(expandedDevBtn.title).toBe('Under Active Development');
    expect(expandedStableBtn.title).toBe('');
    unmount();

    // 2. Collapsed mode
    localStorage.setItem('sidebar-collapsed', 'true');
    renderWithRouter(<Navigation />);
    const collapsedDevBtn = screen.getByRole('button', { name: /Components/i });
    const collapsedStableBtn = screen.getByRole('button', { name: /Catalogs/i });
    expect(collapsedDevBtn.title).toBe('Components (0) - Under Active Development');
    expect(collapsedStableBtn.title).toBe('Catalogs (0)');
  });
});
