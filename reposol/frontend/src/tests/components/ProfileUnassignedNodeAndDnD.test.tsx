import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileSidebar } from '@components/profile/ProfileSidebar';
import { ControlTreeNodeComponent } from '@components/shared/control-tree/ControlTreeNode';

describe('Profile Virtual Unassigned Node & DnD Assignment', () => {
  const sampleResolvedCatalog = {
    all_controls: [
      { id: 'ac-1', title: 'Access Control Policy' },
      { id: 'ac-2', title: 'Account Management' },
      { id: 'ac-3', title: 'Access Enforcement' },
      { id: 'ia-2', title: 'Identification and Authentication' }
    ],
    all_groups: [],
    groups: [
      {
        id: 'cg-core',
        title: 'Core Security Group',
        controls: [
          { id: 'ac-1', title: 'Access Control Policy' }
        ],
        groups: []
      }
    ],
    controls: []
  };

  const sampleProfile = {
    imports: [{ href: 'catalogs/nist-800-53.json', 'include-all': {} }],
    merge: {
      custom: {
        groups: [
          {
            id: 'cg-core',
            title: 'Core Security Group',
            'insert-controls': [
              {
                'include-controls': [{ 'with-ids': ['ac-1'] }]
              }
            ]
          }
        ]
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('omits virtual unassigned node by default in edit mode, but renders when filter is toggled', () => {
    const { rerender } = render(
      <ProfileSidebar
        resolvedCatalog={sampleResolvedCatalog}
        profile={sampleProfile}
        isEditing={true}
        onSelectControl={vi.fn()}
        onSelectGroup={vi.fn()}
        onSelectOverview={vi.fn()}
        onSelectMetadata={vi.fn()}
        onSelectProperties={vi.fn()}
        onSelectParameters={vi.fn()}
        onSelectBackMatter={vi.fn()}
        onSelectImports={vi.fn()}
      />
    );

    // Omitted by default
    expect(screen.queryByTestId('tree-node-__unassigned__')).not.toBeInTheDocument();

    // Renders when showUnassigned is active
    rerender(
      <ProfileSidebar
        resolvedCatalog={sampleResolvedCatalog}
        profile={sampleProfile}
        isEditing={true}
        initialVisibilityFilter={{ showActive: true, showExcluded: true, showWithdrawn: false, showUnassigned: true }}
        onSelectControl={vi.fn()}
        onSelectGroup={vi.fn()}
        onSelectOverview={vi.fn()}
        onSelectMetadata={vi.fn()}
        onSelectProperties={vi.fn()}
        onSelectParameters={vi.fn()}
        onSelectBackMatter={vi.fn()}
        onSelectImports={vi.fn()}
      />
    );

    const unassignedNode = screen.getByTestId('tree-node-__unassigned__');
    expect(unassignedNode).toBeInTheDocument();
    expect(unassignedNode.textContent).toContain('📥 Unassigned Controls (3)');
  });

  it('suppresses virtual unassigned node in view mode (isEditing === false)', () => {
    render(
      <ProfileSidebar
        resolvedCatalog={sampleResolvedCatalog}
        profile={sampleProfile}
        isEditing={false}
        onSelectControl={vi.fn()}
        onSelectGroup={vi.fn()}
        onSelectOverview={vi.fn()}
        onSelectMetadata={vi.fn()}
        onSelectProperties={vi.fn()}
        onSelectParameters={vi.fn()}
        onSelectBackMatter={vi.fn()}
        onSelectImports={vi.fn()}
      />
    );

    expect(screen.queryByTestId('tree-node-__unassigned__')).not.toBeInTheDocument();
  });

  it('omits virtual unassigned node when all imported controls are assigned', () => {
    const fullyAssignedProfile = {
      imports: [{ href: 'catalogs/nist-800-53.json', 'include-all': {} }],
      merge: {
        custom: {
          groups: [
            {
              id: 'cg-core',
              title: 'Core Security Group',
              'insert-controls': [
                {
                  'include-controls': [{ 'with-ids': ['ac-1', 'ac-2', 'ac-3', 'ia-2'] }]
                }
              ]
            }
          ]
        }
      }
    };

    render(
      <ProfileSidebar
        resolvedCatalog={sampleResolvedCatalog}
        profile={fullyAssignedProfile}
        isEditing={true}
        onSelectControl={vi.fn()}
        onSelectGroup={vi.fn()}
        onSelectOverview={vi.fn()}
        onSelectMetadata={vi.fn()}
        onSelectProperties={vi.fn()}
        onSelectParameters={vi.fn()}
        onSelectBackMatter={vi.fn()}
        onSelectImports={vi.fn()}
      />
    );

    expect(screen.queryByTestId('tree-node-__unassigned__')).not.toBeInTheDocument();
  });

  it('guards __unassigned__ node against double click inline rename', () => {
    const mockOnRename = vi.fn();
    const node = {
      id: '__unassigned__',
      title: '📥 Unassigned Controls (3)',
      class: 'virtual-unassigned',
      type: 'group' as const,
      depth: 0,
      hasChildren: true,
      isExpanded: true,
      isSelected: false,
      isVisible: true,
      children: []
    };

    const mockTree: any = {
      selectedId: null,
      expandedIds: new Set(['__unassigned__']),
      searchQuery: '',
      filteredNodes: [],
      toggleExpand: vi.fn(),
      select: vi.fn()
    };

    render(
      <ControlTreeNodeComponent
        node={node}
        tree={mockTree}
        isEditing={true}
        onSelectControl={vi.fn()}
        onRenameGroup={mockOnRename}
      />
    );

    const titleSpan = screen.getByText('📥 Unassigned Controls (3)');
    fireEvent.doubleClick(titleSpan);

    expect(screen.queryByTestId('inline-rename-input-__unassigned__')).not.toBeInTheDocument();
    expect(mockOnRename).not.toHaveBeenCalled();
  });

  it('guards __unassigned__ node against drag reordering (draggable is false and no drag handle)', () => {
    const node = {
      id: '__unassigned__',
      title: '📥 Unassigned Controls (3)',
      class: 'virtual-unassigned',
      type: 'group' as const,
      depth: 0,
      hasChildren: true,
      isExpanded: true,
      isSelected: false,
      isVisible: true,
      children: []
    };

    const mockTree: any = {
      selectedId: null,
      expandedIds: new Set(['__unassigned__']),
      searchQuery: '',
      filteredNodes: [],
      toggleExpand: vi.fn(),
      select: vi.fn()
    };

    render(
      <ControlTreeNodeComponent
        node={node}
        tree={mockTree}
        isEditing={true}
        onMoveNode={vi.fn()}
      />
    );

    const row = screen.getByTestId('tree-node-__unassigned__');
    expect(row.getAttribute('draggable')).toBe('false');
    expect(row.querySelector('[title="Drag to reorder"]')).not.toBeInTheDocument();
  });

  it('suppresses context menu group actions on __unassigned__ node', () => {
    const mockOnAddGroup = vi.fn();
    const mockOnDeleteNode = vi.fn();
    const mockOnRenameGroup = vi.fn();

    const node = {
      id: '__unassigned__',
      title: '📥 Unassigned Controls (3)',
      class: 'virtual-unassigned',
      type: 'group' as const,
      depth: 0,
      hasChildren: true,
      isExpanded: true,
      isSelected: false,
      isVisible: true,
      children: []
    };

    const mockTree: any = {
      selectedId: null,
      expandedIds: new Set(['__unassigned__']),
      searchQuery: '',
      filteredNodes: [],
      toggleExpand: vi.fn(),
      select: vi.fn()
    };

    render(
      <ControlTreeNodeComponent
        node={node}
        tree={mockTree}
        isEditing={true}
        onAddGroup={mockOnAddGroup}
        onDeleteNode={mockOnDeleteNode}
        onRenameGroup={mockOnRenameGroup}
      />
    );

    const row = screen.getByTestId('tree-node-__unassigned__');
    fireEvent.contextMenu(row, { clientX: 100, clientY: 100 });

    expect(screen.queryByTestId('context-menu-add-subgroup')).not.toBeInTheDocument();
    expect(screen.queryByTestId('context-menu-rename-group')).not.toBeInTheDocument();
    expect(screen.queryByTestId('context-menu-delete-group')).not.toBeInTheDocument();
  });

  it('renders "Remove from Group" in context menu for assigned controls and triggers onUnassignControl', () => {
    const mockOnUnassign = vi.fn();

    const node = {
      id: 'ac-1',
      title: 'Access Control Policy',
      parentId: 'cg-core',
      type: 'control' as const,
      depth: 1,
      hasChildren: false,
      isExpanded: false,
      isSelected: false,
      isVisible: true,
      children: []
    };

    const mockTree: any = {
      selectedId: null,
      expandedIds: new Set(),
      searchQuery: '',
      filteredNodes: [],
      toggleExpand: vi.fn(),
      select: vi.fn()
    };

    render(
      <ControlTreeNodeComponent
        node={node}
        tree={mockTree}
        isEditing={true}
        onUnassignControl={mockOnUnassign}
      />
    );

    const row = screen.getByTestId('tree-node-ac-1');
    fireEvent.contextMenu(row, { clientX: 100, clientY: 100 });

    const unassignBtn = screen.getByTestId('context-menu-unassign-control');
    expect(unassignBtn).toBeInTheDocument();
    expect(unassignBtn.textContent).toContain('Remove from Group');

    fireEvent.click(unassignBtn);
    expect(mockOnUnassign).toHaveBeenCalledWith('ac-1', 'cg-core');
  });

  it('dispatches removeControlFromCustomGroup when control is moved to __unassigned__', () => {
    const mockDispatch = vi.fn();

    render(
      <ProfileSidebar
        resolvedCatalog={sampleResolvedCatalog}
        profile={sampleProfile}
        isEditing={true}
        initialVisibilityFilter={{ showActive: true, showExcluded: true, showWithdrawn: false, showUnassigned: true }}
        onSelectControl={vi.fn()}
        onSelectGroup={vi.fn()}
        onSelectOverview={vi.fn()}
        onSelectMetadata={vi.fn()}
        onSelectProperties={vi.fn()}
        onSelectParameters={vi.fn()}
        onSelectBackMatter={vi.fn()}
        onSelectImports={vi.fn()}
        dispatch={mockDispatch}
      />
    );

    const unassignedRow = screen.getByTestId('tree-node-__unassigned__');
    const mockDataTransfer = {
      getData: vi.fn().mockImplementation((key) => {
        if (key === 'text/plain') return 'ac-1';
        return '';
      }),
      types: ['text/plain']
    };

    fireEvent.drop(unassignedRow, { dataTransfer: mockDataTransfer });

    expect(mockDispatch).toHaveBeenCalled();
    const action = mockDispatch.mock.calls[0][0];
    expect(action.type).toBe('REMOVE_CONTROL_FROM_CUSTOM_GROUP');
    expect(action.payload.controlId).toBe('ac-1');
  });

  it('dispatches assignControlToCustomGroup when control is moved to a custom group', () => {
    const mockDispatch = vi.fn();

    render(
      <ProfileSidebar
        resolvedCatalog={sampleResolvedCatalog}
        profile={sampleProfile}
        isEditing={true}
        onSelectControl={vi.fn()}
        onSelectGroup={vi.fn()}
        onSelectOverview={vi.fn()}
        onSelectMetadata={vi.fn()}
        onSelectProperties={vi.fn()}
        onSelectParameters={vi.fn()}
        onSelectBackMatter={vi.fn()}
        onSelectImports={vi.fn()}
        dispatch={mockDispatch}
      />
    );

    const groupRow = screen.getByTestId('tree-node-cg-core');
    const mockDataTransfer = {
      getData: vi.fn().mockImplementation((key) => {
        if (key === 'text/plain') return 'ac-3';
        return '';
      }),
      types: ['text/plain']
    };

    // Simulate dragover at center of group row -> drop inside
    fireEvent.dragOver(groupRow, {
      clientY: 10,
      currentTarget: {
        getBoundingClientRect: () => ({ top: 0, height: 20 })
      },
      dataTransfer: { ...mockDataTransfer, dropEffect: '' }
    });

    fireEvent.drop(groupRow, { dataTransfer: mockDataTransfer });

    expect(mockDispatch).toHaveBeenCalled();
    const action = mockDispatch.mock.calls[0][0];
    expect(action.type).toBe('ASSIGN_CONTROL_TO_CUSTOM_GROUP');
    expect(action.payload.controlId).toBe('ac-3');
    expect(action.payload.targetGroupId).toBe('cg-core');
  });
});
