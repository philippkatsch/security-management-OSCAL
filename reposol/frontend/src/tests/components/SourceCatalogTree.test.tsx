import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SourceCatalogTree } from '@components/profile/SourceCatalogTree';

describe('SourceCatalogTree Component (Dual-Tree Hierarchy Mapper)', () => {
  const sampleResolvedCatalog = {
    source_catalog_id: 'cat-nist-800-53',
    source_catalog_title: 'NIST SP 800-53 Rev 5',
    all_groups: [
      {
        id: 'ac',
        title: 'Access Control',
        class: 'family',
        controls: [
          { id: 'ac-1', title: 'Access Control Policy and Procedures' },
          {
            id: 'ac-2',
            title: 'Account Management',
            controls: [
              { id: 'ac-2(1)', title: 'Automated System Account Management' }
            ]
          }
        ],
        groups: []
      },
      {
        id: 'ia',
        title: 'Identification and Authentication',
        class: 'family',
        controls: [
          { id: 'ia-2', title: 'Identification and Authentication (Organizational Users)' }
        ],
        groups: []
      }
    ],
    all_controls: [],
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

  const availableCustomGroups = [
    { id: 'cg-core', title: 'Core Controls', depth: 0 },
    { id: 'cg-identity', title: 'Identity Controls', depth: 0 }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders source catalog header, group folders, and control nodes', () => {
    render(
      <SourceCatalogTree
        profile={sampleProfile}
        resolvedCatalog={sampleResolvedCatalog}
        isEditing={true}
        availableCustomGroups={availableCustomGroups}
        assignedControlIds={new Set(['ac-1'])}
        getControlAssignment={(cid) => cid === 'ac-1' ? { groupId: 'cg-core', groupTitle: 'Core Controls' } : null}
      />
    );

    expect(screen.getByText('NIST SP 800-53 Rev 5')).toBeInTheDocument();
    expect(screen.getByText('Access Control')).toBeInTheDocument();
    expect(screen.getByText('Identification and Authentication')).toBeInTheDocument();
    expect(screen.getByText('ac-1')).toBeInTheDocument();
    expect(screen.getByText('ac-2')).toBeInTheDocument();
    expect(screen.getByText('ia-2')).toBeInTheDocument();
  });

  it('displays correct assignment badges and statistics', () => {
    render(
      <SourceCatalogTree
        profile={sampleProfile}
        resolvedCatalog={sampleResolvedCatalog}
        isEditing={true}
        availableCustomGroups={availableCustomGroups}
        assignedControlIds={new Set(['ac-1'])}
        getControlAssignment={(cid) => cid === 'ac-1' ? { groupId: 'cg-core', groupTitle: 'Core Controls' } : null}
      />
    );

    const statsStrip = screen.getByTestId('pool-stats-strip');
    expect(statsStrip.textContent).toContain('Total: 4');
    expect(statsStrip.textContent).toContain('Assigned: 1');
    expect(statsStrip.textContent).toContain('Unassigned: 3');

    // Assigned badge
    const coreControlsElements = screen.getAllByText('Core Controls');
    expect(coreControlsElements.length).toBeGreaterThan(0);
  });

  it('handles multi-selection and displays batch action toolbar', () => {
    const onAssignMultipleMock = vi.fn();
    const onRemoveMultipleMock = vi.fn();

    render(
      <SourceCatalogTree
        profile={sampleProfile}
        resolvedCatalog={sampleResolvedCatalog}
        isEditing={true}
        availableCustomGroups={availableCustomGroups}
        assignedControlIds={new Set(['ac-1'])}
        getControlAssignment={(cid) => cid === 'ac-1' ? { groupId: 'cg-core', groupTitle: 'Core Controls' } : null}
        onAssignMultipleControls={onAssignMultipleMock}
        onRemoveMultipleControls={onRemoveMultipleMock}
      />
    );

    // Initially batch bar should not be in the document
    expect(screen.queryByTestId('source-tree-batch-bar')).not.toBeInTheDocument();

    // Controls: [0] ac-1, [1] ac-2, [2] ac-2(1), [3] ia-2
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // select control ac-2 (and child ac-2(1))
    fireEvent.click(checkboxes[3]); // select control ia-2

    // Batch bar should now appear
    expect(screen.getByTestId('source-tree-batch-bar')).toBeInTheDocument();
    expect(screen.getByText(/3 controls selected/i)).toBeInTheDocument();

    // Batch assign to Identity Controls
    const batchSelect = screen.getByTestId('batch-assign-select');
    fireEvent.change(batchSelect, { target: { value: 'cg-identity' } });

    expect(onAssignMultipleMock).toHaveBeenCalledWith(
      expect.arrayContaining(['ac-2', 'ac-2(1)', 'ia-2']),
      'cg-identity'
    );
  });

  it('supports bulk catalog assignment directly from catalog header including sub-controls', () => {
    const onAssignMultipleMock = vi.fn();

    render(
      <SourceCatalogTree
        profile={sampleProfile}
        resolvedCatalog={sampleResolvedCatalog}
        isEditing={true}
        availableCustomGroups={availableCustomGroups}
        assignedControlIds={new Set([])}
        onAssignMultipleControls={onAssignMultipleMock}
      />
    );

    const assignCatalogSelect = screen.getByTitle('Assign all 4 controls in this catalog');
    fireEvent.change(assignCatalogSelect, { target: { value: 'cg-core' } });

    expect(onAssignMultipleMock).toHaveBeenCalledWith(['ac-1', 'ac-2', 'ac-2(1)', 'ia-2'], 'cg-core');
  });

  it('renders sub-controls recursively with expand/collapse and sub-control counts', () => {
    render(
      <SourceCatalogTree
        profile={sampleProfile}
        resolvedCatalog={sampleResolvedCatalog}
        isEditing={true}
        availableCustomGroups={availableCustomGroups}
        assignedControlIds={new Set([])}
      />
    );

    // Verify sub-control count indicator
    expect(screen.getByText('(1 sub-controls)')).toBeInTheDocument();

    // Verify sub-control is visible
    expect(screen.getByText('ac-2(1)')).toBeInTheDocument();
    expect(screen.getByText('Automated System Account Management')).toBeInTheDocument();

    // Collapse parent control ac-2
    const collapseChevron = screen.getByTitle('Collapse sub-controls');
    fireEvent.click(collapseChevron);

    // Verify sub-control is hidden after collapsing
    expect(screen.queryByText('Automated System Account Management')).not.toBeInTheDocument();
  });

  it('filters source tree by search query matching control and group titles', () => {
    render(
      <SourceCatalogTree
        profile={sampleProfile}
        resolvedCatalog={sampleResolvedCatalog}
        isEditing={true}
        availableCustomGroups={availableCustomGroups}
        assignedControlIds={new Set([])}
      />
    );

    const searchInput = screen.getByTestId('pool-search-input');
    fireEvent.change(searchInput, { target: { value: 'authentication' } });

    expect(screen.getByText('Identification and Authentication')).toBeInTheDocument();
    expect(screen.getByText('ia-2')).toBeInTheDocument();
    expect(screen.queryByText('Access Control')).not.toBeInTheDocument();
  });

  it('supports including and excluding all controls in a category via group header action buttons', () => {
    const onUpdateImportMock = vi.fn();
    const asIsProfile = {
      imports: [{ href: 'catalogs/nist-800-53.json', 'include-controls': [{ 'with-ids': ['ac-1'] }] }],
      merge: { 'as-is': {} }
    };

    render(
      <SourceCatalogTree
        profile={asIsProfile}
        resolvedCatalog={sampleResolvedCatalog}
        isEditing={true}
        availableCustomGroups={[]}
        assignedControlIds={new Set([])}
        onUpdateImport={onUpdateImportMock}
      />
    );

    // Group "Access Control" has 1 active out of 3 controls.
    // Both Exclude All (3) and + Include All (3) should be rendered.
    const includeAllBtn = screen.getByTestId('include-all-group-ac');
    expect(includeAllBtn).toBeInTheDocument();
    fireEvent.click(includeAllBtn);

    expect(onUpdateImportMock).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        'include-controls': expect.arrayContaining([
          expect.objectContaining({
            'with-ids': expect.arrayContaining(['ac-1', 'ac-2', 'ac-2(1)'])
          })
        ])
      })
    );

    const excludeAllBtn = screen.getByTestId('exclude-all-group-ac');
    expect(excludeAllBtn).toBeInTheDocument();
    fireEvent.click(excludeAllBtn);

    expect(onUpdateImportMock).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        'include-controls': expect.arrayContaining([
          expect.objectContaining({
            'with-ids': expect.not.arrayContaining(['ac-1'])
          })
        ])
      })
    );
  });

  it('filters pool controls when changing visibility filter checkboxes in popover', () => {
    render(
      <SourceCatalogTree
        profile={sampleProfile}
        resolvedCatalog={sampleResolvedCatalog}
        isEditing={true}
        availableCustomGroups={[]}
        assignedControlIds={new Set([])}
      />
    );

    const filterBtn = screen.getByTestId('pool-filter-btn');
    expect(filterBtn).toBeInTheDocument();

    // Open popover
    fireEvent.click(filterBtn);

    const activeCheckbox = screen.getByTestId('pool-filter-checkbox-active');
    const excludedCheckbox = screen.getByTestId('pool-filter-checkbox-excluded');
    const withdrawnCheckbox = screen.getByTestId('pool-filter-checkbox-withdrawn');

    expect(activeCheckbox).toBeChecked();
    expect(excludedCheckbox).toBeChecked();
    expect(withdrawnCheckbox).not.toBeChecked();

    // Toggle excluded
    fireEvent.click(excludedCheckbox);
    expect(excludedCheckbox).not.toBeChecked();
  });
});
