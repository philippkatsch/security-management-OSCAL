import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfirmProvider } from '../../components/shared/ui/ConfirmProvider';

// Components under test
import { ProfilePage } from '../../components/profile/ProfilePage';
import CdefImportModal from '../../components/ssp/drawers/CdefImportModal';
import { ARFindingsImportModal } from '../../components/poam/ARFindingsImportModal';
import { SSPBrowserModal } from '../../components/assessment-plan/SSPBrowserModal';
import { APBrowserModal } from '../../components/assessment-results/modals/APBrowserModal';

// Mocks
import * as api from '../../lib/api';
import * as queryHooks from '../../hooks/useDocumentQuery';

vi.mock('../../lib/api', () => ({
  authFetch: vi.fn(),
  fetchDocument: vi.fn(),
  fetchDocuments: vi.fn(),
  generateUUID: () => 'mock-generated-uuid-001',
}));

vi.mock('../../hooks/useDocumentQuery', () => ({
  useDocumentListQuery: vi.fn(),
  useDocumentQuery: vi.fn(),
}));

vi.mock('../../hooks/useProfileResolution', () => ({
  useProfileResolution: () => ({
    resolvedCatalog: { uuid: 'resolved-cat', groups: [], controls: [] },
    resolving: false,
    error: null,
    resolve: vi.fn(),
    conflicts: { has_conflicts: false, orphaned_alters: [], orphaned_params: [], orphaned_custom_refs: [] },
    findOriginalControl: (id: string) => ({ id, title: 'Mock Control' }),
    previewResolve: vi.fn(),
    clearCache: vi.fn(),
  }),
}));

const mockSetDoc = vi.fn();
const mockResetUndoRedo = vi.fn();
const mockPushUndoRedoState = vi.fn();
let currentDoc: any = null;

vi.mock('../../hooks/useDocumentLifecycle', () => ({
  useDocumentLifecycle: () => ({
    doc: currentDoc,
    activeDoc: currentDoc,
    setDoc: mockSetDoc,
    isEditing: true,
    editMode: 'visual',
    setEditMode: vi.fn(),
    pushUndoRedoState: mockPushUndoRedoState,
    resetUndoRedo: mockResetUndoRedo,
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
    handleBack: vi.fn(),
  }),
}));

describe('Bug Fixes 1–5 Verification Suite', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    (queryHooks.useDocumentListQuery as any).mockReturnValue({ data: [] });
    (queryHooks.useDocumentQuery as any).mockReturnValue({ data: null, isLoading: false });
  });

  // --- Bug #1: ProfilePage Migration & Synchronization ---
  describe('Bug #1: ProfilePage Auto-migration Synchronization', () => {
    it('migrates #placeholder import and missing merge while synchronizing history via resetUndoRedo', () => {
      currentDoc = {
        profile: {
          uuid: 'prof-loop-test',
          metadata: { title: 'Unmigrated Profile' },
          imports: [
            { href: '#placeholder' },
            { href: '#cat-real-catalog', 'include-all': {} },
          ],
        },
      };

      render(
        <QueryClientProvider client={queryClient}>
          <ConfirmProvider>
            <BrowserRouter>
              <ProfilePage profileId="prof-loop-test" onClose={vi.fn()} />
            </BrowserRouter>
          </ConfirmProvider>
        </QueryClientProvider>
      );

      // Verify setDoc was called with stripped #placeholder and initialized merge
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      const updatedDoc = mockSetDoc.mock.calls[0][0];
      expect(updatedDoc.profile.merge).toEqual({ 'as-is': true });
      expect(updatedDoc.profile.imports).toEqual([
        { href: '#cat-real-catalog', 'include-all': {} },
      ]);

      // Critical: resetUndoRedo must be called with the exact same updated document
      // to synchronize history.activeDoc and avoid infinite loop
      expect(mockResetUndoRedo).toHaveBeenCalledTimes(1);
      expect(mockResetUndoRedo).toHaveBeenCalledWith(updatedDoc);
    });

    it('does not trigger migration if profile already has valid merge and no placeholder', () => {
      currentDoc = {
        profile: {
          uuid: 'prof-valid',
          metadata: { title: 'Valid Profile' },
          imports: [{ href: '#cat-real-catalog' }],
          merge: { 'as-is': true },
        },
      };

      render(
        <QueryClientProvider client={queryClient}>
          <ConfirmProvider>
            <BrowserRouter>
              <ProfilePage profileId="prof-valid" onClose={vi.fn()} />
            </BrowserRouter>
          </ConfirmProvider>
        </QueryClientProvider>
      );

      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(mockResetUndoRedo).not.toHaveBeenCalled();
    });
  });

  // --- Bug #2: CdefImportModal Envelope Key Unwrapping ---
  describe('Bug #2: CdefImportModal Envelope Key Unwrapping', () => {
    it('correctly unwraps backend OSCAL envelope and extracts uuid and title', async () => {
      const mockCdefsResponse = [
        {
          'component-definition': {
            uuid: 'cdef-uuid-abc-123',
            metadata: {
              title: 'PostgreSQL Enterprise Component Definition',
            },
          },
        },
      ];

      const mockSingleCdefDoc = {
        'component-definition': {
          uuid: 'cdef-uuid-abc-123',
          metadata: { title: 'PostgreSQL Enterprise Component Definition' },
          components: [
            {
              uuid: 'comp-uuid-db-001',
              title: 'PostgreSQL Relational DB',
              type: 'service',
            },
          ],
        },
      };

      (api.authFetch as any).mockImplementation(async (url: string) => {
        if (url === '/api/documents/component-definitions') {
          return { ok: true, json: async () => mockCdefsResponse };
        }
        if (url === '/api/documents/component-definitions/cdef-uuid-abc-123') {
          return { ok: true, json: async () => mockSingleCdefDoc };
        }
        return { ok: false, status: 400 };
      });

      render(
        <CdefImportModal
          isOpen={true}
          onClose={vi.fn()}
          onImportComponents={vi.fn()}
        />
      );

      // Wait for options to populate
      await waitFor(() => {
        expect(
          screen.getByRole('option', { name: 'PostgreSQL Enterprise Component Definition' })
        ).toBeInTheDocument();
      });

      const option = screen.getByRole('option', {
        name: 'PostgreSQL Enterprise Component Definition',
      }) as HTMLOptionElement;
      expect(option.value).toBe('cdef-uuid-abc-123');

      // Select this option and ensure the detailed doc is requested with the correct UUID
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'cdef-uuid-abc-123' } });

      await waitFor(() => {
        expect(api.authFetch).toHaveBeenCalledWith(
          '/api/documents/component-definitions/cdef-uuid-abc-123'
        );
        expect(screen.getByText('PostgreSQL Relational DB')).toBeInTheDocument();
      });
    });
  });

  // --- Bug #3: ARFindingsImportModal Envelope Key Unwrapping ---
  describe('Bug #3: ARFindingsImportModal Envelope Key Unwrapping', () => {
    it('correctly unwraps assessment-results envelope and requests document with valid docId', async () => {
      const mockEnvelopedARList = [
        {
          'assessment-results': {
            uuid: 'ar-enveloped-uuid-777',
            metadata: {
              title: 'Annual FedRAMP Assessment Results',
              version: '2.5.0',
            },
          },
        },
      ];

      const mockArDocContent = {
        'assessment-results': {
          uuid: 'ar-enveloped-uuid-777',
          results: [
            {
              uuid: 'res-1',
              findings: [
                {
                  uuid: 'finding-unsat-1',
                  title: 'MFA Not Enforced on Admin Accounts',
                  target: { status: { state: 'not-satisfied' } },
                },
              ],
            },
          ],
        },
      };

      (queryHooks.useDocumentListQuery as any).mockReturnValue({
        data: mockEnvelopedARList,
        isLoading: false,
      });
      (api.fetchDocument as any).mockResolvedValue(mockArDocContent);

      render(
        <ARFindingsImportModal
          isOpen={true}
          onClose={vi.fn()}
          onImport={vi.fn()}
        />
      );

      // Verify card rendered with unwrapped metadata
      expect(screen.getByText('Annual FedRAMP Assessment Results')).toBeInTheDocument();
      expect(screen.getByText(/ID: ar-envel\.\.\. \| Ver: 2\.5\.0/)).toBeInTheDocument();

      // Click card
      const card = screen.getByTestId('ar-doc-card-ar-enveloped-uuid-777');
      await act(async () => {
        fireEvent.click(card);
      });

      await waitFor(() => {
        // Must be called with the unwrapped UUID, not empty string!
        expect(api.fetchDocument).toHaveBeenCalledWith(
          'assessment-results',
          'ar-enveloped-uuid-777'
        );
        expect(screen.getByText('Found 1 Unsatisfied Finding(s)')).toBeInTheDocument();
        expect(screen.getByText('MFA Not Enforced on Admin Accounts')).toBeInTheDocument();
      });
    });
  });

  // --- Bug #4: SSPBrowserModal Envelope Key Unwrapping ---
  describe('Bug #4: SSPBrowserModal Envelope Key Unwrapping', () => {
    it('unwraps system-security-plan envelope in filtering, card rendering, and href linking', async () => {
      const mockEnvelopedSSPs = [
        {
          'system-security-plan': {
            uuid: 'ssp-enveloped-uuid-888',
            metadata: {
              title: 'Production Core Platform SSP',
              version: '3.1.0',
              'last-modified': '2026-08-15T12:00:00Z',
            },
          },
        },
      ];

      (api.fetchDocuments as any).mockResolvedValue(mockEnvelopedSSPs);

      const handleSelectSSP = vi.fn();
      const handleClose = vi.fn();

      render(
        <SSPBrowserModal
          isOpen={true}
          onClose={handleClose}
          onSelectSSP={handleSelectSSP}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Production Core Platform SSP')).toBeInTheDocument();
        expect(screen.getByText('v3.1.0')).toBeInTheDocument();
        expect(screen.getByText('ssp-enveloped-uuid-888')).toBeInTheDocument();
      });

      // Test search filtering with unwrapped properties
      const searchInput = screen.getByPlaceholderText(/Search SSPs/i);
      fireEvent.change(searchInput, { target: { value: 'Production Core' } });
      expect(screen.getByText('Production Core Platform SSP')).toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: 'NonExistent' } });
      expect(screen.queryByText('Production Core Platform SSP')).not.toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: 'ssp-enveloped' } });
      expect(screen.getByText('Production Core Platform SSP')).toBeInTheDocument();

      // Click card to select
      fireEvent.click(screen.getByText('Production Core Platform SSP'));

      // Click Link Target SSP button
      const linkBtn = screen.getByRole('button', { name: /Link Target SSP/i });
      fireEvent.click(linkBtn);

      expect(handleSelectSSP).toHaveBeenCalledWith(
        '../system-security-plans/ssp-enveloped-uuid-888.json',
        undefined
      );
      expect(handleClose).toHaveBeenCalled();
    });
  });

  // --- Bug #5: APBrowserModal Envelope Key Unwrapping ---
  describe('Bug #5: APBrowserModal Envelope Key Unwrapping', () => {
    it('unwraps assessment-plan envelope in filtering, card rendering, and target URI', async () => {
      const mockEnvelopedAPs = [
        {
          'assessment-plan': {
            uuid: 'ap-enveloped-uuid-999',
            metadata: {
              title: 'FY26 Cloud Security Assessment Plan',
              version: '1.4.0',
            },
          },
        },
      ];

      (api.fetchDocuments as any).mockResolvedValue(mockEnvelopedAPs);

      const handleSelectAP = vi.fn();
      const handleClose = vi.fn();

      render(
        <APBrowserModal
          isOpen={true}
          onClose={handleClose}
          onSelectAP={handleSelectAP}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('FY26 Cloud Security Assessment Plan')).toBeInTheDocument();
        expect(screen.getByText('v1.4.0')).toBeInTheDocument();
        expect(screen.getByText(/UUID:\s*ap-enveloped-uuid-999/)).toBeInTheDocument();
        expect(screen.getByText(/Target URI:\s*#ap-enveloped-uuid-999/)).toBeInTheDocument();
      });

      // Test search filtering with unwrapped title and UUID
      const searchInput = screen.getByPlaceholderText(/Search plans/i);
      fireEvent.change(searchInput, { target: { value: 'Cloud Security' } });
      expect(screen.getByText('FY26 Cloud Security Assessment Plan')).toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: 'NonExistent' } });
      expect(screen.queryByText('FY26 Cloud Security Assessment Plan')).not.toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: 'ap-enveloped' } });
      expect(screen.getByText('FY26 Cloud Security Assessment Plan')).toBeInTheDocument();

      // Click card to select
      fireEvent.click(screen.getByText('FY26 Cloud Security Assessment Plan'));

      // Click Link Assessment Plan button
      const linkBtn = screen.getByRole('button', { name: /Link Assessment Plan/i });
      fireEvent.click(linkBtn);

      expect(handleSelectAP).toHaveBeenCalledWith(
        '#ap-enveloped-uuid-999',
        undefined
      );
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
