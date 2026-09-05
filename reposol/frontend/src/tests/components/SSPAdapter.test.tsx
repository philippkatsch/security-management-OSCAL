import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SSPAdapter } from '../../components/shared/control-editor/adapters/SSPAdapter';
import { ControlEditorContext } from '../../components/shared/control-editor/ControlEditorContext';

describe('SSPAdapter Polymorphic Stage Adapter Tests (DD-030, DD-036, US 4.15-4.20)', () => {
  let mockDispatch: any;
  let mockControl: any;
  let mockComponents: any[];
  let mockSSP: any;
  let mockImplementation: any;

  beforeEach(() => {
    mockDispatch = vi.fn();

    mockControl = {
      id: 'ac-2',
      title: 'Account Management',
      class: 'SP800-53',
      params: [
        {
          id: 'ac-2_prm_1',
          label: 'account-type-list',
          values: ['individual', 'shared'],
          guidelines: [{ prose: 'Specify allowable system account types' }]
        }
      ],
      parts: [
        {
          id: 'ac-2_smt',
          name: 'statement',
          prose: 'The organization manages information system accounts:',
          parts: [
            {
              id: 'ac-2_smt_a',
              name: 'item',
              prose: 'Identifies and selects account types {{ insert: param, ac-2_prm_1 }};'
            },
            {
              id: 'ac-2_smt_b',
              name: 'item',
              prose: 'Assigns account managers for information system accounts;'
            }
          ]
        }
      ]
    };

    mockComponents = [
      {
        uuid: 'comp-this-system',
        type: 'this-system',
        title: 'Core Platform System',
        description: 'Root system component',
        status: { state: 'operational' }
      },
      {
        uuid: 'comp-keycloak',
        type: 'software',
        title: 'Keycloak IAM Server',
        description: 'Identity and Access Management server',
        status: { state: 'operational' }
      },
      {
        uuid: 'comp-aws-iam',
        type: 'system',
        title: 'AWS Cloud IAM',
        description: 'Common control provider for cloud infrastructure',
        status: { state: 'operational' }
      }
    ];

    mockImplementation = {
      uuid: 'req-ac-2-uuid',
      'control-id': 'ac-2',
      props: [{ name: 'control-origination', value: 'system-specific' }],
      'set-parameters': [
        {
          'param-id': 'ac-2_prm_1',
          values: ['individual', 'system-admin', 'auditor']
        }
      ],
      'by-components': [
        {
          uuid: 'bc-1-uuid',
          'component-uuid': 'comp-keycloak',
          description: 'Keycloak handles user accounts and RBAC mappings.',
          'implementation-status': {
            state: 'implemented',
            remarks: 'Fully functional in production'
          },
          'set-parameters': [
            {
              'param-id': 'ac-2_prm_1',
              values: ['individual', 'system-admin']
            }
          ],
          inherited: [
            {
              uuid: 'inh-1-uuid',
              'provided-uuid': 'aws-iam-provided-1',
              description: 'Physical security of IAM hardware inherited from AWS.'
            }
          ],
          satisfied: [
            {
              uuid: 'sat-1-uuid',
              'responsibility-uuid': 'aws-iam-resp-1',
              description: 'Customer configures IAM password policy and MFA enforcement.'
            }
          ],
          export: {
            provided: [
              {
                uuid: 'exp-prov-1',
                description: 'Single sign-on endpoint provided to tenant microservices.'
              }
            ],
            responsibilities: [
              {
                uuid: 'exp-resp-1',
                description: 'Tenant microservices must validate JWT signatures with Keycloak public keys.'
              }
            ]
          }
        },
        {
          uuid: 'bc-2-uuid',
          'component-uuid': 'comp-this-system',
          description: 'Organizational account management policy.',
          'implementation-status': {
            state: 'implemented'
          }
        }
      ],
      statements: [
        {
          uuid: 'stmt-impl-1',
          'statement-id': 'ac-2_smt_a',
          'by-components': [
            {
              uuid: 'stmt-bc-1',
              'component-uuid': 'comp-keycloak',
              description: 'Keycloak enforces account type provisioning rules.',
              'implementation-status': { state: 'implemented' }
            }
          ]
        }
      ]
    };

    mockSSP = {
      'system-security-plan': {
        uuid: 'ssp-1',
        'system-implementation': {
          components: mockComponents
        },
        'control-implementation': {
          'set-parameters': [
            {
              'param-id': 'ac-2_prm_1',
              values: ['individual', 'group', 'service']
            }
          ],
          'implemented-requirements': [mockImplementation]
        }
      }
    };
  });

  const renderAdapter = (customProps: any = {}, isEditing = true) => {
    return render(
      <ControlEditorContext.Provider
        value={{
          stage: 'ssp',
          control: mockControl,
          isEditing,
          dispatch: mockDispatch
        }}
      >
        <SSPAdapter
          control={mockControl}
          implementation={mockImplementation}
          components={mockComponents}
          ssp={mockSSP['system-security-plan']}
          isEditing={isEditing}
          dispatch={mockDispatch}
          {...customProps}
        />
      </ControlEditorContext.Provider>
    );
  };

  it('renders control origination selector and updates origination tag via dispatch', () => {
    renderAdapter();

    const origSelect = screen.getByTestId('control-origination-select');
    expect(origSelect).toBeInTheDocument();
    expect(origSelect).toHaveValue('system-specific');

    fireEvent.change(origSelect, { target: { value: 'organization' } });

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const action = mockDispatch.mock.calls[0][0];
    expect(action.type).toBe('UPSERT_IMPLEMENTED_REQ');
  });

  it('renders by-components list, allows selecting by-components, and editing narrative description', () => {
    renderAdapter();

    expect(screen.getByTestId('by-components-list')).toBeInTheDocument();
    expect(screen.getByText('Keycloak IAM Server')).toBeInTheDocument();

    const narrativeInput = screen.getByTestId('by-comp-narrative-input');
    expect(narrativeInput).toHaveValue('Keycloak handles user accounts and RBAC mappings.');

    fireEvent.change(narrativeInput, { target: { value: 'Updated narrative for Keycloak account management.' } });

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const action = mockDispatch.mock.calls[0][0];
    expect(action.type).toBe('UPDATE_BY_COMPONENT');
  });

  it('allows changing by-component status and remarks', () => {
    renderAdapter();

    const statusSelect = screen.getByTestId('status-selector');
    expect(statusSelect).toHaveValue('implemented');

    fireEvent.change(statusSelect, { target: { value: 'partial' } });

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const action = mockDispatch.mock.calls[0][0];
    expect(action.type).toBe('UPDATE_BY_COMPONENT');

    const remarksInput = screen.getByTestId('status-remarks-input');
    fireEvent.change(remarksInput, { target: { value: 'MFA rollout in progress' } });
    expect(mockDispatch).toHaveBeenCalledTimes(2);
  });

  it('adds and removes by-components with minimum items guarantee', () => {
    renderAdapter();

    const addBtn = screen.getByTestId('add-by-component-btn');
    fireEvent.click(addBtn);

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch.mock.calls[0][0].type).toBe('ADD_BY_COMPONENT');

    const removeBtn = screen.getByTestId('remove-by-component-btn');
    fireEvent.click(removeBtn);

    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(mockDispatch.mock.calls[1][0].type).toBe('REMOVE_BY_COMPONENT');
  });

  it('renders statement-level mappings and allows adding statement by-components', () => {
    renderAdapter();

    // Switch to Statements tab
    const stmtsTab = screen.getByRole('button', { name: /Statement Mappings/i });
    fireEvent.click(stmtsTab);

    expect(screen.getByTestId('statements-section')).toBeInTheDocument();
    expect(screen.getByText('ac-2_smt_a')).toBeInTheDocument();
    expect(screen.getByText('ac-2_smt_b')).toBeInTheDocument();

    const addStmtBtns = screen.getAllByTestId('add-statement-by-comp-btn');
    fireEvent.click(addStmtBtns[0]);

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch.mock.calls[0][0].type).toBe('ADD_STATEMENT_BY_COMPONENT');
  });

  it('evaluates 4-tier parameter cascade and renders effective values and source badges', () => {
    renderAdapter();

    // Switch to 4-Tier Parameters tab
    const paramsTab = screen.getByRole('button', { name: /4-Tier Parameters/i });
    fireEvent.click(paramsTab);

    expect(screen.getByTestId('param-cascade-card')).toBeInTheDocument();
    expect(screen.getByText('ac-2_prm_1')).toBeInTheDocument();

    // Tier 1 component override takes highest precedence: ['individual', 'system-admin']
    const badge = screen.getByTestId('param-effective-badge');
    expect(badge).toHaveTextContent('individual, system-admin');
    expect(badge).toHaveTextContent('Component Override');

    // Override input and save
    const overrideInput = screen.getByTestId('param-override-input');
    fireEvent.change(overrideInput, { target: { value: 'individual, admin, contractor' } });

    const saveBtn = screen.getByTestId('save-param-override-btn');
    fireEvent.click(saveBtn);

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch.mock.calls[0][0].type).toBe('SET_SSP_PARAMETER_VALUE');
  });

  it('manages Security Inheritance in Consumer Mode (inherited and satisfied)', () => {
    renderAdapter();

    // Switch to Security Inheritance tab
    const inheritTab = screen.getByRole('button', { name: /Security Inheritance/i });
    fireEvent.click(inheritTab);

    expect(screen.getByTestId('inheritance-section')).toBeInTheDocument();
    expect(screen.getByText(/Physical security of IAM hardware inherited from AWS/i)).toBeInTheDocument();
    expect(screen.getByText(/Customer configures IAM password policy/i)).toBeInTheDocument();

    // Add Inherited
    const addInhBtn = screen.getByTestId('add-inherited-btn');
    fireEvent.click(addInhBtn);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch.mock.calls[0][0].type).toBe('SET_SECURITY_INHERITANCE');

    // Add Satisfied
    const addSatBtn = screen.getByTestId('add-satisfied-btn');
    fireEvent.click(addSatBtn);
    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(mockDispatch.mock.calls[1][0].type).toBe('SET_SECURITY_INHERITANCE');
  });

  it('manages Security Inheritance in Provider Mode (export provided and responsibilities)', () => {
    renderAdapter();

    const inheritTab = screen.getByRole('button', { name: /Security Inheritance/i });
    fireEvent.click(inheritTab);

    const providerBtn = screen.getByRole('button', { name: /CSP Provider Mode/i });
    fireEvent.click(providerBtn);

    expect(screen.getByText(/Single sign-on endpoint provided to tenant microservices/i)).toBeInTheDocument();
    expect(screen.getByText(/Tenant microservices must validate JWT signatures/i)).toBeInTheDocument();

    // Add Export Provided
    const addExportBtn = screen.getByTestId('add-export-provided-btn');
    fireEvent.click(addExportBtn);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch.mock.calls[0][0].type).toBe('SET_SECURITY_INHERITANCE');

    // Add Export Responsibility
    const addExportRespBtn = screen.getByTestId('add-export-responsibility-btn');
    fireEvent.click(addExportRespBtn);
    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(mockDispatch.mock.calls[1][0].type).toBe('SET_SECURITY_INHERITANCE');
  });
});
