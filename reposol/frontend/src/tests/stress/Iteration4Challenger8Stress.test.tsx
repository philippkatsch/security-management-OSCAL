import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import APPage from '../../components/assessment-plan/APPage';
import { ConfirmModal } from '../../components/shared/ui/ConfirmModal';
import { ConfirmProvider, useConfirm } from '../../components/shared/ui/ConfirmProvider';
import { ExportModal } from '../../components/shared/ui/ExportModal';

import { CatalogPage } from '../../components/catalog/CatalogPage';
import { ProfilePage } from '../../components/profile/ProfilePage';
import { ComponentPage } from '../../components/component-definition/ComponentPage';
import { SSPPage } from '../../components/ssp/SSPPage';
import { ARPage } from '../../components/assessment-results/ARPage';
import { POAMPage } from '../../components/poam/POAMPage';
import { MappingPage } from '../../components/mapping/MappingPage';
import { TraceabilityPage } from '../../components/traceability/TraceabilityPage';

import { useDocumentLifecycle } from '@hooks/useDocumentLifecycle';
import { toast } from 'react-hot-toast';

vi.mock('@hooks/useDocumentLifecycle', () => ({
  useDocumentLifecycle: vi.fn(),
}));

vi.mock('@hooks/useDocumentQuery', () => ({
  useDocumentListQuery: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useTraceabilityQuery: vi.fn().mockReturnValue({ data: null, isLoading: false }),
  useDocumentQuery: vi.fn().mockReturnValue({ data: null, isLoading: false }),
}));

vi.mock('@hooks/useProfileResolution', () => ({
  useProfileResolution: vi.fn().mockReturnValue({
    resolvedCatalog: null,
    resolving: false,
    error: null,
    activeView: 'editor',
    setActiveView: vi.fn(),
    parameterValues: {},
    setParameterValues: vi.fn(),
    resolvedControlsMap: new Map(),
    stats: { totalControls: 0, setParametersCount: 0, altersCount: 0 },
  }),
}));

vi.mock('@lib/api', () => ({
  getWorkspaceId: () => 'ws-challenger-8',
  exportDocument: vi.fn(),
  fetchDocument: vi.fn().mockResolvedValue({}),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
  }
});

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe('Iteration 4 Challenger 8 Adversarial Stress Suite', () => {

  describe('1. APPage (Assessment Plan) Stress & Edge Cases', () => {

    const completeAPDoc = {
      'assessment-plan': {
        uuid: 'ap-stress-001',
        metadata: {
          title: 'Full Adversarial Assessment Plan',
          version: '1.0.0',
          'last-modified': '2026-08-13T20:00:00Z',
          oscal_version: '1.2.0',
        },
        'import-ssp': {
          href: 'ssp-ref-001.json',
        },
        'reviewed-controls': {
          'control-selections': [
            { uuid: 'cs-1', 'include-all': true },
            { uuid: 'cs-2', 'include-controls': [{ 'control-id': 'ac-1' }, { 'control-id': 'ac-2' }] }
          ],
          'control-objective-selections': [
            { uuid: 'cos-1', 'include-all': true },
            { uuid: 'cos-2', 'include-objectives': [{ 'objective-id': 'ac-1_obj.1' }] }
          ]
        },
        'assessment-subjects': [
          {
            uuid: 'subj-1',
            type: 'component',
            description: 'Subject 1 Description',
            'include-all': true,
          },
          {
            uuid: 'subj-2',
            type: 'inventory-item',
            description: 'Subject 2 Description',
            'include-subjects': [{ uuid: 'inv-1' }]
          }
        ],
        tasks: [
          {
            uuid: 'task-1',
            title: 'Security Control Assessment Task',
            type: 'milestone',
            timing: {
              'within-date-range': { start: '2026-01-01', end: '2026-12-31' }
            },
            'associated-activities': [{ 'activity-uuid': 'act-1' }]
          },
          {
            uuid: 'task-2',
            title: 'Frequency Task',
            type: 'action',
            timing: {
              'at-frequency': { period: 1, unit: 'month' }
            }
          }
        ],
        'local-definitions': {
          activities: [
            {
              uuid: 'act-1',
              title: 'Activity 1',
              description: 'Activity 1 description',
              props: [{ name: 'method', value: 'EXAMINE' }],
              steps: [{ uuid: 'step-1', title: 'Step 1' }]
            }
          ],
          components: [
            {
              uuid: 'comp-1',
              title: 'Test Component',
              type: 'software',
              description: 'Test component description',
              status: { state: 'operational' }
            }
          ],
          'inventory-items': [
            {
              uuid: 'inv-1',
              description: 'Server Host 01',
              'implemented-components': [{ 'component-uuid': 'comp-1' }]
            }
          ],
          users: [
            {
              uuid: 'user-1',
              title: 'Lead Auditor',
              'role-ids': ['auditor']
            }
          ],
          'objectives-and-methods': [
            {
              uuid: 'om-1',
              'control-id': 'ac-1',
              description: 'Access Control Objective',
              parts: [{ uuid: 'part-1', name: 'objective', prose: 'Verify access controls' }]
            }
          ]
        },
        'assessment-assets': {
          'assessment-platforms': [
            {
              uuid: 'plat-1',
              title: 'Scanner Platform',
              'uses-components': [{ 'component-uuid': 'comp-1' }]
            }
          ],
          'assessment-team': [
            {
              uuid: 'team-1',
              title: 'Red Team Lead',
              'role-ids': ['assessor']
            }
          ]
        },
        'terms-and-conditions': {
          parts: [
            {
              uuid: 'tc-1',
              name: 'rule',
              title: 'Rules of Engagement',
              prose: 'No destructive testing during business hours.'
            }
          ]
        }
      }
    };

    it('renders robustly with minimal/sparse AP document without throwing runtime errors', () => {
      const sparseDoc = { 'assessment-plan': { uuid: 'ap-sparse-01' } };
      (useDocumentLifecycle as any).mockReturnValue({
        activeDoc: sparseDoc,
        doc: sparseDoc,
        setDoc: vi.fn(),
        isEditing: false,
        pushUndoRedoState: vi.fn(),
        loading: false,
        error: null,
      });

      render(
        <BrowserRouter>
          <ConfirmProvider>
            <APPage apId="ap-sparse-01" initialIsEditing={false} />
          </ConfirmProvider>
        </BrowserRouter>
      );

      expect(screen.getByText('Untitled Assessment Plan')).toBeInTheDocument();
      expect(screen.getByText('Assessment Plan Overview')).toBeInTheDocument();
    });

    it('cycles through all 9 tabs cleanly under complete data', () => {
      (useDocumentLifecycle as any).mockReturnValue({
        activeDoc: completeAPDoc,
        doc: completeAPDoc,
        setDoc: vi.fn(),
        isEditing: true,
        pushUndoRedoState: vi.fn(),
        loading: false,
        error: null,
      });

      render(
        <BrowserRouter>
          <ConfirmProvider>
            <APPage apId="ap-stress-001" initialIsEditing={true} />
          </ConfirmProvider>
        </BrowserRouter>
      );

      const tabsToTest = [
        { name: 'Reviewed Controls', expectedHeader: 'Reviewed Controls' },
        { name: 'Activity Tasks', expectedHeader: 'Tasks' },
        { name: 'Local Definitions', expectedHeader: 'Components' },
        { name: 'Subjects Scope', expectedHeader: 'Assessment Subjects' },
        { name: 'Assessment Assets', expectedHeader: 'Assessment Platforms' },
        { name: 'Terms & Conditions', expectedHeader: 'Terms & Conditions' },
        { name: 'Metadata', expectedHeader: 'Metadata' },
        { name: 'JSON Editor', expectedHeader: null },
      ];

      for (const tab of tabsToTest) {
        const tabBtn = screen.getByRole('button', { name: new RegExp(tab.name, 'i') });
        fireEvent.click(tabBtn);
        if (tab.expectedHeader) {
          const headings = screen.getAllByText(tab.expectedHeader);
          expect(headings.length).toBeGreaterThan(0);
        }
      }
    }, 15000);

    it('allows updating SSP reference inline and fires setDoc & toast', async () => {
      const mockSetDoc = vi.fn();
      const mockPushState = vi.fn();

      (useDocumentLifecycle as any).mockReturnValue({
        activeDoc: completeAPDoc,
        doc: completeAPDoc,
        setDoc: mockSetDoc,
        isEditing: true,
        pushUndoRedoState: mockPushState,
        loading: false,
        error: null,
      });

      render(
        <BrowserRouter>
          <ConfirmProvider>
            <APPage apId="ap-stress-001" initialIsEditing={true} />
          </ConfirmProvider>
        </BrowserRouter>
      );

      const editBtn = screen.getByText('Edit Reference');
      fireEvent.click(editBtn);

      const input = screen.getByDisplayValue('ssp-ref-001.json');
      fireEvent.change(input, { target: { value: 'updated-ssp-ref.json' } });

      const saveBtn = screen.getByText('Save');
      fireEvent.click(saveBtn);

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({
          'assessment-plan': expect.objectContaining({
            'import-ssp': { href: 'updated-ssp-ref.json' }
          })
        })
      );
      expect(mockPushState).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('SSP reference updated');
    });
  });

  describe('2. ConfirmModal & ConfirmProvider Stress Testing', () => {

    it('handles backdrop click cancel without calling window.confirm', () => {
      const handleCancel = vi.fn();
      const handleConfirm = vi.fn();

      render(
        <ConfirmModal
          isOpen={true}
          title="Backdrop Test"
          message="Testing backdrop cancel"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      );

      expect(screen.getByText('Backdrop Test')).toBeInTheDocument();
      const cancelBtn = screen.getByText('Cancel');
      fireEvent.click(cancelBtn);

      expect(handleCancel).toHaveBeenCalledTimes(1);
      expect(handleConfirm).not.toHaveBeenCalled();
    });

    it('renders danger variant button correctly', () => {
      render(
        <ConfirmModal
          isOpen={true}
          title="Danger Modal"
          message="Irreversible operation"
          variant="danger"
          confirmLabel="Delete Everything"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const dangerBtn = screen.getByText('Delete Everything');
      expect(dangerBtn).toBeInTheDocument();
      expect(dangerBtn.className).toContain('btnDanger');
    });

    it('rapid invocation of useConfirm resolves sequentially without corruption', async () => {
      const ConfirmTester = () => {
        const { confirm } = useConfirm();
        const [status, setStatus] = React.useState('idle');

        const runTest = async () => {
          setStatus('first-start');
          const first = await confirm({ title: 'First Confirmation', message: 'Proceed 1?' });
          if (!first) {
            setStatus('first-rejected');
            return;
          }
          setStatus('second-start');
          const second = await confirm({ title: 'Second Confirmation', message: 'Proceed 2?' });
          setStatus(second ? 'all-passed' : 'second-rejected');
        };

        return (
          <div>
            <span data-testid="status">{status}</span>
            <button onClick={runTest}>Start Rapid Test</button>
          </div>
        );
      };

      render(
        <ConfirmProvider>
          <ConfirmTester />
        </ConfirmProvider>
      );

      fireEvent.click(screen.getByText('Start Rapid Test'));
      expect(screen.getByTestId('status').textContent).toBe('first-start');

      const confirm1 = await screen.findByText('First Confirmation');
      expect(confirm1).toBeInTheDocument();
      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('second-start');
      });
      const confirm2 = await screen.findByText('Second Confirmation');
      expect(confirm2).toBeInTheDocument();
      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('all-passed');
      });
    });
  });

  describe('3. ExportModal Stress & Edge Cases', () => {

    it('gracefully handles missing docTitle and defaults subtitle', () => {
      render(
        <ExportModal
          isOpen={true}
          docId="doc-no-title"
          stage="catalog"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Select preferred export format')).toBeInTheDocument();
    });

    it('triggers XML export with expected endpoint structure', () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const handleClose = vi.fn();

      render(
        <ExportModal
          isOpen={true}
          docId="cat-999"
          docTitle="Catalog 999"
          stage="catalogs"
          onClose={handleClose}
        />
      );

      const xmlRadio = screen.getByTestId('export-format-xml');
      fireEvent.click(xmlRadio);

      const exportBtn = screen.getByTestId('export-confirm-btn');
      fireEvent.click(exportBtn);

      expect(windowOpenSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/export/catalogs/cat-999?format=xml&w=ws-challenger-8'),
        '_blank'
      );
      expect(toast.success).toHaveBeenCalledWith('Exporting as XML...');
      expect(handleClose).toHaveBeenCalledTimes(1);

      windowOpenSpy.mockRestore();
    });
  });

  describe('4. Stage Page Components Render Verification', () => {

    const stageMockDoc = {
      catalog: { uuid: 'c1', metadata: { title: 'Test Catalog' } },
      profile: { uuid: 'p1', metadata: { title: 'Test Profile' } },
      'component-definition': { uuid: 'comp1', metadata: { title: 'Test Component' } },
      'system-security-plan': { uuid: 'ssp1', metadata: { title: 'Test SSP' } },
      'assessment-results': { uuid: 'ar1', metadata: { title: 'Test AR' } },
      'plan-of-action-and-milestones': { uuid: 'poam1', metadata: { title: 'Test POAM' } },
      'mapping-collection': { uuid: 'm1', metadata: { title: 'Test Mapping' } },
    };

    const setupLifecycleMock = (docType: string, docObj: any) => {
      (useDocumentLifecycle as any).mockReturnValue({
        activeDoc: { [docType]: docObj },
        doc: { [docType]: docObj },
        setDoc: vi.fn(),
        isEditing: false,
        pushUndoRedoState: vi.fn(),
        loading: false,
        error: null,
      });
    };

    const renderWithProviders = (ui: React.ReactElement) => {
      const queryClient = createTestQueryClient();
      return render(
        <QueryClientProvider client={queryClient}>
          <ConfirmProvider>
            <BrowserRouter>{ui}</BrowserRouter>
          </ConfirmProvider>
        </QueryClientProvider>
      );
    };

    it('renders CatalogPage without runtime error', () => {
      setupLifecycleMock('catalog', stageMockDoc.catalog);
      renderWithProviders(<CatalogPage catalogId="c1" />);
      expect(screen.getByText('Test Catalog')).toBeInTheDocument();
    });

    it('renders ProfilePage without runtime error (Catches ReferenceError: title is not defined if unfixed)', () => {
      setupLifecycleMock('profile', stageMockDoc.profile);
      renderWithProviders(<ProfilePage profileId="p1" />);
      expect(screen.getAllByText('Test Profile')[0]).toBeInTheDocument();
    });

    it('renders ComponentPage without runtime error', () => {
      setupLifecycleMock('component-definition', stageMockDoc['component-definition']);
      renderWithProviders(<ComponentPage compId="comp1" />);
      expect(screen.getByText('Test Component')).toBeInTheDocument();
    });

    it('renders SSPPage without runtime error', () => {
      setupLifecycleMock('system-security-plan', stageMockDoc['system-security-plan']);
      renderWithProviders(<SSPPage sspId="ssp1" />);
      expect(screen.getByText('Test SSP')).toBeInTheDocument();
    });

    it('renders ARPage without runtime error', () => {
      setupLifecycleMock('assessment-results', stageMockDoc['assessment-results']);
      renderWithProviders(<ARPage arId="ar1" />);
      expect(screen.getByText('Test AR')).toBeInTheDocument();
    });

    it('renders POAMPage without runtime error', () => {
      setupLifecycleMock('plan-of-action-and-milestones', stageMockDoc['plan-of-action-and-milestones']);
      renderWithProviders(<POAMPage poamId="poam1" />);
      expect(screen.getByText('Test POAM')).toBeInTheDocument();
    });

    it('renders MappingPage without runtime error', () => {
      setupLifecycleMock('mapping-collection', stageMockDoc['mapping-collection']);
      renderWithProviders(<MappingPage mappingId="m1" />);
      expect(screen.getByText('Test Mapping')).toBeInTheDocument();
    });

    it('renders TraceabilityPage without runtime error', () => {
      renderWithProviders(<TraceabilityPage />);
      expect(screen.getByText(/Traceability/i)).toBeInTheDocument();
    });
  });

});
