import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SourcesPanel } from '@components/profile/SourcesPanel';

describe('SourcesPanel Control Pool & Dual-Surface Assignment', () => {
  const sampleResolvedCatalog = {
    source_catalog_id: 'cat-nist-800-53',
    source_catalog_title: 'NIST SP 800-53 Rev 5',
    all_controls: [
      { id: 'ac-1', title: 'Access Control Policy and Procedures' },
      { id: 'ac-2', title: 'Account Management' },
      { id: 'ac-3', title: 'Access Enforcement' },
      { id: 'ia-2', title: 'Identification and Authentication (Organizational Users)' }
    ],
    all_groups: [],
    groups: [],
    controls: []
  };

  const sampleProfile = {
    imports: [{ href: 'catalogs/nist-800-53.json', 'include-all': {} }],
    merge: {
      custom: {
        groups: [
          {
            id: 'cg-core',
            title: 'Core Controls',
            'insert-controls': [
              {
                'include-controls': [{ 'with-ids': ['ac-1'] }]
              }
            ]
          },
          {
            id: 'cg-identity',
            title: 'Identity Controls',
            'insert-controls': [
              {
                'include-controls': [{ 'with-ids': [] }]
              }
            ]
          }
        ]
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).__isDraggingFromPool = false;
  });

  it('renders unified single-surface workbench with structuring and tree controls', () => {
    render(
      <SourcesPanel
        profile={sampleProfile}
        resolvedCatalog={sampleResolvedCatalog}
        isEditing={true}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('structuring-mode-select')).toBeInTheDocument();
    expect(screen.getByTestId('combine-method-select')).toBeInTheDocument();
    expect(screen.getByTestId('pool-search-input')).toBeInTheDocument();
  });

  it('filters pool cards by text search matching ID and title', () => {
    render(
      <SourcesPanel
        profile={sampleProfile}
        resolvedCatalog={sampleResolvedCatalog}
        isEditing={true}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('control-pool-tab-btn'));

    const searchInput = screen.getByTestId('pool-search-input');
    fireEvent.change(searchInput, { target: { value: 'account' } });

    expect(screen.getByTestId('pool-control-card-ac-2')).toBeInTheDocument();
    expect(screen.queryByTestId('pool-control-card-ac-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pool-control-card-ac-3')).not.toBeInTheDocument();
  });

  it('displays all controls (assigned and unassigned) simultaneously in workbench', () => {
    render(
      <SourcesPanel
        profile={sampleProfile}
        resolvedCatalog={sampleResolvedCatalog}
        isEditing={true}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('control-pool-tab-btn'));

    // Both assigned and unassigned controls are visible
    expect(screen.getByTestId('pool-control-card-ac-1')).toBeInTheDocument();
    expect(screen.getByTestId('pool-control-card-ac-2')).toBeInTheDocument();
    expect(screen.getByTestId('pool-control-card-ac-3')).toBeInTheDocument();
    expect(screen.getByTestId('pool-control-card-ia-2')).toBeInTheDocument();
  });

  it('sets proper DataTransfer payload on card dragstart', () => {
    render(
      <SourcesPanel
        profile={sampleProfile}
        resolvedCatalog={sampleResolvedCatalog}
        isEditing={true}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('control-pool-tab-btn'));

    const card = screen.getByTestId('pool-control-card-ac-2');
    const mockDataTransfer = {
      setData: vi.fn(),
      effectAllowed: ''
    };

    fireEvent.dragStart(card, { dataTransfer: mockDataTransfer });

    expect(mockDataTransfer.setData).toHaveBeenCalledWith('text/plain', 'ac-2');
    expect(mockDataTransfer.setData).toHaveBeenCalledWith(
      'application/x-oscal-control',
      expect.stringContaining('"id":"ac-2"')
    );
    expect(mockDataTransfer.setData).toHaveBeenCalledWith('sourceSurface', 'control-pool');
  });

  it('unassigns control via quick unassign button on assigned card', () => {
    const mockOnChange = vi.fn();
    render(
      <SourcesPanel
        profile={sampleProfile}
        resolvedCatalog={sampleResolvedCatalog}
        isEditing={true}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByTestId('control-pool-tab-btn'));

    const unassignBtn = screen.getByTestId('unassign-btn-ac-1');
    expect(unassignBtn).toBeInTheDocument();

    fireEvent.click(unassignBtn);

    expect(mockOnChange).toHaveBeenCalled();
    const updatedProfile = mockOnChange.mock.calls[0][0];
    const groupWithIds = updatedProfile.merge.custom.groups[0]['insert-controls'][0]['include-controls'][0]['with-ids'];
    expect(groupWithIds).not.toContain('ac-1');
  });

  it('assigns control via accessible keyboard dropdown on unassigned card', () => {
    const mockOnChange = vi.fn();
    render(
      <SourcesPanel
        profile={sampleProfile}
        resolvedCatalog={sampleResolvedCatalog}
        isEditing={true}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByTestId('control-pool-tab-btn'));

    const select = screen.getByTestId('assign-select-ac-2');
    expect(select).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'cg-identity' } });

    expect(mockOnChange).toHaveBeenCalled();
    const updatedProfile = mockOnChange.mock.calls[0][0];
    const identityGroup = updatedProfile.merge.custom.groups.find((g: any) => g.id === 'cg-identity');
    const withIds = identityGroup['insert-controls'][0]['include-controls'][0]['with-ids'];
    expect(withIds).toContain('ac-2');
  });

  it('unassigns control when dropped onto Control Pool container', () => {
    const mockOnChange = vi.fn();
    render(
      <SourcesPanel
        profile={sampleProfile}
        resolvedCatalog={sampleResolvedCatalog}
        isEditing={true}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByTestId('control-pool-tab-btn'));

    const workbench = document.querySelector('.control-pool-workbench')!;
    expect(workbench).toBeInTheDocument();

    const mockDataTransfer = {
      getData: vi.fn().mockImplementation((key) => {
        if (key === 'application/x-oscal-control') {
          return JSON.stringify({ id: 'ac-1', title: 'Access Control Policy' });
        }
        if (key === 'text/plain') return 'ac-1';
        return '';
      }),
      types: ['application/x-oscal-control', 'text/plain']
    };

    fireEvent.dragOver(workbench, { dataTransfer: mockDataTransfer });
    expect(screen.getByTestId('pool-dropzone-indicator')).toBeInTheDocument();

    fireEvent.drop(workbench, { dataTransfer: mockDataTransfer });

    expect(mockOnChange).toHaveBeenCalled();
    const updatedProfile = mockOnChange.mock.calls[0][0];
    const groupWithIds = updatedProfile.merge.custom.groups[0]['insert-controls'][0]['include-controls'][0]['with-ids'];
    expect(groupWithIds).not.toContain('ac-1');
  });

  it('disables dragging and hides assignment controls in read-only mode', () => {
    render(
      <SourcesPanel
        profile={sampleProfile}
        resolvedCatalog={sampleResolvedCatalog}
        isEditing={false}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('control-pool-tab-btn'));

    const card = screen.getByTestId('pool-control-card-ac-2');
    expect(card.getAttribute('draggable')).toBe('false');

    expect(screen.queryByTestId('unassign-btn-ac-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('assign-select-ac-2')).not.toBeInTheDocument();
  });
});
