import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfilePage } from '../../components/profile/ProfilePage';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfirmProvider } from '../../components/shared/ui/ConfirmProvider';

const mockSetDoc = vi.fn();
const mockPushUndoRedoState = vi.fn();

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
    isDirty: false,
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    save: vi.fn(),
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

vi.mock('@hooks/useProfileResolution', () => ({
  useProfileResolution: () => ({
    resolvedCatalog: {
      uuid: 'resolved-cat',
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          controls: [
            { id: 'ac-1', title: 'Policy & Procedures' }
          ]
        }
      ],
      controls: []
    },
    resolving: false,
    error: null,
    resolve: vi.fn(),
    conflicts: { has_conflicts: false, orphaned_alters: [], orphaned_params: [], orphaned_custom_refs: [] },
    findOriginalControl: (id: string) => ({ id, title: 'Policy & Procedures' }),
    previewResolve: vi.fn(),
    clearCache: vi.fn()
  })
}));

describe('ProfilePage Unit & Action Dispatch Tests (DD-029)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    vi.clearAllMocks();

    currentDoc = {
      profile: {
        uuid: 'prof-123',
        metadata: {
          title: 'FedRAMP Moderate Baseline Profile',
          lastModified: '2026-01-01T00:00:00Z',
          version: '1.0',
          oscalVersion: '1.0.0'
        },
        imports: [
          {
            href: '#cat-123',
            'include-all': {}
          }
        ],
        merge: {
          custom: {
            groups: [
              {
                id: 'custom-grp-1',
                title: 'Custom Core Group',
                controls: []
              }
            ]
          }
        }
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
            <ProfilePage profileId="prof-123" onClose={vi.fn()} {...props} />
          </BrowserRouter>
        </ConfirmProvider>
      </QueryClientProvider>
    );
  };

  it('renders profile title, overview, and sidebar navigation items', () => {
    renderComponent();

    expect(screen.getAllByText('FedRAMP Moderate Baseline Profile').length).toBeGreaterThan(0);
    expect(screen.getByTestId('profile-sidebar-imports')).toBeInTheDocument();
    expect(screen.getByTestId('profile-sidebar-overview')).toBeInTheDocument();
  });

  it('allows selecting sidebar imports view', () => {
    renderComponent();

    const importsItem = screen.getByTestId('profile-sidebar-imports');
    expect(importsItem).toBeInTheDocument();
    fireEvent.click(importsItem);
  });

  it('allows switching between visual and JSON source tabs', () => {
    renderComponent();

    const jsonTab = screen.getByRole('button', { name: /JSON Source/i });
    expect(jsonTab).toBeInTheDocument();
    fireEvent.click(jsonTab);

    const visualTab = screen.getByRole('button', { name: /Visual/i });
    expect(visualTab).toBeInTheDocument();
    fireEvent.click(visualTab);
  });

  it('renders in edit mode and allows interacting with overview', () => {
    currentIsEditing = true;
    renderComponent();

    const overviewItem = screen.getByTestId('profile-sidebar-overview');
    expect(overviewItem).toBeInTheDocument();
    fireEvent.click(overviewItem);
  });
});
