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
  gatherAllAssignedControlIds,
  findCustomGroupById,
  findCustomGroupLocation,
  findAndRemoveCustomGroup,
  isGroupDescendant,
  ensureInsertControls,
  ensureCustomMergeStructure,
  getProfileFromDraft,
  CustomGroup
} from '../../lib/document-actions/profile-actions';

describe('Adversarial Stress Test Suite: Profile Document Actions', () => {
  // Helper to generate a fresh base profile
  const createBaseProfile = () => ({
    profile: {
      uuid: 'prof-adv-test-001',
      metadata: {
        title: 'Adversarial Stress Profile',
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
              id: 'grp-root-1',
              title: 'Root Group 1',
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
                  id: 'grp-sub-1a',
                  title: 'Subgroup 1A',
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
              id: 'grp-root-2',
              title: 'Root Group 2',
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

  // =========================================================================
  // 1. DEEP NESTING STRESS TESTS (15+ Levels)
  // =========================================================================
  describe('1. Deep Nesting Stress Tests', () => {
    it('constructs and navigates a 15-level deeply nested custom group tree', () => {
      let doc = createBaseProfile();
      const depth = 15;
      let parentId: string | null = null;

      // Build chain: deep-0 -> deep-1 -> ... -> deep-14
      for (let i = 0; i < depth; i++) {
        const currentId = `deep-grp-${i}`;
        const action = addCustomGroup({
          id: currentId,
          title: `Deep Level ${i}`,
          parentGroupId: parentId
        });
        doc = produce(doc, draft => { action.apply(draft); });
        parentId = currentId;
      }

      // Add controls at depth 14 (leaf)
      const assignAction = assignControlToCustomGroup({
        controlId: 'deep-ctrl-14',
        targetGroupId: 'deep-grp-14'
      });
      doc = produce(doc, draft => { assignAction.apply(draft); });

      // Verify findCustomGroupById at deepest level
      const leaf = findCustomGroupById(doc.profile.merge.custom, 'deep-grp-14');
      expect(leaf).toBeDefined();
      expect(leaf?.id).toBe('deep-grp-14');
      expect(leaf?.title).toBe('Deep Level 14');

      // Verify location resolution at depth 14
      const loc = findCustomGroupLocation(doc.profile.merge.custom, 'deep-grp-14');
      expect(loc).toBeDefined();
      expect(loc?.parent?.id).toBe('deep-grp-13');
      expect(loc?.index).toBe(0);

      // Verify control assignment at deepest level
      const allAssigned = gatherAllAssignedControlIds(doc.profile.merge.custom);
      expect(allAssigned.has('deep-ctrl-14')).toBe(true);

      // Move leaf from depth 14 to depth 2
      const moveAction = moveCustomGroup({
        sourceGroupId: 'deep-grp-14',
        targetGroupId: 'deep-grp-2'
      });
      doc = produce(doc, draft => { moveAction.apply(draft); });

      const movedLeaf = findCustomGroupById(doc.profile.merge.custom, 'deep-grp-14');
      expect(movedLeaf).toBeDefined();
      const newLoc = findCustomGroupLocation(doc.profile.merge.custom, 'deep-grp-14');
      expect(newLoc?.parent?.id).toBe('deep-grp-2');

      // Depth 13 should now have no children
      const oldParent = findCustomGroupById(doc.profile.merge.custom, 'deep-grp-13');
      expect(oldParent?.groups?.length).toBe(0);
    });

    it('handles deletion of mid-tree node at depth 7 with child promotion', () => {
      let doc = createBaseProfile();
      for (let i = 0; i < 10; i++) {
        const parentId = i === 0 ? null : `chain-${i - 1}`;
        const action = addCustomGroup({
          id: `chain-${i}`,
          title: `Chain ${i}`,
          parentGroupId: parentId
        });
        doc = produce(doc, draft => { action.apply(draft); });
      }

      // Delete node chain-5 with deleteChildren: false (promote chain-6 to chain-4)
      const deleteAction = deleteCustomGroup({
        groupId: 'chain-5',
        deleteChildren: false
      });
      doc = produce(doc, draft => { deleteAction.apply(draft); });

      expect(findCustomGroupById(doc.profile.merge.custom, 'chain-5')).toBeNull();
      const promoted = findCustomGroupById(doc.profile.merge.custom, 'chain-6');
      expect(promoted).toBeDefined();
      const loc = findCustomGroupLocation(doc.profile.merge.custom, 'chain-6');
      expect(loc?.parent?.id).toBe('chain-4');
    });

    it('handles deletion of mid-tree node with cross-branch reassignment', () => {
      let doc = createBaseProfile();
      // Add chain A: branchA-0 -> branchA-1 -> branchA-2
      doc = produce(doc, draft => {
        addCustomGroup({ id: 'branchA-0', title: 'Branch A' }).apply(draft);
        addCustomGroup({ id: 'branchA-1', title: 'Branch A1', parentGroupId: 'branchA-0' }).apply(draft);
        assignControlToCustomGroup({ controlId: 'ctrl-a1', targetGroupId: 'branchA-1' }).apply(draft);
        addCustomGroup({ id: 'branchB-0', title: 'Branch B' }).apply(draft);
      });

      // Delete branchA-0 and reassign to branchB-0
      const deleteAction = deleteCustomGroup({
        groupId: 'branchA-0',
        reassignToGroupId: 'branchB-0'
      });
      doc = produce(doc, draft => { deleteAction.apply(draft); });

      expect(findCustomGroupById(doc.profile.merge.custom, 'branchA-0')).toBeNull();
      const branchB = findCustomGroupById(doc.profile.merge.custom, 'branchB-0')!;
      expect(branchB).toBeDefined();
      expect(branchB.groups?.some(g => g.id === 'branchA-1')).toBe(true);

      // Verify controls were preserved and reachable
      const allAssigned = gatherAllAssignedControlIds(doc.profile.merge.custom);
      expect(allAssigned.has('ctrl-a1')).toBe(true);
    });
  });

  // =========================================================================
  // 2. CIRCULAR MOVE PREVENTION & SELF-MOVE STRESS
  // =========================================================================
  describe('2. Circular Move Prevention & Self-Move Stress', () => {
    it('strictly prevents moving a group into itself (direct self-move)', () => {
      const doc = createBaseProfile();
      const initialJson = JSON.stringify(doc);

      const action = moveCustomGroup({
        sourceGroupId: 'grp-root-1',
        targetGroupId: 'grp-root-1'
      });
      const next = produce(doc, draft => { action.apply(draft); });

      // State must be completely unchanged
      expect(JSON.stringify(next)).toBe(initialJson);
    });

    it('strictly prevents moving a group into itself case-insensitively', () => {
      const doc = createBaseProfile();
      const initialJson = JSON.stringify(doc);

      const action = moveCustomGroup({
        sourceGroupId: 'grp-root-1',
        targetGroupId: 'GRP-ROOT-1'
      });
      const next = produce(doc, draft => { action.apply(draft); });

      expect(JSON.stringify(next)).toBe(initialJson);
    });

    it('strictly prevents moving an ancestor group into its direct child', () => {
      const doc = createBaseProfile();
      const initialJson = JSON.stringify(doc);

      const action = moveCustomGroup({
        sourceGroupId: 'grp-root-1',
        targetGroupId: 'grp-sub-1a'
      });
      const next = produce(doc, draft => { action.apply(draft); });

      expect(JSON.stringify(next)).toBe(initialJson);
    });

    it('strictly prevents moving an ancestor into a deeply nested descendant (5 levels down)', () => {
      let doc = createBaseProfile();
      let parentId = 'grp-sub-1a';
      for (let i = 1; i <= 5; i++) {
        const id = `nested-descendant-${i}`;
        const action = addCustomGroup({ id, title: `Descendant ${i}`, parentGroupId: parentId });
        doc = produce(doc, draft => { action.apply(draft); });
        parentId = id;
      }

      const snapshot = JSON.stringify(doc);

      // Attempt to move top ancestor grp-root-1 into nested-descendant-5
      const invalidMove = moveCustomGroup({
        sourceGroupId: 'grp-root-1',
        targetGroupId: 'nested-descendant-5'
      });
      const next = produce(doc, draft => { invalidMove.apply(draft); });

      expect(JSON.stringify(next)).toBe(snapshot);
    });

    it('isGroupDescendant helper correctly detects cyclic targets', () => {
      const doc = createBaseProfile();
      expect(isGroupDescendant(doc.profile.merge.custom, 'grp-root-1', 'grp-sub-1a')).toBe(true);
      expect(isGroupDescendant(doc.profile.merge.custom, 'grp-sub-1a', 'grp-root-1')).toBe(false);
      expect(isGroupDescendant(doc.profile.merge.custom, 'grp-root-1', 'grp-root-2')).toBe(false);
      expect(isGroupDescendant(doc.profile.merge.custom, 'non-existent', 'grp-root-1')).toBe(false);
    });
  });

  // =========================================================================
  // 3. ORPHAN & NON-EXISTENT PARENT / GROUP OPERATIONS
  // =========================================================================
  describe('3. Non-Existent Parent & Target Graceful Fallbacks', () => {
    it('falls back to root when adding a group with non-existent parentGroupId', () => {
      const doc = createBaseProfile();
      const action = addCustomGroup({
        id: 'grp-orphan',
        title: 'Orphan Group',
        parentGroupId: 'does-not-exist-999'
      });
      const next = produce(doc, draft => { action.apply(draft); });

      const added = findCustomGroupById(next.profile.merge.custom, 'grp-orphan');
      expect(added).toBeDefined();
      // Should be placed at root
      expect(next.profile.merge.custom.groups.some((g: any) => g.id === 'grp-orphan')).toBe(true);
    });

    it('falls back to root when moving a group into non-existent targetGroupId', () => {
      const doc = createBaseProfile();
      const action = moveCustomGroup({
        sourceGroupId: 'grp-sub-1a',
        targetGroupId: 'ghost-target-id'
      });
      const next = produce(doc, draft => { action.apply(draft); });

      const moved = findCustomGroupById(next.profile.merge.custom, 'grp-sub-1a');
      expect(moved).toBeDefined();
      // Fallback places at root
      expect(next.profile.merge.custom.groups.some((g: any) => g.id === 'grp-sub-1a')).toBe(true);
    });

    it('safely handles moveCustomGroup when sourceGroupId does not exist', () => {
      const doc = createBaseProfile();
      const snapshot = JSON.stringify(doc);

      const action = moveCustomGroup({
        sourceGroupId: 'non-existent-source',
        targetGroupId: 'grp-root-1'
      });
      const next = produce(doc, draft => { action.apply(draft); });

      expect(JSON.stringify(next)).toBe(snapshot);
    });

    it('safely handles renameCustomGroup when groupId does not exist', () => {
      const doc = createBaseProfile();
      const snapshot = JSON.stringify(doc);

      const action = renameCustomGroup({
        groupId: 'phantom-group',
        title: 'Phantom New Title'
      });
      const next = produce(doc, draft => { action.apply(draft); });

      expect(JSON.stringify(next)).toBe(snapshot);
    });

    it('safely handles deleteCustomGroup when groupId does not exist', () => {
      const doc = createBaseProfile();
      const snapshot = JSON.stringify(doc);

      const action = deleteCustomGroup({
        groupId: 'non-existent-group'
      });
      const next = produce(doc, draft => { action.apply(draft); });

      expect(JSON.stringify(next)).toBe(snapshot);
    });

    it('safely deletes group when reassignToGroupId does not exist without error', () => {
      const doc = createBaseProfile();
      const action = deleteCustomGroup({
        groupId: 'grp-root-2',
        reassignToGroupId: 'missing-reassign-target'
      });
      const next = produce(doc, draft => { action.apply(draft); });

      expect(findCustomGroupById(next.profile.merge.custom, 'grp-root-2')).toBeNull();
    });

    it('safely ignores assignControlToCustomGroup when targetGroupId does not exist', () => {
      const doc = createBaseProfile();
      const snapshot = JSON.stringify(doc);

      const action = assignControlToCustomGroup({
        controlId: 'ac-1',
        targetGroupId: 'non-existent-group-target'
      });
      const next = produce(doc, draft => { action.apply(draft); });

      expect(JSON.stringify(next)).toBe(snapshot);
    });

    it('safely handles removeControlFromCustomGroup when sourceGroupId does not exist', () => {
      const doc = createBaseProfile();
      const snapshot = JSON.stringify(doc);

      const action = removeControlFromCustomGroup({
        controlId: 'ac-1',
        sourceGroupId: 'invalid-group-source'
      });
      const next = produce(doc, draft => { action.apply(draft); });

      expect(JSON.stringify(next)).toBe(snapshot);
    });
  });

  // =========================================================================
  // 4. REORDERING & NATURAL ALPHANUMERIC SORTING
  // =========================================================================
  describe('4. Reordering & Natural Alphanumeric Sorting', () => {
    it('performs natural alphanumeric sorting on numeric control IDs (ac-1, ac-2, ac-10, ac-20)', () => {
      const doc = createBaseProfile();
      const testIds = ['ac-10', 'ac-1.2', 'ac-1', 'ac-20', 'ac-2', 'ac-1.10', 'ac-1.1'];

      const action = reorderControlsInCustomGroup({
        groupId: 'grp-root-2',
        controlIds: testIds,
        order: 'ascending'
      });
      const next = produce(doc, draft => { action.apply(draft); });

      const grp = findCustomGroupById(next.profile.merge.custom, 'grp-root-2')!;
      const sortedIds = grp['insert-controls']![0]['include-controls']![0]['with-ids']!;

      expect(sortedIds).toEqual([
        'ac-1',
        'ac-1.1',
        'ac-1.2',
        'ac-1.10',
        'ac-2',
        'ac-10',
        'ac-20'
      ]);
    });

    it('performs descending natural alphanumeric sorting', () => {
      const doc = createBaseProfile();
      const testIds = ['ac-1', 'ac-10', 'ac-2'];

      const action = reorderControlsInCustomGroup({
        groupId: 'grp-root-2',
        controlIds: testIds,
        order: 'descending'
      });
      const next = produce(doc, draft => { action.apply(draft); });

      const grp = findCustomGroupById(next.profile.merge.custom, 'grp-root-2')!;
      const sortedIds = grp['insert-controls']![0]['include-controls']![0]['with-ids']!;

      expect(sortedIds).toEqual(['ac-10', 'ac-2', 'ac-1']);
    });

    it('safely reorders when controlIds is an empty array', () => {
      const doc = createBaseProfile();
      const action = reorderControlsInCustomGroup({
        groupId: 'grp-root-1',
        controlIds: []
      });
      const next = produce(doc, draft => { action.apply(draft); });

      const grp = findCustomGroupById(next.profile.merge.custom, 'grp-root-1')!;
      expect(grp['insert-controls']![0]['include-controls']![0]['with-ids']).toEqual([]);
    });

    it('safely reorders when insert-controls is initially empty or missing', () => {
      const doc = createBaseProfile();
      // Remove insert-controls manually
      delete (doc.profile.merge.custom.groups[0] as any)['insert-controls'];

      const action = reorderControlsInCustomGroup({
        groupId: 'grp-root-1',
        controlIds: ['ctrl-x', 'ctrl-y'],
        order: 'ascending'
      });
      const next = produce(doc, draft => { action.apply(draft); });

      const grp = findCustomGroupById(next.profile.merge.custom, 'grp-root-1')!;
      expect(grp['insert-controls']).toBeDefined();
      expect(grp['insert-controls']![0]['include-controls']![0]['with-ids']).toEqual(['ctrl-x', 'ctrl-y']);
    });
  });

  // =========================================================================
  // 5. EXCLUSIVE CONTROL ASSIGNMENT & CASE-INSENSITIVITY
  // =========================================================================
  describe('5. Exclusive Assignment & Case-Insensitive Mechanics', () => {
    it('removes control from previous group even when casing differs (e.g. AC-1 vs ac-1)', () => {
      const doc = createBaseProfile();
      // Assign AC-1 (uppercase) to grp-root-2
      const action = assignControlToCustomGroup({
        controlId: 'AC-1',
        targetGroupId: 'grp-root-2'
      });
      const next = produce(doc, draft => { action.apply(draft); });

      const grp1 = findCustomGroupById(next.profile.merge.custom, 'grp-root-1')!;
      const grp1Ids = grp1['insert-controls']![0]['include-controls']![0]['with-ids']!;
      expect(grp1Ids).not.toContain('ac-1');
      expect(grp1Ids).not.toContain('AC-1');

      const grp2 = findCustomGroupById(next.profile.merge.custom, 'grp-root-2')!;
      const grp2Ids = grp2['insert-controls']![0]['include-controls']![0]['with-ids']!;
      expect(grp2Ids).toContain('AC-1');
    });

    it('re-assigning control within same group changes position without duplicating', () => {
      const doc = createBaseProfile();
      // grp-root-1 has ['ac-1', 'ac-2']
      // Re-assign ac-2 to targetIndex: 0
      const action = assignControlToCustomGroup({
        controlId: 'ac-2',
        targetGroupId: 'grp-root-1',
        targetIndex: 0
      });
      const next = produce(doc, draft => { action.apply(draft); });

      const grp1 = findCustomGroupById(next.profile.merge.custom, 'grp-root-1')!;
      const ids = grp1['insert-controls']![0]['include-controls']![0]['with-ids']!;
      expect(ids).toEqual(['ac-2', 'ac-1']);
    });

    it('prevents renaming group to an existing group ID with different case (collision prevention)', () => {
      const doc = createBaseProfile();
      // grp-root-1 and grp-root-2 exist. Try renaming grp-root-1 to GRP-ROOT-2
      const action = renameCustomGroup({
        groupId: 'grp-root-1',
        newId: 'GRP-ROOT-2'
      });
      const next = produce(doc, draft => { action.apply(draft); });

      const grp1 = findCustomGroupById(next.profile.merge.custom, 'grp-root-1');
      expect(grp1).toBeDefined();
      expect(grp1?.id).toBe('grp-root-1');
    });

    it('removeControlFromCustomGroup with case-insensitive controlId', () => {
      const doc = createBaseProfile();
      const action = removeControlFromCustomGroup({
        controlId: 'AC-1',
        sourceGroupId: 'grp-root-1'
      });
      const next = produce(doc, draft => { action.apply(draft); });

      const grp1 = findCustomGroupById(next.profile.merge.custom, 'grp-root-1')!;
      const ids = grp1['insert-controls']![0]['include-controls']![0]['with-ids']!;
      expect(ids).toEqual(['ac-2']);
    });
  });

  // =========================================================================
  // 6. DRAFT NORMALIZATION, NULL SAFETY & FUZZING
  // =========================================================================
  describe('6. Draft Normalization, Null Safety & Malformed Draft Resilience', () => {
    it('handles bare Profile object without top-level wrapper', () => {
      const bareProfile = createBaseProfile().profile;
      const action = addCustomGroup({ title: 'Bare Profile Group' });
      const next = produce(bareProfile, draft => { action.apply(draft); });

      expect(next.merge.custom.groups.some((g: any) => g.title === 'Bare Profile Group')).toBe(true);
    });

    it('handles completely uninitialized draft gracefully', () => {
      const nullDraft: any = null;
      expect(getProfileFromDraft(nullDraft)).toBeNull();

      const emptyDraft = {};
      expect(getProfileFromDraft(emptyDraft)).toBeNull();

      const primitiveDraft = 'not-an-object';
      expect(getProfileFromDraft(primitiveDraft)).toBeNull();
    });

    it('initializes missing merge and custom structure when calling ensureCustomMergeStructure', () => {
      const minimalProfile: any = { uuid: 'p1' };
      ensureCustomMergeStructure(minimalProfile);

      expect(minimalProfile.merge).toBeDefined();
      expect(minimalProfile.merge.combine.method).toBe('use-first');
      expect(minimalProfile.merge.custom.groups).toEqual([]);
    });

    it('normalizes insert-controls when malformed in ensureInsertControls', () => {
      const malformedGroup: CustomGroup = {
        id: 'malformed',
        title: 'Malformed Group',
        'insert-controls': []
      };
      const ic = ensureInsertControls(malformedGroup);
      expect(ic.order).toBe('keep');
      expect(ic['include-controls']).toBeDefined();
      expect(ic['include-controls']![0]['with-ids']).toEqual([]);
    });

    it('safely handles whitespace-only title and ID in addCustomGroup', () => {
      const doc = createBaseProfile();
      const action = addCustomGroup({
        id: '   ',
        title: '   '
      });
      const next = produce(doc, draft => { action.apply(draft); });

      const added = next.profile.merge.custom.groups[next.profile.merge.custom.groups.length - 1];
      expect(added.title).toBe('New Custom Group');
      expect(added.id).toMatch(/^custom_grp_/);
    });

    it('safely ignores empty or whitespace newId and title in renameCustomGroup', () => {
      const doc = createBaseProfile();
      const action = renameCustomGroup({
        groupId: 'grp-root-1',
        title: '   ',
        newId: '   '
      });
      const next = produce(doc, draft => { action.apply(draft); });

      const grp = findCustomGroupById(next.profile.merge.custom, 'grp-root-1')!;
      expect(grp.title).toBe('Root Group 1');
      expect(grp.id).toBe('grp-root-1');
    });
  });

  // =========================================================================
  // 7. RANDOM GENERATOR PROPERTY / STRESS HARNESS
  // =========================================================================
  describe('7. Random Generator Stress Harness (100 sequential mutations)', () => {
    it('maintains strict tree invariants and exclusive assignments over 100 randomized actions', () => {
      let doc = createBaseProfile();

      const existingGroupIds = ['grp-root-1', 'grp-sub-1a', 'grp-root-2'];
      const controlPool = [
        'ac-1', 'ac-2', 'ac-2.1', 'ac-2.2', 'au-1', 'au-2',
        'ia-1', 'ia-2', 'cm-1', 'cm-2', 'sc-1', 'sc-7', 'pe-1'
      ];

      for (let step = 0; step < 100; step++) {
        const op = step % 6;

        switch (op) {
          case 0: {
            // Add custom group
            const newId = `rand-grp-${step}`;
            const parent = Math.random() > 0.5 && existingGroupIds.length > 0
              ? existingGroupIds[Math.floor(Math.random() * existingGroupIds.length)]
              : null;
            const action = addCustomGroup({
              id: newId,
              title: `Random Group ${step}`,
              parentGroupId: parent
            });
            doc = produce(doc, draft => { action.apply(draft); });
            existingGroupIds.push(newId);
            break;
          }
          case 1: {
            // Assign control
            if (existingGroupIds.length > 0) {
              const targetGroup = existingGroupIds[Math.floor(Math.random() * existingGroupIds.length)];
              const targetCtrl = controlPool[Math.floor(Math.random() * controlPool.length)];
              const action = assignControlToCustomGroup({
                controlId: targetCtrl,
                targetGroupId: targetGroup
              });
              doc = produce(doc, draft => { action.apply(draft); });
            }
            break;
          }
          case 2: {
            // Move custom group
            if (existingGroupIds.length >= 2) {
              const src = existingGroupIds[Math.floor(Math.random() * existingGroupIds.length)];
              const tgt = Math.random() > 0.3
                ? existingGroupIds[Math.floor(Math.random() * existingGroupIds.length)]
                : null;
              const action = moveCustomGroup({
                sourceGroupId: src,
                targetGroupId: tgt
              });
              doc = produce(doc, draft => { action.apply(draft); });
            }
            break;
          }
          case 3: {
            // Reorder controls
            if (existingGroupIds.length > 0) {
              const grpId = existingGroupIds[Math.floor(Math.random() * existingGroupIds.length)];
              const order = Math.random() > 0.5 ? 'ascending' : 'descending';
              const action = reorderControlsInCustomGroup({
                groupId: grpId,
                order: order
              });
              doc = produce(doc, draft => { action.apply(draft); });
            }
            break;
          }
          case 4: {
            // Remove control
            const ctrl = controlPool[Math.floor(Math.random() * controlPool.length)];
            const action = removeControlFromCustomGroup({ controlId: ctrl });
            doc = produce(doc, draft => { action.apply(draft); });
            break;
          }
          case 5: {
            // Rename group
            if (existingGroupIds.length > 0) {
              const grpId = existingGroupIds[Math.floor(Math.random() * existingGroupIds.length)];
              const action = renameCustomGroup({
                groupId: grpId,
                title: `Renamed Group ${step}`
              });
              doc = produce(doc, draft => { action.apply(draft); });
            }
            break;
          }
        }

        // INVARIANT CHECK after every single operation:
        // 1. merge.custom.groups is an Array
        expect(Array.isArray(doc.profile.merge.custom.groups)).toBe(true);

        // 2. Control assignment exclusivity: No control is assigned more than once
        const seenControls = new Set<string>();
        const checkGroup = (g: CustomGroup) => {
          if (g['insert-controls']) {
            for (const ic of g['insert-controls']) {
              if (ic['include-controls']) {
                for (const inc of ic['include-controls']) {
                  if (inc['with-ids']) {
                    for (const cid of inc['with-ids']) {
                      const lower = cid.toLowerCase();
                      expect(seenControls.has(lower)).toBe(false);
                      seenControls.add(lower);
                    }
                  }
                }
              }
            }
          }
          if (g.groups) {
            for (const sub of g.groups) {
              checkGroup(sub);
            }
          }
        };

        for (const rootG of doc.profile.merge.custom.groups) {
          checkGroup(rootG);
        }
      }
    });
  });

  // =========================================================================
  // 8. PURE IMMUTABILITY & DOCUMENTACTION CONFORMANCE
  // =========================================================================
  describe('8. Pure Immutability & DocumentAction Conformance', () => {
    it('ensures actions do not mutate original frozen document', () => {
      const base = createBaseProfile();
      // Deep freeze the base object
      const deepFreeze = (obj: any) => {
        Object.freeze(obj);
        Object.keys(obj).forEach(key => {
          if (typeof obj[key] === 'object' && obj[key] !== null && !Object.isFrozen(obj[key])) {
            deepFreeze(obj[key]);
          }
        });
      };
      deepFreeze(base);

      const action = addCustomGroup({ id: 'grp-frozen-test', title: 'Frozen Test' });

      expect(() => {
        const next = produce(base, draft => { action.apply(draft); });
        expect(next.profile.merge.custom.groups.length).toBe(3);
      }).not.toThrow();
    });
  });
});
