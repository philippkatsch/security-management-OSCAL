import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssessmentSubjectsAssetsTab } from '../../../components/assessment-plan/AssessmentSubjectsAssetsTab';
import { AssessmentPlan } from '../../../lib/types/oscal';

vi.mock('../../../lib/api', () => ({
  fetchDocument: vi.fn().mockResolvedValue({
    'system-security-plan': {
      'system-implementation': {
        components: [
          { uuid: 'comp-db', title: 'PostgreSQL Relational DB' },
          { uuid: 'comp-app', title: 'Kubernetes App Cluster' },
        ],
        'inventory-items': [
          { uuid: 'inv-1', description: 'Server Rack Alpha' },
        ],
        users: [
          { uuid: 'usr-1', title: 'Jane SysAdmin' },
        ],
      },
    },
  }),
}));

describe('AssessmentSubjectsAssetsTab', () => {
  const mockDispatch = vi.fn();

  const mockAP: AssessmentPlan = {
    uuid: 'ap-1',
    metadata: {
      title: 'Testing Plan',
      version: '1.0.0',
      'oscal-version': '1.2.2',
    },
    'import-ssp': {
      href: '../system-security-plans/00000000-0000-0000-0000-000000000001.json',
    },
    'reviewed-controls': {
      'control-selections': [{ 'include-all': {} }],
    },
    'assessment-subjects': [
      {
        type: 'component',
        description: 'Production Database Servers',
        'include-all': {},
      },
    ],
    'assessment-assets': {
      components: [
        {
          uuid: 'tool-1',
          title: 'Nessus Vulnerability Scanner',
          type: 'software',
          description: 'Network vulnerability assessment tool',
          status: { state: 'operational' },
        },
      ],
      'assessment-platforms': [
        {
          uuid: 'plat-1',
          title: 'Automated Scan Platform',
          'uses-components': [{ 'component-uuid': 'tool-1' }],
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders subjects list and switches to assets & platforms view', () => {
    render(
      <AssessmentSubjectsAssetsTab
        document={mockAP}
        dispatch={mockDispatch}
        isEditing={true}
      />
    );

    // Subjects tab by default
    expect(screen.getByText('Production Database Servers')).toBeInTheDocument();
    expect(screen.getByText(/Includes all instances of type/i)).toBeInTheDocument();

    // Switch to Assets view
    const assetsToggleBtn = screen.getByRole('button', { name: /Assessment Assets & Platforms/i });
    fireEvent.click(assetsToggleBtn);

    expect(screen.getAllByText('Nessus Vulnerability Scanner').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Automated Scan Platform')).toBeInTheDocument();
  });

  it('handles adding new subject group and auto-populate action', async () => {
    render(
      <AssessmentSubjectsAssetsTab
        document={mockAP}
        dispatch={mockDispatch}
        isEditing={true}
      />
    );

    const descInput = screen.getByPlaceholderText(/Production Database Cluster Nodes/i);
    const addSubjBtn = screen.getByRole('button', { name: /\+ Add Subject Scope/i });

    fireEvent.change(descInput, { target: { value: 'Frontend Web Servers' } });
    fireEvent.click(addSubjBtn);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_ASSESSMENT_SUBJECT',
      })
    );

    await waitFor(() => {
      const autoPopBtn = screen.getByRole('button', { name: /Auto-Populate Subjects from SSP/i });
      fireEvent.click(autoPopBtn);
      expect(mockDispatch).toHaveBeenCalled();
    });
  });

  it('handles adding new asset component tool in assets view', () => {
    render(
      <AssessmentSubjectsAssetsTab
        document={mockAP}
        dispatch={mockDispatch}
        isEditing={true}
      />
    );

    // Switch to Assets view
    fireEvent.click(screen.getByRole('button', { name: /Assessment Assets & Platforms/i }));

    const toolTitleInput = screen.getByPlaceholderText(/Nessus Scanner/i);
    const addToolBtn = screen.getByRole('button', { name: /\+ Add Tool/i });

    fireEvent.change(toolTitleInput, { target: { value: 'Burp Suite Professional' } });
    fireEvent.click(addToolBtn);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_ASSET_COMPONENT',
      })
    );
  });
});
