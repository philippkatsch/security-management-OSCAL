import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogAdapter } from '@components/shared/control-editor/adapters/CatalogAdapter';
import { ControlEditorContext } from '@components/shared/control-editor/ControlEditorContext';

describe('CatalogAdapter Unit Tests', () => {
  const mockControl = {
    id: 'ac-1',
    title: 'Policy and Procedures',
    props: [{ name: 'label', value: 'AC-1' }],
    links: [{ href: 'https://example.com/policy', rel: 'reference' }]
  };

  it('renders properties and links in read-only mode', () => {
    render(
      <ControlEditorContext.Provider value={{ stage: 'catalog', control: mockControl as any, isEditing: false, dispatch: vi.fn() }}>
        <CatalogAdapter />
      </ControlEditorContext.Provider>
    );

    expect(screen.getByText('label')).toBeInTheDocument();
    expect(screen.getByText('AC-1')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/policy')).toBeInTheDocument();
  });

  it('allows updating properties and triggers onChange in edit mode', () => {
    const mockOnChange = vi.fn();
    render(
      <ControlEditorContext.Provider value={{ stage: 'catalog', control: mockControl as any, isEditing: true, dispatch: vi.fn() }}>
        <CatalogAdapter onChange={mockOnChange} allUsedPropKeys={['label', 'status']} />
      </ControlEditorContext.Provider>
    );

    const addPropBtn = screen.getByRole('button', { name: /Add Property/i });
    expect(addPropBtn).toBeInTheDocument();
    fireEvent.click(addPropBtn);

    expect(mockOnChange).toHaveBeenCalled();
    const updated = mockOnChange.mock.calls[0][0];
    expect(updated.props.length).toBe(2);
  });

  it('allows updating links and triggers onChange in edit mode', () => {
    const mockOnChange = vi.fn();
    render(
      <ControlEditorContext.Provider value={{ stage: 'catalog', control: mockControl as any, isEditing: true, dispatch: vi.fn() }}>
        <CatalogAdapter onChange={mockOnChange} />
      </ControlEditorContext.Provider>
    );

    const addLinkBtn = screen.getByRole('button', { name: /Add Link/i });
    expect(addLinkBtn).toBeInTheDocument();
    fireEvent.click(addLinkBtn);

    expect(mockOnChange).toHaveBeenCalled();
    const updated = mockOnChange.mock.calls[0][0];
    expect(updated.links.length).toBe(2);
  });
});
