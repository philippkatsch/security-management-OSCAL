import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SystemImplementationTab from '../../components/ssp/SystemImplementationTab';
import * as api from '../../lib/api';

// Mock authFetch for CdefImportModal
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api');
  return {
    ...actual,
    authFetch: vi.fn()
  };
});

describe('SystemImplementationTab Component', () => {
  const mockDispatch = vi.fn();
  const mockHandleUpdateField = vi.fn();

  const sampleSysImp = {
    components: [
      {
        uuid: 'comp-root',
        type: 'this-system',
        title: 'Core System',
        description: 'Root system component representing the system as a whole.',
        status: { state: 'operational' },
        props: [{ name: 'implementation-point', value: 'internal' }]
      },
      {
        uuid: 'comp-web',
        type: 'software',
        title: 'Nginx Web Server',
        description: 'Ingress reverse proxy and TLS terminator.',
        purpose: 'SSL Termination',
        status: { state: 'operational' },
        protocols: [
          {
            name: 'https',
            title: 'HTTPS Web',
            'port-ranges': [{ start: 443, end: 443, transport: 'TCP' }]
          }
        ]
      }
    ],
    users: [
      {
        uuid: 'user-admin',
        title: 'System Administrator',
        'short-name': 'SysAdmin',
        description: 'Full cluster and database administrator.',
        props: [
          { name: 'type', value: 'internal' },
          { name: 'privilege-level', value: 'privileged' }
        ],
        'role-ids': ['system-owner', 'maintainer'],
        'authorized-privileges': [
          {
            title: 'Cluster Root Access',
            'functions-performed': ['Deploy pods', 'Rotate TLS secrets']
          }
        ]
      }
    ],
    'inventory-items': [
      {
        uuid: 'inv-1',
        description: 'Production RDS Database Instance',
        props: [
          { name: 'asset-id', value: 'rds-prod-01' },
          { name: 'ipv4-address', value: '10.0.5.22' },
          { name: 'asset-type', value: 'database-instance' },
          { name: 'is-scanned', value: 'yes' }
        ],
        'implemented-components': [{ 'component-uuid': 'comp-web' }]
      }
    ],
    'leveraged-authorizations': [
      {
        uuid: 'auth-aws',
        title: 'AWS FedRAMP High Authorization',
        'party-uuid': 'party-aws',
        'date-authorized': '2026-01-15',
        links: [{ rel: 'system-security-plan', href: 'https://compliance.aws.amazon.com/ssp' }]
      }
    ]
  };

  const sampleSsp = {
    metadata: {
      title: 'Test Enterprise SSP',
      parties: [
        { uuid: 'party-aws', name: 'Amazon Web Services', type: 'organization' },
        { uuid: 'party-alice', name: 'Alice Smith', type: 'person' }
      ],
      roles: [
        { id: 'system-owner', title: 'System Owner' },
        { id: 'maintainer', title: 'Maintainer' }
      ]
    },
    'system-characteristics': {
      'system-name': 'Test Enterprise System'
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 4 sub-tabs and defaults to components list', () => {
    render(
      <SystemImplementationTab
        sysImp={sampleSysImp}
        isEditing={true}
        dispatch={mockDispatch}
        ssp={sampleSsp}
      />
    );

    expect(screen.getByText('Components')).toBeInTheDocument();
    expect(screen.getByText('Users & Privileges')).toBeInTheDocument();
    expect(screen.getByText('Inventory Items')).toBeInTheDocument();
    expect(screen.getByText('Leveraged Authorizations')).toBeInTheDocument();

    // Components tab active by default
    expect(screen.getByText('Core System')).toBeInTheDocument();
    expect(screen.getByText('Nginx Web Server')).toBeInTheDocument();
  });

  it('auto-provisions this-system root component if components is empty', () => {
    render(
      <SystemImplementationTab
        sysImp={{ components: [] }}
        isEditing={true}
        dispatch={mockDispatch}
        ssp={sampleSsp}
      />
    );

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'INIT_COMPONENTS'
      })
    );
  });

  it('opens ComponentDrawer when clicking a component row and allows editing', () => {
    render(
      <SystemImplementationTab
        sysImp={sampleSysImp}
        isEditing={true}
        dispatch={mockDispatch}
        ssp={sampleSsp}
      />
    );

    const nginxRow = screen.getByText('Nginx Web Server');
    fireEvent.click(nginxRow);

    // ComponentDrawer opens
    expect(screen.getByText('Edit System Component')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Nginx Web Server')).toBeInTheDocument();
    expect(screen.getByDisplayValue('SSL Termination')).toBeInTheDocument();

    // Switch to Protocols tab in drawer
    const protocolsTab = screen.getByText(/Protocols & Ports/i);
    fireEvent.click(protocolsTab);
    expect(screen.getByDisplayValue('https')).toBeInTheDocument();

    // Save changes
    const saveBtn = screen.getByText('Save Component');
    fireEvent.click(saveBtn);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_SYSTEM_COMPONENT'
      })
    );
  });

  it('opens ComponentDrawer when clicking + Add Component and adds protocol template', () => {
    render(
      <SystemImplementationTab
        sysImp={sampleSysImp}
        isEditing={true}
        dispatch={mockDispatch}
        ssp={sampleSsp}
      />
    );

    const addCompBtn = screen.getByText('+ Add Component');
    fireEvent.click(addCompBtn);

    expect(screen.getByText('Edit System Component')).toBeInTheDocument();

    // Fill title
    const titleInput = screen.getByDisplayValue('New Component');
    fireEvent.change(titleInput, { target: { value: 'PostgreSQL DB' } });

    // Switch to protocols tab and add PostgreSQL preset
    const protocolsTab = screen.getByText(/Protocols & Ports/i);
    fireEvent.click(protocolsTab);

    const postgresBtn = screen.getByText(/\+ PostgreSQL Database/i);
    fireEvent.click(postgresBtn);

    expect(screen.getByDisplayValue('postgresql')).toBeInTheDocument();

    // Save component
    const saveBtn = screen.getByText('Save Component');
    fireEvent.click(saveBtn);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_SYSTEM_COMPONENT'
      })
    );
  });

  it('switches to Users tab, displays users table, and opens UserDrawer', () => {
    render(
      <SystemImplementationTab
        sysImp={sampleSysImp}
        isEditing={true}
        dispatch={mockDispatch}
        ssp={sampleSsp}
      />
    );

    const usersTab = screen.getByText('Users & Privileges');
    fireEvent.click(usersTab);

    expect(screen.getByText('System Administrator')).toBeInTheDocument();
    expect(screen.getByText('SysAdmin')).toBeInTheDocument();
    expect(screen.getByText('privileged')).toBeInTheDocument();

    // Click user row to open drawer
    const userRow = screen.getByText('System Administrator');
    fireEvent.click(userRow);

    expect(screen.getByText('👤 Edit System User Class')).toBeInTheDocument();

    // Check Privileges sub-tab
    const privsTab = screen.getByText(/Authorized Privileges/i);
    fireEvent.click(privsTab);

    expect(screen.getByDisplayValue('Cluster Root Access')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Deploy pods')).toBeInTheDocument();

    // Add function
    const addFuncBtn = screen.getByText('+ Add Function');
    fireEvent.click(addFuncBtn);

    // Save user
    const saveBtn = screen.getByText('Save User Class');
    fireEvent.click(saveBtn);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_SYSTEM_USER'
      })
    );
  });

  it('switches to Inventory Items tab, opens InventoryDrawer and binds description', () => {
    render(
      <SystemImplementationTab
        sysImp={sampleSysImp}
        isEditing={true}
        dispatch={mockDispatch}
        ssp={sampleSsp}
      />
    );

    const invTab = screen.getByText('Inventory Items');
    fireEvent.click(invTab);

    expect(screen.getByText('Production RDS Database Instance')).toBeInTheDocument();
    expect(screen.getByText('rds-prod-01')).toBeInTheDocument();

    // Click inventory row to open drawer
    const invRow = screen.getByText('Production RDS Database Instance');
    fireEvent.click(invRow);

    expect(screen.getByText('🖥️ Edit Asset Inventory Item')).toBeInTheDocument();

    // Verify description is strictly bound
    const descTextarea = screen.getByDisplayValue('Production RDS Database Instance');
    fireEvent.change(descTextarea, { target: { value: 'Updated RDS Database Instance (eu-west-1)' } });

    // Check Implemented Components tab
    const compTab = screen.getByText(/Implemented Components/i);
    fireEvent.click(compTab);

    expect(screen.getByText('Nginx Web Server')).toBeInTheDocument();

    // Save inventory item
    const saveBtn = screen.getByText('Save Inventory Item');
    fireEvent.click(saveBtn);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_INVENTORY_ITEM'
      })
    );
  });

  it('switches to Leveraged Authorizations tab, opens LeveragedAuthDrawer and resolves party name', () => {
    render(
      <SystemImplementationTab
        sysImp={sampleSysImp}
        isEditing={true}
        dispatch={mockDispatch}
        ssp={sampleSsp}
      />
    );

    const authTab = screen.getByText('Leveraged Authorizations');
    fireEvent.click(authTab);

    expect(screen.getByText('AWS FedRAMP High Authorization')).toBeInTheDocument();
    expect(screen.getByText('Amazon Web Services')).toBeInTheDocument();

    // Click auth row to open drawer
    const authRow = screen.getByText('AWS FedRAMP High Authorization');
    fireEvent.click(authRow);

    expect(screen.getByText(/Edit Leveraged Authorization/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('AWS FedRAMP High Authorization')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-01-15')).toBeInTheDocument();

    // Save auth
    const saveBtn = screen.getByText('Save Authorization');
    fireEvent.click(saveBtn);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_LEVERAGED_AUTH'
      })
    );
  });

  it('supports importing components from Component Definition via CdefImportModal', async () => {
    const mockAuthFetch = vi.mocked(api.authFetch);
    mockAuthFetch.mockImplementation(async (url: string) => {
      if (url === '/api/documents/component-definitions') {
        return {
          ok: true,
          json: async () => [
            { id: 'cdef-1', uuid: 'cdef-1', title: 'PostgreSQL Baseline CDEF' }
          ]
        } as any;
      }
      if (url === '/api/documents/component-definitions/cdef-1') {
        return {
          ok: true,
          json: async () => ({
            'component-definition': {
              uuid: 'cdef-1',
              title: 'PostgreSQL Baseline CDEF',
              components: [
                {
                  uuid: 'cdef-comp-1',
                  type: 'service',
                  title: 'PostgreSQL Relational DB',
                  description: 'Managed relational database engine',
                  protocols: [{ name: 'postgresql', title: 'PostgreSQL' }]
                }
              ]
            }
          })
        } as any;
      }
      return { ok: false } as any;
    });

    render(
      <SystemImplementationTab
        sysImp={sampleSysImp}
        isEditing={true}
        dispatch={mockDispatch}
        ssp={sampleSsp}
      />
    );

    const importCdefBtn = screen.getByText('Import from CDEF');
    fireEvent.click(importCdefBtn);

    expect(screen.getByText(/Import from Component Definition/i)).toBeInTheDocument();

    // Wait for definitions dropdown and select cdef-1
    await waitFor(() => {
      expect(screen.getByText('PostgreSQL Baseline CDEF')).toBeInTheDocument();
    });

    const selectCdef = screen.getByRole('combobox');
    fireEvent.change(selectCdef, { target: { value: 'cdef-1' } });

    // Wait for components to load
    await waitFor(() => {
      expect(screen.getByText('PostgreSQL Relational DB')).toBeInTheDocument();
    });

    const importBtn = screen.getByText(/Import \(1\) Component/i);
    fireEvent.click(importBtn);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_SYSTEM_COMPONENT'
      })
    );
  });
});
