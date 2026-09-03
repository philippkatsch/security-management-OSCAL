import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ComponentRolesEditor, OSCAL_STANDARD_ROLES } from '../../components/component-definition/editors/ComponentRolesEditor';
import { ResponsibleRole } from '../../lib/types/oscal';

describe('ComponentRolesEditor Unit Tests', () => {
  const sampleParties = [
    { uuid: 'party-001', name: 'Alice Security Admin', type: 'person', 'email-addresses': ['alice@example.com'] },
    { uuid: 'party-002', name: 'Ops Corp Inc', type: 'organization', 'email-addresses': ['info@opscorp.com'] }
  ];

  const sampleRoles: ResponsibleRole[] = [
    {
      'role-id': 'asset-owner',
      'party-uuids': ['party-001'],
      remarks: 'Primary asset owner for security review'
    }
  ];

  it('renders roles and assigned parties in read-only mode', () => {
    render(
      <ComponentRolesEditor
        roles={sampleRoles}
        parties={sampleParties}
        onChange={vi.fn()}
        editMode={false}
      />
    );

    expect(screen.getByText('Asset Owner')).toBeInTheDocument();
    expect(screen.getByText('Alice Security Admin')).toBeInTheDocument();
    expect(screen.getByText(/Primary asset owner for security review/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+ Add Responsible Role/i })).not.toBeInTheDocument();
  });

  it('renders dropdown with 9 standard roles and allows selecting a different standard role', () => {
    const mockOnChange = vi.fn();
    render(
      <ComponentRolesEditor
        roles={sampleRoles}
        parties={sampleParties}
        onChange={mockOnChange}
        editMode={true}
      />
    );

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    
    // Check all standard roles exist in options
    OSCAL_STANDARD_ROLES.forEach(sr => {
      expect(screen.getByRole('option', { name: new RegExp(sr.label, 'i') })).toBeInTheDocument();
    });

    fireEvent.change(select, { target: { value: 'maintainer' } });

    expect(mockOnChange).toHaveBeenCalled();
    const updated = mockOnChange.mock.calls[0][0];
    expect(updated[0]['role-id']).toBe('maintainer');
  });

  it('allows adding a custom role via custom option and typing custom role ID', () => {
    const mockOnChange = vi.fn();
    render(
      <ComponentRolesEditor
        roles={sampleRoles}
        parties={sampleParties}
        onChange={mockOnChange}
        editMode={true}
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '__custom__' } });

    expect(mockOnChange).toHaveBeenCalled();
  });

  it('toggles party assignment when party button is clicked', () => {
    const mockOnChange = vi.fn();
    render(
      <ComponentRolesEditor
        roles={sampleRoles}
        parties={sampleParties}
        onChange={mockOnChange}
        editMode={true}
      />
    );

    // Toggle Ops Corp Inc (party-002)
    const partyBtn = screen.getByRole('button', { name: /Ops Corp Inc/i });
    expect(partyBtn).toBeInTheDocument();
    fireEvent.click(partyBtn);

    expect(mockOnChange).toHaveBeenCalled();
    const updated = mockOnChange.mock.calls[0][0];
    expect(updated[0]['party-uuids']).toContain('party-001');
    expect(updated[0]['party-uuids']).toContain('party-002');
  });

  it('allows adding and removing a role', () => {
    const mockOnChange = vi.fn();
    render(
      <ComponentRolesEditor
        roles={sampleRoles}
        parties={sampleParties}
        onChange={mockOnChange}
        editMode={true}
      />
    );

    const addBtn = screen.getByRole('button', { name: /\+ Add Responsible Role/i });
    fireEvent.click(addBtn);

    expect(mockOnChange).toHaveBeenCalled();
    const addedList = mockOnChange.mock.calls[0][0];
    expect(addedList.length).toBe(2);

    const removeBtn = screen.getByRole('button', { name: /🗑 Remove/i });
    fireEvent.click(removeBtn);

    expect(mockOnChange.mock.calls[1][0]).toEqual([addedList[1]]);
  });

  it('warns when a duplicate role ID is assigned', () => {
    const duplicateRoles: ResponsibleRole[] = [
      { 'role-id': 'asset-owner', 'party-uuids': [] },
      { 'role-id': 'asset-owner', 'party-uuids': [] }
    ];

    render(
      <ComponentRolesEditor
        roles={duplicateRoles}
        parties={sampleParties}
        onChange={vi.fn()}
        editMode={true}
      />
    );

    const warnings = screen.getAllByText(/Duplicate role ID/i);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
