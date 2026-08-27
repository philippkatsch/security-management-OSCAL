import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { GroupEditor } from '@components/shared/GroupEditor';
import { DeleteCustomGroupDialog } from '@components/profile/DeleteCustomGroupDialog';
import {
  applyDeleteCustomGroup,
  deleteCustomGroup,
  applyReorderControlsInCustomGroup,
  reorderControlsInCustomGroup,
  applyAssignControlToCustomGroup,
  assignControlToCustomGroup,
  applyRemoveControlFromCustomGroup,
  removeControlFromCustomGroup,
  applyAddCustomGroup,
  addCustomGroup
} from '@lib/document-actions/profile-actions';
import { resolveProfileSync } from '@lib/profile';

// Mock child components that are not under direct test to keep tests fast and isolated
vi.mock('@components/shared/PartsEditor', () => ({
  PartsEditor: () => <div data-testid="parts-editor-mock" />
}));
vi.mock('@components/shared/PropsEditor', () => ({
  PropsEditor: () => <div data-testid="props-editor-mock" />
}));
vi.mock('@components/shared/LinksEditor', () => ({
  LinksEditor: () => <div data-testid="links-editor-mock" />
}));
vi.mock('./ParameterEditor', () => ({
  ParameterEditor: () => <div data-testid="parameter-editor-mock" />
}));

describe('Empirical Challenger M2-2: GroupEditor & DeleteCustomGroupDialog Stress Suite', () => {

  const NIST_UUID = '11111111-2222-3333-4444-555555555555';

  const sampleCatalog = {
    uuid: NIST_UUID,
    id: NIST_UUID,
    metadata: { title: 'NIST SP 800-53 Rev 5', version: '5.1.0' },
    groups: [
      {
        id: 'ac',
        title: 'Access Control',
        controls: [
          { id: 'ac-1', title: 'Access Control Policy and Procedures' },
          { id: 'ac-2', title: 'Account Management' },
          { id: 'ac-3', title: 'Access Enforcement' },
          { id: 'ac-10', title: 'Concurrent Session Control' },
          { id: 'ac-20', title: 'Use of External Systems' }
        ]
      },
      {
        id: 'ia',
        title: 'Identification and Authentication',
        controls: [
          { id: 'ia-1', title: 'Identification and Authentication Policy' },
          { id: 'ia-2', title: 'Identification and Authentication (Org Users)' },
          { id: 'ia-5', title: 'Authenticator Management' }
        ]
      }
    ]
  };

  const createCatalogCache = () => {
    const map = new Map<string, any>();
    map.set(NIST_UUID.toLowerCase(), {
      type: 'catalog',
      data: { catalog: sampleCatalog }
    });
    return map;
  };

  const createBaseProfile = (customGroups: any[] = []) => ({
    profile: {
      uuid: '99999999-8888-7777-6666-555555555555',
      metadata: {
        title: 'Challenger Test Profile',
        version: '1.0.0',
        'oscal-version': '1.1.2'
      },
      imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
      merge: {
        custom: {
          groups: customGroups
        }
      }
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // SCENARIO 1: Deleting a group with multiple controls -> return to unassigned pool
  // =========================================================================
  describe('Scenario 1: Deleting a group with multiple controls (Unassigned Pool)', () => {

    it('1.1: DeleteCustomGroupDialog correctly counts controls from controls array and insert-controls', () => {
      // Group with direct controls
      const groupWithDirect = {
        id: 'grp-direct',
        title: 'Direct Controls Group',
        controls: [{ id: 'ac-1' }, { id: 'ac-2' }, { id: 'ac-3' }]
      };

      const { rerender } = render(
        <DeleteCustomGroupDialog
          isOpen={true}
          group={groupWithDirect}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByText(/Assigned Control/i)).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByTestId('radio-control-unassigned')).toBeChecked();

      // Group with insert-controls structure
      const groupWithInsert = {
        id: 'grp-insert',
        title: 'Insert Controls Group',
        'insert-controls': [
          { 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2', 'ac-10', 'ac-20'] }] }
        ]
      };

      rerender(
        <DeleteCustomGroupDialog
          isOpen={true}
          group={groupWithInsert}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('1.2: DeleteCustomGroupDialog defaults to unassigned pool and dispatches null reassign target', () => {
      const mockConfirm = vi.fn();
      const mockCancel = vi.fn();

      const group = {
        id: 'grp-to-delete',
        title: 'Obsolete Group',
        'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2'] }] }]
      };

      render(
        <DeleteCustomGroupDialog
          isOpen={true}
          group={group}
          onConfirm={mockConfirm}
          onCancel={mockCancel}
        />
      );

      // Confirm with defaults
      fireEvent.click(screen.getByTestId('confirm-delete-group-btn'));

      expect(mockConfirm).toHaveBeenCalledTimes(1);
      expect(mockConfirm).toHaveBeenCalledWith({
        deleteChildren: false,
        reassignToGroupId: null
      });
    });

    it('1.3: applyDeleteCustomGroup removes group and unassigns all contained controls', () => {
      const draft = createBaseProfile([
        {
          id: 'grp-preserve',
          title: 'Preserved Group',
          'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ia-1'] }] }]
        },
        {
          id: 'grp-unassign',
          title: 'Group to Delete',
          'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2', 'ac-3'] }] }]
        }
      ]);

      const success = applyDeleteCustomGroup(draft, {
        groupId: 'grp-unassign',
        deleteChildren: false,
        reassignToGroupId: null
      });

      expect(success).toBe(true);
      const customGroups = draft.profile.merge.custom.groups;
      expect(customGroups.length).toBe(1);
      expect(customGroups[0].id).toBe('grp-preserve');

      // Verify controls are no longer in custom groups
      const allAssignedIds = customGroups.flatMap((g: any) =>
        g['insert-controls']?.flatMap((ic: any) =>
          ic['include-controls']?.flatMap((inc: any) => inc['with-ids'] || []) || []
        ) || []
      );
      expect(allAssignedIds).toEqual(['ia-1']);
      expect(allAssignedIds).not.toContain('ac-1');
      expect(allAssignedIds).not.toContain('ac-2');
      expect(allAssignedIds).not.toContain('ac-3');
    });

    it('1.4: Resolving profile after deletion reflects unassigned controls in overall resolution', () => {
      const profile = createBaseProfile([
        {
          id: 'grp-auth',
          title: 'Authentication Family',
          'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ia-1', 'ia-2'] }] }]
        }
      ]);

      const cache = createCatalogCache();
      const resolvedBefore = resolveProfileSync(profile, cache);
      expect(resolvedBefore.catalog.groups?.length).toBe(1);
      expect(resolvedBefore.catalog.groups?.[0].id).toBe('grp-auth');

      // Now simulate deleting grp-auth
      applyDeleteCustomGroup(profile, {
        groupId: 'grp-auth',
        deleteChildren: false,
        reassignToGroupId: null
      });

      expect(profile.profile.merge.custom.groups.length).toBe(0);

      // When no custom groups exist, resolver falls back to as-is catalog groups
      const resolvedAfter = resolveProfileSync(profile, cache);
      expect(resolvedAfter.catalog.groups?.some(g => g.id === 'grp-auth')).toBe(false);
    });

    it('1.5: Unassigning a single control via GroupEditor remove button updates insert-controls correctly', () => {
      const mockUnassign = vi.fn();
      const group = {
        id: 'grp-ops',
        title: 'Operations Group',
        controls: [
          { id: 'ac-1', title: 'Policy' },
          { id: 'ac-2', title: 'Management' }
        ],
        'insert-controls': [
          { 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2'] }] }
        ]
      };

      render(
        <GroupEditor
          group={group}
          isEditing={true}
          mode="profile"
          onUnassignControl={mockUnassign}
        />
      );

      const removeAc1Btn = screen.getByTestId('remove-control-btn-ac-1');
      expect(removeAc1Btn).toBeInTheDocument();
      fireEvent.click(removeAc1Btn);

      expect(mockUnassign).toHaveBeenCalledTimes(1);
      expect(mockUnassign).toHaveBeenCalledWith('ac-1', 'grp-ops');
    });

    it('1.6: GroupEditor remove button fallback updates group state when onUnassignControl is omitted', () => {
      const mockOnChange = vi.fn();
      const group = {
        id: 'grp-ops',
        title: 'Operations Group',
        controls: [
          { id: 'ac-1', title: 'Policy' },
          { id: 'ac-2', title: 'Management' }
        ],
        'insert-controls': [
          { 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2'] }] }
        ]
      };

      render(
        <GroupEditor
          group={group}
          isEditing={true}
          mode="profile"
          onChange={mockOnChange}
        />
      );

      const removeAc2Btn = screen.getByTestId('remove-control-btn-ac-2');
      fireEvent.click(removeAc2Btn);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const updatedGroup = mockOnChange.mock.calls[0][0];
      expect(updatedGroup.controls.map((c: any) => c.id)).toEqual(['ac-1']);
      expect(updatedGroup['insert-controls'][0]['include-controls'][0]['with-ids']).toEqual(['ac-1']);
    });
  });

  // =========================================================================
  // SCENARIO 2: Deleting a parent group and promoting child sub-groups
  // =========================================================================
  describe('Scenario 2: Parent group deletion and child sub-group promotion', () => {

    it('2.1: DeleteCustomGroupDialog displays child sub-group options and defaults to promote', () => {
      const group = {
        id: 'parent-1',
        title: 'Parent Domain',
        groups: [
          { id: 'child-1', title: 'Child Subgroup 1' },
          { id: 'child-2', title: 'Child Subgroup 2' }
        ]
      };

      render(
        <DeleteCustomGroupDialog
          isOpen={true}
          group={group}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getAllByText(/Child Sub-group/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByTestId('radio-subgroup-promote')).toBeChecked();
      expect(screen.getByTestId('radio-subgroup-delete')).not.toBeChecked();
    });

    it('2.2: Top-level parent deletion promotes children in place, preserving sibling order', () => {
      const draft = createBaseProfile([
        { id: 'root-before', title: 'Before Parent' },
        {
          id: 'parent-to-delete',
          title: 'Parent Group',
          groups: [
            { id: 'sub-alpha', title: 'Sub Alpha', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }] },
            { id: 'sub-beta', title: 'Sub Beta', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-2'] }] }] }
          ]
        },
        { id: 'root-after', title: 'After Parent' }
      ]);

      const success = applyDeleteCustomGroup(draft, {
        groupId: 'parent-to-delete',
        deleteChildren: false,
        reassignToGroupId: null
      });

      expect(success).toBe(true);
      const groups = draft.profile.merge.custom.groups;
      expect(groups.length).toBe(4);
      expect(groups.map((g: any) => g.id)).toEqual([
        'root-before',
        'sub-alpha',
        'sub-beta',
        'root-after'
      ]);

      // Verify promoted children retain their insert-controls
      expect(groups[1]['insert-controls'][0]['include-controls'][0]['with-ids']).toEqual(['ac-1']);
      expect(groups[2]['insert-controls'][0]['include-controls'][0]['with-ids']).toEqual(['ac-2']);
    });

    it('2.3: Deleting a nested sub-group promotes its children to the enclosing parent group', () => {
      const draft = createBaseProfile([
        {
          id: 'grandparent',
          title: 'Grandparent Group',
          groups: [
            {
              id: 'parent-middle',
              title: 'Middle Group',
              groups: [
                { id: 'grandchild-1', title: 'Grandchild 1', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['sc-7'] }] }] },
                { id: 'grandchild-2', title: 'Grandchild 2', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['sc-13'] }] }] }
              ]
            }
          ]
        }
      ]);

      const success = applyDeleteCustomGroup(draft, {
        groupId: 'parent-middle',
        deleteChildren: false,
        reassignToGroupId: null
      });

      expect(success).toBe(true);
      const gp = draft.profile.merge.custom.groups[0];
      expect(gp.id).toBe('grandparent');
      expect(gp.groups?.length).toBe(2);
      expect(gp.groups?.map((g: any) => g.id)).toEqual(['grandchild-1', 'grandchild-2']);
      expect(gp.groups?.[0]['insert-controls'][0]['include-controls'][0]['with-ids']).toEqual(['sc-7']);
      expect(gp.groups?.[1]['insert-controls'][0]['include-controls'][0]['with-ids']).toEqual(['sc-13']);
    });

    it('2.4: Cascading deletion (deleteChildren=true) permanently purges children', () => {
      const mockConfirm = vi.fn();
      const group = {
        id: 'parent-cascade',
        title: 'Parent Cascade',
        groups: [{ id: 'child-purge', title: 'Purged Child' }]
      };

      render(
        <DeleteCustomGroupDialog
          isOpen={true}
          group={group}
          onConfirm={mockConfirm}
          onCancel={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTestId('radio-subgroup-delete'));
      fireEvent.click(screen.getByTestId('confirm-delete-group-btn'));

      expect(mockConfirm).toHaveBeenCalledWith({
        deleteChildren: true,
        reassignToGroupId: null
      });

      // Apply to draft
      const draft = createBaseProfile([
        {
          id: 'parent-cascade',
          title: 'Parent Cascade',
          groups: [{ id: 'child-purge', title: 'Purged Child' }]
        },
        { id: 'survivor', title: 'Survivor' }
      ]);

      applyDeleteCustomGroup(draft, {
        groupId: 'parent-cascade',
        deleteChildren: true,
        reassignToGroupId: null
      });

      expect(draft.profile.merge.custom.groups.length).toBe(1);
      expect(draft.profile.merge.custom.groups[0].id).toBe('survivor');
    });

    it('2.5: Deep hierarchy stress (4 levels) resolves correctly after intermediate node deletion', () => {
      const draft = createBaseProfile([
        {
          id: 'L1',
          title: 'Level 1',
          groups: [
            {
              id: 'L2',
              title: 'Level 2',
              groups: [
                {
                  id: 'L3',
                  title: 'Level 3',
                  groups: [
                    {
                      id: 'L4',
                      title: 'Level 4',
                      'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]);

      // Delete L2 with promotion
      applyDeleteCustomGroup(draft, { groupId: 'L2', deleteChildren: false, reassignToGroupId: null });
      expect(draft.profile.merge.custom.groups[0].groups?.[0].id).toBe('L3');

      // Delete L3 with promotion
      applyDeleteCustomGroup(draft, { groupId: 'L3', deleteChildren: false, reassignToGroupId: null });
      expect(draft.profile.merge.custom.groups[0].groups?.[0].id).toBe('L4');
      expect(draft.profile.merge.custom.groups[0].groups?.[0]['insert-controls'][0]['include-controls'][0]['with-ids']).toEqual(['ac-1']);

      // Resolve with catalog cache
      const cache = createCatalogCache();
      const resolved = resolveProfileSync(draft, cache);
      expect(resolved.catalog.groups?.[0].id).toBe('L1');
      expect(resolved.catalog.groups?.[0].groups?.[0].id).toBe('L4');
      expect(resolved.catalog.groups?.[0].groups?.[0].controls?.[0].id).toBe('ac-1');
    });
  });

  // =========================================================================
  // SCENARIO 3: Reassigning controls to a target group on deletion
  // =========================================================================
  describe('Scenario 3: Reassigning controls to a target group on deletion', () => {

    it('3.1: DeleteCustomGroupDialog excludes deleted group from available targets and handles target selection', () => {
      const mockConfirm = vi.fn();
      const groupToDelete = {
        id: 'grp-source',
        title: 'Source Group',
        'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2'] }] }]
      };

      const availableTargets = [
        { id: 'grp-source', title: 'Source Group' }, // must be filtered out
        { id: 'grp-target-1', title: 'Target Group One' },
        { id: 'grp-target-2', title: 'Target Group Two' }
      ];

      render(
        <DeleteCustomGroupDialog
          isOpen={true}
          group={groupToDelete}
          availableTargetGroups={availableTargets}
          onConfirm={mockConfirm}
          onCancel={vi.fn()}
        />
      );

      // Verify grp-source is not in the select options
      const select = screen.getByTestId('select-reassign-target-group');
      const optionValues = Array.from(select.querySelectorAll('option')).map(o => o.value);
      expect(optionValues).not.toContain('grp-source');
      expect(optionValues).toEqual(['grp-target-1', 'grp-target-2']);

      // Select reassign radio and choose grp-target-2
      fireEvent.click(screen.getByTestId('radio-control-reassign'));
      fireEvent.change(select, { target: { value: 'grp-target-2' } });

      fireEvent.click(screen.getByTestId('confirm-delete-group-btn'));

      expect(mockConfirm).toHaveBeenCalledWith({
        deleteChildren: false,
        reassignToGroupId: 'grp-target-2'
      });
    });

    it('3.2: Reassign radio is disabled when no other custom groups exist', () => {
      const groupToDelete = {
        id: 'only-group',
        title: 'The Only Group',
        'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }]
      };

      render(
        <DeleteCustomGroupDialog
          isOpen={true}
          group={groupToDelete}
          availableTargetGroups={[{ id: 'only-group', title: 'The Only Group' }]}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const reassignRadio = screen.getByTestId('radio-control-reassign');
      expect(reassignRadio).toBeDisabled();
      expect(screen.getByText(/No other custom groups available for reassignment/i)).toBeInTheDocument();
    });

    it('3.3: applyDeleteCustomGroup reassigns all controls and prevents duplicate control IDs', () => {
      const draft = createBaseProfile([
        {
          id: 'grp-target',
          title: 'Target Group',
          'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1', 'ac-3'] }] }]
        },
        {
          id: 'grp-source',
          title: 'Source Group to Delete',
          'insert-controls': [{ 'include-controls': [{ 'with-ids': ['AC-1', 'ac-2', 'ac-10'] }] }] // Note AC-1 uppercase duplicate
        }
      ]);

      const success = applyDeleteCustomGroup(draft, {
        groupId: 'grp-source',
        deleteChildren: false,
        reassignToGroupId: 'grp-target'
      });

      expect(success).toBe(true);
      expect(draft.profile.merge.custom.groups.length).toBe(1);

      const targetGroup = draft.profile.merge.custom.groups[0];
      expect(targetGroup.id).toBe('grp-target');
      const finalWithIds = targetGroup['insert-controls'][0]['include-controls'][0]['with-ids'];

      // AC-1 should not create duplicate since ac-1 is already in target
      expect(finalWithIds).toEqual(['ac-1', 'ac-3', 'ac-2', 'ac-10']);
    });

    it('3.4: Reassignment properly initializes insert-controls if target group had none', () => {
      const draft = createBaseProfile([
        {
          id: 'grp-bare-target',
          title: 'Bare Target'
          // no insert-controls initially
        },
        {
          id: 'grp-source',
          title: 'Source Group',
          'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2'] }] }]
        }
      ]);

      const success = applyDeleteCustomGroup(draft, {
        groupId: 'grp-source',
        deleteChildren: false,
        reassignToGroupId: 'grp-bare-target'
      });

      expect(success).toBe(true);
      const targetGroup = draft.profile.merge.custom.groups[0];
      expect(targetGroup['insert-controls']).toBeDefined();
      expect(targetGroup['insert-controls'][0]['include-controls'][0]['with-ids']).toEqual(['ac-1', 'ac-2']);
    });

    it('3.5: Reassigning to a nested target group transfers controls deep into the hierarchy', () => {
      const draft = createBaseProfile([
        {
          id: 'parent',
          title: 'Parent',
          groups: [
            {
              id: 'nested-target',
              title: 'Nested Target',
              'insert-controls': [{ 'include-controls': [{ 'with-ids': ['sc-7'] }] }]
            }
          ]
        },
        {
          id: 'source-to-delete',
          title: 'Source to Delete',
          'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2'] }] }]
        }
      ]);

      const success = applyDeleteCustomGroup(draft, {
        groupId: 'source-to-delete',
        deleteChildren: false,
        reassignToGroupId: 'nested-target'
      });

      expect(success).toBe(true);
      const nested = draft.profile.merge.custom.groups[0].groups[0];
      expect(nested['insert-controls'][0]['include-controls'][0]['with-ids']).toEqual(['sc-7', 'ac-1', 'ac-2']);
    });
  });

  // =========================================================================
  // SCENARIO 4: Changing insert-controls.order directive (keep, ascending, descending)
  // =========================================================================
  describe('Scenario 4: Changing insert-controls.order directive', () => {

    it('4.1: GroupEditor renders order select in profile mode when isEditing is true', () => {
      const group = {
        id: 'grp-ordered',
        title: 'Ordered Group',
        'insert-controls': [{ order: 'keep', 'include-controls': [{ 'with-ids': ['ac-1'] }] }]
      };

      const { rerender } = render(
        <GroupEditor
          group={group}
          isEditing={true}
          mode="profile"
          onChange={vi.fn()}
        />
      );

      const select = screen.getByTestId('group-order-select') as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      expect(select.value).toBe('keep');

      // In catalog mode, select is not rendered
      rerender(
        <GroupEditor
          group={group}
          isEditing={true}
          mode="catalog"
          onChange={vi.fn()}
        />
      );
      expect(screen.queryByTestId('group-order-select')).not.toBeInTheDocument();

      // In read-only profile mode, select is not rendered
      rerender(
        <GroupEditor
          group={group}
          isEditing={false}
          mode="profile"
          onChange={vi.fn()}
        />
      );
      expect(screen.queryByTestId('group-order-select')).not.toBeInTheDocument();
    });

    it('4.2: GroupEditor invokes onOrderChange when available for keep, ascending, and descending', () => {
      const mockOrderChange = vi.fn();
      const group = {
        id: 'grp-ordered',
        title: 'Ordered Group',
        'insert-controls': [{ order: 'keep', 'include-controls': [{ 'with-ids': ['ac-1'] }] }]
      };

      render(
        <GroupEditor
          group={group}
          isEditing={true}
          mode="profile"
          onOrderChange={mockOrderChange}
        />
      );

      const select = screen.getByTestId('group-order-select');

      fireEvent.change(select, { target: { value: 'ascending' } });
      expect(mockOrderChange).toHaveBeenCalledWith('ascending');

      fireEvent.change(select, { target: { value: 'descending' } });
      expect(mockOrderChange).toHaveBeenCalledWith('descending');

      fireEvent.change(select, { target: { value: 'keep' } });
      expect(mockOrderChange).toHaveBeenCalledWith('keep');
    });

    it('4.3: GroupEditor fallback correctly modifies insert-controls array when onOrderChange is omitted', () => {
      const mockOnChange = vi.fn();
      const groupWithoutIcs = {
        id: 'grp-no-ics',
        title: 'No Insert Controls Group'
      };

      render(
        <GroupEditor
          group={groupWithoutIcs}
          isEditing={true}
          mode="profile"
          onChange={mockOnChange}
        />
      );

      const select = screen.getByTestId('group-order-select');
      fireEvent.change(select, { target: { value: 'descending' } });

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const updatedGroup = mockOnChange.mock.calls[0][0];
      expect(updatedGroup['insert-controls']).toBeDefined();
      expect(updatedGroup['insert-controls'][0].order).toBe('descending');
    });

    it('4.4: applyReorderControlsInCustomGroup sorts controls alphanumerically ascending and descending', () => {
      const draft = createBaseProfile([
        {
          id: 'grp-sort',
          title: 'Sort Testing Group',
          'insert-controls': [
            {
              order: 'keep',
              'include-controls': [{ 'with-ids': ['ac-10', 'ac-2', 'ac-1', 'ac-20', 'ac-3'] }]
            }
          ]
        }
      ]);

      // Ascending sort (natural alphanumeric)
      applyReorderControlsInCustomGroup(draft, {
        groupId: 'grp-sort',
        order: 'ascending'
      });

      let withIds = draft.profile.merge.custom.groups[0]['insert-controls'][0]['include-controls'][0]['with-ids'];
      expect(withIds).toEqual(['ac-1', 'ac-2', 'ac-3', 'ac-10', 'ac-20']);
      expect(draft.profile.merge.custom.groups[0]['insert-controls'][0].order).toBe('ascending');

      // Descending sort
      applyReorderControlsInCustomGroup(draft, {
        groupId: 'grp-sort',
        order: 'descending'
      });

      withIds = draft.profile.merge.custom.groups[0]['insert-controls'][0]['include-controls'][0]['with-ids'];
      expect(withIds).toEqual(['ac-20', 'ac-10', 'ac-3', 'ac-2', 'ac-1']);
      expect(draft.profile.merge.custom.groups[0]['insert-controls'][0].order).toBe('descending');
    });

    it('4.5: Reordering with custom manual controlIds list and keep order preserves exact specified sequence', () => {
      const draft = createBaseProfile([
        {
          id: 'grp-manual',
          title: 'Manual Sequence Group',
          'insert-controls': [
            {
              order: 'ascending',
              'include-controls': [{ 'with-ids': ['ac-1', 'ac-2', 'ac-3'] }]
            }
          ]
        }
      ]);

      applyReorderControlsInCustomGroup(draft, {
        groupId: 'grp-manual',
        controlIds: ['ac-3', 'ac-1', 'ac-2'],
        order: 'keep'
      });

      const ic = draft.profile.merge.custom.groups[0]['insert-controls'][0];
      expect(ic.order).toBe('keep');
      expect(ic['include-controls'][0]['with-ids']).toEqual(['ac-3', 'ac-1', 'ac-2']);
    });
  });

  // =========================================================================
  // SCENARIO 5: Adversarial Edge Cases, Keyboard Navigation & Error Resilience
  // =========================================================================
  describe('Scenario 5: Adversarial Edge Cases, Keyboard & Error Resilience', () => {

    it('5.1: DeleteCustomGroupDialog closes gracefully on Escape key press', () => {
      const mockCancel = vi.fn();
      render(
        <DeleteCustomGroupDialog
          isOpen={true}
          group={{ id: 'grp-esc', title: 'Escape Test' }}
          onConfirm={vi.fn()}
          onCancel={mockCancel}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(mockCancel).toHaveBeenCalledTimes(1);
    });

    it('5.2: DeleteCustomGroupDialog closes on backdrop overlay click', () => {
      const mockCancel = vi.fn();
      render(
        <DeleteCustomGroupDialog
          isOpen={true}
          group={{ id: 'grp-backdrop', title: 'Backdrop Test' }}
          onConfirm={vi.fn()}
          onCancel={mockCancel}
        />
      );

      const overlay = screen.getByTestId('delete-custom-group-dialog-overlay');
      fireEvent.click(overlay);
      expect(mockCancel).toHaveBeenCalledTimes(1);
    });

    it('5.3: DeleteCustomGroupDialog does not close when clicking inside dialog body', () => {
      const mockCancel = vi.fn();
      render(
        <DeleteCustomGroupDialog
          isOpen={true}
          group={{ id: 'grp-body', title: 'Body Click Test' }}
          onConfirm={vi.fn()}
          onCancel={mockCancel}
        />
      );

      const dialog = screen.getByTestId('delete-custom-group-dialog');
      fireEvent.click(dialog);
      expect(mockCancel).not.toHaveBeenCalled();
    });

    it('5.4: DeleteCustomGroupDialog returns null when isOpen is false or group is null', () => {
      const { container, rerender } = render(
        <DeleteCustomGroupDialog
          isOpen={false}
          group={{ id: 'grp-null' }}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      expect(container.firstChild).toBeNull();

      rerender(
        <DeleteCustomGroupDialog
          isOpen={true}
          group={null}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('5.5: Action handlers safely handle non-existent group IDs without throwing', () => {
      const draft = createBaseProfile([]);

      expect(applyDeleteCustomGroup(draft, { groupId: 'non-existent', deleteChildren: false, reassignToGroupId: null })).toBe(false);
      expect(applyReorderControlsInCustomGroup(draft, { groupId: 'non-existent', order: 'ascending' })).toBe(false);
      expect(applyRemoveControlFromCustomGroup(draft, { controlId: 'ac-1', sourceGroupId: 'non-existent' })).toBe(false);
    });

    it('5.6: Full complex lifecycle stress test', () => {
      // 1. Start with profile having nested custom groups
      const profile = createBaseProfile([
        {
          id: 'governance',
          title: 'Governance Domain',
          groups: [
            {
              id: 'access-control-sub',
              title: 'Access Subdomain',
              'insert-controls': [{ order: 'keep', 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2', 'ac-10', 'ac-20'] }] }]
            },
            {
              id: 'identity-sub',
              title: 'Identity Subdomain',
              'insert-controls': [{ order: 'keep', 'include-controls': [{ 'with-ids': ['ia-1', 'ia-2'] }] }]
            }
          ]
        },
        {
          id: 'operations',
          title: 'Operations Domain',
          'insert-controls': [{ order: 'keep', 'include-controls': [{ 'with-ids': ['ac-3', 'ia-5'] }] }]
        }
      ]);

      // 2. Sort access-control-sub controls ascending
      applyReorderControlsInCustomGroup(profile, { groupId: 'access-control-sub', order: 'ascending' });
      expect(profile.profile.merge.custom.groups[0].groups[0]['insert-controls'][0]['include-controls'][0]['with-ids']).toEqual([
        'ac-1', 'ac-2', 'ac-10', 'ac-20'
      ]);

      // 3. Delete governance parent with promotion of access-control-sub and identity-sub
      applyDeleteCustomGroup(profile, { groupId: 'governance', deleteChildren: false, reassignToGroupId: null });
      expect(profile.profile.merge.custom.groups.map((g: any) => g.id)).toEqual([
        'access-control-sub',
        'identity-sub',
        'operations'
      ]);

      // 4. Delete access-control-sub with reassignment to operations
      applyDeleteCustomGroup(profile, { groupId: 'access-control-sub', deleteChildren: false, reassignToGroupId: 'operations' });
      expect(profile.profile.merge.custom.groups.map((g: any) => g.id)).toEqual([
        'identity-sub',
        'operations'
      ]);

      const opsControls = profile.profile.merge.custom.groups[1]['insert-controls'][0]['include-controls'][0]['with-ids'];
      expect(opsControls).toEqual(['ac-3', 'ia-5', 'ac-1', 'ac-2', 'ac-10', 'ac-20']);

      // 5. Sort operations controls descending
      applyReorderControlsInCustomGroup(profile, { groupId: 'operations', order: 'descending' });
      const opsDesc = profile.profile.merge.custom.groups[1]['insert-controls'][0]['include-controls'][0]['with-ids'];
      expect(opsDesc).toEqual(['ia-5', 'ac-20', 'ac-10', 'ac-3', 'ac-2', 'ac-1']);

      // 6. Resolve final profile
      const cache = createCatalogCache();
      const resolved = resolveProfileSync(profile, cache);
      expect(resolved.catalog.groups?.length).toBe(2);
      expect(resolved.catalog.groups?.[0].id).toBe('identity-sub');
      expect(resolved.catalog.groups?.[1].id).toBe('operations');
      expect(resolved.catalog.groups?.[1].controls?.length).toBe(6);
    });

    it('5.7: Case-insensitive group deletion matches groupId regardless of casing', () => {
      const draft = createBaseProfile([
        { id: 'GRP-AUDIT', title: 'Audit Group', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['au-1'] }] }] }
      ]);

      const success = applyDeleteCustomGroup(draft, {
        groupId: 'grp-audit',
        deleteChildren: false,
        reassignToGroupId: null
      });

      expect(success).toBe(true);
      expect(draft.profile.merge.custom.groups.length).toBe(0);
    });

    it('5.8: 10-level deep nesting hierarchy deletion and promotion stress test', () => {
      let current: any = {
        id: 'level-10',
        title: 'Level 10',
        'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }]
      };

      for (let i = 9; i >= 1; i--) {
        current = {
          id: `level-${i}`,
          title: `Level ${i}`,
          groups: [current]
        };
      }

      const draft = createBaseProfile([current]);

      // Delete level-5 with promotion
      const success = applyDeleteCustomGroup(draft, {
        groupId: 'level-5',
        deleteChildren: false,
        reassignToGroupId: null
      });

      expect(success).toBe(true);

      // Verify level-4 now directly contains level-6
      const l1 = draft.profile.merge.custom.groups[0];
      const l2 = l1.groups[0];
      const l3 = l2.groups[0];
      const l4 = l3.groups[0];
      expect(l4.id).toBe('level-4');
      expect(l4.groups[0].id).toBe('level-6');
    });

    it('5.9: GroupEditor computes accurate metrics for nested groups including sub-group controls', () => {
      const nestedGroup = {
        id: 'root-grp',
        title: 'Root Metric Test',
        controls: [{ id: 'ac-1' }, { id: 'ac-2' }],
        groups: [
          {
            id: 'sub-grp-1',
            title: 'Sub 1',
            controls: [{ id: 'ac-3' }],
            groups: [
              {
                id: 'sub-grp-1-1',
                title: 'Sub 1.1',
                controls: [{ id: 'ac-10' }, { id: 'ac-20' }]
              }
            ]
          },
          {
            id: 'sub-grp-2',
            title: 'Sub 2',
            controls: [{ id: 'ia-1' }]
          }
        ]
      };

      render(
        <GroupEditor
          group={nestedGroup}
          isEditing={false}
          mode="profile"
        />
      );

      // Direct Controls: 2 and Sub-groups: 2
      expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(2);
      // Total (incl. enhancements): 2 + 1 + 2 + 1 = 6 controls
      expect(screen.getByText('6')).toBeInTheDocument();
    });

    it('5.10: GroupEditor correctly filters withdrawn controls in profile mode vs catalog mode', () => {
      const groupWithWithdrawn = {
        id: 'withdrawn-test-grp',
        title: 'Withdrawn Test',
        controls: [
          { id: 'ac-active', title: 'Active Control' },
          { id: 'ac-withdrawn-status', title: 'Withdrawn By Status', status: 'withdrawn' },
          { id: 'ac-withdrawn-prop', title: 'Withdrawn By Prop', props: [{ name: 'status', value: 'withdrawn' }] }
        ]
      };

      // In profile mode, withdrawn controls are ALWAYS filtered out
      const { rerender } = render(
        <GroupEditor
          group={groupWithWithdrawn}
          isEditing={true}
          mode="profile"
        />
      );

      expect(screen.getByText('Active Control')).toBeInTheDocument();
      expect(screen.queryByText('Withdrawn By Status')).not.toBeInTheDocument();
      expect(screen.queryByText('Withdrawn By Prop')).not.toBeInTheDocument();

      // In catalog mode with isEditing=true, withdrawn controls are visible (for restoration)
      rerender(
        <GroupEditor
          group={groupWithWithdrawn}
          isEditing={true}
          mode="catalog"
        />
      );

      expect(screen.getByText('Active Control')).toBeInTheDocument();
      expect(screen.getByText('Withdrawn By Status')).toBeInTheDocument();
      expect(screen.getByText('Withdrawn By Prop')).toBeInTheDocument();
    });
  });
});

