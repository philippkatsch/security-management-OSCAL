/**
 * Tests for the Layout component.
 * Covers: rendering, health check polling (online/offline/error),
 * noPadding prop, children rendering, navigation integration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import Layout from '../components/Layout';

describe('Layout', () => {
  const defaultProps = {
    activeTab: 'catalogs',
    onTabChange: vi.fn(),
    noPadding: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the OSCAL Management System title', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    await act(async () => {
      render(<Layout {...defaultProps}>Test Content</Layout>);
    });
    expect(screen.getByText('OSCAL Management System')).toBeInTheDocument();
  });

  it('renders children', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    await act(async () => {
      render(<Layout {...defaultProps}><div>My Child Content</div></Layout>);
    });
    expect(screen.getByText('My Child Content')).toBeInTheDocument();
  });

  it('shows ONLINE status when health check succeeds', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    await act(async () => {
      render(<Layout {...defaultProps} />);
    });
    expect(screen.getByText('ONLINE')).toBeInTheDocument();
    const badge = document.querySelector('.health-badge');
    expect(badge.classList.contains('online')).toBe(true);
  });

  it('shows OFFLINE status when health check returns non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ status: 'error' }),
    });
    await act(async () => {
      render(<Layout {...defaultProps} />);
    });
    expect(screen.getByText('OFFLINE')).toBeInTheDocument();
    const badge = document.querySelector('.health-badge');
    expect(badge.classList.contains('offline')).toBe(true);
  });

  it('shows OFFLINE status when fetch throws an error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    await act(async () => {
      render(<Layout {...defaultProps} />);
    });
    expect(screen.getByText('OFFLINE')).toBeInTheDocument();
  });

  it('shows CHECKING status while health check is in progress', () => {
    global.fetch = vi.fn(() => new Promise(() => {})); // Never resolves
    render(<Layout {...defaultProps} />);
    expect(screen.getByText('CHECKING')).toBeInTheDocument();
  });

  it('renders the backend status label', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    await act(async () => {
      render(<Layout {...defaultProps} />);
    });
    expect(screen.getByText('Backend Status:')).toBeInTheDocument();
  });

  it('applies no-padding class when noPadding=true', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    await act(async () => {
      render(<Layout {...defaultProps} noPadding={true} />);
    });
    const main = document.querySelector('.content-body');
    expect(main.classList.contains('no-padding')).toBe(true);
  });

  it('does not apply no-padding class when noPadding=false', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    await act(async () => {
      render(<Layout {...defaultProps} noPadding={false} />);
    });
    const main = document.querySelector('.content-body');
    expect(main.classList.contains('no-padding')).toBe(false);
  });

  it('polls health every 10 seconds', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        json: async () => ({ status: 'ok' }),
      });
    });

    await act(async () => {
      render(<Layout {...defaultProps} />);
    });
    expect(callCount).toBe(1);

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(callCount).toBe(2);

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(callCount).toBe(3);
  });

  it('cleans up interval on unmount', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    let fetchCallCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      fetchCallCount++;
      return Promise.resolve({ ok: true, json: async () => ({ status: 'ok' }) });
    });

    const { unmount } = await act(async () => render(<Layout {...defaultProps} />));
    const countAfterMount = fetchCallCount;
    unmount();

    await act(async () => {
      vi.advanceTimersByTime(30000);
    });
    // After unmount, no more fetch calls should occur
    expect(fetchCallCount).toBe(countAfterMount);
  });

  it('renders Navigation with active tab', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    await act(async () => {
      render(<Layout {...defaultProps} activeTab="profiles" />);
    });
    // Navigation should render - check for at least one nav element
    expect(document.querySelector('.navigation-sidebar')).toBeInTheDocument();
  });
});
