import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import APPage from '../../../components/assessment-plan/APPage';
import { useDocumentLifecycle } from '@hooks/useDocumentLifecycle';

vi.mock('@hooks/useDocumentLifecycle', () => ({
  useDocumentLifecycle: vi.fn(),
}));

vi.mock('@lib/api', () => ({
  getWorkspaceId: () => 'ws-test',
  exportDocument: vi.fn(),
  fetchDocuments: vi.fn().mockResolvedValue([
    { id: 'ssp-1', title: 'FedRAMP Production Baseline SSP', version: '1.0.0' },
  ]),
  fetchDocument: vi.fn().mockResolvedValue({
    'system-security-plan': {
      'system-characteristics': { 'system-name': 'FedRAMP Cloud Target', status: { state: 'operational' } },
      'control-implementation': { 'implemented-requirements': [{ 'control-id': 'ac-1' }, { 'control-id': 'ac-2' }] },
      'system-implementation': { components: [{ uuid: 'comp-1' }], users: [{ uuid: 'usr-1' }] },
    },
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('APPage — 6-Tab Modular Builder Architecture & Header', () => {
  const mockSetDoc = vi.fn();
  const mockPushUndoRedoState = vi.fn();

  const mockAP = {
    'assessment-plan': {
      uuid: 'ap-101',
      metadata: {
        title: 'Cloud Core Security Assessment Plan',
        version: '1.0.0',
        'oscal-version': '1.2.2',
        roles: [{ id: 'lead-assessor', title: 'Lead Assessor' }],
        parties: [{ uuid: 'p-1', name: 'Bob Auditor', type: 'person' }],
      },
      'import-ssp': {
        href: '../system-security-plans/ssp-1.json',
      },
      'reviewed-controls': {
        'control-selections': [
          {
            'include-controls': [{ 'control-id': 'ac-1' }, { 'control-id': 'ac-2' }],
          },
        ],
      },
      'assessment-subjects': [
        {
          type: 'component',
          description: 'Production App Servers',
          'include-all': {},
        },
      ],
      'local-definitions': {
        components: [
          {
            uuid: 'comp-local-1',
            title: 'Audit Workstation Alpha',
            type: 'software',
          },
        ],
        activities: [
          {
            uuid: 'act-1',
            title: 'Configuration Inspection',
            description: 'Inspect server configurations',
            props: [{ name: 'method', value: 'EXAMINE' }],
            steps: [{ uuid: 'st-1', title: 'Check SSH config', description: 'Ensure root login disabled' }],
          },
        ],
        'objectives-and-methods': [
          {
            'control-id': 'ac-1',
            description: 'Evaluate access control policy documentation',
            parts: [{ name: 'assessment-objective', prose: 'Policy is reviewed annually' }],
          },
        ],
      },
      tasks: [
        {
          uuid: 'task-1',
          title: 'Execute Vulnerability Scans',
          type: 'action',
          timing: {
            'within-date-range': { start: '2026-10-01', end: '2026-10-05' },
          },
          'associated-activities': [{ 'activity-uuid': 'act-1' }],
        },
      ],
      'terms-and-conditions': {
        parts: [
          {
            uuid: 'tc-1',
            name: 'rules-of-engagement',
            title: 'Rules of Engagement',
            prose: 'Testing window: 02:00 - 06:00 UTC.',
          },
        ],
      },
      'back-matter': {
        resources: [
          {
            uuid: 'res-1',
            title: 'Signed Rules of Engagement.pdf',
            rlinks: [{ href: '#res-1' }],
          },
        ],
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useDocumentLifecycle as any).mockReturnValue({
      activeDoc: mockAP,
      doc: mockAP,
      setDoc: mockSetDoc,
      isEditing: true,
      pushUndoRedoState: mockPushUndoRedoState,
      loading: false,
      error: null,
      saving: false,
      validating: false,
      validationResult: null,
      versions: [],
      hasDraft: false,
      showDrawer: false,
      setShowDrawer: vi.fn(),
      handleBack: vi.fn(),
      handleToggleEdit: vi.fn(),
      handleSelectVersion: vi.fn(),
      handleDeleteDraft: vi.fn(),
      handlePublishVersion: vi.fn(),
    });
  });

  it('renders the header bar, target SSP badge, and default Overview tab', () => {
    render(
      <BrowserRouter>
        <APPage apId="ap-101" initialIsEditing={true} />
      </BrowserRouter>
    );

    // Title and Target SSP Badge
    expect(screen.getByText('Cloud Core Security Assessment Plan')).toBeInTheDocument();
    expect(screen.getAllByText(/Target SSP/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/ssp-1\.json/i).length).toBeGreaterThanOrEqual(1);

    // Tab 1 content rendered
    expect(screen.getByText('Document Identification & Metadata')).toBeInTheDocument();
  });

  it('switches between all 6 modular tabs and JSON Source smoothly', () => {
    render(
      <BrowserRouter>
        <APPage apId="ap-101" initialIsEditing={true} />
      </BrowserRouter>
    );

    // Tab 2: Reviewed Controls & Scope
    fireEvent.click(screen.getByRole('button', { name: /Reviewed Controls & Scope/i }));
    expect(screen.getByText('Assessment Scoping & Coverage Matrix')).toBeInTheDocument();

    // Tab 3: Assessment Subjects & Assets
    fireEvent.click(screen.getByRole('button', { name: /Assessment Subjects & Assets/i }));
    expect(screen.getByText('Production App Servers')).toBeInTheDocument();

    // Tab 4: Local Definitions & Methods
    fireEvent.click(screen.getByRole('button', { name: /Local Definitions & Methods/i }));
    expect(screen.getByText('Assessment Objectives & Methodologies')).toBeInTheDocument();

    // Tab 5: Tasks & Timeline
    fireEvent.click(screen.getByRole('button', { name: /Tasks & Timeline/i }));
    expect(screen.getByText('Assessment Task Scheduler & Execution Timeline')).toBeInTheDocument();
    expect(screen.getByText('Execute Vulnerability Scans')).toBeInTheDocument();

    // Tab 6: Terms & Conditions
    fireEvent.click(screen.getByRole('button', { name: /Terms & Conditions/i }));
    expect(screen.getAllByDisplayValue('Rules of Engagement').length).toBeGreaterThanOrEqual(1);

    // Tab 7: JSON Source
    fireEvent.click(screen.getByRole('button', { name: /JSON Source/i }));
    expect(screen.getByText('Loading editor bundle...')).toBeInTheDocument();
  }, 15000);

  it('opens SSPBrowserModal when "Change SSP" is clicked in header', async () => {
    render(
      <BrowserRouter>
        <APPage apId="ap-101" initialIsEditing={true} />
      </BrowserRouter>
    );

    const changeSspBtn = screen.getByRole('button', { name: /Change SSP/i });
    fireEvent.click(changeSspBtn);

    expect(screen.getByText('Select Target System Security Plan (SSP)')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/FedRAMP Production Baseline SSP/i)).toBeInTheDocument();
    });
  });
});
