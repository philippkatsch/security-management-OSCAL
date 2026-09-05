import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SSPPage } from '../../components/ssp/SSPPage';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfirmProvider } from '../../components/shared/ui/ConfirmProvider';
import * as apiClientModule from '../../lib/api-client';

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

describe('SSPPage Component & Baseline Resolution Tests (Milestone 4)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    vi.clearAllMocks();

    currentDoc = {
      'system-security-plan': {
        uuid: 'ssp-1234-uuid',
        metadata: {
          title: 'Enterprise Core System Security Plan',
          'last-modified': '2026-09-01T00:00:00Z',
          version: '1.0.0',
          'oscal-version': '1.2.2'
        },
        'import-profile': {
          href: '../profiles/fedramp-moderate.json'
        },
        'system-characteristics': {
          'system-ids': [{ id: 'SYS-CORE-001' }],
          'system-name': 'Enterprise Core Information System',
          description: 'Production core system hosting containerized services.',
          'security-sensitivity-level': 'moderate',
          status: { state: 'operational' },
          'security-impact-level': {
            'security-objective-confidentiality': 'moderate',
            'security-objective-integrity': 'moderate',
            'security-objective-availability': 'moderate'
          },
          'system-information': {
            'information-types': [
              {
                uuid: 'info-1',
                title: 'Customer Authentication Credentials',
                description: 'User passwords and MFA tokens'
              }
            ]
          },
          'authorization-boundary': {
            description: 'VPC boundary in AWS Frankfurt region.'
          }
        },
        'system-implementation': {
          users: [
            { uuid: 'user-1', title: 'System Administrator', description: 'Root admin' }
          ],
          components: [
            {
              uuid: 'comp-this-system',
              type: 'this-system',
              title: 'Enterprise Core Information System',
              description: 'The system as a whole',
              status: { state: 'operational' }
            },
            {
              uuid: 'comp-keycloak',
              type: 'software',
              title: 'Keycloak IAM',
              description: 'Authentication provider',
              status: { state: 'operational' }
            }
          ],
          'inventory-items': [
            { uuid: 'inv-1', description: 'Primary RDS PostgreSQL Instance' }
          ],
          'leveraged-authorizations': [
            {
              uuid: 'auth-aws',
              title: 'AWS FedRAMP High Authorization',
              'party-uuid': 'party-aws-uuid',
              'date-authorized': '2026-01-15'
            }
          ]
        },
        'control-implementation': {
          description: 'Overarching control realization strategy.',
          'implemented-requirements': [
            {
              uuid: 'req-ac-1',
              'control-id': 'ac-1',
              props: [{ name: 'control-origination', value: 'organization' }],
              'by-components': [
                {
                  uuid: 'bc-ac-1',
                  'component-uuid': 'comp-this-system',
                  description: 'Organizational access control policy enforced annually.',
                  'implementation-status': { state: 'implemented' }
                }
              ]
            },
            {
              uuid: 'req-ac-2',
              'control-id': 'ac-2',
              props: [{ name: 'control-origination', value: 'system-specific' }],
              'by-components': [
                {
                  uuid: 'bc-ac-2',
                  'component-uuid': 'comp-keycloak',
                  description: 'Keycloak handles user account provisioning and RBAC.',
                  'implementation-status': { state: 'implemented' }
                }
              ]
            }
          ]
        }
      }
    };
    currentIsEditing = false;
    currentEditMode = 'visual';

    // Mock apiClient responses for resolution and document listings
    vi.spyOn(apiClientModule, 'apiClient').mockImplementation(async (path: string, options?: any) => {
      if (path.includes('/resolve/ssp/preview')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            control_tree: {
              groups: [
                {
                  id: 'ac',
                  title: 'Access Control',
                  controls: [
                    { id: 'ac-1', title: 'Policy and Procedures' },
                    { id: 'ac-2', title: 'Account Management' },
                    { id: 'ac-3', title: 'Access Enforcement' }
                  ]
                }
              ],
              controls: []
            },
            implementation_summary: {
              total: 3,
              implemented: 2,
              partially_implemented: 0,
              planned: 1,
              not_applicable: 0
            },
            parameters: {
              global: {},
              control_level: {},
              component_level: {},
              baseline_defaults: {}
            },
            source_baseline: {
              href: '../profiles/fedramp-moderate.json',
              id: 'fedramp-moderate',
              type: 'profile',
              title: 'FedRAMP Moderate Baseline'
            }
          })
        } as any;
      }

      if (path.includes('/documents/profiles')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              stage: 'profiles',
              uuid: 'fedramp-moderate-uuid',
              title: 'FedRAMP Moderate Baseline Profile',
              version: '1.0.0'
            },
            {
              stage: 'profiles',
              uuid: 'nist-sp-800-53-low-uuid',
              title: 'NIST SP 800-53 Low Baseline',
              version: '2.0.0'
            }
          ]
        } as any;
      }

      if (path.includes('/documents/catalogs')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              stage: 'catalogs',
              uuid: 'nist-sp-800-53-r5-uuid',
              title: 'NIST SP 800-53 Rev 5 Catalog',
              version: '5.1.0'
            }
          ]
        } as any;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({})
      } as any;
    });
  });

  const renderComponent = (props: any = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ConfirmProvider>
          <BrowserRouter>
            <SSPPage sspId="ssp-1234-uuid" onClose={vi.fn()} {...props} />
          </BrowserRouter>
        </ConfirmProvider>
      </QueryClientProvider>
    );
  };

  it('renders SSPPage with document title, Overview metrics, and FIPS impact triad', async () => {
    renderComponent();

    expect(screen.getByText('Enterprise Core System Security Plan')).toBeInTheDocument();
    expect(screen.getByText('Imported Baseline Framework')).toBeInTheDocument();
    expect(screen.getByText('../profiles/fedramp-moderate.json')).toBeInTheDocument();

    // Verify Metric Cards
    expect(screen.getByText('Baseline Controls')).toBeInTheDocument();
    expect(screen.getByText('Implemented Reqs')).toBeInTheDocument();
    expect(screen.getByText('Implementation Coverage')).toBeInTheDocument();
  });

  it('auto-initializes root this-system component if components list is empty', async () => {
    currentDoc['system-security-plan']['system-implementation'].components = [];
    currentIsEditing = true;

    renderComponent();

    expect(mockSetDoc).toHaveBeenCalled();
  });

  it('triggers baseline preview resolution and loads control hierarchy', async () => {
    renderComponent();

    await waitFor(() => {
      expect(apiClientModule.apiClient).toHaveBeenCalledWith(
        '/resolve/ssp/preview',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('opens workspace document browser modal when browsing baselines in edit mode', async () => {
    currentIsEditing = true;
    renderComponent();

    const browseBtn = screen.getByTestId('browse-baseline-btn');
    expect(browseBtn).toBeInTheDocument();
    fireEvent.click(browseBtn);

    expect(screen.getByTestId('baseline-browser-modal')).toBeInTheDocument();
    expect(screen.getByText('Select Baseline Profile or Catalog')).toBeInTheDocument();

    // Verify document search & profile list
    await waitFor(() => {
      expect(screen.getByText('FedRAMP Moderate Baseline Profile')).toBeInTheDocument();
    });

    // Select profile
    const selectDoc = screen.getByTestId('browser-doc-fedramp-moderate-uuid');
    fireEvent.click(selectDoc);

    expect(mockSetDoc).toHaveBeenCalled();
  });

  it('allows manual editing of baseline URI reference in edit mode', async () => {
    currentIsEditing = true;
    renderComponent();

    const editBtn = screen.getByTestId('edit-profile-href-btn');
    fireEvent.click(editBtn);

    const input = screen.getByTestId('profile-href-input');
    fireEvent.change(input, { target: { value: '../catalogs/nist-sp-800-53-r5.json' } });

    const saveBtn = screen.getByTestId('save-profile-href-btn');
    fireEvent.click(saveBtn);

    expect(mockSetDoc).toHaveBeenCalled();
  });

  it('navigates seamlessly across tabs and renders Control Implementation tab with metrics', async () => {
    renderComponent();

    const ctrlTabBtn = screen.getByRole('button', { name: 'Control Implementation' });
    fireEvent.click(ctrlTabBtn);

    expect(screen.getByTestId('control-implementation-tab')).toBeInTheDocument();
    expect(screen.getByTestId('controls-table')).toBeInTheDocument();
    expect(screen.getByTestId('control-row-ac-1')).toBeInTheDocument();
    expect(screen.getByTestId('control-row-ac-2')).toBeInTheDocument();
  });

  it('filters controls in ControlImplementationTab by search query, status, and origination', async () => {
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: 'Control Implementation' }));

    // Search filter
    const searchInput = screen.getByTestId('search-controls-input');
    fireEvent.change(searchInput, { target: { value: 'ac-1' } });
    expect(screen.getByTestId('control-row-ac-1')).toBeInTheDocument();

    // Status filter
    const statusSelect = screen.getByTestId('status-filter-select');
    fireEvent.change(statusSelect, { target: { value: 'implemented' } });
    expect(screen.getByTestId('control-row-ac-1')).toBeInTheDocument();

    // Origination filter
    const origSelect = screen.getByTestId('origination-filter-select');
    fireEvent.change(origSelect, { target: { value: 'organization' } });
    expect(screen.getByTestId('control-row-ac-1')).toBeInTheDocument();
  });

  it('opens UnifiedControlEditor detail panel when selecting a control', async () => {
    currentIsEditing = true;
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: 'Control Implementation' }));

    const row = screen.getByTestId('control-row-ac-1');
    fireEvent.click(row);

    // Detail panel with UnifiedControlEditor & SSPAdapter should be visible
    expect(screen.getByTestId('ssp-adapter')).toBeInTheDocument();
    expect(screen.getByText('System Control Implementation')).toBeInTheDocument();
  });
});
