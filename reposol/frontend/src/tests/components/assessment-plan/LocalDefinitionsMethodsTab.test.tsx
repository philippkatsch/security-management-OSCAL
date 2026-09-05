import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalDefinitionsMethodsTab } from '../../../components/assessment-plan/LocalDefinitionsMethodsTab';
import { AssessmentPlan } from '../../../lib/types/oscal';

describe('LocalDefinitionsMethodsTab', () => {
  const mockDispatch = vi.fn();

  const mockAP: AssessmentPlan = {
    uuid: 'ap-1',
    metadata: {
      title: 'Testing Plan',
      version: '1.0.0',
      'oscal-version': '1.2.2',
      roles: [{ id: 'security-evaluator', title: 'Security Evaluator' }],
    },
    'import-ssp': {
      href: '../system-security-plans/00000000-0000-0000-0000-000000000001.json',
    },
    'reviewed-controls': {
      'control-selections': [{ 'include-all': {} }],
    },
    'local-definitions': {
      components: [
        {
          uuid: 'local-comp-1',
          title: 'Bastion Test Host',
          type: 'software',
          status: { state: 'operational' },
        },
      ],
      users: [
        {
          uuid: 'local-user-1',
          title: 'Auditor Test Account',
          'role-ids': ['auditor'],
        },
      ],
      'objectives-and-methods': [
        {
          'control-id': 'ac-2',
          description: 'Evaluate account creation approval procedures',
          parts: [
            {
              name: 'assessment-objective',
              prose: 'Review account tickets for authorizing signatures.',
              props: [{ name: 'method-id', value: 'ac-2-method-1' }],
            },
            {
              name: 'assessment-method',
              props: [{ name: 'method', value: 'EXAMINE' }],
              parts: [{ name: 'assessment-objects', prose: 'Ticket management logs.' }],
            },
          ],
        },
      ],
      activities: [
        {
          uuid: 'local-act-1',
          title: 'Static Analysis Scan',
          description: 'Execute automated SAST pipeline against codebase',
          props: [{ name: 'method', value: 'TEST' }],
          steps: [
            { uuid: 'step-1', title: 'Run SonarQube', description: 'Trigger static scan' },
          ],
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders local objectives with evaluation methods and allows defining new objective', () => {
    render(
      <LocalDefinitionsMethodsTab
        document={mockAP}
        dispatch={mockDispatch}
        isEditing={true}
      />
    );

    expect(screen.getByText('ac-2')).toBeInTheDocument();
    expect(screen.getByText('Method: EXAMINE')).toBeInTheDocument();
    expect(screen.getByText(/Review account tickets/i)).toBeInTheDocument();

    // Add new objective
    const ctrlInput = screen.getByPlaceholderText('ac-2');
    const descTextarea = screen.getByPlaceholderText(/Verify that account management procedures/i);
    const addObjBtn = screen.getByRole('button', { name: /\+ Add Objective & Method/i });

    fireEvent.change(ctrlInput, { target: { value: 'ia-2' } });
    fireEvent.change(descTextarea, { target: { value: 'Verify MFA implementation' } });
    fireEvent.click(addObjBtn);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_LOCAL_OBJECTIVE',
      })
    );
  });

  it('switches to Procedural Activities sub-tab and opens ActivityEditorModal', () => {
    render(
      <LocalDefinitionsMethodsTab
        document={mockAP}
        dispatch={mockDispatch}
        isEditing={true}
      />
    );

    // Switch to Activities
    fireEvent.click(screen.getByRole('button', { name: /Procedural Activities/i }));

    expect(screen.getByText('Static Analysis Scan')).toBeInTheDocument();
    expect(screen.getByText('TEST')).toBeInTheDocument();
    expect(screen.getByText('1 Step')).toBeInTheDocument();

    // Open modal
    const editActBtn = screen.getByRole('button', { name: /Edit Activity/i });
    fireEvent.click(editActBtn);

    expect(screen.getByText('Edit Assessment Activity')).toBeInTheDocument();
  });

  it('switches to Local Components & Users sub-tab and allows adding new entities', () => {
    render(
      <LocalDefinitionsMethodsTab
        document={mockAP}
        dispatch={mockDispatch}
        isEditing={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Local Components & Users/i }));

    expect(screen.getByText('Bastion Test Host')).toBeInTheDocument();
    expect(screen.getByText('Auditor Test Account')).toBeInTheDocument();

    // Add local component
    const compInput = screen.getByPlaceholderText('Component Title');
    const addCompBtn = screen.getByRole('button', { name: /Add Component/i });

    fireEvent.change(compInput, { target: { value: 'Custom Pen-Testing Proxy' } });
    fireEvent.click(addCompBtn);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_LOCAL_COMPONENT',
      })
    );
  });
});
