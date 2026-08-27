import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileSidebar } from '@components/profile/ProfileSidebar';
import { ControlTreeNodeComponent } from '@components/shared/control-tree/ControlTreeNode';
import {
  applyAddCustomGroup,
  applyRenameCustomGroup,
  applyDeleteCustomGroup,
  applyMoveCustomGroup,
  applyAssignControlToCustomGroup,
  applyRemoveControlFromCustomGroup,
  applyReorderControlsInCustomGroup,
  gatherAllAssignedControlIds,
  gatherControlsInGroup,
  findCustomGroupById
} from '@lib/document-actions/profile-actions';

/**
 * Interactive test harness simulating a complete live Profile Page with real state transitions
 */
function LiveProfileSidebarHarness({
  initialProfile,
  initialResolvedCatalog,
  isEditing = true
}: {
  initialProfile: any;
  initialResolvedCatalog: any;
  isEditing?: boolean;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const dispatch = (action: any) => {
    setProfile((prev: any) => {
      const cloned = JSON.parse(JSON.stringify(prev));
      const draft = { profile: cloned };

      switch (action.type) {
        case 'ASSIGN_CONTROL_TO_CUSTOM_GROUP':
        case 'profile/assignControlToCustomGroup':
          applyAssignControlToCustomGroup(draft, action.payload);
          break;
        case 'REMOVE_CONTROL_FROM_CUSTOM_GROUP':
        case 'profile/removeControlFromCustomGroup':
          applyRemoveControlFromCustomGroup(draft, action.payload);
          break;
        case 'ADD_CUSTOM_GROUP':
        case 'profile/addCustomGroup':
          applyAddCustomGroup(draft, action.payload);
          break;
        case 'RENAME_CUSTOM_GROUP':
        case 'profile/renameCustomGroup':
          applyRenameCustomGroup(draft, action.payload);
          break;
        case 'DELETE_CUSTOM_GROUP':
        case 'profile/deleteCustomGroup':
          applyDeleteCustomGroup(draft, action.payload);
          break;
        case 'MOVE_CUSTOM_GROUP':
        case 'profile/moveCustomGroup':
          applyMoveCustomGroup(draft, action.payload);
          break;
        case 'REORDER_CONTROLS_IN_CUSTOM_GROUP':
        case 'profile/reorderControlsInCustomGroup':
          applyReorderControlsInCustomGroup(draft, action.payload);
          break;
      }
      return draft.profile;
    });
  };

  return (
    <div>
      <div data-testid="serialized-profile-json">
        {JSON.stringify(profile)}
      </div>
      <ProfileSidebar
        resolvedCatalog={initialResolvedCatalog}
        profile={profile}
        isEditing={isEditing}
        selectedControlId={selectedControlId}
        selectedGroupId={selectedGroupId}
        onSelectControl={(id: string) => setSelectedControlId(id)}
        onSelectGroup={(id: string) => setSelectedGroupId(id)}
        onSelectOverview={vi.fn()}
        onSelectMetadata={vi.fn()}
        onSelectProperties={vi.fn()}
        onSelectParameters={vi.fn()}
        onSelectBackMatter={vi.fn()}
        onSelectImports={vi.fn()}
        dispatch={dispatch}
        initialVisibilityFilter={{ showActive: true, showExcluded: true, showWithdrawn: false, showUnassigned: true }}
      />
    </div>
  );
}

/**
 * Helper to simulate realistic browser drag-and-drop onto a tree node (dragOver at center + drop)
 */
function dropControlOnNode(
  targetElement: HTMLElement,
  dataTransferObj: { getData: (key: string) => string; types: string[] }
) {
  fireEvent.dragOver(targetElement, {
    clientY: 10,
    currentTarget: {
      getBoundingClientRect: () => ({ top: 0, height: 20 })
    },
    dataTransfer: { ...dataTransferObj, dropEffect: 'move' }
  });

  fireEvent.drop(targetElement, { dataTransfer: dataTransferObj });
}

describe('Adversarial Challenger M3-1: Profile Sidebar Virtual Unassigned Node & DnD Suite', () => {
  const sampleResolvedCatalog = {
    all_controls: [
      { id: 'ac-1', title: 'Access Control Policy and Procedures' },
      { id: 'ac-2', title: 'Account Management' },
      { id: 'ac-3', title: 'Access Enforcement' },
      { id: 'ac-4', title: 'Information Flow Enforcement' },
      { id: 'ac-5', title: 'Separation of Duties' },
      { id: 'ac-6', title: 'Least Privilege' },
      { id: 'ia-1', title: 'Identification and Authentication Policy' },
      { id: 'ia-2', title: 'Identification and Authentication' },
      { id: 'ia-3', title: 'Device Identification and Authentication' },
      { id: 'sc-1', title: 'System and Communications Protection Policy' },
      { id: 'sc-7', title: 'Boundary Protection' },
      { id: 'sc-13', title: 'Cryptographic Protection' }
    ],
    all_groups: [],
    groups: [
      {
        id: 'cg-core',
        title: 'Core Access Group',
        controls: [
          { id: 'ac-1', title: 'Access Control Policy and Procedures' },
          { id: 'ac-2', title: 'Account Management' }
        ],
        groups: [
          {
            id: 'cg-sub-flow',
            title: 'Sub-Flow Controls',
            controls: [{ id: 'ac-4', title: 'Information Flow Enforcement' }],
            groups: []
          }
        ]
      },
      {
        id: 'cg-crypto',
        title: 'Cryptography & Boundary',
        controls: [
          { id: 'sc-13', title: 'Cryptographic Protection' }
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
            title: 'Core Access Group',
            'insert-controls': [
              {
                'include-controls': [{ 'with-ids': ['ac-1', 'ac-2'] }]
              }
            ],
            groups: [
              {
                id: 'cg-sub-flow',
                title: 'Sub-Flow Controls',
                'insert-controls': [
                  {
                    'include-controls': [{ 'with-ids': ['ac-4'] }]
                  }
                ],
                groups: []
              }
            ]
          },
          {
            id: 'cg-crypto',
            title: 'Cryptography & Boundary',
            'insert-controls': [
              {
                'include-controls': [{ 'with-ids': ['sc-13'] }]
              }
            ],
            groups: []
          }
        ]
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. DRAGGING CONTROLS RAPIDLY BETWEEN MULTIPLE CUSTOM GROUPS & UNASSIGNED
  // =========================================================================
  describe('1. Dragging Controls Between Multiple Custom Groups & Unassigned Node Rapidly', () => {
    it('executes rapid sequential cross-group control moves and keeps state perfectly consistent', () => {
      render(
        <LiveProfileSidebarHarness
          initialProfile={sampleProfile}
          initialResolvedCatalog={sampleResolvedCatalog}
          isEditing={true}
        />
      );

      // Initially: 12 total imported controls.
      // Assigned: ac-1, ac-2 (in cg-core), ac-4 (in cg-sub-flow), sc-13 (in cg-crypto) = 4 assigned.
      // Unassigned: 12 - 4 = 8 controls.
      let unassignedNode = screen.getByTestId('tree-node-__unassigned__');
      expect(unassignedNode.textContent).toContain('📥 Unassigned Controls (8)');

      // Step 1: Assign unassigned 'ac-3' to 'cg-core'
      const cgCoreRow = screen.getByTestId('tree-node-cg-core');
      dropControlOnNode(cgCoreRow, {
        getData: (key: string) => (key === 'text/plain' ? 'ac-3' : ''),
        types: ['text/plain']
      });

      // After Step 1: Assigned = 5, Unassigned = 7
      unassignedNode = screen.getByTestId('tree-node-__unassigned__');
      expect(unassignedNode.textContent).toContain('📥 Unassigned Controls (7)');

      // Step 2: Move 'ac-3' from 'cg-core' to 'cg-crypto'
      const cgCryptoRow = screen.getByTestId('tree-node-cg-crypto');
      dropControlOnNode(cgCryptoRow, {
        getData: (key: string) => (key === 'text/plain' ? 'ac-3' : ''),
        types: ['text/plain']
      });

      // Still 5 assigned, 7 unassigned
      unassignedNode = screen.getByTestId('tree-node-__unassigned__');
      expect(unassignedNode.textContent).toContain('📥 Unassigned Controls (7)');

      // Step 3: Expand cg-core to reveal cg-sub-flow, then move 'ac-3' to 'cg-sub-flow'
      const cgCoreToggle = cgCoreRow.querySelector('span');
      if (cgCoreToggle) fireEvent.click(cgCoreToggle);

      const cgSubFlowRow = screen.getByTestId('tree-node-cg-sub-flow');
      dropControlOnNode(cgSubFlowRow, {
        getData: (key: string) => (key === 'text/plain' ? 'ac-3' : ''),
        types: ['text/plain']
      });
      expect(unassignedNode.textContent).toContain('📥 Unassigned Controls (7)');

      // Step 4: Move 'ac-3' back to unassigned node
      dropControlOnNode(unassignedNode, {
        getData: (key: string) => (key === 'text/plain' ? 'ac-3' : ''),
        types: ['text/plain']
      });

      // After Step 4: Assigned = 4, Unassigned = 8
      unassignedNode = screen.getByTestId('tree-node-__unassigned__');
      expect(unassignedNode.textContent).toContain('📥 Unassigned Controls (8)');

      // Verify the serialized profile JSON reflects exact state
      const jsonText = screen.getByTestId('serialized-profile-json').textContent!;
      const parsed = JSON.parse(jsonText);
      const assignedSet = gatherAllAssignedControlIds(parsed.merge.custom);
      expect(assignedSet.has('ac-3')).toBe(false);
      expect(assignedSet.has('ac-1')).toBe(true);
      expect(assignedSet.has('ac-2')).toBe(true);
      expect(assignedSet.has('ac-4')).toBe(true);
      expect(assignedSet.has('sc-13')).toBe(true);
      expect(assignedSet.size).toBe(4);
    });

    it('performs a 30-step permutation stress loop of rapid drag operations without error or corruption', () => {
      render(
        <LiveProfileSidebarHarness
          initialProfile={sampleProfile}
          initialResolvedCatalog={sampleResolvedCatalog}
          isEditing={true}
        />
      );

      // Expand cg-core so cg-sub-flow is visible
      const cgCoreRow = screen.getByTestId('tree-node-cg-core');
      const cgCoreToggle = cgCoreRow.querySelector('span');
      if (cgCoreToggle) fireEvent.click(cgCoreToggle);

      const targetGroupIds = ['cg-core', 'cg-sub-flow', 'cg-crypto', '__unassigned__'];
      const candidateControls = ['ac-5', 'ac-6', 'ia-1', 'ia-2', 'ia-3', 'sc-1', 'sc-7'];

      for (let i = 0; i < 30; i++) {
        const ctrl = candidateControls[i % candidateControls.length];
        const targetId = targetGroupIds[i % targetGroupIds.length];
        const targetRow = screen.getByTestId(`tree-node-${targetId}`);

        dropControlOnNode(targetRow, {
          getData: (key: string) => (key === 'text/plain' ? ctrl : ''),
          types: ['text/plain']
        });
      }

      // Check state consistency
      const jsonText = screen.getByTestId('serialized-profile-json').textContent!;
      const parsed = JSON.parse(jsonText);

      // Verify every control in profile is unique across all groups
      const allFoundControls: string[] = [];
      const traverseGroup = (g: any) => {
        const controls = gatherControlsInGroup(g);
        allFoundControls.push(...controls);
        if (g.groups) g.groups.forEach(traverseGroup);
      };
      parsed.merge.custom.groups.forEach(traverseGroup);

      const uniqueControls = new Set(allFoundControls.map(c => c.toLowerCase()));
      expect(allFoundControls.length).toBe(uniqueControls.size);
    });

    it('accepts drag with application/x-oscal-control JSON payload from external pool', () => {
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

      const targetRow = screen.getByTestId('tree-node-cg-crypto');
      const payload = JSON.stringify({
        id: 'sc-7',
        title: 'Boundary Protection',
        sourceGroupId: null
      });

      dropControlOnNode(targetRow, {
        getData: (key: string) => {
          if (key === 'application/x-oscal-control') return payload;
          if (key === 'text/plain') return 'sc-7';
          return '';
        },
        types: ['application/x-oscal-control', 'text/plain']
      });

      expect(mockDispatch).toHaveBeenCalled();
      const action = mockDispatch.mock.calls[0][0];
      expect(action.type).toBe('ASSIGN_CONTROL_TO_CUSTOM_GROUP');
      expect(action.payload.controlId).toBe('sc-7');
      expect(action.payload.targetGroupId).toBe('cg-crypto');
    });

    it('gracefully recovers when application/x-oscal-control contains corrupt JSON and falls back to text/plain', () => {
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

      const targetRow = screen.getByTestId('tree-node-cg-core');
      dropControlOnNode(targetRow, {
        getData: (key: string) => {
          if (key === 'application/x-oscal-control') return '{ corrupt-json! ';
          if (key === 'text/plain') return 'sc-1';
          return '';
        },
        types: ['application/x-oscal-control', 'text/plain']
      });

      expect(mockDispatch).toHaveBeenCalled();
      const action = mockDispatch.mock.calls[0][0];
      expect(action.type).toBe('ASSIGN_CONTROL_TO_CUSTOM_GROUP');
      expect(action.payload.controlId).toBe('sc-1');
      expect(action.payload.targetGroupId).toBe('cg-core');
    });

    it('safely handles drop events with missing or empty dataTransfer without throwing runtime error', () => {
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

      const targetRow = screen.getByTestId('tree-node-cg-core');
      expect(() => {
        dropControlOnNode(targetRow, {
          getData: () => '',
          types: []
        });
      }).not.toThrow();

      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. RE-ASSIGNING ALREADY ASSIGNED CONTROLS (EXCLUSIVITY VERIFICATION)
  // =========================================================================
  describe('2. Re-assigning Already Assigned Controls (Verifying Exclusivity)', () => {
    it('strictly enforces exclusivity when reassigning a control from one custom group to another', () => {
      const doc = {
        profile: {
          imports: [{ href: 'catalogs/cat.json', 'include-all': {} }],
          merge: {
            custom: {
              groups: [
                {
                  id: 'grp-alpha',
                  title: 'Alpha Group',
                  'insert-controls': [
                    { 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2', 'ac-3'] }] }
                  ]
                },
                {
                  id: 'grp-beta',
                  title: 'Beta Group',
                  'insert-controls': [
                    { 'include-controls': [{ 'with-ids': ['ac-4'] }] }
                  ]
                }
              ]
            }
          }
        }
      };

      // Assign 'ac-2' from grp-alpha to grp-beta
      const success = applyAssignControlToCustomGroup(doc, {
        controlId: 'ac-2',
        targetGroupId: 'grp-beta'
      });

      expect(success).toBe(true);

      const alpha = findCustomGroupById(doc.profile.merge.custom, 'grp-alpha');
      const beta = findCustomGroupById(doc.profile.merge.custom, 'grp-beta');

      const alphaControls = gatherControlsInGroup(alpha!);
      const betaControls = gatherControlsInGroup(beta!);

      expect(alphaControls).toEqual(['ac-1', 'ac-3']);
      expect(betaControls).toEqual(['ac-4', 'ac-2']);

      // 'ac-2' must exist exactly once across all groups
      const allAssigned = gatherAllAssignedControlIds(doc.profile.merge.custom);
      expect(allAssigned.has('ac-2')).toBe(true);
      expect(allAssigned.size).toBe(4);
    });

    it('enforces exclusivity case-insensitively across nested multi-level group structures', () => {
      const doc = {
        profile: {
          imports: [{ href: 'catalogs/cat.json', 'include-all': {} }],
          merge: {
            custom: {
              groups: [
                {
                  id: 'grp-root',
                  title: 'Root Group',
                  groups: [
                    {
                      id: 'grp-sub-1',
                      title: 'Sub Group 1',
                      groups: [
                        {
                          id: 'grp-deep',
                          title: 'Deep Group',
                          'insert-controls': [
                            { 'include-controls': [{ 'with-ids': ['AC-1', 'IA-2'] }] }
                          ]
                        }
                      ]
                    }
                  ]
                },
                {
                  id: 'grp-target',
                  title: 'Target Group',
                  'insert-controls': [
                    { 'include-controls': [{ 'with-ids': ['SC-1'] }] }
                  ]
                }
              ]
            }
          }
        }
      };

      // Reassign 'ac-1' (lowercase) to 'grp-target'
      applyAssignControlToCustomGroup(doc, {
        controlId: 'ac-1',
        targetGroupId: 'grp-target'
      });

      const deepGroup = findCustomGroupById(doc.profile.merge.custom, 'grp-deep');
      const targetGroup = findCustomGroupById(doc.profile.merge.custom, 'grp-target');

      const deepControls = gatherControlsInGroup(deepGroup!);
      const targetControls = gatherControlsInGroup(targetGroup!);

      // Old group deepGroup must NO LONGER have 'AC-1' or 'ac-1'
      expect(deepControls).toEqual(['IA-2']);
      expect(targetControls).toEqual(['SC-1', 'ac-1']);
    });

    it('cleanses control ID from multiple insert-controls blocks within the same group upon reassignment', () => {
      const doc = {
        profile: {
          imports: [{ href: 'catalogs/cat.json', 'include-all': {} }],
          merge: {
            custom: {
              groups: [
                {
                  id: 'grp-multi-ic',
                  title: 'Multi IC Group',
                  'insert-controls': [
                    { 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2'] }] },
                    { 'include-controls': [{ 'with-ids': ['ac-1', 'ac-3'] }] }
                  ]
                },
                {
                  id: 'grp-other',
                  title: 'Other Group',
                  'insert-controls': []
                }
              ]
            }
          }
        }
      };

      // Reassign 'ac-1' to 'grp-other'
      applyAssignControlToCustomGroup(doc, {
        controlId: 'ac-1',
        targetGroupId: 'grp-other'
      });

      const multiIcGroup = findCustomGroupById(doc.profile.merge.custom, 'grp-multi-ic');
      const otherGroup = findCustomGroupById(doc.profile.merge.custom, 'grp-other');

      expect(gatherControlsInGroup(multiIcGroup!)).toEqual(['ac-2', 'ac-3']);
      expect(gatherControlsInGroup(otherGroup!)).toEqual(['ac-1']);
    });

    it('keeps unassigned count unchanged when a control is reassigned between groups', () => {
      render(
        <LiveProfileSidebarHarness
          initialProfile={sampleProfile}
          initialResolvedCatalog={sampleResolvedCatalog}
          isEditing={true}
        />
      );

      const unassignedNodeBefore = screen.getByTestId('tree-node-__unassigned__');
      expect(unassignedNodeBefore.textContent).toContain('📥 Unassigned Controls (8)');

      // Reassign 'ac-1' (currently in cg-core) to 'cg-crypto'
      const cgCryptoRow = screen.getByTestId('tree-node-cg-crypto');
      dropControlOnNode(cgCryptoRow, {
        getData: (key: string) => (key === 'text/plain' ? 'ac-1' : ''),
        types: ['text/plain']
      });

      // The unassigned count must STILL be 8 because 'ac-1' was already assigned!
      const unassignedNodeAfter = screen.getByTestId('tree-node-__unassigned__');
      expect(unassignedNodeAfter.textContent).toContain('📥 Unassigned Controls (8)');
    });
  });

  // =========================================================================
  // 3. ATTEMPTING TO DROP CUSTOM GROUPS INTO VIRTUAL UNASSIGNED NODE
  // =========================================================================
  describe('3. Attempting to Drop Custom Groups into the Virtual Unassigned Node', () => {
    it('blocks dragOver on virtual unassigned node when dragging a group internally (activeDraggedId)', () => {
      const mockNode = {
        id: '__unassigned__',
        title: '📥 Unassigned Controls (8)',
        class: 'virtual-unassigned',
        type: 'group' as const,
        depth: 0,
        hasChildren: true,
        isExpanded: true,
        isSelected: false,
        isVisible: true,
        children: []
      };

      const mockTree = {
        selectedId: null,
        expandedIds: new Set(['__unassigned__']),
        searchQuery: '',
        flatList: [
          { id: 'cg-core', type: 'group', parentId: null },
          mockNode
        ],
        filteredNodes: [mockNode],
        toggleExpand: vi.fn(),
        select: vi.fn()
      };

      render(
        <ControlTreeNodeComponent
          node={mockNode as any}
          tree={mockTree as any}
          isEditing={true}
          onMoveNode={vi.fn()}
          activeDraggedId="cg-core"
        />
      );

      const unassignedRow = screen.getByTestId('tree-node-__unassigned__');
      const dragOverEvent = new MouseEvent('dragover', { bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(dragOverEvent, 'preventDefault');

      fireEvent(unassignedRow, dragOverEvent);

      // DragOver MUST NOT call preventDefault when activeDraggedId is a group!
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('blocks dragOver on virtual unassigned node when dragging a group with nodeType="group" in dataTransfer', () => {
      const mockNode = {
        id: '__unassigned__',
        title: '📥 Unassigned Controls (8)',
        class: 'virtual-unassigned',
        type: 'group' as const,
        depth: 0,
        hasChildren: true,
        isExpanded: true,
        isSelected: false,
        isVisible: true,
        children: []
      };

      const mockTree = {
        selectedId: null,
        expandedIds: new Set(['__unassigned__']),
        searchQuery: '',
        flatList: [mockNode],
        filteredNodes: [mockNode],
        toggleExpand: vi.fn(),
        select: vi.fn()
      };

      render(
        <ControlTreeNodeComponent
          node={mockNode as any}
          tree={mockTree as any}
          isEditing={true}
          onMoveNode={vi.fn()}
        />
      );

      const unassignedRow = screen.getByTestId('tree-node-__unassigned__');
      const dragOverEvent = new MouseEvent('dragover', { bubbles: true, cancelable: true });
      Object.defineProperty(dragOverEvent, 'dataTransfer', {
        value: {
          types: ['text/plain', 'nodeType'],
          getData: (key: string) => (key === 'nodeType' ? 'group' : 'cg-core'),
          dropEffect: 'none'
        }
      });

      const preventDefaultSpy = vi.spyOn(dragOverEvent, 'preventDefault');
      fireEvent(unassignedRow, dragOverEvent);

      // Dropping a group must not be allowed
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('aborts and refuses to dispatch when a custom group drop is forcefully triggered onto __unassigned__', () => {
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

      // Attempt drop with group ID
      fireEvent.drop(unassignedRow, {
        dataTransfer: {
          getData: (key: string) => (key === 'text/plain' ? 'cg-core' : ''),
          types: ['text/plain']
        }
      });

      // ProfileSidebar.handleMoveNode checks findNodeType('cg-core') === 'group' and targetParentId === '__unassigned__', returning immediately
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('rejects dropping a nested sub-group onto __unassigned__', () => {
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

      // Attempt drop with sub-group ID
      fireEvent.drop(unassignedRow, {
        dataTransfer: {
          getData: (key: string) => (key === 'text/plain' ? 'cg-sub-flow' : ''),
          types: ['text/plain']
        }
      });

      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('prevents inline renaming, group deletion, and dragging of the virtual unassigned node itself', () => {
      const mockOnRename = vi.fn();
      const mockOnDelete = vi.fn();
      const mockOnMove = vi.fn();

      const mockNode = {
        id: '__unassigned__',
        title: '📥 Unassigned Controls (8)',
        class: 'virtual-unassigned',
        type: 'group' as const,
        depth: 0,
        hasChildren: true,
        isExpanded: true,
        isSelected: false,
        isVisible: true,
        children: []
      };

      const mockTree = {
        selectedId: null,
        expandedIds: new Set(['__unassigned__']),
        searchQuery: '',
        flatList: [mockNode],
        filteredNodes: [mockNode],
        toggleExpand: vi.fn(),
        select: vi.fn()
      };

      render(
        <ControlTreeNodeComponent
          node={mockNode as any}
          tree={mockTree as any}
          isEditing={true}
          onRenameGroup={mockOnRename}
          onDeleteNode={mockOnDelete}
          onMoveNode={mockOnMove}
        />
      );

      const unassignedRow = screen.getByTestId('tree-node-__unassigned__');

      // 1. Draggable is false
      expect(unassignedRow.getAttribute('draggable')).toBe('false');

      // 2. Double click does not trigger inline edit
      const titleSpan = screen.getByText('📥 Unassigned Controls (8)');
      fireEvent.doubleClick(titleSpan);
      expect(screen.queryByTestId('inline-rename-input-__unassigned__')).not.toBeInTheDocument();
      expect(mockOnRename).not.toHaveBeenCalled();

      // 3. Context menu contains NO destructive/modifying group options
      fireEvent.contextMenu(unassignedRow, { clientX: 100, clientY: 100 });
      expect(screen.queryByTestId('context-menu-add-subgroup')).not.toBeInTheDocument();
      expect(screen.queryByTestId('context-menu-rename-group')).not.toBeInTheDocument();
      expect(screen.queryByTestId('context-menu-delete-group')).not.toBeInTheDocument();
      expect(mockOnDelete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. DISABLING EDIT MODE & ZERO LEAKAGE IN SERIALIZED OSCAL JSON
  // =========================================================================
  describe('4. Disabling Edit Mode & Verifying Absence from DOM and Serialized JSON', () => {
    it('completely removes virtual unassigned node from DOM when edit mode is toggled off', () => {
      const { rerender } = render(
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

      // In edit mode: present
      expect(screen.getByTestId('tree-node-__unassigned__')).toBeInTheDocument();

      // Toggle edit mode off (read-only / view mode)
      rerender(
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

      // In view mode: completely absent
      expect(screen.queryByTestId('tree-node-__unassigned__')).not.toBeInTheDocument();
      expect(screen.queryByText(/Unassigned Controls/i)).not.toBeInTheDocument();
    });

    it('does not render virtual unassigned node when all imported controls are assigned in edit mode', () => {
      const allAssignedProfile = {
        imports: [{ href: 'catalogs/nist-800-53.json', 'include-all': {} }],
        merge: {
          custom: {
            groups: [
              {
                id: 'cg-all',
                title: 'All Controls Group',
                'insert-controls': [
                  {
                    'include-controls': [
                      {
                        'with-ids': [
                          'ac-1', 'ac-2', 'ac-3', 'ac-4', 'ac-5', 'ac-6',
                          'ia-1', 'ia-2', 'ia-3', 'sc-1', 'sc-7', 'sc-13'
                        ]
                      }
                    ]
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
          profile={allAssignedProfile}
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

    it('does not render virtual unassigned node when merge mode is "as-is" or "flat"', () => {
      const asIsProfile = {
        imports: [{ href: 'catalogs/nist-800-53.json', 'include-all': {} }],
        merge: {
          'as-is': true
        }
      };

      const flatProfile = {
        imports: [{ href: 'catalogs/nist-800-53.json', 'include-all': {} }],
        merge: {
          flat: true
        }
      };

      const { rerender } = render(
        <ProfileSidebar
          resolvedCatalog={sampleResolvedCatalog}
          profile={asIsProfile}
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

      rerender(
        <ProfileSidebar
          resolvedCatalog={sampleResolvedCatalog}
          profile={flatProfile}
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

    it('guarantees zero leakage of __unassigned__ or virtual properties in serialized OSCAL JSON', () => {
      render(
        <LiveProfileSidebarHarness
          initialProfile={sampleProfile}
          initialResolvedCatalog={sampleResolvedCatalog}
          isEditing={true}
        />
      );

      // Perform a series of additions, assignments, reassignments, and unassignments
      const cgCoreRow = screen.getByTestId('tree-node-cg-core');
      const unassignedNode = screen.getByTestId('tree-node-__unassigned__');

      // Drop ac-5 into cg-core
      dropControlOnNode(cgCoreRow, {
        getData: (key: string) => (key === 'text/plain' ? 'ac-5' : ''),
        types: ['text/plain']
      });

      // Drop ac-1 back into __unassigned__
      dropControlOnNode(unassignedNode, {
        getData: (key: string) => (key === 'text/plain' ? 'ac-1' : ''),
        types: ['text/plain']
      });

      const serializedString = screen.getByTestId('serialized-profile-json').textContent!;
      const profileJson = JSON.parse(serializedString);

      // 1. Raw string must NOT contain '__unassigned__' or 'virtual-unassigned'
      expect(serializedString).not.toContain('__unassigned__');
      expect(serializedString).not.toContain('virtual-unassigned');
      expect(serializedString).not.toContain('\uffff_unassigned');

      // 2. Structural traversal of profile.merge.custom.groups
      const verifyGroupPurity = (grp: any) => {
        expect(grp.id).not.toBe('__unassigned__');
        expect(grp.class).not.toBe('virtual-unassigned');
        expect(grp.title).not.toMatch(/Unassigned Controls/i);
        if (grp.groups) {
          grp.groups.forEach(verifyGroupPurity);
        }
        if (grp['insert-controls']) {
          grp['insert-controls'].forEach((ic: any) => {
            if (ic['include-controls']) {
              ic['include-controls'].forEach((inc: any) => {
                if (inc['with-ids']) {
                  expect(inc['with-ids']).not.toContain('__unassigned__');
                }
              });
            }
          });
        }
      };

      profileJson.merge.custom.groups.forEach(verifyGroupPurity);
    });
  });
});
