/**
 * Tests for the ImportWizard component.
 * Covers: Registry loading, filtering, searching, importing registry entries,
 * URL tab, custom URL import, example URL clicks, and closing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ImportWizard from '../components/ImportWizard';

const mockRegistry = [
  {
    id: 'nist-800-53-catalog',
    title: 'NIST SP 800-53 Rev 5',
    description: 'NIST 800-53 catalog details',
    model: 'catalog',
    source: 'nist',
    url: 'https://example.com/nist-catalog.json',
  },
  {
    id: 'nist-moderate-profile',
    title: 'NIST Moderate Profile',
    description: 'Moderate baseline profile description',
    model: 'profile',
    source: 'nist',
    url: 'https://example.com/nist-moderate.json',
  },
  {
    id: 'sample-ssp',
    title: 'Sample SSP',
    description: 'Sample system security plan',
    model: 'ssp',
    source: 'sample',
    url: 'https://example.com/ssp.json',
  },
];

function setupFetchMocks(registryData = mockRegistry, importResponse = { status: 'created', title: 'Imported Doc', stage: 'catalogs' }, ok = true) {
  global.fetch = vi.fn().mockImplementation((url, options) => {
    if (url.includes('/api/import/registry/')) {
      return Promise.resolve({
        ok,
        json: async () => ok ? importResponse : { detail: 'Error importing' },
      });
    }
    if (url.includes('/api/import/url')) {
      return Promise.resolve({
        ok,
        json: async () => ok ? importResponse : { detail: 'URL Import failed' },
      });
    }
    if (url.includes('/api/import/registry')) {
      return Promise.resolve({
        ok: true,
        json: async () => registryData,
      });
    }
    return Promise.resolve({ ok: false });
  });
}

describe('ImportWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders and fetches registry on mount', async () => {
    setupFetchMocks();
    await act(async () => {
      render(<ImportWizard stage="dashboard" onImported={vi.fn()} onClose={vi.fn()} />);
    });
    await waitFor(() => {
      expect(screen.getByText('NIST SP 800-53 Rev 5')).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/import/registry', expect.any(Object));
  });

  it('filters list by stage and search input', async () => {
    setupFetchMocks();
    await act(async () => {
      render(<ImportWizard stage="dashboard" onImported={vi.fn()} onClose={vi.fn()} />);
    });
    await waitFor(() => {
      expect(screen.getByText('NIST SP 800-53 Rev 5')).toBeInTheDocument();
    });

    // Search for "Moderate"
    const searchInput = screen.getByPlaceholderText('Search by title or description…');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Moderate' } });
    });
    expect(screen.queryByText('NIST SP 800-53 Rev 5')).not.toBeInTheDocument();
    expect(screen.getByText('NIST Moderate Profile')).toBeInTheDocument();

    // Click "ssp" chip
    const sspChip = screen.getByText(/ssp/i);
    await act(async () => {
      fireEvent.click(sspChip);
    });
    // Search is still "Moderate", and SSP doesn't match
    expect(screen.queryByText('Sample SSP')).not.toBeInTheDocument();
    // Clear search
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: '' } });
    });
    expect(screen.getByText('Sample SSP')).toBeInTheDocument();
  });

  it('imports a registry entry successfully (created)', async () => {
    const onImported = vi.fn();
    setupFetchMocks(mockRegistry, { status: 'created', title: 'NIST SP 800-53 Rev 5', stage: 'catalogs' });
    await act(async () => {
      render(<ImportWizard stage="dashboard" onImported={onImported} onClose={vi.fn()} />);
    });
    await waitFor(() => {
      expect(screen.getByText('NIST SP 800-53 Rev 5')).toBeInTheDocument();
    });

    const importButtons = screen.getAllByRole('button', { name: 'Import' });
    await act(async () => {
      fireEvent.click(importButtons[0]); // NIST SP 800-53 Rev 5
    });

    await waitFor(() => {
      expect(screen.getByText('✅ Imported: "NIST SP 800-53 Rev 5"')).toBeInTheDocument();
    });
    expect(onImported).toHaveBeenCalledWith('catalogs');
  });

  it('imports a registry entry successfully (updated)', async () => {
    const onImported = vi.fn();
    setupFetchMocks(mockRegistry, { status: 'updated', title: 'NIST SP 800-53 Rev 5', stage: 'catalogs' });
    await act(async () => {
      render(<ImportWizard stage="dashboard" onImported={onImported} onClose={vi.fn()} />);
    });
    await waitFor(() => {
      expect(screen.getByText('NIST SP 800-53 Rev 5')).toBeInTheDocument();
    });

    const importButtons = screen.getAllByRole('button', { name: 'Import' });
    await act(async () => {
      fireEvent.click(importButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('🔄 Updated: "NIST SP 800-53 Rev 5"')).toBeInTheDocument();
    });
  });

  it('handles registry import API failure', async () => {
    setupFetchMocks(mockRegistry, {}, false);
    await act(async () => {
      render(<ImportWizard stage="dashboard" onImported={vi.fn()} onClose={vi.fn()} />);
    });
    await waitFor(() => {
      expect(screen.getByText('NIST SP 800-53 Rev 5')).toBeInTheDocument();
    });

    const importButtons = screen.getAllByRole('button', { name: 'Import' });
    await act(async () => {
      fireEvent.click(importButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('❌ Error importing')).toBeInTheDocument();
    });
  });

  it('handles registry import network error', async () => {
    setupFetchMocks();
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/import/registry/')) {
        return Promise.reject(new Error('Connection failure'));
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockRegistry,
      });
    });

    await act(async () => {
      render(<ImportWizard stage="dashboard" onImported={vi.fn()} onClose={vi.fn()} />);
    });
    await waitFor(() => {
      expect(screen.getByText('NIST SP 800-53 Rev 5')).toBeInTheDocument();
    });

    const importButtons = screen.getAllByRole('button', { name: 'Import' });
    await act(async () => {
      fireEvent.click(importButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('❌ Network error: Connection failure')).toBeInTheDocument();
    });
  });

  it('switches tabs and performs URL import', async () => {
    const onImported = vi.fn();
    setupFetchMocks(mockRegistry, { status: 'created', title: 'Custom Catalog', stage: 'catalogs' });
    await act(async () => {
      render(<ImportWizard stage="dashboard" onImported={onImported} onClose={vi.fn()} />);
    });

    const urlTab = screen.getByText(/Import from URL/i);
    await act(async () => {
      fireEvent.click(urlTab);
    });

    expect(screen.getByText('Document URL')).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/https:\/\/raw.githubusercontent.com/);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'https://test.com/doc.json' } });
    });

    const importBtn = screen.getByRole('button', { name: '📥 Import' });
    await act(async () => {
      fireEvent.click(importBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('✅ Imported: "Custom Catalog" (catalogs)')).toBeInTheDocument();
    });
    expect(onImported).toHaveBeenCalledWith('catalogs');
  });

  it('clicks example URLs to populate input', async () => {
    setupFetchMocks();
    await act(async () => {
      render(<ImportWizard stage="dashboard" onImported={vi.fn()} onClose={vi.fn()} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/Import from URL/i));
    });

    const exampleBtn = screen.getByText('NIST SP 800-53 Rev5 Catalog');
    await act(async () => {
      fireEvent.click(exampleBtn);
    });

    const input = screen.getByPlaceholderText(/https:\/\/raw.githubusercontent.com/);
    expect(input.value).toContain('NIST_SP-800-53_rev5_catalog.json');
  });

  it('handles URL import failures', async () => {
    setupFetchMocks(mockRegistry, {}, false);
    await act(async () => {
      render(<ImportWizard stage="dashboard" onImported={vi.fn()} onClose={vi.fn()} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/Import from URL/i));
    });

    const input = screen.getByPlaceholderText(/https:\/\/raw.githubusercontent.com/);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'https://test.com/fail.json' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '📥 Import' }));
    });

    await waitFor(() => {
      expect(screen.getByText('❌ URL Import failed')).toBeInTheDocument();
    });
  });

  it('handles URL import network errors', async () => {
    setupFetchMocks();
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/import/url')) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    await act(async () => {
      render(<ImportWizard stage="dashboard" onImported={vi.fn()} onClose={vi.fn()} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/Import from URL/i));
    });

    const input = screen.getByPlaceholderText(/https:\/\/raw.githubusercontent.com/);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'https://test.com/net-error.json' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '📥 Import' }));
    });

    await waitFor(() => {
      expect(screen.getByText('❌ Network error: Network error')).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    setupFetchMocks();
    await act(async () => {
      render(<ImportWizard stage="dashboard" onImported={vi.fn()} onClose={onClose} />);
    });

    const closeBtn = screen.getByText('✕');
    await act(async () => {
      fireEvent.click(closeBtn);
    });
    expect(onClose).toHaveBeenCalled();
  });
});
