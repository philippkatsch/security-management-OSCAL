/**
 * Tests for the ImportWizard component.
 * Covers: Registry loading, filtering, searching, importing registry entries,
 * URL tab, custom URL import, example URL clicks, and closing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ImportWizard from '@components/document/ImportWizard';

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
      expect(screen.getByText(/Error importing/i)).toBeInTheDocument();
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
      expect(screen.getByText(/URL Import failed/i)).toBeInTheDocument();
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

  it('embedded mode uses non-persisting import and invokes onApplyContent directly', async () => {
    const onApplyContent = vi.fn();
    const mockCatalogDoc = {
      catalog: {
        uuid: 'nist-uuid-123',
        metadata: { title: 'NIST SP 800-53 Rev 5' },
        groups: [{ id: 'ac', title: 'Access Control' }]
      }
    };
    setupFetchMocks(mockRegistry, {
      status: 'parsed',
      title: 'NIST SP 800-53 Rev 5',
      stage: 'catalogs',
      document: mockCatalogDoc
    });

    await act(async () => {
      render(
        <ImportWizard
          stage="catalogs"
          embedded={true}
          onApplyContent={onApplyContent}
          currentDocument={{ uuid: 'my-catalog-uuid', metadata: { title: 'My Custom Catalog' } }}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('NIST SP 800-53 Rev 5')).toBeInTheDocument();
    });

    const applyButtons = screen.getAllByRole('button', { name: '📥 Apply Content' });
    await act(async () => {
      fireEvent.click(applyButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('✅ Content Applied: "NIST SP 800-53 Rev 5"')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/import/registry/nist-800-53-catalog?persist=false'),
      expect.any(Object)
    );
    expect(onApplyContent).toHaveBeenCalledWith(mockCatalogDoc.catalog);
  });

  it('embedded mode URL import sends persist: false and applies content', async () => {
    const onApplyContent = vi.fn();
    const mockUrlDoc = {
      catalog: {
        uuid: 'url-uuid-456',
        metadata: { title: 'URL Catalog' },
        controls: [{ id: 'ctrl-1', title: 'Control 1' }]
      }
    };
    setupFetchMocks(mockRegistry, {
      status: 'parsed',
      title: 'URL Catalog',
      stage: 'catalogs',
      document: mockUrlDoc
    });

    await act(async () => {
      render(
        <ImportWizard
          stage="catalogs"
          embedded={true}
          onApplyContent={onApplyContent}
          currentDocument={{ uuid: 'my-catalog-uuid', metadata: { title: 'My Custom Catalog' } }}
        />
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/Import from URL/i));
    });

    const input = screen.getByPlaceholderText(/https:\/\/raw.githubusercontent.com/);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'https://example.com/custom.json' } });
    });

    const loadBtn = screen.getByRole('button', { name: '📥 Load & Apply Content' });
    await act(async () => {
      fireEvent.click(loadBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('✅ Content Applied: "URL Catalog"')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/import/url?persist=false'),
      expect.objectContaining({
        body: expect.stringContaining('"persist":false')
      })
    );
    expect(onApplyContent).toHaveBeenCalledWith(mockUrlDoc.catalog);
  });

  it('embedded mode file upload sends persist: false and applies content', async () => {
    const onApplyContent = vi.fn();
    const mockFileDoc = {
      catalog: {
        uuid: 'file-uuid-789',
        metadata: { title: 'File Catalog' },
        controls: [{ id: 'ctrl-file', title: 'File Control' }]
      }
    };
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/import/file')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: 'parsed',
            title: 'File Catalog',
            stage: 'catalogs',
            document: mockFileDoc
          })
        });
      }
      if (url.includes('/api/import/registry')) {
        return Promise.resolve({ ok: true, json: async () => mockRegistry });
      }
      return Promise.resolve({ ok: false });
    });

    await act(async () => {
      render(
        <ImportWizard
          stage="catalogs"
          embedded={true}
          onApplyContent={onApplyContent}
          currentDocument={{ uuid: 'my-catalog-uuid', metadata: { title: 'My Custom Catalog' } }}
        />
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/Upload File/i));
    });

    const file = new File([JSON.stringify(mockFileDoc)], 'catalog.json', { type: 'application/json' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    const uploadBtn = screen.getByRole('button', { name: /Upload & Apply/i });
    await act(async () => {
      fireEvent.click(uploadBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('✅ Content Applied: "File Catalog"')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/import/file?persist=false'),
      expect.any(Object)
    );
    expect(onApplyContent).toHaveBeenCalledWith(mockFileDoc.catalog);
  });

  it('embedded mode rejects stage mismatch when imported document does not match active stage', async () => {
    const onApplyContent = vi.fn();
    setupFetchMocks(mockRegistry, {
      status: 'parsed',
      title: 'Wrong Model Profile',
      stage: 'profiles', // stage mismatch: expected catalogs, got profiles!
      document: {
        profile: {
          uuid: 'prof-uuid',
          metadata: { title: 'Wrong Model Profile' }
        }
      }
    });

    await act(async () => {
      render(
        <ImportWizard
          stage="catalogs"
          embedded={true}
          onApplyContent={onApplyContent}
          currentDocument={{ uuid: 'my-catalog-uuid', metadata: { title: 'My Catalog' } }}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('NIST SP 800-53 Rev 5')).toBeInTheDocument();
    });

    const applyButtons = screen.getAllByRole('button', { name: '📥 Apply Content' });
    await act(async () => {
      fireEvent.click(applyButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText(/Cannot apply a profiles document to a catalogs document/i)).toBeInTheDocument();
    });

    expect(onApplyContent).not.toHaveBeenCalled();
  });

  it('embedded mode handles onApplyContent rejection without showing false success or calling onImported', async () => {
    const onApplyContent = vi.fn().mockRejectedValue(new Error('Backend save failed'));
    const onImported = vi.fn();
    const mockCatalogDoc = {
      catalog: {
        uuid: 'cat-fail',
        metadata: { title: 'Fail Catalog' }
      }
    };
    setupFetchMocks(mockRegistry, {
      status: 'parsed',
      title: 'Fail Catalog',
      stage: 'catalogs',
      document: mockCatalogDoc
    });

    await act(async () => {
      render(
        <ImportWizard
          stage="catalogs"
          embedded={true}
          onApplyContent={onApplyContent}
          onImported={onImported}
          currentDocument={{ uuid: 'my-catalog-uuid', metadata: { title: 'My Custom Catalog' } }}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('NIST SP 800-53 Rev 5')).toBeInTheDocument();
    });

    const applyButtons = screen.getAllByRole('button', { name: '📥 Apply Content' });
    await act(async () => {
      fireEvent.click(applyButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText(/Backend save failed/i)).toBeInTheDocument();
    });

    // Verify false success is NOT shown and onImported is NOT called
    expect(screen.queryByText(/✅ Content Applied/i)).not.toBeInTheDocument();
    expect(onImported).not.toHaveBeenCalled();
  });

  it('renders as modal dialog with role="dialog" and aria-modal="true" and closes on Escape', async () => {
    const onClose = vi.fn();
    setupFetchMocks(mockRegistry);

    await act(async () => {
      render(<ImportWizard stage="catalogs" onClose={onClose} />);
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.className).toContain('editor-overlay');

    // Press Escape key
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes modal when clicking directly on overlay backdrop', async () => {
    const onClose = vi.fn();
    setupFetchMocks(mockRegistry);

    await act(async () => {
      render(<ImportWizard stage="catalogs" onClose={onClose} />);
    });

    const dialog = screen.getByRole('dialog');
    // Click on the backdrop (dialog itself)
    await act(async () => {
      fireEvent.click(dialog);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('imports a registry entry that already exists (already_exists status)', async () => {
    const onImported = vi.fn();
    setupFetchMocks(mockRegistry, {
      status: 'already_exists',
      title: 'NIST SP 800-53 Rev 5',
      version: '5.2.0',
      stage: 'catalogs',
    });
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
      expect(screen.getByText('ℹ️ Already imported: "NIST SP 800-53 Rev 5" (Version 5.2.0)')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '✓ Up to date' })).toBeInTheDocument();
  });

  it('handles URL import with already_exists status', async () => {
    const onImported = vi.fn();
    setupFetchMocks(mockRegistry, {
      status: 'already_exists',
      title: 'NIST SP 800-53 Rev 5',
      version: '5.2.0',
      stage: 'catalogs',
    });
    await act(async () => {
      render(<ImportWizard stage="catalogs" onImported={onImported} onClose={vi.fn()} />);
    });

    const urlTab = screen.getByText(/Import from URL/i);
    await act(async () => {
      fireEvent.click(urlTab);
    });

    const input = screen.getByPlaceholderText(/https:\/\/raw.githubusercontent.com/);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'https://test.com/catalog.json' } });
    });

    const importBtn = screen.getByRole('button', { name: '📥 Import' });
    await act(async () => {
      fireEvent.click(importBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/ℹ️ Already imported: "NIST SP 800-53 Rev 5" \(catalogs\) — Version 5.2.0 is already present/i)).toBeInTheDocument();
    });
  });

  it('handles URL import with duplicate title warning for modified content', async () => {
    const onImported = vi.fn();
    setupFetchMocks(mockRegistry, {
      status: 'created',
      title: 'Existing Profile Name',
      stage: 'profiles',
      uuid: 'new-uuid-12345678',
      same_title_existing: {
        uuid: 'old-uuid-87654321',
        title: 'Existing Profile Name',
        version: '1.0.0',
        identical_content: false,
      },
    });
    await act(async () => {
      render(<ImportWizard stage="profiles" onImported={onImported} onClose={vi.fn()} />);
    });

    const urlTab = screen.getByText(/Import from URL/i);
    await act(async () => {
      fireEvent.click(urlTab);
    });

    const input = screen.getByPlaceholderText(/https:\/\/raw.githubusercontent.com/);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'https://test.com/profile.json' } });
    });

    const importBtn = screen.getByRole('button', { name: '📥 Import' });
    await act(async () => {
      fireEvent.click(importBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/⚠️ Imported: "Existing Profile Name" \(profiles\) — Note: Another document with this title already exists/i)).toBeInTheDocument();
    });
  });

  it('renders profile presets in URL tab when stage is profiles', async () => {
    setupFetchMocks(mockRegistry);
    await act(async () => {
      render(<ImportWizard stage="profiles" onClose={vi.fn()} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/Import from URL/i));
    });

    expect(screen.getByText('Standard Profile Presets (Click to load)')).toBeInTheDocument();
    expect(screen.getByText('NIST SP 800-53 Rev 5 — LOW Baseline Profile')).toBeInTheDocument();
    expect(screen.getByText('NIST SP 800-53 Rev 5 — MODERATE Baseline Profile')).toBeInTheDocument();
    expect(screen.getByText('NIST SP 800-53 Rev 5 — HIGH Baseline Profile')).toBeInTheDocument();
  });

  it('renders SSP and POA&M presets in URL tab when stage is ssps or poams', async () => {
    setupFetchMocks(mockRegistry);
    let unmountFn: () => void = () => {};
    await act(async () => {
      const res = render(<ImportWizard stage="ssps" onClose={vi.fn()} />);
      unmountFn = res.unmount;
    });
    await act(async () => {
      fireEvent.click(screen.getByText(/Import from URL/i));
    });
    expect(screen.getByText('Standard System Security Plan Presets (Click to load)')).toBeInTheDocument();
    expect(screen.getByText('NIST OSCAL Example System Security Plan')).toBeInTheDocument();
    unmountFn();

    await act(async () => {
      render(<ImportWizard stage="poams" onClose={vi.fn()} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByText(/Import from URL/i));
    });
    expect(screen.getByText('Standard POA&M Presets (Click to load)')).toBeInTheDocument();
    expect(screen.getByText('NIST OSCAL Example Plan of Action and Milestones')).toBeInTheDocument();
  });

  it('handles URL import with content_updated action showing warning banner', async () => {
    const onImported = vi.fn();
    setupFetchMocks(mockRegistry, {
      status: 'updated',
      action: 'content_updated',
      title: 'Modified Local Profile',
      version: '1.0.0',
      existing_version: '1.0.0',
      stage: 'profiles',
    });
    await act(async () => {
      render(<ImportWizard stage="profiles" onImported={onImported} onClose={vi.fn()} />);
    });

    fireEvent.click(screen.getByText(/Import from URL/i));
    const input = screen.getByPlaceholderText(/https:\/\/raw.githubusercontent.com/);
    fireEvent.change(input, { target: { value: 'https://test.com/profile.json' } });
    fireEvent.click(screen.getByRole('button', { name: '📥 Import' }));

    await waitFor(() => {
      expect(screen.getByText(/⚠️ Re-imported: "Modified Local Profile" \(profiles\) — Existing document was locally modified; updated with imported content./i)).toBeInTheDocument();
    });
  });
});
