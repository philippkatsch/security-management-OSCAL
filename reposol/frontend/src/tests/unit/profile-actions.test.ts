import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import {
  addCustomGroup,
  renameCustomGroup,
  deleteCustomGroup,
  moveCustomGroup,
  assignControlToCustomGroup,
  removeControlFromCustomGroup,
  reorderControlsInCustomGroup,
  setMergeMode,
  setCombineMethod,
  includeControlInBaseline,
  excludeControlFromBaseline,
  importCustomGroupBranch,
  gatherAllAssignedControlIds,
  findCustomGroupById
} from '../../lib/document-actions/profile-actions';

describe('Profile Document Actions', () => {
  const createBaseProfile = () => ({
    profile: {
      uuid: 'prof-test-1234',
      metadata: {
        title: 'Enterprise Tailored Baseline',
        version: '1.0.0',
        'oscal-version': '1.1.0'
      },
      imports: [
        {
          href: 'catalog-nist-800-53.json',
          'include-all': {}
        }
      ],
      merge: {
        combine: { method: 'use-first' },
        custom: {
          groups: [
            {
              id: 'grp-access-control',
              title: 'Access Control Policies',
              class: 'family',
              'insert-controls': [
                {
                  order: 'keep',
                  'include-controls': [
                    {
                      'with-ids': ['ac-1', 'ac-2']
                    }
                  ]
                }
              ],
              groups: [
                {
                  id: 'grp-ac-sub',
                  title: 'Account Management Subgroup',
                  class: 'subfamily',
                  'insert-controls': [
                    {
                      order: 'keep',
                      'include-controls': [
                        {
                          'with-ids': ['ac-2.1', 'ac-2.2']
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              id: 'grp-audit',
              title: 'Audit & Accountability',
              class: 'family',
              'insert-controls': [
                {
                  order: 'keep',
                  'include-controls': [
                    {
                      'with-ids': ['au-1', 'au-2']
                    }
                  ]
                }
              ]
            }
          ]
        }
      }
    }
  });

  // 1. addCustomGroup (Root)
  it('adds a top-level custom group to merge.custom.groups', () => {
    const doc = createBaseProfile();
    const action = addCustomGroup({ id: 'grp-crypto', title: 'Cryptographic Protection' });
    const next = produce(doc, draft => { action.apply(draft); });

    const customGroups = next.profile.merge.custom.groups;
    expect(customGroups.length).toBe(3);
    const added = customGroups.find((g: any) => g.id === 'grp-crypto');
    expect(added).toBeDefined();
    expect(added.title).toBe('Cryptographic Protection');
    expect(added['insert-controls']).toBeDefined();
    expect(added['insert-controls'][0]['include-controls'][0]['with-ids']).toEqual([]);
  });

  // 2. addCustomGroup (Nested)
  it('adds a nested sub-group to an existing parent group', () => {
    const doc = createBaseProfile();
    const action = addCustomGroup({
      id: 'grp-audit-review',
      title: 'Audit Review Subgroup',
      parentGroupId: 'grp-audit'
    });
    const next = produce(doc, draft => { action.apply(draft); });

    const auditGrp = findCustomGroupById(next.profile.merge.custom, 'grp-audit');
    expect(auditGrp).toBeDefined();
    expect(auditGrp?.groups?.length).toBe(1);
    expect(auditGrp?.groups?.[0].id).toBe('grp-audit-review');
    expect(auditGrp?.groups?.[0].title).toBe('Audit Review Subgroup');
  });

  // 3. addCustomGroup (Auto-ID)
  it('generates an auto-id starting with custom_grp_ when id is omitted', () => {
    const doc = createBaseProfile();
    const action = addCustomGroup({ title: 'Anonymous Custom Group' });
    const next = produce(doc, draft => { action.apply(draft); });

    const customGroups = next.profile.merge.custom.groups;
    const added = customGroups.find((g: any) => g.title === 'Anonymous Custom Group');
    expect(added).toBeDefined();
    expect(added.id).toMatch(/^custom_grp_/);
  });

  // 4. addCustomGroup (Mode initialization)
  it('initializes merge.custom and removes as-is when adding group to as-is profile', () => {
    const doc = {
      profile: {
        uuid: 'prof-as-is',
        metadata: { title: 'As-Is Profile', version: '1.0.0', 'oscal-version': '1.1.0' },
        imports: [{ href: 'catalog.json', 'include-all': {} }],
        merge: { 'as-is': true }
      }
    };
    const action = addCustomGroup({ id: 'grp-first', title: 'First Group' });
    const next = produce(doc, draft => { action.apply(draft); });

    expect(next.profile.merge['as-is']).toBeUndefined();
    expect(next.profile.merge.custom).toBeDefined();
    expect(next.profile.merge.custom.groups.length).toBe(1);
    expect(next.profile.merge.custom.groups[0].id).toBe('grp-first');
  });

  // 5. renameCustomGroup (Title update)
  it('updates title of custom group', () => {
    const doc = createBaseProfile();
    const action = renameCustomGroup({ groupId: 'grp-access-control', title: 'Identity & Access Control' });
    const next = produce(doc, draft => { action.apply(draft); });

    const grp = findCustomGroupById(next.profile.merge.custom, 'grp-access-control');
    expect(grp?.title).toBe('Identity & Access Control');
  });

  // 6. renameCustomGroup (ID update)
  it('updates id of custom group', () => {
    const doc = createBaseProfile();
    const action = renameCustomGroup({ groupId: 'grp-audit', newId: 'grp-audit-logging' });
    const next = produce(doc, draft => { action.apply(draft); });

    const oldGrp = findCustomGroupById(next.profile.merge.custom, 'grp-audit');
    expect(oldGrp).toBeNull();
    const newGrp = findCustomGroupById(next.profile.merge.custom, 'grp-audit-logging');
    expect(newGrp).toBeDefined();
    expect(newGrp?.title).toBe('Audit & Accountability');
  });

  // 7. renameCustomGroup (Collision prevention)
  it('does not change id if newId already exists in custom groups', () => {
    const doc = createBaseProfile();
    const action = renameCustomGroup({ groupId: 'grp-audit', newId: 'grp-access-control' });
    const next = produce(doc, draft => { action.apply(draft); });

    const auditGrp = findCustomGroupById(next.profile.merge.custom, 'grp-audit');
    expect(auditGrp).toBeDefined();
    expect(auditGrp?.id).toBe('grp-audit');
  });

  // 8. deleteCustomGroup (Leaf deletion)
  it('deletes a leaf group from merge.custom.groups', () => {
    const doc = createBaseProfile();
    const action = deleteCustomGroup({ groupId: 'grp-audit' });
    const next = produce(doc, draft => { action.apply(draft); });

    expect(findCustomGroupById(next.profile.merge.custom, 'grp-audit')).toBeNull();
    expect(next.profile.merge.custom.groups.length).toBe(1);
  });

  // 9. deleteCustomGroup (Cascade delete)
  it('deletes parent group and all nested children when deleteChildren is true', () => {
    const doc = createBaseProfile();
    const action = deleteCustomGroup({ groupId: 'grp-access-control', deleteChildren: true });
    const next = produce(doc, draft => { action.apply(draft); });

    expect(findCustomGroupById(next.profile.merge.custom, 'grp-access-control')).toBeNull();
    expect(findCustomGroupById(next.profile.merge.custom, 'grp-ac-sub')).toBeNull();
  });

  // 10. deleteCustomGroup (Promote children)
  it('promotes children to parent level when deleteChildren is false and no reassign target', () => {
    const doc = createBaseProfile();
    const action = deleteCustomGroup({ groupId: 'grp-access-control', deleteChildren: false });
    const next = produce(doc, draft => { action.apply(draft); });

    expect(findCustomGroupById(next.profile.merge.custom, 'grp-access-control')).toBeNull();
    const subGrp = findCustomGroupById(next.profile.merge.custom, 'grp-ac-sub');
    expect(subGrp).toBeDefined();
    // Verify it is promoted to root level
    expect(next.profile.merge.custom.groups.some((g: any) => g.id === 'grp-ac-sub')).toBe(true);
  });

  // 11. deleteCustomGroup (Reassign controls & children)
  it('reassigns controls and sub-groups to target group when deleted', () => {
    const doc = createBaseProfile();
    const action = deleteCustomGroup({
      groupId: 'grp-access-control',
      reassignToGroupId: 'grp-audit'
    });
    const next = produce(doc, draft => { action.apply(draft); });

    expect(findCustomGroupById(next.profile.merge.custom, 'grp-access-control')).toBeNull();
    const auditGrp = findCustomGroupById(next.profile.merge.custom, 'grp-audit')!;
    expect(auditGrp).toBeDefined();

    // Check reassigned sub-group
    expect(auditGrp.groups?.some(g => g.id === 'grp-ac-sub')).toBe(true);

    // Check reassigned controls
    const auditControls = auditGrp['insert-controls']![0]['include-controls']![0]['with-ids']!;
    expect(auditControls).toContain('au-1');
    expect(auditControls).toContain('au-2');
    expect(auditControls).toContain('ac-1');
    expect(auditControls).toContain('ac-2');
  });

  // 12. moveCustomGroup (Sibling reorder)
  it('reorders groups at root level', () => {
    const doc = createBaseProfile();
    const action = moveCustomGroup({ sourceGroupId: 'grp-audit', targetGroupId: null, targetIndex: 0 });
    const next = produce(doc, draft => { action.apply(draft); });

    expect(next.profile.merge.custom.groups[0].id).toBe('grp-audit');
    expect(next.profile.merge.custom.groups[1].id).toBe('grp-access-control');
  });

  // 13. moveCustomGroup (Move to parent)
  it('moves root group into another group as a child', () => {
    const doc = createBaseProfile();
    const action = moveCustomGroup({ sourceGroupId: 'grp-audit', targetGroupId: 'grp-access-control' });
    const next = produce(doc, draft => { action.apply(draft); });

    expect(next.profile.merge.custom.groups.length).toBe(1);
    const parent = findCustomGroupById(next.profile.merge.custom, 'grp-access-control')!;
    expect(parent.groups?.some(g => g.id === 'grp-audit')).toBe(true);
  });

  // 14. moveCustomGroup (Promote from nested to root)
  it('promotes a nested group to root level', () => {
    const doc = createBaseProfile();
    const action = moveCustomGroup({ sourceGroupId: 'grp-ac-sub', targetGroupId: null });
    const next = produce(doc, draft => { action.apply(draft); });

    const parent = findCustomGroupById(next.profile.merge.custom, 'grp-access-control')!;
    expect(parent.groups?.length || 0).toBe(0);
    expect(next.profile.merge.custom.groups.some((g: any) => g.id === 'grp-ac-sub')).toBe(true);
  });

  // 15. moveCustomGroup (Cycle prevention)
  it('prevents moving a group into its own descendant', () => {
    const doc = createBaseProfile();
    const action = moveCustomGroup({ sourceGroupId: 'grp-access-control', targetGroupId: 'grp-ac-sub' });
    const next = produce(doc, draft => { action.apply(draft); });

    // Should not mutate because it would create a cyclic tree
    expect(next.profile.merge.custom.groups.some((g: any) => g.id === 'grp-access-control')).toBe(true);
    const ac = findCustomGroupById(next.profile.merge.custom, 'grp-access-control');
    expect(ac?.groups?.some(g => g.id === 'grp-ac-sub')).toBe(true);
  });

  // 16. assignControlToCustomGroup (New assignment)
  it('assigns an unassigned control to a target custom group', () => {
    const doc = createBaseProfile();
    const action = assignControlToCustomGroup({ controlId: 'ia-1', targetGroupId: 'grp-audit' });
    const next = produce(doc, draft => { action.apply(draft); });

    const auditGrp = findCustomGroupById(next.profile.merge.custom, 'grp-audit')!;
    const withIds = auditGrp['insert-controls']![0]['include-controls']![0]['with-ids']!;
    expect(withIds).toContain('ia-1');
  });

  // 17. assignControlToCustomGroup (Exclusive assignment)
  it('removes control from previous custom group when assigned to a new group', () => {
    const doc = createBaseProfile();
    const action = assignControlToCustomGroup({ controlId: 'ac-1', targetGroupId: 'grp-audit' });
    const next = produce(doc, draft => { action.apply(draft); });

    const acGrp = findCustomGroupById(next.profile.merge.custom, 'grp-access-control')!;
    const acWithIds = acGrp['insert-controls']![0]['include-controls']![0]['with-ids']!;
    expect(acWithIds).not.toContain('ac-1');

    const auditGrp = findCustomGroupById(next.profile.merge.custom, 'grp-audit')!;
    const auditWithIds = auditGrp['insert-controls']![0]['include-controls']![0]['with-ids']!;
    expect(auditWithIds).toContain('ac-1');
  });

  // 18. assignControlToCustomGroup (Position insert)
  it('inserts control at specific target index', () => {
    const doc = createBaseProfile();
    const action = assignControlToCustomGroup({ controlId: 'ia-2', targetGroupId: 'grp-audit', targetIndex: 0 });
    const next = produce(doc, draft => { action.apply(draft); });

    const auditGrp = findCustomGroupById(next.profile.merge.custom, 'grp-audit')!;
    const withIds = auditGrp['insert-controls']![0]['include-controls']![0]['with-ids']!;
    expect(withIds[0]).toBe('ia-2');
  });

  // 19. removeControlFromCustomGroup (Specific group)
  it('removes control from a specified custom group', () => {
    const doc = createBaseProfile();
    const action = removeControlFromCustomGroup({ controlId: 'ac-2', sourceGroupId: 'grp-access-control' });
    const next = produce(doc, draft => { action.apply(draft); });

    const acGrp = findCustomGroupById(next.profile.merge.custom, 'grp-access-control')!;
    const withIds = acGrp['insert-controls']![0]['include-controls']![0]['with-ids']!;
    expect(withIds).toEqual(['ac-1']);
  });

  // 20. removeControlFromCustomGroup (Global unassign)
  it('removes control globally across all custom groups when sourceGroupId is omitted', () => {
    const doc = createBaseProfile();
    const action = removeControlFromCustomGroup({ controlId: 'ac-2.1' });
    const next = produce(doc, draft => { action.apply(draft); });

    const allAssigned = gatherAllAssignedControlIds(next.profile.merge.custom);
    expect(allAssigned.has('ac-2.1')).toBe(false);
  });

  // 21. reorderControlsInCustomGroup (Explicit list & Sorting)
  it('reorders controls with explicit list and applies ascending sorting', () => {
    const doc = createBaseProfile();
    const action1 = reorderControlsInCustomGroup({
      groupId: 'grp-access-control',
      controlIds: ['ac-2', 'ac-1']
    });
    const next1 = produce(doc, draft => { action1.apply(draft); });
    const grp1 = findCustomGroupById(next1.profile.merge.custom, 'grp-access-control')!;
    expect(grp1['insert-controls']![0]['include-controls']![0]['with-ids']).toEqual(['ac-2', 'ac-1']);

    const action2 = reorderControlsInCustomGroup({
      groupId: 'grp-access-control',
      order: 'ascending'
    });
    const next2 = produce(next1, draft => { action2.apply(draft); });
    const grp2 = findCustomGroupById(next2.profile.merge.custom, 'grp-access-control')!;
    expect(grp2['insert-controls']![0]['include-controls']![0]['with-ids']).toEqual(['ac-1', 'ac-2']);
  });

  // 22. gatherAllAssignedControlIds helper
  it('gathers all assigned control IDs across root and nested groups', () => {
    const doc = createBaseProfile();
    const ids = gatherAllAssignedControlIds(doc.profile.merge.custom);
    expect(ids.size).toBe(6);
    expect(ids.has('ac-1')).toBe(true);
    expect(ids.has('ac-2')).toBe(true);
    expect(ids.has('ac-2.1')).toBe(true);
    expect(ids.has('ac-2.2')).toBe(true);
    expect(ids.has('au-1')).toBe(true);
    expect(ids.has('au-2')).toBe(true);
  });

  // Additional Tailoring Actions
  it('switches merge mode between as-is, flat, and custom', () => {
    const doc = createBaseProfile();
    const flatAction = setMergeMode('flat');
    const flatDoc = produce(doc, draft => { flatAction.apply(draft); });
    expect(flatDoc.profile.merge.flat).toBeDefined();
    expect(flatDoc.profile.merge.custom).toBeUndefined();
    expect(flatDoc.profile.merge['as-is']).toBeUndefined();

    const asIsAction = setMergeMode('as-is');
    const asIsDoc = produce(flatDoc, draft => { asIsAction.apply(draft); });
    expect(asIsDoc.profile.merge['as-is']).toBe(true);
    expect(asIsDoc.profile.merge.flat).toBeUndefined();

    const customAction = setMergeMode('custom');
    const customDoc = produce(asIsDoc, draft => { customAction.apply(draft); });
    expect(customDoc.profile.merge.custom).toBeDefined();
    expect(customDoc.profile.merge['as-is']).toBeUndefined();
  });

  it('sets combine method', () => {
    const doc = createBaseProfile();
    const action = setCombineMethod('merge');
    const next = produce(doc, draft => { action.apply(draft); });
    expect(next.profile.merge.combine.method).toBe('merge');
  });

  it('includes and excludes controls in baseline imports', () => {
    const doc = createBaseProfile();
    const excAction = excludeControlFromBaseline(0, 'ac-5');
    const next1 = produce(doc, draft => { excAction.apply(draft); });
    expect(next1.profile.imports[0]['exclude-controls']![0]['with-ids']).toContain('ac-5');

    const incAction = includeControlInBaseline(0, 'ac-5');
    const next2 = produce(next1, draft => { incAction.apply(draft); });
    expect(next2.profile.imports[0]['exclude-controls']![0]['with-ids']).not.toContain('ac-5');
  });

  describe('importCustomGroupBranch', () => {
    it('creates custom group with exact title, id, nested subgroups and assigned controls', () => {
      const doc = createBaseProfile();
      const catalogGroup = {
        id: 'govern',
        title: 'GOVERN',
        class: 'function',
        props: [{ name: 'label', value: 'GV' }],
        groups: [
          {
            id: 'gv.oc',
            title: 'Organizational Context',
            class: 'category',
            controls: [
              { id: 'gv.oc-01', title: 'Context 1' },
              { id: 'gv.oc-02', title: 'Context 2' }
            ]
          },
          {
            id: 'gv.ov',
            title: 'Oversight',
            class: 'category',
            controls: [
              { id: 'gv.ov-01', title: 'Oversight 1' }
            ]
          }
        ],
        controls: []
      };

      const action = importCustomGroupBranch({ group: catalogGroup });
      const next = produce(doc, draft => { action.apply(draft); });

      const governGroup = findCustomGroupById(next.profile.merge.custom, 'govern');
      expect(governGroup).toBeDefined();
      expect(governGroup!.title).toBe('GOVERN');
      expect(governGroup!.class).toBe('function');
      expect(governGroup!.groups).toHaveLength(2);

      const gvOc = findCustomGroupById(governGroup!, 'gv.oc');
      expect(gvOc).toBeDefined();
      expect(gvOc!.title).toBe('Organizational Context');
      expect(gvOc!['insert-controls']![0]['include-controls']![0]['with-ids']).toEqual(['gv.oc-01', 'gv.oc-02']);

      const gvOv = findCustomGroupById(governGroup!, 'gv.ov');
      expect(gvOv).toBeDefined();
      expect(gvOv!.title).toBe('Oversight');
      expect(gvOv!['insert-controls']![0]['include-controls']![0]['with-ids']).toEqual(['gv.ov-01']);
    });

    it('nests imported group branch inside target custom group when targetParentId is specified', () => {
      const doc = createBaseProfile();
      const catalogGroup = {
        id: 'gv.oc',
        title: 'Organizational Context',
        controls: [{ id: 'gv.oc-01', title: 'Context 1' }]
      };

      const action = importCustomGroupBranch({
        group: catalogGroup,
        targetParentId: 'grp-access-control'
      });
      const next = produce(doc, draft => { action.apply(draft); });

      const parent = findCustomGroupById(next.profile.merge.custom, 'grp-access-control');
      expect(parent).toBeDefined();
      const nested = parent!.groups?.find(g => g.id === 'gv.oc');
      expect(nested).toBeDefined();
      expect(nested!.title).toBe('Organizational Context');
      expect(nested!['insert-controls']![0]['include-controls']![0]['with-ids']).toContain('gv.oc-01');
    });

    it('does not duplicate sub-controls into parent group with-ids when direct controls have sub-controls', () => {
      const doc = createBaseProfile();
      const catalogGroup = {
        id: 'govern',
        title: 'GOVERN',
        controls: [
          {
            id: 'gv.oc',
            title: 'Organizational Context',
            controls: [
              { id: 'gv.oc-01', title: 'Context 1' },
              { id: 'gv.oc-02', title: 'Context 2' }
            ]
          }
        ]
      };

      const action = importCustomGroupBranch({ group: catalogGroup });
      const next = produce(doc, draft => { action.apply(draft); });

      const governGroup = findCustomGroupById(next.profile.merge.custom, 'govern');
      expect(governGroup).toBeDefined();
      // Must only contain 'gv.oc', NOT 'gv.oc-01' or 'gv.oc-02' in the same with-ids list!
      const assignedIds = governGroup!['insert-controls']![0]['include-controls']![0]['with-ids'];
      expect(assignedIds).toEqual(['gv.oc']);
      expect(assignedIds).not.toContain('gv.oc-01');
      expect(assignedIds).not.toContain('gv.oc-02');
    });

    it('assigns single control directly to top-level root insert-controls when targetGroupId is null', () => {
      const doc = createBaseProfile();
      const action = assignControlToCustomGroup({
        controlId: 'id.am-01',
        targetGroupId: null as any
      });
      const next = produce(doc, draft => { action.apply(draft); });

      const topLevelIc = next.profile.merge.custom['insert-controls'];
      expect(topLevelIc).toBeDefined();
      expect(topLevelIc[0]['include-controls'][0]['with-ids']).toContain('id.am-01');
    });

    it('assigns multiple controls directly to top-level root insert-controls without duplicating', () => {
      const doc = createBaseProfile();
      const action = assignControlToCustomGroup({
        controlId: 'id.am-01',
        targetGroupId: null as any
      });
      const next1 = produce(doc, draft => { action.apply(draft); });
      const next2 = produce(next1, draft => { action.apply(draft); });

      const topLevelIc = next2.profile.merge.custom['insert-controls'];
      expect(topLevelIc[0]['include-controls'][0]['with-ids']).toEqual(['id.am-01']);
    });

    it('moves a control from an existing custom group to top-level root when targetGroupId is null', () => {
      const doc = createBaseProfile();
      // 'ac-1' is in 'grp-access-control'
      const action = assignControlToCustomGroup({
        controlId: 'ac-1',
        targetGroupId: null as any
      });
      const next = produce(doc, draft => { action.apply(draft); });

      // ac-1 should be removed from grp-access-control
      const accessControlGroup = findCustomGroupById(next.profile.merge.custom, 'grp-access-control');
      expect(accessControlGroup!['insert-controls']![0]['include-controls']![0]['with-ids']).not.toContain('ac-1');

      // ac-1 should now be in top-level insert-controls
      const topLevelIc = next.profile.merge.custom['insert-controls'];
      expect(topLevelIc[0]['include-controls'][0]['with-ids']).toContain('ac-1');
    });
  });
});
