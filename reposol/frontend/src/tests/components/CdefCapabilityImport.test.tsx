import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CdefImportModal from '../../components/ssp/drawers/CdefImportModal';
import { SystemImplementationTab } from '../../components/ssp/SystemImplementationTab';
import * as api from '../../lib/api';

vi.mock('../../lib/api', () => ({
  authFetch: vi.fn(),
  getWorkspaceHeaders: vi.fn(() => ({})),
  getApiBaseUrl: vi.fn(() => 'http://localhost:8000')
}));

describe('CDEF Capability Import into SSP Suite', () => {
  const sampleCdefWithCapability = {
    'component-definition': {
      uuid: 'cdef-iam-composite',
      metadata: {
        title: 'Enterprise IAM Composite Catalog'
      },
      components: [
        {
          uuid: 'comp-db-1',
          type: 'software',
          title: 'PostgreSQL Relational DB',
          description: 'Database server'
        }
      ],
      capabilities: [
        {
          uuid: 'cap-iam-zero-trust',
          name: 'Zero Trust Authentication Capability',
          description: 'Comprehensive identity verification and SSO federation.',
          'incorporates-components': [
            {
              'component-uuid': 'comp-db-1',
              description: 'Credential and session store'
            }
          ],
          'control-implementations': [
            {
              uuid: 'ci-cap-1',
              source: 'https://oscal.nist.gov/catalogs/sp800-53',
              description: 'Access control and authentication',
              'implemented-requirements': [
                {
                  uuid: 'req-ia-2',
                  'control-id': 'ia-2',
                  description: 'Identification and Authentication via Zero Trust Capability'
                }
              ]
            }
          ]
        }
      ]
    }
  };

  it('renders capabilities alongside components and allows filtering by category', async () => {
    const mockAuthFetch = vi.mocked(api.authFetch);
    mockAuthFetch.mockImplementation(async (url: string) => {
      if (url === '/api/documents/component-definitions') {
        return {
          ok: true,
          json: async () => [
            { uuid: 'cdef-iam-composite', metadata: { title: 'Enterprise IAM Composite Catalog' } }
          ]
        } as any;
      }
      if (url === '/api/documents/component-definitions/cdef-iam-composite') {
        return {
          ok: true,
          json: async () => sampleCdefWithCapability
        } as any;
      }
      return { ok: false } as any;
    });

    render(
      <CdefImportModal
        isOpen={true}
        onClose={vi.fn()}
        onImport={vi.fn()}
      />
    );

    // Wait for definitions to load in dropdown
    await waitFor(() => {
      expect(screen.getByText('Enterprise IAM Composite Catalog')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'cdef-iam-composite' } });

    // Wait for components & capabilities to appear
    await waitFor(() => {
      expect(screen.getByText('PostgreSQL Relational DB')).toBeInTheDocument();
      expect(screen.getByText('Zero Trust Authentication Capability')).toBeInTheDocument();
    });

    // Test filter pills
    expect(screen.getByText(/All \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/🧱 Components \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/⚡ Capabilities \(1\)/i)).toBeInTheDocument();

    // Click Capabilities pill
    const capPill = screen.getByText(/⚡ Capabilities \(1\)/i);
    fireEvent.click(capPill);

    expect(screen.getByText('Zero Trust Authentication Capability')).toBeInTheDocument();
    expect(screen.queryByText('PostgreSQL Relational DB')).not.toBeInTheDocument();
  });

  it('imports capability into SSP as a system-component and creates control implementation requirement', async () => {
    const mockAuthFetch = vi.mocked(api.authFetch);
    mockAuthFetch.mockImplementation(async (url: string) => {
      if (url === '/api/documents/component-definitions') {
        return {
          ok: true,
          json: async () => [
            { uuid: 'cdef-iam-composite', metadata: { title: 'Enterprise IAM Composite Catalog' } }
          ]
        } as any;
      }
      if (url === '/api/documents/component-definitions/cdef-iam-composite') {
        return {
          ok: true,
          json: async () => sampleCdefWithCapability
        } as any;
      }
      return { ok: false } as any;
    });

    const mockDispatch = vi.fn();

    render(
      <SystemImplementationTab
        sysImp={{ components: [], users: [], 'inventory-items': [], 'leveraged-authorizations': [] }}
        isEditing={true}
        dispatch={mockDispatch}
        ssp={{ metadata: { title: 'Target Enterprise SSP' } }}
      />
    );

    const importCdefBtn = screen.getByText('Import from CDEF');
    fireEvent.click(importCdefBtn);

    await waitFor(() => {
      expect(screen.getByText('Enterprise IAM Composite Catalog')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'cdef-iam-composite' } });

    await waitFor(() => {
      expect(screen.getByText('Zero Trust Authentication Capability')).toBeInTheDocument();
    });

    // Uncheck component inside modal, keep only capability checked
    const compText = screen.getByText('PostgreSQL Relational DB');
    const compRow = compText.closest('div[class*="rounded border"]');
    const compCheckbox = compRow!.querySelector('input[type="checkbox"]')!;
    fireEvent.click(compCheckbox);

    // Click Import Capability
    const importBtn = screen.getByText(/Import \(1\) Capabilit/i);
    fireEvent.click(importBtn);

    // Verify component was added for the capability
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_SYSTEM_COMPONENT'
      })
    );

    // Verify control requirements were upserted and mapped to the capability
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPSERT_IMPLEMENTED_REQ'
      })
    );

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_BY_COMPONENT'
      })
    );
  });

  it('imports both component and capability cleanly without empty protocols or parameter schema violations', async () => {
    const mockAuthFetch = vi.mocked(api.authFetch);
    mockAuthFetch.mockImplementation(async (url: string) => {
      if (url === '/api/documents/component-definitions') {
        return {
          ok: true,
          json: async () => [
            { uuid: 'cdef-iam-composite', metadata: { title: 'Enterprise IAM Composite Catalog' } }
          ]
        } as any;
      }
      if (url === '/api/documents/component-definitions/cdef-iam-composite') {
        return {
          ok: true,
          json: async () => sampleCdefWithCapability
        } as any;
      }
      return { ok: false } as any;
    });

    let importedItems: any[] = [];
    render(
      <CdefImportModal
        isOpen={true}
        onClose={vi.fn()}
        onImport={(imported) => {
          importedItems = imported;
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Enterprise IAM Composite Catalog')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'cdef-iam-composite' } });

    await waitFor(() => {
      expect(screen.getByText('Zero Trust Authentication Capability')).toBeInTheDocument();
    });

    // Both are selected by default. Click import button
    const importBtn = screen.getByText(/Import \(2\) Items/i);
    fireEvent.click(importBtn);

    expect(importedItems).toHaveLength(2);

    // Verify comp has no empty protocols array (minItems: 1 constraint)
    const importedComp = importedItems.find(i => i.title === 'PostgreSQL Relational DB');
    expect(importedComp).toBeDefined();
    expect(importedComp.protocols).toBeUndefined();
    expect(importedComp.status).toEqual({ state: 'operational' });

    // Verify cap has service type and is-capability prop
    const importedCap = importedItems.find(i => i.title === 'Zero Trust Authentication Capability');
    expect(importedCap).toBeDefined();
    expect(importedCap.type).toBe('service');
    expect(importedCap.props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'is-capability', value: 'true' })
      ])
    );
  });
});
