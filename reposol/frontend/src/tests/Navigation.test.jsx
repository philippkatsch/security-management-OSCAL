/**
 * Tests for the Navigation component.
 * Covers: sidebar collapse/expand, active tab highlighting,
 * tab change callbacks, localStorage persistence, brand click.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Navigation from '../components/Navigation';

describe('Navigation', () => {
  const defaultProps = {
    activeTab: 'catalogs',
    onTabChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders all navigation items', () => {
    render(<Navigation {...defaultProps} />);
    expect(screen.getByText('Catalogs')).toBeInTheDocument();
    expect(screen.getByText('Profiles')).toBeInTheDocument();
    expect(screen.getByText('SSPs')).toBeInTheDocument();
    expect(screen.getByText('Components')).toBeInTheDocument();
    expect(screen.getByText('Assessment Plans')).toBeInTheDocument();
    expect(screen.getByText('Assessment Results')).toBeInTheDocument();
    expect(screen.getByText('POA&Ms')).toBeInTheDocument();
  });

  it('renders the brand name "Reposol"', () => {
    render(<Navigation {...defaultProps} />);
    expect(screen.getByText('Reposol')).toBeInTheDocument();
  });

  it('calls onTabChange when a nav item is clicked', () => {
    const onTabChange = vi.fn();
    render(<Navigation activeTab="catalogs" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByText('Profiles'));
    expect(onTabChange).toHaveBeenCalledWith('profiles');
  });

  it('calls onTabChange("dashboard") when brand logo is clicked', () => {
    const onTabChange = vi.fn();
    render(<Navigation activeTab="catalogs" onTabChange={onTabChange} />);
    // Click the brand area (parent div with class clickable-brand)
    const brandLeft = document.querySelector('.clickable-brand');
    fireEvent.click(brandLeft);
    expect(onTabChange).toHaveBeenCalledWith('dashboard');
  });

  it('highlights the active tab with "active" class', () => {
    render(<Navigation activeTab="profiles" onTabChange={vi.fn()} />);
    const profilesButton = screen.getByRole('button', { name: /Profiles/i });
    expect(profilesButton).toHaveClass('active');
  });

  it('toggling sidebar saves collapsed state to localStorage', () => {
    render(<Navigation {...defaultProps} />);
    const toggleButton = document.querySelector('.btn-sidebar-toggle');
    fireEvent.click(toggleButton);
    expect(localStorage.getItem('sidebar-collapsed')).toBe('true');
    fireEvent.click(toggleButton);
    expect(localStorage.getItem('sidebar-collapsed')).toBe('false');
  });

  it('reads collapsed state from localStorage on mount', () => {
    localStorage.setItem('sidebar-collapsed', 'true');
    render(<Navigation {...defaultProps} />);
    const sidebar = document.querySelector('.navigation-sidebar');
    expect(sidebar.classList.contains('collapsed')).toBe(true);
  });

  it('starts expanded by default when localStorage has no entry', () => {
    render(<Navigation {...defaultProps} />);
    const sidebar = document.querySelector('.navigation-sidebar');
    expect(sidebar.classList.contains('collapsed')).toBe(false);
  });

  it('toggle button has correct title when collapsed', () => {
    localStorage.setItem('sidebar-collapsed', 'true');
    render(<Navigation {...defaultProps} />);
    const toggleButton = document.querySelector('.btn-sidebar-toggle');
    expect(toggleButton.title).toBe('Expand sidebar');
  });

  it('toggle button has correct title when expanded', () => {
    render(<Navigation {...defaultProps} />);
    const toggleButton = document.querySelector('.btn-sidebar-toggle');
    expect(toggleButton.title).toBe('Collapse sidebar');
  });

  it('renders Under Development badges for uncompleted stages', () => {
    render(<Navigation {...defaultProps} />);
    const devBadges = screen.getAllByText('🚧 Dev');
    expect(devBadges.length).toBe(6); // Components, Control Mappings, SSPs, Assessment Plans, Assessment Results, POA&Ms
  });
});

