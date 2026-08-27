import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileSidebar } from '@components/profile/ProfileSidebar';
import { DeleteCustomGroupDialog } from '@components/profile/DeleteCustomGroupDialog';
import { ControlTreeNodeComponent } from '@components/shared/control-tree/ControlTreeNode';

describe('Profile Custom Groups Tree Integration', () => {
  const sampleResolvedCatalog = {
    groups: [
      {
        id: 'cg-core',
        title: 'Core Controls Group',
        controls: [
          { id: 'ac-1', title: 'Access Control Policy' },
          { id: 'ac-2', title: 'Account Management' }
        ],
        groups: [
          {
            id: 'cg-sub-1',
            title: 'Identity Sub-Group',
            controls: [{ id: 'ia-2', title: 'Identification and Authentication' }]
          }
        ]
      }
    ],
    controls: []
  };

  const sampleProfile = {
    imports: [{ href: 'catalogs/sample-cat.json', 'include-all': {} }],
    merge: {
      custom: {
        groups: [
          {
            id: 'cg-core',
            title: 'Core Controls Group',
            'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2'] }] }],
            groups: [
              {
                id: 'cg-sub-1',
                title: 'Identity Sub-Group',
                'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ia-2'] }] }]
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

  it('renders Add Custom Group button when isCustomMerge and isEditing are true', () => {
    const mockOnAddGroup = vi.fn();
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
        onAddCustomGroup={mockOnAddGroup}
      />
    );

    const addBtn = screen.getByTestId('add-custom-group-btn');
    expect(addBtn).toBeInTheDocument();
    expect(addBtn.textContent).toContain('Add Custom Group');

    fireEvent.click(addBtn);
    expect(mockOnAddGroup).toHaveBeenCalledWith(null);
  });

  it('handles inline rename on double click and Enter key on ControlTreeNode', () => {
    const mockOnRename = vi.fn();
    const node = {
      id: 'cg-core',
      title: 'Core Controls Group',
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
      expandedIds: new Set(['cg-core']),
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
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onRenameGroup={mockOnRename}
      />
    );

    const titleSpan = screen.getByText('Core Controls Group');
    expect(titleSpan).toBeInTheDocument();

    // Double click triggers inline edit
    fireEvent.doubleClick(titleSpan);

    const renameInput = screen.getByTestId('inline-rename-input-cg-core');
    expect(renameInput).toBeInTheDocument();

    // Type new name and press Enter
    fireEvent.change(renameInput, { target: { value: 'Renamed Core Group' } });
    fireEvent.keyDown(renameInput, { key: 'Enter' });

    expect(mockOnRename).toHaveBeenCalledWith('cg-core', 'Renamed Core Group');
  });

  it('cancels inline rename on Escape key without dispatching rename', () => {
    const mockOnRename = vi.fn();
    const node = {
      id: 'cg-core',
      title: 'Core Controls Group',
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
      expandedIds: new Set(['cg-core']),
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
        onSelect={vi.fn()}
        onToggleExpand={vi.fn()}
        onRenameGroup={mockOnRename}
      />
    );

    const titleSpan = screen.getByText('Core Controls Group');
    fireEvent.doubleClick(titleSpan);

    const renameInput = screen.getByTestId('inline-rename-input-cg-core');
    fireEvent.change(renameInput, { target: { value: 'Should Not Save' } });
    fireEvent.keyDown(renameInput, { key: 'Escape' });

    expect(mockOnRename).not.toHaveBeenCalled();
    expect(screen.queryByTestId('inline-rename-input-cg-core')).not.toBeInTheDocument();
  });

  it('handles DeleteCustomGroupDialog confirmation with control reassignment and subgroup handling', () => {
    const mockOnConfirm = vi.fn();
    const mockOnCancel = vi.fn();

    const groupToDelete = {
      id: 'cg-core',
      title: 'Core Controls Group',
      controls: [{ id: 'ac-1' }, { id: 'ac-2' }],
      groups: [{ id: 'cg-sub-1', title: 'Identity Sub-Group' }]
    };

    const availableTargets = [
      { id: 'cg-core', title: 'Core Controls Group' },
      { id: 'cg-target', title: 'Target Group' }
    ];

    render(
      <DeleteCustomGroupDialog
        isOpen={true}
        group={groupToDelete}
        availableTargetGroups={availableTargets}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('delete-custom-group-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete custom group/)).toBeInTheDocument();

    // Reassign controls to target group
    const reassignRadio = screen.getByTestId('radio-control-reassign');
    fireEvent.click(reassignRadio);

    const selectTarget = screen.getByTestId('select-reassign-target-group');
    fireEvent.change(selectTarget, { target: { value: 'cg-target' } });

    // Delete sub-groups
    const deleteSubgroupsRadio = screen.getByTestId('radio-subgroup-delete');
    fireEvent.click(deleteSubgroupsRadio);

    // Confirm
    const confirmBtn = screen.getByTestId('confirm-delete-group-btn');
    fireEvent.click(confirmBtn);

    expect(mockOnConfirm).toHaveBeenCalledWith({
      deleteChildren: true,
      reassignToGroupId: 'cg-target'
    });
  });

  it('handles DeleteCustomGroupDialog cancel', () => {
    const mockOnConfirm = vi.fn();
    const mockOnCancel = vi.fn();

    const groupToDelete = {
      id: 'cg-core',
      title: 'Core Controls Group'
    };

    render(
      <DeleteCustomGroupDialog
        isOpen={true}
        group={groupToDelete}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const cancelBtn = screen.getByTestId('cancel-delete-group-btn');
    fireEvent.click(cancelBtn);

    expect(mockOnCancel).toHaveBeenCalled();
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });
});