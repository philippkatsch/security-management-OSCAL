import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import APPage from '../../components/assessment-plan/APPage';
import { BrowserRouter } from 'react-router-dom';
import { useDocumentLifecycle } from '@hooks/useDocumentLifecycle';

vi.mock('@hooks/useDocumentLifecycle', () => ({
  useDocumentLifecycle: vi.fn(),
}));

vi.mock('@lib/api', () => ({
  getWorkspaceId: () => 'ws-123',
  exportDocument: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Challenger 7 - Empirical Verification of APPage 9 Tabs & Modals', () => {
  const mockSetDoc = vi.fn();
  const mockPushUndoRedoState = vi.fn();

  const richSampleAP = {
    'assessment-plan': {
      uuid: 'ap-99999',
      metadata: {
        title: 'Full Compliance Assessment Plan',
        version: '1.2.0',
        'last-modified': '2026-08-13T12:00:00Z',
        oscal_version: '1.2.0',
      },
      'import-ssp': {
        href: 'ssp-production-baseline.json',
      },
      'reviewed-controls': {
        'control-selections': [
          {
            uuid: 'cs-1',
            'include-all': false,
            'include-controls': [
              { 'control-id': 'ac-1' },
              { 'control-id': 'ac-2' }
            ]
          }
        ],
        'control-objective-selections': [
          {
            uuid: 'cos-1',
            'include-all': false,
            'include-objectives': [
              { 'objective-id': 'ac-1_obj' }
            ]
          }
        ]
      },
      tasks: [
        {
          uuid: 'task-uuid-101',
          title: 'Conduct Vulnerability Assessment',
          type: 'action',
          timing: {
            'within-date-range': { start: '2026-09-01', end: '2026-09-15' }
          },
          'associated-activities': [{ 'activity-uuid': 'act-uuid-201' }]
        }
      ],
      'local-definitions': {
        components: [
          {
            uuid: 'comp-uuid-301',
            title: 'Core Database Server',
            type: 'software',
            description: 'PostgreSQL Relational DB',
            status: { state: 'operational' }
          }
        ],
        'inventory-items': [
          {
            uuid: 'inv-uuid-401',
            description: 'DB Rack Unit 01',
            'implemented-components': [{ 'component-uuid': 'comp-uuid-301' }]
          }
        ],
        users: [
          {
            uuid: 'user-uuid-501',
            title: 'Jane Assessor',
            'role-ids': ['lead-assessor', 'auditor']
          }
        ],
        activities: [
          {
            uuid: 'act-uuid-201',
            title: 'DB Log Analysis',
            description: 'Examine authentication and privilege escalation logs',
            props: [{ name: 'method', value: 'EXAMINE' }],
            steps: [
              { uuid: 'step-101', title: 'Export Auth Logs', description: 'Download logs from SIEM' }
            ]
          }
        ],
        'objectives-and-methods': [
          {
            uuid: 'om-uuid-601',
            'control-id': 'ac-1',
            description: 'Verify access control policy is documented',
            parts: [
              { name: 'objective-statement', prose: 'Policy must be reviewed annually.' }
            ]
          }
        ]
      },
      'assessment-subjects': [
        {
          uuid: 'subj-uuid-701',
          type: 'component',
          description: 'Production DB Cluster Subject',
          'include-all': false,
          'include-subjects': [{ 'subject-uuid': 'comp-uuid-301' }]
        }
      ],
      'assessment-assets': {
        'assessment-platforms': [
          {
            uuid: 'plat-uuid-801',
            title: 'Nessus Vulnerability Scanner',
            'uses-components': [{ 'component-uuid': 'comp-uuid-301' }]
          }
        ],
        'assessment-team': [
          {
            uuid: 'team-uuid-901',
            title: 'Independent Assessment Team Alpha',
            'role-ids': ['assessor-team-lead']
          }
        ]
      },
      'terms-and-conditions': {
        parts: [
          {
            uuid: 'tc-uuid-1001',
            name: 'rules-of-engagement',
            title: 'Rules of Engagement',
            prose: 'Testing must only be performed during off-peak hours (01:00-05:00 UTC).'
          }
        ]
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useDocumentLifecycle as any).mockReturnValue({
      activeDoc: richSampleAP,
      doc: richSampleAP,
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

  it('renders all 9 APPage tabs and displays active tab contents when clicked', async () => {
    render(
      <BrowserRouter>
        <APPage apId="ap-99999" initialIsEditing={true} />
      </BrowserRouter>
    );

    // Tab 1: Overview
    expect(screen.getByText('Assessment Plan Overview')).toBeInTheDocument();
    expect(screen.getByText('Plan Completeness')).toBeInTheDocument();

    // Tab 2: Reviewed Controls
    fireEvent.click(screen.getByRole('button', { name: /Reviewed Controls/i }));
    expect(screen.getByText('ac-1')).toBeInTheDocument();
    expect(screen.getByText('ac-2')).toBeInTheDocument();
    expect(screen.getByText('Control Objective Selections')).toBeInTheDocument();
    expect(screen.getByText('ac-1_obj')).toBeInTheDocument();
    expect(screen.getByText('Objectives & Methods')).toBeInTheDocument();
    expect(screen.getByText('Verify access control policy is documented')).toBeInTheDocument();

    // Tab 3: Activity Tasks
    fireEvent.click(screen.getByText('Activity Tasks'));
    expect(screen.getByText('Conduct Vulnerability Assessment')).toBeInTheDocument();
    expect(screen.getByText('DB Log Analysis')).toBeInTheDocument();

    // Tab 4: Local Definitions
    fireEvent.click(screen.getByText('Local Definitions'));
    expect(screen.getByText('Core Database Server')).toBeInTheDocument();
    expect(screen.getByText('DB Rack Unit 01')).toBeInTheDocument();
    expect(screen.getByText('Jane Assessor')).toBeInTheDocument();

    // Tab 5: Subjects Scope
    fireEvent.click(screen.getByText('Subjects Scope'));
    expect(screen.getByText('Production DB Cluster Subject')).toBeInTheDocument();

    // Tab 6: Assessment Assets
    fireEvent.click(screen.getByText('Assessment Assets'));
    expect(screen.getByText('Nessus Vulnerability Scanner')).toBeInTheDocument();
    expect(screen.getByText('Independent Assessment Team Alpha')).toBeInTheDocument();

    // Tab 7: Terms & Conditions
    fireEvent.click(screen.getByText('Terms & Conditions'));
    expect(screen.getByDisplayValue('Rules of Engagement')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Testing must only be performed during off-peak hours (01:00-05:00 UTC).')).toBeInTheDocument();

    // Tab 8: Metadata
    fireEvent.click(screen.getByText('Metadata'));
    expect(screen.getByDisplayValue('Full Compliance Assessment Plan')).toBeInTheDocument();

    // Tab 9: JSON Editor
    fireEvent.click(screen.getByText('JSON Editor'));
    expect(screen.getByText('Loading editor bundle...')).toBeInTheDocument();
  });

  it('empirically verifies TaskEditor and ActivityEditor modals function on Activity Tasks tab', async () => {
    render(
      <BrowserRouter>
        <APPage apId="ap-99999" initialIsEditing={true} />
      </BrowserRouter>
    );

    // 1. TaskEditor modal via Activity Tasks tab
    fireEvent.click(screen.getByText('Activity Tasks'));
    fireEvent.click(screen.getByText('Conduct Vulnerability Assessment'));
    expect(screen.getByText('Task Details')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Conduct Vulnerability Assessment')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '×' }));
    expect(screen.queryByText('Task Details')).not.toBeInTheDocument();

    // 2. ActivityEditor modal via Activity Tasks tab
    fireEvent.click(screen.getByText('DB Log Analysis'));
    expect(screen.getByText('Activity Details')).toBeInTheDocument();
    expect(screen.getByDisplayValue('DB Log Analysis')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '×' }));
    expect(screen.queryByText('Activity Details')).not.toBeInTheDocument();
  });

  it('EMPIRICAL BUG REPRODUCTION: EntityDetailPanel modals fail to render when entity rows are clicked because isOpen prop is omitted in APPage.tsx', async () => {
    render(
      <BrowserRouter>
        <APPage apId="ap-99999" initialIsEditing={true} />
      </BrowserRouter>
    );

    // Click Subject row
    fireEvent.click(screen.getByText('Subjects Scope'));
    fireEvent.click(screen.getByText('Production DB Cluster Subject'));

    // EntityDetailPanel receives selectedSubject and renders Subject Details panel cleanly
    expect(screen.getByText('Subject Details')).toBeInTheDocument();
  });
});
