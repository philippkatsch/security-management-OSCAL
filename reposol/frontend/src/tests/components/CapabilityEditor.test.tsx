import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CapabilityEditor from '../../components/component-definition/CapabilityEditor';
import { Capability, DefinedComponent, Resource } from '../../lib/types/oscal';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('CapabilityEditor Unit Tests', () => {
  const sampleComponents: DefinedComponent[] = [
    {
      uuid: 'comp-keycloak-1',
      type: 'service',
      title: 'Keycloak IAM',
      description: 'Central identity provider'
    },
    {
      uuid: 'comp-postgres-2',
      type: 'software',
      title: 'PostgreSQL DB',
      description: 'Persistent relational database'
    },
    {
      uuid: 'comp-redis-3',
      type: 'software',
      title: 'Redis Cache',
      description: 'In-memory caching layer'
    }
  ];

  const sampleResources: Resource[] = [
    {
      uuid: 'res-fips-1',
      title: 'FIPS 140-3 Cryptographic Certificate',
      description: 'Module validation'
    }
  ];

  const sampleCapability: Capability = {
    uuid: 'cap-iam-123',
    name: 'Zero Trust Identity Architecture',
    description: 'Unified identity federation, MFA, and database persistence.',
    remarks: 'Enterprise capability for cloud deployments.',
    'incorporates-components': [
      {
        'component-uuid': 'comp-keycloak-1',
        description: 'Authentication broker and token generator'
      },
      {
        'component-uuid': 'comp-postgres-2',
        description: 'User accounts and session storage'
      }
    ],
    'control-implementations': [
      {
        uuid: 'ci-cap-1',
        source: 'https://oscal.nist.gov/catalogs/sp800-53',
        description: 'Capability level access control enforcement',
        'implemented-requirements': [
          {
            uuid: 'req-ac-2',
            'control-id': 'ac-2',
            description: 'Account management jointly handled by Keycloak and PostgreSQL'
          }
        ]
      }
    ],
    props: [
      { name: 'architecture-layer', value: 'security-core' }
    ],
    links: [
      { rel: 'validation', href: '#res-fips-1', text: 'FIPS Cert' }
    ]
  };

  it('renders capability details in read-only mode', () => {
    renderWithProviders(
      <CapabilityEditor
        capability={sampleCapability}
        components={sampleComponents}
        resources={sampleResources}
        editMode={false}
      />
    );

    expect(screen.getByDisplayValue('Zero Trust Identity Architecture')).toBeDisabled();
    expect(screen.getByText(/Unified identity federation, MFA, and database persistence./i)).toBeInTheDocument();
    expect(screen.getByText(/Enterprise capability for cloud deployments./i)).toBeInTheDocument();
    expect(screen.getByText('Keycloak IAM')).toBeInTheDocument();
    expect(screen.getByText('Authentication broker and token generator')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL DB')).toBeInTheDocument();
    expect(screen.getByText('User accounts and session storage')).toBeInTheDocument();
    // Control implementations section
    expect(screen.getByText(/AC-2/i)).toBeInTheDocument();
  });

  it('calls onUpdate when editing name, description, and remarks', () => {
    const handleUpdate = vi.fn();
    renderWithProviders(
      <CapabilityEditor
        capability={sampleCapability}
        components={sampleComponents}
        resources={sampleResources}
        onUpdate={handleUpdate}
        editMode={true}
      />
    );

    // Edit Name
    const nameInput = screen.getByDisplayValue('Zero Trust Identity Architecture');
    fireEvent.change(nameInput, { target: { value: 'Updated Zero Trust IAM' } });
    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Updated Zero Trust IAM'
      })
    );

    // Edit Description
    const descInput = screen.getByDisplayValue('Unified identity federation, MFA, and database persistence.');
    fireEvent.change(descInput, { target: { value: 'Updated description' } });
    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Updated description'
      })
    );

    // Edit Remarks
    const remarksInput = screen.getByDisplayValue('Enterprise capability for cloud deployments.');
    fireEvent.change(remarksInput, { target: { value: 'Updated remarks notes' } });
    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        remarks: 'Updated remarks notes'
      })
    );
  });

  it('allows adding and removing incorporated components', () => {
    const handleUpdate = vi.fn();
    renderWithProviders(
      <CapabilityEditor
        capability={sampleCapability}
        components={sampleComponents}
        resources={sampleResources}
        onUpdate={handleUpdate}
        editMode={true}
      />
    );

    // Available component select
    const addCompSelect = screen.getByDisplayValue('+ Add Component to Capability...');
    fireEvent.change(addCompSelect, { target: { value: 'comp-redis-3' } });

    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        'incorporates-components': expect.arrayContaining([
          expect.objectContaining({ 'component-uuid': 'comp-redis-3' })
        ])
      })
    );

    // Remove first component
    const removeButtons = screen.getAllByRole('button', { name: /Remove/i });
    fireEvent.click(removeButtons[0]);

    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        'incorporates-components': [
          {
            'component-uuid': 'comp-postgres-2',
            description: 'User accounts and session storage'
          }
        ]
      })
    );
  });

  it('allows editing the role description of an incorporated component', () => {
    const handleUpdate = vi.fn();
    renderWithProviders(
      <CapabilityEditor
        capability={sampleCapability}
        components={sampleComponents}
        resources={sampleResources}
        onUpdate={handleUpdate}
        editMode={true}
      />
    );

    const roleInput = screen.getByDisplayValue('Authentication broker and token generator');
    fireEvent.change(roleInput, { target: { value: 'Primary OAuth2 OpenID broker' } });

    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        'incorporates-components': [
          {
            'component-uuid': 'comp-keycloak-1',
            description: 'Primary OAuth2 OpenID broker'
          },
          {
            'component-uuid': 'comp-postgres-2',
            description: 'User accounts and session storage'
          }
        ]
      })
    );
  });

  it('renders ControlImplementationsEditor for capability control mapping', () => {
    renderWithProviders(
      <CapabilityEditor
        capability={sampleCapability}
        components={sampleComponents}
        resources={sampleResources}
        editMode={true}
      />
    );

    // ControlImplementationsEditor controls
    expect(screen.getByText(/Control Implementations \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/AC-2/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Add Single/i })).toBeInTheDocument();
  });
});
