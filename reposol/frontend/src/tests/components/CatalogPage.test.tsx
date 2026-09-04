import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CatalogPage } from '../../components/catalog/CatalogPage';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfirmProvider } from '../../components/shared/ui/ConfirmProvider';

const mockSetDoc = vi.fn();
const mockPushUndoRedoState = vi.fn();
const mockSave = vi.fn().mockResolvedValue({});
const mockResetUndoRedo = vi.fn();

let currentDoc: any = null;
let currentIsEditing = false;
let currentEditMode = 'visual';

vi.mock('@hooks/useDocumentLifecycle', () => ({
  useDocumentLifecycle: () => ({
    doc: currentDoc,
    activeDoc: currentDoc,
    setDoc: mockSetDoc,
    isEditing: currentIsEditing,
    editMode: currentEditMode,
    setEditMode: vi.fn((m) => { currentEditMode = m; }),
    pushUndoRedoState: mockPushUndoRedoState,
    resetUndoRedo: mockResetUndoRedo,
    isDirty: false,
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    save: mockSave,
    loading: false,
    saving: false,
    validating: false,
    validationResult: null,
    validate: vi.fn(),
    hasDraft: false,
    handleDeleteDraft: vi.fn(),
    versions: [],
    currentVersion: null,
    inspectedVersion: null,
    handleSelectVersion: vi.fn(),
    handlePublishVersion: vi.fn(),
    handleToggleEdit: vi.fn(),
    markDraftDiscarded: vi.fn(),
    saveDraftTag: vi.fn(),
    saveVersionTag: vi.fn(),
    deleteVersionTag: vi.fn(),
    loadVersions: vi.fn(),
    handleBack: vi.fn()
  }),
}));

vi.mock('@hooks/useDocumentQuery', () => ({
  useDocumentListQuery: () => ({ data: [] }),
  useDocumentQuery: () => ({ data: currentDoc, isLoading: false })
}));

describe('CatalogPage Unit & Action Dispatch Tests (DD-029)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    vi.clearAllMocks();

    currentDoc = {
      catalog: {
        uuid: 'cat-123',
        metadata: {
          title: 'NIST SP 800-53 Rev 5',
          lastModified: '2026-01-01T00:00:00Z',
          version: '1.0',
          oscalVersion: '1.0.0'
        },
        groups: [
          {
            id: 'ac',
            title: 'Access Control',
            controls: [
              { id: 'ac-1', title: 'Policy and Procedures' },
              { id: 'ac-2', title: 'Account Management' }
            ]
          }
        ],
        controls: [
          { id: 'root-1', title: 'Root Control' }
        ]
      }
    };
    currentIsEditing = false;
    currentEditMode = 'visual';
  });

  const renderComponent = (props: any = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ConfirmProvider>
          <BrowserRouter>
            <CatalogPage catalogId="cat-123" onClose={vi.fn()} {...props} />
          </BrowserRouter>
        </ConfirmProvider>
      </QueryClientProvider>
    );
  };

  it('renders catalog title, visual view, and overview in sidebar', () => {
    renderComponent();

    expect(screen.getAllByText('NIST SP 800-53 Rev 5').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Overview').length).toBeGreaterThan(0);
  });

  it('allows switching to JSON Source tab and back', () => {
    renderComponent();

    const jsonTab = screen.getByRole('button', { name: /JSON Source/i });
    expect(jsonTab).toBeInTheDocument();
    fireEvent.click(jsonTab);

    const visualTab = screen.getByRole('button', { name: /Visual/i });
    expect(visualTab).toBeInTheDocument();
    fireEvent.click(visualTab);
  });

  it('selects group from sidebar when clicked', () => {
    renderComponent();

    const groupElements = screen.getAllByText(/Access Control/i);
    expect(groupElements.length).toBeGreaterThan(0);
    fireEvent.click(groupElements[0]);
  });

  it('renders in edit mode and allows selecting overview sections', () => {
    currentIsEditing = true;
    renderComponent();

    const overviewItems = screen.getAllByText('Overview');
    expect(overviewItems.length).toBeGreaterThan(0);
    fireEvent.click(overviewItems[0]);
  });

  it('hides "Load Template / Content" sidebar button when isEditing is false', () => {
    currentIsEditing = false;
    renderComponent();

    expect(screen.queryByTestId('catalog-sidebar-import')).not.toBeInTheDocument();
    expect(screen.queryByText(/Load Template \/ Content/i)).not.toBeInTheDocument();
  });

  it('renders "Load Template / Content" sidebar button when isEditing is true and switches to import view on click', () => {
    currentIsEditing = true;
    renderComponent();

    const importSidebarBtn = screen.getByTestId('catalog-sidebar-import');
    expect(importSidebarBtn).toBeInTheDocument();
    expect(importSidebarBtn).toHaveTextContent('Load Template / Content');

    fireEvent.click(importSidebarBtn);

    expect(screen.getByText(/📥 Load Template \/ Content/i)).toBeInTheDocument();
    expect(screen.getByText(/Your catalog UUID and title will be preserved/i)).toBeInTheDocument();
  });

  it('applies imported content preserving current catalog uuid and title and saving document', async () => {
    currentIsEditing = true;
    const mockRegistry = [
      {
        id: 'nist-source',
        title: 'NIST Catalog',
        description: 'Desc',
        model: 'catalog',
        source: 'nist',
        url: 'https://example.com/nist.json'
      }
    ];
    const parsedCatalog = {
      uuid: 'remote-uuid-999',
      metadata: {
        title: 'Remote Imported Catalog Title',
        version: '2.0.0'
      },
      groups: [{ id: 'imported-group', title: 'Imported Group' }]
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/import/registry/nist-source')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: 'parsed',
            stage: 'catalogs',
            uuid: 'remote-uuid-999',
            title: 'Remote Imported Catalog Title',
            document: { catalog: parsedCatalog }
          })
        });
      }
      if (url.includes('/api/import/registry')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockRegistry
        });
      }
      return Promise.resolve({ ok: false });
    });

    renderComponent();

    const importSidebarBtn = screen.getByTestId('catalog-sidebar-import');
    fireEvent.click(importSidebarBtn);

    // Wait for registry items to load
    await screen.findByText('NIST Catalog');

    // Click Apply Content on the registry item
    const importBtn = screen.getByRole('button', { name: /Apply Content/i });
    fireEvent.click(importBtn);

    // Verify handleApplyContent was invoked:
    await waitFor(() => {
      expect(mockSetDoc).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
      expect(mockResetUndoRedo).toHaveBeenCalled();
    });

    // Check that uuid and title were preserved
    const savedDoc = mockSave.mock.calls[0][0];
    expect(savedDoc.catalog.uuid).toBe('cat-123'); // Original UUID preserved!
    expect(savedDoc.catalog.metadata.title).toBe('NIST SP 800-53 Rev 5'); // Original title preserved!
    expect(savedDoc.catalog.groups).toEqual([{ id: 'imported-group', title: 'Imported Group' }]); // Content updated!
  });

  it('applies imported content unwrapping nested catalog object cleanly', async () => {
    currentIsEditing = true;
    const mockRegistry = [
      {
        id: 'nested-source',
        title: 'Nested Catalog',
        description: 'Desc',
        model: 'catalog',
        source: 'nist',
        url: 'https://example.com/nested.json'
      }
    ];
    // Notice double-nested catalog in response:
    const doubleNestedResponse = {
      catalog: {
        uuid: 'nested-inner-uuid',
        metadata: { title: 'Inner Title' },
        groups: [{ id: 'inner-group', title: 'Inner Family' }]
      }
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/import/registry/nested-source')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: 'parsed',
            stage: 'catalogs',
            uuid: 'nested-inner-uuid',
            title: 'Inner Title',
            document: doubleNestedResponse
          })
        });
      }
      if (url.includes('/api/import/registry')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockRegistry
        });
      }
      return Promise.resolve({ ok: false });
    });

    renderComponent();

    const importSidebarBtn = screen.getByTestId('catalog-sidebar-import');
    fireEvent.click(importSidebarBtn);

    await screen.findByText('Nested Catalog');
    const importBtn = screen.getByRole('button', { name: /Apply Content/i });
    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled();
    });

    const savedDoc = mockSave.mock.calls[0][0];
    expect(savedDoc.catalog).toBeDefined();
    // Ensure it did NOT create a { catalog: { catalog: ... } } double-nesting:
    expect(savedDoc.catalog.catalog).toBeUndefined();
    expect(savedDoc.catalog.uuid).toBe('cat-123');
    expect(savedDoc.catalog.metadata.title).toBe('NIST SP 800-53 Rev 5');
    expect(savedDoc.catalog.groups).toEqual([{ id: 'inner-group', title: 'Inner Family' }]);
  });

  it('renders Load Template / Content button on empty catalog overview and navigates to import view', async () => {
    currentIsEditing = true;
    currentDoc = {
      catalog: {
        uuid: 'empty-cat-123',
        metadata: {
          title: 'Empty Test Catalog',
          version: '1.0.0',
          oscalVersion: '1.0.0'
        },
        groups: [],
        controls: []
      }
    };

    renderComponent();

    const emptyBtn = await screen.findByTestId('empty-catalog-load-template-btn');
    expect(emptyBtn).toBeInTheDocument();
    expect(emptyBtn).toHaveTextContent('Load Template / Content');

    fireEvent.click(emptyBtn);

    expect(screen.getByText(/📥 Load Template \/ Content/i)).toBeInTheDocument();
  });
});
