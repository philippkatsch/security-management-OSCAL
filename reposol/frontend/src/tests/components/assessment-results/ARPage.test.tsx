import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import ARPage from '../../../components/assessment-results/ARPage';
import { useDocumentLifecycle } from '@hooks/useDocumentLifecycle';
import { toast } from 'react-hot-toast';

vi.mock('@hooks/useDocumentLifecycle', () => ({
  useDocumentLifecycle: vi.fn(),
}));

vi.mock('@lib/api', () => ({
  getWorkspaceId: () => 'ws-test',
  exportDocument: vi.fn(),
  fetchDocuments: vi.fn().mockResolvedValue([
    { id: 'ap-101', title: 'Annual Security Assessment Plan', version: '1.0.0' },
  ]),
  fetchDocument: vi.fn().mockResolvedValue({}),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ARPage — Modular Architecture & Elimination of Stubbed Handlers', () => {
  const mockSetDoc = vi.fn();
  const mockPushUndoRedoState = vi.fn();
  const mockSave = vi.fn().mockResolvedValue({});

  const obsId = 'obs-uuid-1';
  const riskId = 'risk-uuid-1';

  const mockAR = {
    'assessment-results': {
      uuid: 'ar-101',
      metadata: {
        title: 'Q3 Enterprise Assessment Results',
        version: '1.0.0',
        'oscal-version': '1.2.2',
        'last-modified': '2026-09-04T12:00:00Z',
      },
      'import-ap': {
        href: '#ap-101',
      },
      results: [
        {
          uuid: 'rs-1',
          title: 'Result Set 1',
          description: 'Production AWS Cloud Assessment Result Set',
          start: '2026-08-13T10:00:00.000Z',
          end: '2026-08-13T18:00:00.000Z',
          'reviewed-controls': {
            'control-selections': [{ 'include-all': {} }],
          },
          observations: [
            {
              uuid: obsId,
              title: 'Obs 1',
              description: 'Observation of missing IAM lockout policy',
              methods: ['EXAMINE'],
              collected: '2026-08-13T10:30:00.000Z',
              types: ['finding'],
              subjects: [{ 'subject-uuid': 'comp-1', type: 'component' }],
              'relevant-evidence': [{ description: 'IAM configuration export' }],
            },
          ],
          risks: [
            {
              uuid: riskId,
              title: 'Test Risk',
              description: 'Risk description',
              statement: 'Lack of account lockout enables brute force attacks.',
              status: 'open',
              characterizations: [
                {
                  facets: [{ name: 'likelihood', system: 'http://first.org/cvss', value: 'High' }],
                },
              ],
              remediations: [],
              'risk-log': { entries: [] },
            },
          ],
          findings: [
            {
              uuid: 'finding-1',
              title: 'Finding 1: Inadequate Lockout',
              description: 'Account lockout duration does not meet requirements.',
              target: {
                type: 'objective-id',
                'target-id': 'ac-2_obj_1',
                status: {
                  state: 'not-satisfied',
                  reason: 'Missing controls',
                },
              },
              'related-observations': [{ 'observation-uuid': obsId }],
              'related-risks': [{ 'risk-uuid': riskId }],
            },
          ],
          'assessment-log': {
            entries: [],
          },
          attestations: [],
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useDocumentLifecycle as any).mockReturnValue({
      doc: mockAR,
      activeDoc: mockAR,
      setDoc: mockSetDoc,
      loading: false,
      error: null,
      saving: false,
      validating: false,
      validationResult: null,
      save: mockSave,
      validate: vi.fn(),
      reload: vi.fn(),
      versions: [],
      hasDraft: false,
      isEditing: true,
      setIsEditing: vi.fn(),
      handleToggleEdit: vi.fn(),
      handleBack: vi.fn(),
      pushUndoRedoState: mockPushUndoRedoState,
      setShowDrawer: vi.fn(),
    });
  });

  it('renders Overview tab with resolved AP ID and high-level metrics', async () => {
    render(
      <BrowserRouter>
        <ARPage arId="ar-101" initialEditMode={true} />
      </BrowserRouter>
    );

    expect(screen.getByText('Q3 Enterprise Assessment Results')).toBeDefined();
    // Verify AP ID is rendered in overview
    expect(screen.getByText('ap-101')).toBeDefined();
    expect(screen.getByText('Total Findings')).toBeDefined();
    expect(screen.getByText('Total Observations')).toBeDefined();
    expect(screen.getByText('Total Risks')).toBeDefined();
  });

  it('navigates to Result Sets tab and renders sidebar with accessible buttons', async () => {
    render(
      <BrowserRouter>
        <ARPage arId="ar-101" initialEditMode={true} />
      </BrowserRouter>
    );

    // Switch to Result Sets
    const resultSetsTabBtn = screen.getByRole('button', { name: /Result Sets/i });
    fireEvent.click(resultSetsTabBtn);

    // Sidebar has accessible button for Result Set 1
    const rsBtn = screen.getByRole('button', { name: /Result Set 1/i });
    expect(rsBtn).toBeDefined();

    // + New button exists
    expect(screen.getByRole('button', { name: '+ New' })).toBeDefined();
  });

  it('creates new result set and displays Title and Start form fields', async () => {
    render(
      <BrowserRouter>
        <ARPage arId="ar-101" initialEditMode={true} />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Result Sets/i }));
    fireEvent.click(screen.getByRole('button', { name: '+ New' }));

    expect(mockSetDoc).toHaveBeenCalled();

    // Field labels are connected
    const titleInput = screen.getByLabelText('Title');
    const startInput = screen.getByLabelText('Start');

    fireEvent.change(titleInput, { target: { value: 'New Test Result Set' } });
    fireEvent.change(startInput, { target: { value: '2026-08-13T10:00' } });

    expect(mockSetDoc).toHaveBeenCalled();
  });

  it('switches to Findings sub-tab, opens finding editor, and modifies fields', async () => {
    render(
      <BrowserRouter>
        <ARPage arId="ar-101" initialEditMode={true} />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Result Sets/i }));
    fireEvent.click(screen.getByRole('button', { name: /Findings/i }));

    // + Add Finding button exists
    const addFindingBtn = screen.getByRole('button', { name: '+ Add Finding' });
    fireEvent.click(addFindingBtn);

    // Finding form accessible labels
    const titleInput = screen.getByLabelText('Title');
    const descInput = screen.getByLabelText('Description');
    const targetTypeSelect = screen.getByLabelText('Target Type');
    const targetIdInput = screen.getByLabelText('Target ID');
    const statusStateSelect = screen.getByLabelText('Status State');
    const statusReasonInput = screen.getByLabelText('Status Reason');
    const relObsSelect = screen.getByLabelText('Related Observations');
    const relRisksSelect = screen.getByLabelText('Related Risks');

    fireEvent.change(titleInput, { target: { value: 'New Finding' } });
    fireEvent.change(descInput, { target: { value: 'Finding description' } });
    fireEvent.change(targetTypeSelect, { target: { value: 'objective-id' } });
    fireEvent.change(targetIdInput, { target: { value: 'obj-1' } });
    fireEvent.change(statusStateSelect, { target: { value: 'not-satisfied' } });
    fireEvent.change(statusReasonInput, { target: { value: 'Missing controls' } });

    expect(mockSetDoc).toHaveBeenCalled();
  });

  it('switches to Assessment Log sub-tab, adds entry with accessible inputs', async () => {
    render(
      <BrowserRouter>
        <ARPage arId="ar-101" initialEditMode={true} />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Result Sets/i }));
    fireEvent.click(screen.getByRole('button', { name: /Assessment Log/i }));

    const addEntryBtn = screen.getByRole('button', { name: '+ Add Entry' });
    fireEvent.click(addEntryBtn);

    const timestampInput = screen.getByLabelText('Timestamp');
    const titleInput = screen.getByLabelText('Title');
    const descInput = screen.getByLabelText('Description');

    fireEvent.change(timestampInput, { target: { value: '2026-08-13T12:00' } });
    fireEvent.change(titleInput, { target: { value: 'New Log Entry' } });
    fireEvent.change(descInput, { target: { value: 'Test log entry description' } });

    expect(mockSetDoc).toHaveBeenCalled();
  });

  it('switches to Risks sub-tab and adds remediation and risk log entries', async () => {
    render(
      <BrowserRouter>
        <ARPage arId="ar-101" initialEditMode={true} />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Result Sets/i }));
    fireEvent.click(screen.getByRole('button', { name: /Risks/i }));

    // Click on existing risk
    fireEvent.click(screen.getByText('Test Risk'));

    // Click + Add Remediation
    const addRemBtn = screen.getByRole('button', { name: '+ Add Remediation' });
    fireEvent.click(addRemBtn);

    const remTitle = screen.getAllByLabelText('Title').slice(-1)[0];
    const remLifecycle = screen.getByLabelText('Lifecycle');
    const remDesc = screen.getAllByLabelText('Description').slice(-1)[0];

    fireEvent.change(remTitle, { target: { value: 'Remediate this risk' } });
    fireEvent.change(remLifecycle, { target: { value: 'planned' } });
    fireEvent.change(remDesc, { target: { value: 'Remediation steps' } });

    // Click + Add Asset
    const addAssetBtn = screen.getByRole('button', { name: '+ Add Asset' });
    fireEvent.click(addAssetBtn);
    const assetInput = screen.getAllByLabelText('Required Assets').slice(-1)[0];
    fireEvent.change(assetInput, { target: { value: 'Asset 1' } });

    // Click + Add Task
    const addTaskBtn = screen.getByRole('button', { name: '+ Add Task' });
    fireEvent.click(addTaskBtn);

    // Click + Add Log Entry
    const addLogBtn = screen.getByRole('button', { name: '+ Add Log Entry' });
    fireEvent.click(addLogBtn);

    const logTitle = screen.getAllByLabelText('Title').slice(-1)[0];
    const logStatus = screen.getByLabelText('Status Change');
    const logStart = screen.getAllByLabelText('Start').slice(-1)[0];
    const logDesc = screen.getAllByLabelText('Description').slice(-1)[0];

    fireEvent.change(logTitle, { target: { value: 'Status update log' } });
    fireEvent.change(logStatus, { target: { value: 'investigating' } });
    fireEvent.change(logStart, { target: { value: '2026-08-13T12:00' } });
    fireEvent.change(logDesc, { target: { value: 'Changing status to investigating' } });

    expect(mockSetDoc).toHaveBeenCalled();
  });

  it('clicking save-btn calls save and triggers toast.success with Saved successfully', async () => {
    render(
      <BrowserRouter>
        <ARPage arId="ar-101" initialEditMode={true} />
      </BrowserRouter>
    );

    const saveBtn = screen.getByTestId('save-btn');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Saved successfully');
    });
  });
});
