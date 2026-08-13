/**
 * Tests for the App component routing and integration.
 * Covers: App mounting, router integration, Layout rendering,
 * and Dashboard rendering under RouterProvider.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Outlet } from 'react-router-dom';
import App from '../../App';

vi.mock('../../components/layout/Layout', () => ({
  Layout: () => (
    <div data-testid="layout" data-active-tab="dashboard">
      <Outlet />
    </div>
  ),
}));

function mockFetchSuccess(data: any[] = []) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/health')) {
      return Promise.resolve({ ok: true, json: async () => ({ status: 'ok' }) });
    }
    if (url.includes('/api/documents')) {
      return Promise.resolve({ ok: true, json: async () => data });
    }
    return Promise.resolve({ ok: false });
  });
}

describe('App Integration & Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchSuccess([]);
    window.history.replaceState(null, '', '/');
  });

  it('renders without crashing and displays layout', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });

  it('renders dashboard welcome banner when at root path', async () => {
    window.history.replaceState(null, '', '/');
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText('Welcome to Reposol')).toBeInTheDocument();
  });

  it('renders dashboard quick guide section', async () => {
    window.history.replaceState(null, '', '/');
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText('Quick Guide: The OSCAL Lifecycle')).toBeInTheDocument();
  });
});
