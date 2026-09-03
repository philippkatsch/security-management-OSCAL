import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ComponentLinksEditor, OSCAL_STANDARD_RELS } from '../../components/component-definition/editors/ComponentLinksEditor';
import { Link, DefinedComponent, Resource } from '../../lib/types/oscal';

describe('ComponentLinksEditor Unit Tests', () => {
  const siblingComponents: DefinedComponent[] = [
    {
      uuid: 'comp-db-001',
      type: 'software',
      title: 'Database Engine',
      description: 'SQL Database'
    },
    {
      uuid: 'comp-auth-002',
      type: 'service',
      title: 'Auth Microservice',
      description: 'OAuth2 authentication'
    }
  ];

  const resources: Resource[] = [
    {
      uuid: 'res-cert-001',
      title: 'FIPS 140-2 Certificate',
      description: 'Cryptographic module validation certificate'
    }
  ];

  const sampleLinks: Link[] = [
    {
      rel: 'depends-on',
      href: '#comp-db-001',
      text: 'Database Engine'
    },
    {
      rel: 'validation',
      href: '#res-cert-001',
      text: 'FIPS 140-2 Certificate'
    }
  ];

  it('renders links in read-only mode with relation badges and labels', () => {
    render(
      <ComponentLinksEditor
        links={sampleLinks}
        components={siblingComponents}
        resources={resources}
        currentComponentUuid="comp-main"
        onChange={vi.fn()}
        editMode={false}
      />
    );

    expect(screen.getByText(/Depends On:/i)).toBeInTheDocument();
    expect(screen.getByText('Database Engine')).toBeInTheDocument();
    expect(screen.getByText(/Validation Record:/i)).toBeInTheDocument();
    expect(screen.getByText('FIPS 140-2 Certificate')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+ Add Link/i })).not.toBeInTheDocument();
  });

  it('renders relation dropdown options and allows changing relationship type', () => {
    const mockOnChange = vi.fn();
    render(
      <ComponentLinksEditor
        links={sampleLinks}
        components={siblingComponents}
        resources={resources}
        currentComponentUuid="comp-main"
        onChange={mockOnChange}
        editMode={true}
      />
    );

    const relSelects = screen.getAllByRole('combobox');
    expect(relSelects.length).toBeGreaterThan(0);

    fireEvent.change(relSelects[0], { target: { value: 'uses-service' } });

    expect(mockOnChange).toHaveBeenCalled();
    const updated = mockOnChange.mock.calls[0][0];
    expect(updated[0].rel).toBe('uses-service');
  });

  it('allows switching target mode between component, resource, and URL', () => {
    const mockOnChange = vi.fn();
    render(
      <ComponentLinksEditor
        links={sampleLinks}
        components={siblingComponents}
        resources={resources}
        currentComponentUuid="comp-main"
        onChange={mockOnChange}
        editMode={true}
      />
    );

    // Switch to URL mode
    const urlModeBtns = screen.getAllByRole('button', { name: /🌐 URI\/URL/i });
    fireEvent.click(urlModeBtns[0]);

    expect(mockOnChange).toHaveBeenCalled();
    const updated = mockOnChange.mock.calls[0][0];
    expect(updated[0].href).toBe('https://');
  });

  it('allows adding and removing links', () => {
    const mockOnChange = vi.fn();
    render(
      <ComponentLinksEditor
        links={sampleLinks}
        components={siblingComponents}
        resources={resources}
        currentComponentUuid="comp-main"
        onChange={mockOnChange}
        editMode={true}
      />
    );

    const addBtn = screen.getByRole('button', { name: /\+ Add Link \/ Dependency/i });
    fireEvent.click(addBtn);

    expect(mockOnChange).toHaveBeenCalled();
    const addedList = mockOnChange.mock.calls[0][0];
    expect(addedList.length).toBe(3);

    const deleteBtns = screen.getAllByRole('button', { name: '🗑' });
    fireEvent.click(deleteBtns[0]);

    expect(mockOnChange.mock.calls[1][0]).toEqual([sampleLinks[1], addedList[2]]);
  });

  it('toggles advanced drawer for media-type and resource-fragment', () => {
    render(
      <ComponentLinksEditor
        links={sampleLinks}
        components={siblingComponents}
        resources={resources}
        currentComponentUuid="comp-main"
        onChange={vi.fn()}
        editMode={true}
      />
    );

    const gearBtns = screen.getAllByRole('button', { name: '⚙️' });
    fireEvent.click(gearBtns[0]);

    expect(screen.getByText('MIME Media Type')).toBeInTheDocument();
    expect(screen.getByText('Resource Fragment')).toBeInTheDocument();
  });
});
