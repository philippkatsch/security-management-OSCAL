/**
 * Tests for the Layout component.
 * Covers: rendering, health check polling (online/offline/error),
 * children rendering, navigation integration.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfirmProvider } from '@components/shared/ui/ConfirmProvider';
import { Layout } from '@components/layout/Layout';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter>
      <ConfirmProvider>
        {ui}
      </ConfirmProvider>
    </MemoryRouter>
  );
};

describe('Layout', () => {
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
      renderWithRouter(<Layout>Test Content</Layout>);
    });
    expect(screen.getByText('OSCAL Management System')).toBeInTheDocument();
  });

  it('renders children', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    await act(async () => {
      renderWithRouter(<Layout><div>My Child Content</div></Layout>);
    });
    expect(screen.getByText('My Child Content')).toBeInTheDocument();
  });

  it('shows ONLINE status when health check succeeds', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    await act(async () => {
      renderWithRouter(<Layout />);
    });
    expect(screen.getByText('ONLINE')).toBeInTheDocument();
    const badge = document.querySelector('.health-badge');
    expect(badge?.classList.contains('online')).toBe(true);
  });

  it('shows OFFLINE status when health check returns non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ status: 'error' }),
    });
    await act(async () => {
      renderWithRouter(<Layout />);
    });
    expect(screen.getByText('OFFLINE')).toBeInTheDocument();
    const badge = document.querySelector('.health-badge');
    expect(badge?.classList.contains('offline')).toBe(true);
  });

  it('shows OFFLINE status when fetch throws an error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    await act(async () => {
      renderWithRouter(<Layout />);
    });
    expect(screen.getByText('OFFLINE')).toBeInTheDocument();
  });

  it('shows CHECKING status while health check is in progress', () => {
    global.fetch = vi.fn(() => new Promise(() => {})); // Never resolves
    renderWithRouter(<Layout />);
    expect(screen.getByText('CHECKING')).toBeInTheDocument();
  });

  it('renders the backend status label', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    await act(async () => {
      renderWithRouter(<Layout />);
    });
    expect(screen.getByText('Backend Status:')).toBeInTheDocument();
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
      renderWithRouter(<Layout />);
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
    let fetchCallCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      fetchCallCount++;
      return Promise.resolve({ ok: true, json: async () => ({ status: 'ok' }) });
    });

    const { unmount } = await act(async () => renderWithRouter(<Layout />));
    const countAfterMount = fetchCallCount;
    unmount();

    await act(async () => {
      vi.advanceTimersByTime(30000);
    });
    // After unmount, no more fetch calls should occur
    expect(fetchCallCount).toBe(countAfterMount);
  });

  it('renders Navigation with sidebar', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    await act(async () => {
      renderWithRouter(<Layout />);
    });
    // Navigation should render - check for at least one nav element
    expect(document.querySelector('.navigation-sidebar')).toBeInTheDocument();
  });
});
