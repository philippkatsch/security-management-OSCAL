import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TasksTimelineTab } from '../../../components/assessment-plan/TasksTimelineTab';
import { AssessmentPlan } from '../../../lib/types/oscal';

describe('TasksTimelineTab', () => {
  const mockDispatch = vi.fn();

  const mockAP: AssessmentPlan = {
    uuid: 'ap-1',
    metadata: {
      title: 'Testing Plan',
      version: '1.0.0',
      'oscal-version': '1.2.2',
      roles: [{ id: 'lead-assessor', title: 'Lead Assessor' }],
    },
    'import-ssp': {
      href: '../system-security-plans/00000000-0000-0000-0000-000000000001.json',
    },
    'reviewed-controls': {
      'control-selections': [{ 'include-all': {} }],
    },
    'local-definitions': {
      activities: [
        {
          uuid: 'act-1',
          title: 'Vulnerability Scan Execution',
          description: 'Run automated scanners',
        },
      ],
    },
    tasks: [
      {
        uuid: 'task-1',
        title: 'Initial Scoping Milestone',
        type: 'milestone',
        timing: {
          'on-date': { date: '2026-10-01' },
        },
      },
      {
        uuid: 'task-2',
        title: 'Network & Port Scanning',
        type: 'action',
        timing: {
          'within-date-range': { start: '2026-10-02', end: '2026-10-10' },
        },
        dependencies: [{ 'task-uuid': 'task-1' }],
        'associated-activities': [{ 'activity-uuid': 'act-1' }],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders task cards and timing information in default cards view', () => {
    render(
      <TasksTimelineTab
        document={mockAP}
        dispatch={mockDispatch}
        isEditing={true}
      />
    );

    expect(screen.getByText('Initial Scoping Milestone')).toBeInTheDocument();
    expect(screen.getByText('Date: 2026-10-01')).toBeInTheDocument();
    expect(screen.getByText('Network & Port Scanning')).toBeInTheDocument();
    expect(screen.getByText('2026-10-02 → 2026-10-10')).toBeInTheDocument();
    expect(screen.getByText(/Depends on:/i)).toBeInTheDocument();
  });

  it('switches between Cards/List view and Interactive Gantt Timeline view', () => {
    render(
      <TasksTimelineTab
        document={mockAP}
        dispatch={mockDispatch}
        isEditing={true}
      />
    );

    // Switch to Gantt view
    const timelineToggleBtn = screen.getByRole('button', { name: /Interactive Gantt Timeline/i });
    fireEvent.click(timelineToggleBtn);

    expect(screen.getByText('Visual Gantt / Timeline Sequence')).toBeInTheDocument();
    expect(screen.getByText(/Milestone Marker:/i)).toBeInTheDocument();
  });

  it('opens TaskEditorModal when "+ New Task" is clicked', () => {
    render(
      <TasksTimelineTab
        document={mockAP}
        dispatch={mockDispatch}
        isEditing={true}
      />
    );

    const newTaskBtn = screen.getByRole('button', { name: /\+ New Task/i });
    fireEvent.click(newTaskBtn);

    expect(screen.getByText('New Assessment Task')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Vulnerability Scan/i)).toBeInTheDocument();
  });
});
