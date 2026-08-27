import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { produce } from 'immer';
import {
  addCustomGroup,
  renameCustomGroup,
  moveCustomGroup,
  applyMoveCustomGroup,
  assignControlToCustomGroup,
  removeControlFromCustomGroup,
  reorderControlsInCustomGroup,
  deleteCustomGroup,
  setMergeMode,
  gatherAllAssignedControlIds,
  findCustomGroupById,
  ensureCustomMergeStructure,
  getProfileFromDraft,
  CustomGroup
} from '../../lib/document-actions/profile-actions';
import {
  resolveProfileSync,
  filterControls,
  filterGroups
} from '../../lib/profile/profile-resolver';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn()
  }
}));

describe('Tier 5 Adversarial Frontend Suite: Alice\'s Custom Merge Multi-Step User Journey', () => {

  const NIST_UUID = '11111111-2222-3333-4444-555555555555';
  const ISO_UUID = '22222222-3333-4444-5555-666666666666';
  const BSI_UUID = '33333333-4444-5555-6666-777777777777';

  const sampleCatalogNist = {
    uuid: NIST_UUID,
    id: NIST_UUID,
    metadata: { title: 'NIST SP 800-53 Rev 5', version: '5.1.0' },
    groups: [
      {
        id: 'ac',
        title: 'Access Control',
        controls: [
          { id: 'AC-1', title: 'Policy and Procedures', parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'AC-1 statement' }] },
          { id: 'AC-2', title: 'Account Management', parts: [{ id: 'ac-2_smt', name: 'statement', prose: 'AC-2 statement' }] },
          { id: 'AC-3', title: 'Access Enforcement', parts: [{ id: 'ac-3_smt', name: 'statement', prose: 'AC-3 statement' }] }
        ]
      },
      {
        id: 'ia',
        title: 'Identification and Authentication',
        controls: [
          { id: 'IA-2.1', title: 'Multi-Factor Authentication', parts: [{ id: 'ia-2.1_smt', name: 'statement', prose: 'IA-2.1 statement' }] }
        ]
      }
    ]
  };

  const sampleCatalogIso = {
    uuid: ISO_UUID,
    id: ISO_UUID,
    metadata: { title: 'ISO/IEC 27001:2022', version: '2022' },
    groups: [
      {
        id: 'a.5',
        title: 'Organizational Controls',
        controls: [
          { id: 'A.5.15', title: 'Access Control Requirements', parts: [{ id: 'a.5.15_smt', name: 'statement', prose: 'ISO Access prose' }] },
          { id: 'A.5.16', title: 'Identity Management Requirements', parts: [{ id: 'a.5.16_smt', name: 'statement', prose: 'ISO Identity prose' }] }
        ]
      }
    ]
  };

  const sampleCatalogBsi = {
    uuid: BSI_UUID,
    id: BSI_UUID,
    metadata: { title: 'BSI IT-Grundschutz', version: '2023' },
    groups: [
      {
        id: 'app.1',
        title: 'Applications',
        controls: [
          { id: 'APP.1.1.A1', title: 'Access Concept', parts: [{ id: 'app.1.1.a1_smt', name: 'statement', prose: 'BSI Access Concept' }] }
        ]
      }
    ]
  };

  const createCatalogCache = () => {
    const map = new Map<string, any>();
    map.set(NIST_UUID.toLowerCase(), { type: 'catalog', data: { catalog: sampleCatalogNist } });
    map.set(ISO_UUID.toLowerCase(), { type: 'catalog', data: { catalog: sampleCatalogIso } });
    map.set(BSI_UUID.toLowerCase(), { type: 'catalog', data: { catalog: sampleCatalogBsi } });
    return map;
  };

  const createInitialAliceProfile = () => ({
    profile: {
      uuid: 'prof-alice-journey-001',
      metadata: {
        title: 'Alice Organizational Baseline',
        version: '1.0.0',
        'oscal-version': '1.1.2'
      },
      imports: [
        { href: `#${NIST_UUID}`, 'include-all': {} },
        { href: `#${ISO_UUID}`, 'include-all': {} },
        { href: `#${BSI_UUID}`, 'include-all': {} }
      ],
      merge: {
        'as-is': true
      }
    }
  });

  it('executes full Alice Journey through pure state machine with synchronous resolution verification', () => {
    let state = createInitialAliceProfile();
    const catalogCache = createCatalogCache();

    // Step 1: Switch merge mode from as-is to custom
    state = produce(state, draft => {
      setMergeMode('custom').apply(draft);
    });
    expect(state.profile.merge.custom).toBeDefined();
    expect((state.profile.merge as any)['as-is']).toBeUndefined();
    expect((state.profile.merge as any).flat).toBeUndefined();

    // Step 2: Create root custom group 'grp-gov'
    state = produce(state, draft => {
      addCustomGroup({
        id: 'grp-gov',
        title: 'Enterprise Governance',
        class: 'domain',
        props: [{ name: 'owner', value: 'CISO Office' }]
      }).apply(draft);
    });
    expect(state.profile.merge.custom.groups).toHaveLength(1);
    expect(state.profile.merge.custom.groups[0].id).toBe('grp-gov');

    // Step 3: Create nested subgroup 'grp-iam' under 'grp-gov'
    state = produce(state, draft => {
      addCustomGroup({
        id: 'grp-iam',
        title: 'Identity & Access Management',
        parentGroupId: 'grp-gov'
      }).apply(draft);
    });
    expect(state.profile.merge.custom.groups[0].groups).toHaveLength(1);
    expect(state.profile.merge.custom.groups[0].groups![0].id).toBe('grp-iam');

    // Step 4: Create deep sub-group 'grp-cloud-iam' under 'grp-iam' (3 levels deep)
    state = produce(state, draft => {
      addCustomGroup({
        id: 'grp-cloud-iam',
        title: 'Cloud IAM & Privileged Access',
        parentGroupId: 'grp-iam'
      }).apply(draft);
    });
    expect(state.profile.merge.custom.groups[0].groups![0].groups).toHaveLength(1);
    expect(state.profile.merge.custom.groups[0].groups![0].groups![0].id).toBe('grp-cloud-iam');

    // Step 5: Dual-surface control assignment simulation:
    // Assign AC-1 and A.5.15 to 'grp-gov'
    // Assign AC-2 and A.5.16 to 'grp-iam'
    // Assign IA-2.1 to 'grp-cloud-iam'
    state = produce(state, draft => {
      assignControlToCustomGroup({ controlId: 'ac-1', targetGroupId: 'grp-gov', order: 'ascending' }).apply(draft);
      assignControlToCustomGroup({ controlId: 'a.5.15', targetGroupId: 'grp-gov' }).apply(draft);
      assignControlToCustomGroup({ controlId: 'ac-2', targetGroupId: 'grp-iam' }).apply(draft);
      assignControlToCustomGroup({ controlId: 'a.5.16', targetGroupId: 'grp-iam' }).apply(draft);
      assignControlToCustomGroup({ controlId: 'ia-2.1', targetGroupId: 'grp-cloud-iam' }).apply(draft);
    });

    // Verify gathered assigned control IDs
    const assignedIds = gatherAllAssignedControlIds(state.profile.merge.custom);
    expect(assignedIds.has('ac-1')).toBe(true);
    expect(assignedIds.has('a.5.15')).toBe(true);
    expect(assignedIds.has('ac-2')).toBe(true);
    expect(assignedIds.has('a.5.16')).toBe(true);
    expect(assignedIds.has('ia-2.1')).toBe(true);
    expect(assignedIds.has('ac-3')).toBe(false); // Unassigned
    expect(assignedIds.has('app.1.1.a1')).toBe(false); // Unassigned

    // Step 6: Test Reorder Controls in grp-gov to 'descending'
    state = produce(state, draft => {
      reorderControlsInCustomGroup({ groupId: 'grp-gov', order: 'descending' }).apply(draft);
    });
    const govGroup = findCustomGroupById(state.profile.merge.custom, 'grp-gov')!;
    const govWithIds = govGroup['insert-controls']![0]['include-controls']![0]['with-ids']!;
    expect(govWithIds).toEqual(['ac-1', 'a.5.15']); // descending sort order

    // Step 7: Rename custom group 'grp-cloud-iam' -> 'grp-cloud-mfa', change title
    state = produce(state, draft => {
      renameCustomGroup({
        groupId: 'grp-cloud-iam',
        newId: 'grp-cloud-mfa',
        title: 'Cloud MFA & Zero Trust'
      }).apply(draft);
    });
    const renamedGroup = findCustomGroupById(state.profile.merge.custom, 'grp-cloud-mfa');
    expect(renamedGroup).not.toBeNull();
    expect(renamedGroup!.title).toBe('Cloud MFA & Zero Trust');

    // Step 8: Group Deletion with Migration
    // Delete 'grp-iam' and reassign its controls & subgroups directly to 'grp-gov'
    state = produce(state, draft => {
      deleteCustomGroup({
        groupId: 'grp-iam',
        reassignToGroupId: 'grp-gov'
      }).apply(draft);
    });

    const rootGov = state.profile.merge.custom.groups[0];
    expect(findCustomGroupById(state.profile.merge.custom, 'grp-iam')).toBeNull();
    // Migrated controls are now in rootGov
    const govControlsAfterMigration = rootGov['insert-controls']![0]['include-controls']![0]['with-ids']!;
    expect(govControlsAfterMigration).toContain('ac-2');
    expect(govControlsAfterMigration).toContain('a.5.16');
    // Child group 'grp-cloud-mfa' is now directly under rootGov
    expect(rootGov.groups).toHaveLength(1);
    expect(rootGov.groups![0].id).toBe('grp-cloud-mfa');

    // Step 9: Synchronous Resolution Verification
    // Add top-level insert-controls include-all so unassigned controls are resolved at root
    state = produce(state, draft => {
      draft.profile.merge.custom['insert-controls'] = [{ 'include-all': {} }];
    });

    const resolved = resolveProfileSync(state, catalogCache);
    expect(resolved.catalog.groups).toHaveLength(1);
    const resGov = resolved.catalog.groups[0];
    expect(resGov.id).toBe('grp-gov');
    const resGovCtrlIds = resGov.controls.map((c: any) => c.id.toLowerCase());
    expect(resGovCtrlIds).toContain('ac-1');
    expect(resGovCtrlIds).toContain('ac-2');
    expect(resGovCtrlIds).toContain('a.5.15');
    expect(resGovCtrlIds).toContain('a.5.16');

    expect(resGov.groups).toHaveLength(1);
    expect(resGov.groups[0].id).toBe('grp-cloud-mfa');
    expect(resGov.groups[0].controls).toHaveLength(1);
    expect(resGov.groups[0].controls[0].id).toBe('IA-2.1');

    // Leftover unassigned controls at root: AC-3 and APP.1.1.A1
    const unassignedResolvedIds = resolved.catalog.controls.map((c: any) => c.id.toLowerCase());
    expect(unassignedResolvedIds).toContain('ac-3');
    expect(unassignedResolvedIds).toContain('app.1.1.a1');
  });

  it('stress-tests rapid sequential group mutations and prevents cyclic hierarchy', () => {
    let state = createInitialAliceProfile();
    state = produce(state, draft => {
      setMergeMode('custom').apply(draft);
    });

    // Create 10 sequential nested groups
    for (let i = 1; i <= 10; i++) {
      state = produce(state, draft => {
        addCustomGroup({
          id: `lvl-${i}`,
          title: `Level ${i}`,
          parentGroupId: i === 1 ? null : `lvl-${i - 1}`
        }).apply(draft);
      });
    }

    // Verify 10-level hierarchy
    let current = state.profile.merge.custom.groups[0];
    for (let i = 1; i <= 10; i++) {
      expect(current.id).toBe(`lvl-${i}`);
      if (i < 10) {
        expect(current.groups).toBeDefined();
        expect(current.groups).toHaveLength(1);
        current = current.groups![0];
      }
    }

    // Attempt illegal cyclic move: Move lvl-2 inside lvl-8 (descendant of lvl-2)
    // Must be prevented and return false
    const illegalResult = applyMoveCustomGroup(state, {
      sourceGroupId: 'lvl-2',
      targetGroupId: 'lvl-8'
    });
    expect(illegalResult).toBe(false);

    // Hierarchy remains intact
    expect(state.profile.merge.custom.groups[0].id).toBe('lvl-1');
    expect(state.profile.merge.custom.groups[0].groups![0].id).toBe('lvl-2');
  });

  it('guarantees exclusive control assignment across deep custom groups', () => {
    let state = createInitialAliceProfile();
    state = produce(state, draft => {
      setMergeMode('custom').apply(draft);
      addCustomGroup({ id: 'grp-alpha', title: 'Alpha' }).apply(draft);
      addCustomGroup({ id: 'grp-beta', title: 'Beta' }).apply(draft);
      addCustomGroup({ id: 'grp-gamma', title: 'Gamma' }).apply(draft);
      // Assign AC-1 to Alpha
      assignControlToCustomGroup({ controlId: 'ac-1', targetGroupId: 'grp-alpha' }).apply(draft);
    });

    // Check AC-1 is in Alpha
    let alpha = findCustomGroupById(state.profile.merge.custom, 'grp-alpha')!;
    expect(alpha['insert-controls']![0]['include-controls']![0]['with-ids']).toContain('ac-1');

    // Reassign AC-1 to Beta
    state = produce(state, draft => {
      assignControlToCustomGroup({ controlId: 'ac-1', targetGroupId: 'grp-beta' }).apply(draft);
    });

    alpha = findCustomGroupById(state.profile.merge.custom, 'grp-alpha')!;
    let beta = findCustomGroupById(state.profile.merge.custom, 'grp-beta')!;
    expect(alpha['insert-controls']![0]['include-controls']![0]['with-ids']).not.toContain('ac-1');
    expect(beta['insert-controls']![0]['include-controls']![0]['with-ids']).toContain('ac-1');

    // Reassign AC-1 to Gamma
    state = produce(state, draft => {
      assignControlToCustomGroup({ controlId: 'ac-1', targetGroupId: 'grp-gamma' }).apply(draft);
    });

    beta = findCustomGroupById(state.profile.merge.custom, 'grp-beta')!;
    let gamma = findCustomGroupById(state.profile.merge.custom, 'grp-gamma')!;
    expect(beta['insert-controls']![0]['include-controls']![0]['with-ids']).not.toContain('ac-1');
    expect(gamma['insert-controls']![0]['include-controls']![0]['with-ids']).toContain('ac-1');

    // Unassign AC-1 (remove from Gamma)
    state = produce(state, draft => {
      removeControlFromCustomGroup({ controlId: 'ac-1' }).apply(draft);
    });

    gamma = findCustomGroupById(state.profile.merge.custom, 'grp-gamma')!;
    expect(gamma['insert-controls']![0]['include-controls']![0]['with-ids']).not.toContain('ac-1');
    const allAssigned = gatherAllAssignedControlIds(state.profile.merge.custom);
    expect(allAssigned.has('ac-1')).toBe(false);
  });
});
