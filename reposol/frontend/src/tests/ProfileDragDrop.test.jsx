import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileSidebar } from '../components/profile/ProfileSidebar';
import { SourcesPanel } from '../components/profile/SourcesPanel';

describe('Profile Drag-and-Drop & Context Menu Category Editor', () => {
  const mockProfile = {
    uuid: 'profile-1',
    metadata: { title: 'Test Profile', version: '1.0' },
    imports: [{ href: '/api/documents/catalogs/5a4378ff-89cd-4336-8521-bbc191ab98f1', 'include-all': {} }],
    merge: {
      custom: {
        groups: [
          {
            id: 'group_1',
            title: 'Test Category 1',
            'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }], order: 'keep' }]
          }
        ]
      }
    }
  };

  const mockResolvedCatalog = {
    uuid: 'resolved-cat-1',
    metadata: { title: 'Test Catalog' },
    groups: [
      {
        id: 'group_1',
        title: 'Test Category 1',
        controls: [{ id: 'ac-1', title: 'Access Control 1' }]
      }
    ]
  };

  const mockCatalogCache = new Map();
  mockCatalogCache.set('5a4378ff-89cd-4336-8521-bbc191ab98f1', {
    catalog: {
      uuid: '5a4378ff-89cd-4336-8521-bbc191ab98f1',
      metadata: { title: 'Source Catalog' },
      controls: [
        { id: 'ac-1', title: 'Access Control 1' },
        { id: 'ac-2', title: 'Access Control 2' }
      ]
    }
  });

  it('renders Custom Category Tree and Add Top-level Group button in sidebar', () => {
    const mockOnChange = vi.fn();
    render(
      <ProfileSidebar
        resolvedCatalog={mockResolvedCatalog}
        profile={mockProfile}
        selectedControlId={null}
        onSelectControl={vi.fn()}
        isEditing={true}
        activeTab="sources"
        expandedGroups={{}}
        onToggleGroup={vi.fn()}
        onToggleControlSelection={vi.fn()}
        onChange={mockOnChange}
      />
    );

    // Group should render
    expect(screen.getByText('Test Category 1')).toBeInTheDocument();
    
    // Add group button should render since activeTab === 'sources' and custom merge is active
    const btn = screen.getByText(/Add Top-level Group/i);
    expect(btn).toBeInTheDocument();
  });

  it('renders Control Pool in SourcesPanel', () => {
    render(
      <SourcesPanel
        profile={mockProfile}
        onChange={vi.fn()}
        isEditing={true}
        resolvedCatalog={mockResolvedCatalog}
        catalogCache={mockCatalogCache}
      />
    );

    // Should render control pool header
    expect(screen.getByText('📥 Control Pool (Drag & Drop)')).toBeInTheDocument();

    // ac-2 is not assigned, so it should be visible in the unassigned pool
    expect(screen.getByText('Access Control 2')).toBeInTheDocument();
  });

  it('handles copying structure in "all" and "main-only" modes', () => {
    const mockOnChange = vi.fn();
    
    // Mock window.confirm to return true
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

    render(
      <SourcesPanel
        profile={mockProfile}
        onChange={mockOnChange}
        isEditing={true}
        resolvedCatalog={mockResolvedCatalog}
        catalogCache={mockCatalogCache}
      />
    );

    // Find the "Import Full Structure" button and click it
    const copyStructureBtn = screen.getByText('📥 Import Full Structure');
    fireEvent.click(copyStructureBtn);

    expect(mockOnChange).toHaveBeenCalled();

    // In copy structure mode, topLevelInsert should be populated and existing custom groups preserved
    const callArg = mockOnChange.mock.calls[0][0];
    expect(callArg.merge.custom.groups).toHaveLength(1);
    expect(callArg.merge.custom.groups[0].id).toBe('group_1');
    expect(callArg.merge.custom['insert-controls']).toHaveLength(1);
    expect(callArg.merge.custom['insert-controls'][0]['include-controls'][0]['with-ids']).toEqual(['ac-1', 'ac-2']);
  });

  it('does not mark child controls as assigned if they are not resolved in the resolvedCatalog', () => {
    // Add a child control to ac-1 in mockCatalogCache
    const testCache = new Map();
    testCache.set('5a4378ff-89cd-4336-8521-bbc191ab98f1', {
      catalog: {
        uuid: '5a4378ff-89cd-4336-8521-bbc191ab98f1',
        metadata: { title: 'Source Catalog' },
        controls: [
          {
            id: 'ac-1',
            title: 'Access Control 1',
            controls: [
              { id: 'ac-1.1', title: 'Sub-Access Control 1.1' }
            ]
          },
          { id: 'ac-2', title: 'Access Control 2' }
        ]
      }
    });

    render(
      <SourcesPanel
        profile={mockProfile}
        onChange={vi.fn()}
        isEditing={true}
        resolvedCatalog={mockResolvedCatalog}
        catalogCache={testCache}
      />
    );

    // Sub-Access Control 1.1 should be rendered in the pool
    const subCtrlEl = screen.getByText('Sub-Access Control 1.1');
    expect(subCtrlEl).toBeInTheDocument();

    // It should NOT be marked as "✓ Assigned" since it's not in mockResolvedCatalog
    const zugewiesenTexts = screen.queryAllByText('✓ Assigned');
    expect(zugewiesenTexts).toHaveLength(1);
    expect(zugewiesenTexts[0].closest('div')).not.toHaveTextContent('Sub-Access Control 1.1');
  });

  it('marks recursively resolved child controls as assigned if they are present in the resolvedCatalog', () => {
    const testCache = new Map();
    testCache.set('5a4378ff-89cd-4336-8521-bbc191ab98f1', {
      catalog: {
        uuid: '5a4378ff-89cd-4336-8521-bbc191ab98f1',
        metadata: { title: 'Source Catalog' },
        controls: [
          {
            id: 'ac-1',
            title: 'Access Control 1',
            controls: [
              { id: 'ac-1.1', title: 'Sub-Access Control 1.1' }
            ]
          },
          { id: 'ac-2', title: 'Access Control 2' }
        ]
      }
    });

    // In mockResolvedCatalog, ac-1.1 is recursively resolved (inside ac-1)
    const mockResolvedCatalogWithChildren = {
      uuid: 'resolved-cat-1',
      metadata: { title: 'Test Catalog' },
      groups: [
        {
          id: 'group_1',
          title: 'Test Category 1',
          controls: [
            {
              id: 'ac-1',
              title: 'Access Control 1',
              controls: [
                { id: 'ac-1.1', title: 'Sub-Access Control 1.1' }
              ]
            }
          ]
        }
      ]
    };

    render(
      <SourcesPanel
        profile={mockProfile}
        onChange={vi.fn()}
        isEditing={true}
        resolvedCatalog={mockResolvedCatalogWithChildren}
        catalogCache={testCache}
      />
    );

    // Sub-Access Control 1.1 should be rendered in the pool
    const subCtrlEl = screen.getByText('Sub-Access Control 1.1');
    expect(subCtrlEl).toBeInTheDocument();

    // It should be marked as "✓ Assigned" because it is present in the resolvedCatalog
    const zugewiesenTexts = screen.queryAllByText('✓ Assigned');
    expect(zugewiesenTexts).toHaveLength(2); // One for ac-1, one for ac-1.1
  });

  it('renders trash icon in edit mode and hides it in read mode', () => {
    const mockOnChange = vi.fn();
    const { rerender } = render(
      <ProfileSidebar
        resolvedCatalog={mockResolvedCatalog}
        profile={mockProfile}
        selectedControlId={null}
        onSelectControl={vi.fn()}
        isEditing={true}
        activeTab="sources"
        expandedGroups={{}}
        onToggleGroup={vi.fn()}
        onToggleControlSelection={vi.fn()}
        onChange={mockOnChange}
      />
    );

    // Trash element should render in edit mode
    const trashEl = screen.getByTitle(/Delete \/ unassign/i);
    expect(trashEl).toBeInTheDocument();
    expect(trashEl).toHaveAttribute('data-dnd-id', 'trash');
    expect(trashEl).toHaveAttribute('data-dnd-type', 'trash');
    expect(trashEl).toHaveTextContent('Drag elements here to delete');

    // Rerender in read-only mode
    rerender(
      <ProfileSidebar
        resolvedCatalog={mockResolvedCatalog}
        profile={mockProfile}
        selectedControlId={null}
        onSelectControl={vi.fn()}
        isEditing={false}
        activeTab="sources"
        expandedGroups={{}}
        onToggleGroup={vi.fn()}
        onToggleControlSelection={vi.fn()}
        onChange={mockOnChange}
      />
    );
    expect(screen.queryByTitle(/Delete \/ unassign/i)).not.toBeInTheDocument();
  });
});
