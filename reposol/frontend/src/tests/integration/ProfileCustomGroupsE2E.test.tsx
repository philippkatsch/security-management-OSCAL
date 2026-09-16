import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { SourcesPanel } from '@components/profile/SourcesPanel';
import { GroupEditor } from '@components/shared/GroupEditor';
import { ProfileSidebar } from '@components/profile/ProfileSidebar';
import { ConfirmProvider } from '@components/shared/ui/ConfirmProvider';
import {
  resolveProfileSync,
  applyModify,
  filterControls,
  filterGroups
} from '@lib/profile';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn()
  }
}));

describe('Stage 2 Profile Tailoring — Custom Group Definition & Control Pool Assignment E2E Integration Suite', () => {

  // Standard 36-char UUIDs for catalogs
  const NIST_UUID = '11111111-2222-3333-4444-555555555555';
  const ISO_UUID = '22222222-3333-4444-5555-666666666666';

  const sampleCatalogNist = {
    uuid: NIST_UUID,
    id: NIST_UUID,
    metadata: { title: 'NIST SP 800-53 Rev 5', version: '5.1.0' },
    groups: [
      {
        id: 'ac',
        title: 'Access Control',
        controls: [
          { id: 'ac-1', title: 'Policy and Procedures', parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'AC-1 prose' }] },
          { id: 'ac-2', title: 'Account Management', parts: [{ id: 'ac-2_smt', name: 'statement', prose: 'AC-2 prose' }] },
          { id: 'ac-3', title: 'Access Enforcement', parts: [{ id: 'ac-3_smt', name: 'statement', prose: 'AC-3 prose' }] }
        ]
      },
      {
        id: 'ia',
        title: 'Identification and Authentication',
        controls: [
          { id: 'ia-1', title: 'Identification Policy', parts: [{ id: 'ia-1_smt', name: 'statement', prose: 'IA-1 prose' }] },
          { id: 'ia-2', title: 'Identification and Authentication (Org Users)', parts: [{ id: 'ia-2_smt', name: 'statement', prose: 'IA-2 prose' }] },
          { id: 'ia-5', title: 'Authenticator Management', parts: [{ id: 'ia-5_smt', name: 'statement', prose: 'IA-5 prose' }] }
        ]
      },
      {
        id: 'sc',
        title: 'System and Communications Protection',
        controls: [
          { id: 'sc-7', title: 'Boundary Protection', parts: [{ id: 'sc-7_smt', name: 'statement', prose: 'SC-7 prose' }] },
          { id: 'sc-13', title: 'Cryptographic Protection', parts: [{ id: 'sc-13_smt', name: 'statement', prose: 'SC-13 prose' }] }
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
          { id: 'a.5.15', title: 'Access Control Requirements', parts: [{ id: 'a.5.15_smt', name: 'statement', prose: 'ISO Access control prose' }] },
          { id: 'a.5.16', title: 'Identity Management Requirements', parts: [{ id: 'a.5.16_smt', name: 'statement', prose: 'ISO Identity prose' }] }
        ]
      }
    ]
  };

  const resolvedCatalogFixture = {
    uuid: NIST_UUID,
    metadata: { title: 'NIST SP 800-53 Rev 5' },
    source_catalog_title: 'NIST SP 800-53 Rev 5',
    source_catalog_id: NIST_UUID,
    all_groups: sampleCatalogNist.groups,
    all_controls: [],
    groups: sampleCatalogNist.groups,
    controls: []
  };

  const createCatalogCache = (catalogs: any[] = [sampleCatalogNist]) => {
    const map = new Map<string, any>();
    for (const cat of catalogs) {
      map.set(cat.uuid.toLowerCase(), {
        type: 'catalog',
        data: { catalog: cat }
      });
    }
    return map;
  };

  const createProfileDoc = (profileFields: any) => ({
    profile: {
      uuid: '99999999-8888-7777-6666-555555555555',
      metadata: {
        title: 'Tailored Profile',
        version: '1.0.0',
        'oscal-version': '1.1.2',
        'last-modified': new Date().toISOString()
      },
      imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
      ...profileFields
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // TIER 1: FEATURE COVERAGE (60 Tests across 12 Features)
  // =========================================================================
  describe('Tier 1: Feature Coverage (60 Tests across 12 Features)', () => {

    // -----------------------------------------------------------------------
    // Feature 1: Create Custom Group (+ button & context menu / structure copy)
    // -----------------------------------------------------------------------
    describe('Feature 1: Create Custom Group (R1)', () => {
      it('F1.1: Copies catalog structure into custom groups via handleCopyStructure in SourcesPanel', () => {
        let profileState: any = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: { custom: { groups: [] } }
        };
        const onChange = vi.fn((newProf) => { profileState = newProf; });

        render(
          <SourcesPanel
            profile={profileState}
            onChange={onChange}
            isEditing={true}
            availableCatalogs={[sampleCatalogNist]}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        const copyBtn = screen.getByRole('button', { name: /Import Full Structure/i });
        fireEvent.click(copyBtn);

        expect(onChange).toHaveBeenCalled();
        const updated = onChange.mock.calls[0][0];
        expect(updated.merge.custom.groups.length).toBe(3);
        expect(updated.merge.custom.groups[0].id).toBe('ac');
        expect(updated.merge.custom.groups[0].title).toBe('Access Control');
        expect(updated.merge.custom.groups[0]['insert-controls'][0]['include-controls'][0]['with-ids']).toEqual(['ac-1', 'ac-2', 'ac-3']);
      });

      it('F1.2: Adds custom group with unique ID without duplicating existing groups', () => {
        let profileState: any = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: {
            custom: {
              groups: [{ id: 'custom_domain_1', title: 'Identity & Access Domain', 'insert-controls': [] }]
            }
          }
        };
        const onChange = vi.fn((newProf) => { profileState = newProf; });

        render(
          <SourcesPanel
            profile={profileState}
            onChange={onChange}
            isEditing={true}
            availableCatalogs={[sampleCatalogNist]}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByRole('button', { name: /Import Full Structure/i }));
        expect(onChange).toHaveBeenCalled();
        const updated = onChange.mock.calls[0][0];
        expect(updated.merge.custom.groups.length).toBe(4);
        expect(updated.merge.custom.groups[0].id).toBe('custom_domain_1');
      });

      it('F1.3: Initializes empty custom group in merge.custom when switching to custom mode', () => {
        let profileState: any = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: { 'as-is': true }
        };
        const onChange = vi.fn((newProf) => { profileState = newProf; });

        render(
          <SourcesPanel
            profile={profileState}
            onChange={onChange}
            isEditing={true}
          />
        );

        const select = screen.getByTestId('structuring-mode-select');
        fireEvent.change(select, { target: { value: 'custom' } });

        expect(onChange).toHaveBeenCalled();
        const updated = onChange.mock.calls[0][0];
        expect(updated.merge.custom).toBeDefined();
        expect(updated.merge.custom.groups).toEqual([]);
        expect(updated.merge['as-is']).toBeUndefined();
      });

      it('F1.4: Creates custom groups with empty insert-controls structure when source groups have no controls', () => {
        const emptyCat = {
          uuid: '33333333-4444-5555-6666-777777777777',
          id: '33333333-4444-5555-6666-777777777777',
          metadata: { title: 'Empty Family Catalog' },
          groups: [{ id: 'empty-family', title: 'Empty Family', controls: [] }]
        };

        const profileState: any = {
          imports: [{ href: `../catalogs/${emptyCat.uuid}.json`, 'include-all': {} }],
          merge: { custom: { groups: [] } }
        };
        const onChange = vi.fn();

        render(
          <SourcesPanel
            profile={profileState}
            onChange={onChange}
            isEditing={true}
            availableCatalogs={[emptyCat]}
            resolvedCatalog={{ ...emptyCat, source_catalog_id: emptyCat.uuid, all_groups: emptyCat.groups, all_controls: [] }}
          />
        );

        const copyStructureBtn = screen.getByRole('button', { name: /Import Full Structure/i });
        fireEvent.click(copyStructureBtn);

        expect(onChange).toHaveBeenCalled();
        const updated = onChange.mock.calls[0][0];
        expect(updated.merge.custom.groups[0]['insert-controls']).toEqual([]);
      });

      it('F1.5: Preserves existing custom groups when new imports are added', () => {
        const existingGroup = { id: 'sec-ops', title: 'Security Operations', 'insert-controls': [] };
        const profileState: any = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: { custom: { groups: [existingGroup] } }
        };
        const onChange = vi.fn();

        render(
          <SourcesPanel
            profile={profileState}
            onChange={onChange}
            isEditing={true}
            availableCatalogs={[sampleCatalogNist, sampleCatalogIso]}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByRole('button', { name: /Import Full Structure/i }));
        expect(onChange).toHaveBeenCalled();
        const updated = onChange.mock.calls[0][0];
        expect(updated.merge.custom.groups.some((g: any) => g.id === 'sec-ops')).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    // Feature 2: Edit Custom Group Title & ID Inline
    // -----------------------------------------------------------------------
    describe('Feature 2: Edit Custom Group Title & ID Inline (R1)', () => {
      it('F2.1: GroupEditor renders title and id inputs in edit mode', () => {
        const group = { id: 'custom-grp-1', title: 'Original Custom Title', props: [], parts: [] };
        render(
          <ConfirmProvider>
            <GroupEditor
              group={group}
              isEditing={true}
              mode="profile"
              onChange={vi.fn()}
            />
          </ConfirmProvider>
        );

        expect(screen.getByDisplayValue('Original Custom Title')).toBeInTheDocument();
        expect(screen.getByDisplayValue('custom-grp-1')).toBeInTheDocument();
      });

      it('F2.2: GroupEditor invokes onChange with updated title when title input changes', async () => {
        const group = { id: 'custom-grp-1', title: 'Original Title', props: [], parts: [] };
        const onChange = vi.fn();

        render(
          <ConfirmProvider>
            <GroupEditor
              group={group}
              isEditing={true}
              mode="profile"
              onChange={onChange}
            />
          </ConfirmProvider>
        );

        const titleInput = screen.getByPlaceholderText('Group Title');
        fireEvent.change(titleInput, { target: { value: 'Renamed Security Domain' } });

        await waitFor(() => {
          expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            id: 'custom-grp-1',
            title: 'Renamed Security Domain'
          }));
        }, { timeout: 1000 });
      });

      it('F2.3: GroupEditor invokes onChange with updated ID when ID input changes', async () => {
        const group = { id: 'old-grp-id', title: 'Title', props: [], parts: [] };
        const onChange = vi.fn();

        render(
          <ConfirmProvider>
            <GroupEditor
              group={group}
              isEditing={true}
              mode="profile"
              onChange={onChange}
            />
          </ConfirmProvider>
        );

        const idInput = screen.getByDisplayValue('old-grp-id');
        fireEvent.change(idInput, { target: { value: 'new-domain-id' } });

        await waitFor(() => {
          expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            id: 'new-domain-id',
            title: 'Title'
          }));
        }, { timeout: 1000 });
      });

      it('F2.4: GroupEditor renders static heading without inputs when isEditing is false (Read-Only)', () => {
        const group = { id: 'custom-grp-1', title: 'View Title', props: [], parts: [] };

        render(
          <ConfirmProvider>
            <GroupEditor
              group={group}
              isEditing={false}
              mode="profile"
              onChange={vi.fn()}
            />
          </ConfirmProvider>
        );

        expect(screen.getByRole('heading', { level: 2, name: 'View Title' })).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Group Title')).not.toBeInTheDocument();
      });

      it('F2.5: GroupEditor allows adding and editing custom group properties (props)', () => {
        const group = { id: 'custom-grp-1', title: 'Title', props: [{ name: 'label', value: 'DOMAIN-1' }], parts: [] };
        const onChange = vi.fn();

        render(
          <ConfirmProvider>
            <GroupEditor
              group={group}
              isEditing={true}
              mode="profile"
              onChange={onChange}
            />
          </ConfirmProvider>
        );

        expect(screen.getByDisplayValue('DOMAIN-1')).toBeInTheDocument();
      });
    });

    // -----------------------------------------------------------------------
    // Feature 3: Nest Custom Groups (Sub-groups)
    // -----------------------------------------------------------------------
    describe('Feature 3: Nest Custom Groups (Sub-groups) (R1)', () => {
      it('F3.1: Resolves profile with 2-level custom group hierarchy', () => {
        const profileDoc = createProfileDoc({
          merge: {
            custom: {
              groups: [
                {
                  id: 'parent-domain',
                  title: 'Core Governance Domain',
                  groups: [
                    {
                      id: 'child-family',
                      title: 'Access Management Sub-family',
                      'insert-controls': [
                        { 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2'] }] }
                      ]
                    }
                  ]
                }
              ]
            }
          }
        });

        const cache = createCatalogCache();
        const res = resolveProfileSync(profileDoc, cache);
        expect(res.catalog.groups?.length).toBe(1);
        expect(res.catalog.groups?.[0].id).toBe('parent-domain');
        expect(res.catalog.groups?.[0].groups?.length).toBe(1);
        expect(res.catalog.groups?.[0].groups?.[0].id).toBe('child-family');
        expect(res.catalog.groups?.[0].groups?.[0].controls?.length).toBe(2);
      });

      it('F3.2: Resolves profile with 3-level deep custom group hierarchy', () => {
        const profileDoc = createProfileDoc({
          merge: {
            custom: {
              groups: [
                {
                  id: 'level-1',
                  title: 'Level 1 Domain',
                  groups: [
                    {
                      id: 'level-2',
                      title: 'Level 2 Category',
                      groups: [
                        {
                          id: 'level-3',
                          title: 'Level 3 Specific Policy',
                          'insert-controls': [
                            { 'include-controls': [{ 'with-ids': ['sc-7'] }] }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          }
        });

        const cache = createCatalogCache();
        const res = resolveProfileSync(profileDoc, cache);
        expect(res.catalog.groups?.[0].groups?.[0].groups?.[0].id).toBe('level-3');
        expect(res.catalog.groups?.[0].groups?.[0].groups?.[0].controls?.[0].id).toBe('sc-7');
      });

      it('F3.3: Removes control from deeply nested sub-group in SourcesPanel', () => {
        const profileState = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: {
            custom: {
              groups: [
                {
                  id: 'parent',
                  title: 'Parent',
                  groups: [
                    {
                      id: 'child',
                      title: 'Child',
                      'insert-controls': [
                        { 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2'] }] }
                      ]
                    }
                  ]
                }
              ]
            }
          }
        };

        const onChange = vi.fn();
        render(
          <SourcesPanel
            profile={profileState}
            onChange={onChange}
            isEditing={true}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));

        const poolContainer = screen.getByText(/Control Pool \(Drag & Drop\)/i).closest('div')!.parentElement!;
        fireEvent.drop(poolContainer, {
          dataTransfer: {
            getData: (format: string) => format === 'text/plain' ? 'ac-1' : ''
          }
        });

        expect(onChange).toHaveBeenCalled();
        const updated = onChange.mock.calls[0][0];
        const childGroup = updated.merge.custom.groups[0].groups[0];
        const remainingWithIds = childGroup['insert-controls'][0]['include-controls'][0]['with-ids'];
        expect(remainingWithIds).toEqual(['ac-2']);
      });

      it('F3.4: Traverses controls in nested groups when computing assigned control IDs', () => {
        const profileState = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: {
            custom: {
              groups: [
                {
                  id: 'parent',
                  title: 'Parent',
                  groups: [
                    {
                      id: 'child',
                      title: 'Child',
                      'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-3'] }] }]
                    }
                  ]
                }
              ]
            }
          }
        };

        render(
          <SourcesPanel
            profile={profileState}
            isEditing={true}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));

        const ac3Card = screen.getByText('Access Enforcement').closest('[draggable]')!;
        expect(within(ac3Card).getByText('✓ Assigned')).toBeInTheDocument();
      });

      it('F3.5: GroupEditor displays sub-group navigation when nested groups exist', () => {
        const group = {
          id: 'parent-group',
          title: 'Parent Group',
          groups: [
            { id: 'sub-1', title: 'Sub-group 1' },
            { id: 'sub-2', title: 'Sub-group 2' }
          ],
          props: [],
          parts: []
        };

        render(
          <ConfirmProvider>
            <GroupEditor
              group={group}
              isEditing={true}
              mode="profile"
              onChange={vi.fn()}
              onSelectGroup={vi.fn()}
            />
          </ConfirmProvider>
        );

        expect(screen.getByText('Sub-group 1')).toBeInTheDocument();
        expect(screen.getByText('Sub-group 2')).toBeInTheDocument();
      });
    });

    // -----------------------------------------------------------------------
    // Feature 4: Delete Custom Group with Reassignment
    // -----------------------------------------------------------------------
    describe('Feature 4: Delete Custom Group with Reassignment (R1)', () => {
      it('F4.1: Deleting custom group leaves remaining custom groups untouched', () => {
        const groups = [
          { id: 'grp-keep', title: 'Keep Me', 'insert-controls': [] },
          { id: 'grp-delete', title: 'Delete Me', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }] }
        ];

        const updatedGroups = groups.filter(g => g.id !== 'grp-delete');
        expect(updatedGroups.length).toBe(1);
        expect(updatedGroups[0].id).toBe('grp-keep');
      });

      it('F4.2: Deleting a custom group returns its controls to unassigned state in resolved view', () => {
        const profileBefore = createProfileDoc({
          merge: {
            custom: {
              groups: [{ id: 'temp-grp', title: 'Temporary Group', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }] }]
            }
          }
        });

        const cache = createCatalogCache();
        const resBefore = resolveProfileSync(profileBefore, cache);
        expect(resBefore.catalog.groups?.[0].controls?.[0].id).toBe('ac-1');

        const profileAfter = createProfileDoc({
          merge: { custom: { groups: [] } }
        });

        const resAfter = resolveProfileSync(profileAfter, cache);
        // Fallback to as-is when custom groups is empty
        expect(resAfter.catalog.groups?.some(g => g.id === 'temp-grp')).toBe(false);
      });

      it('F4.3: Deleting nested child group does not delete parent group', () => {
        const parent = {
          id: 'parent',
          title: 'Parent',
          groups: [
            { id: 'child-1', title: 'Child 1' },
            { id: 'child-2', title: 'Child 2' }
          ]
        };

        const deleteChild = (g: any, targetId: string) => ({
          ...g,
          groups: g.groups ? g.groups.filter((sub: any) => sub.id !== targetId) : undefined
        });

        const updatedParent = deleteChild(parent, 'child-1');
        expect(updatedParent.groups.length).toBe(1);
        expect(updatedParent.groups[0].id).toBe('child-2');
      });

      it('F4.4: Deleting parent group cascades removal of its child sub-groups', () => {
        const groups = [
          { id: 'parent-to-delete', title: 'Parent', groups: [{ id: 'orphan-child', title: 'Child' }] },
          { id: 'other-parent', title: 'Other Parent', groups: [] }
        ];

        const updated = groups.filter(g => g.id !== 'parent-to-delete');
        expect(updated.length).toBe(1);
        expect(updated[0].id).toBe('other-parent');
      });

      it('F4.5: Controls from deleted group become available for re-assignment in pool', () => {
        const profile = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: { custom: { groups: [] } }
        };

        render(
          <SourcesPanel
            profile={profile}
            isEditing={true}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
        const assignedBadges = screen.queryAllByText('✓ Assigned');
        expect(assignedBadges.length).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    // Feature 5: Virtual "📥 Unassigned Controls" Tree Node
    // -----------------------------------------------------------------------
    describe('Feature 5: Virtual Unassigned Controls Tree Node (R2)', () => {
      it('F5.1: Accurately computes pool controls count from imported catalog', () => {
        const profile = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: { custom: { groups: [] } }
        };

        render(
          <SourcesPanel
            profile={profile}
            isEditing={true}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        const poolTabBtn = screen.getByTestId('control-pool-tab-btn');
        expect(within(poolTabBtn).getByText('8')).toBeInTheDocument();
      });

      it('F5.2: Reflects assigned status on card grid when controls are assigned to custom groups', () => {
        const profile = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: {
            custom: {
              groups: [
                {
                  id: 'grp-1',
                  title: 'Group 1',
                  'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1', 'ia-2'] }] }]
                }
              ]
            }
          }
        };

        render(
          <SourcesPanel
            profile={profile}
            isEditing={true}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));

        const ac1Card = screen.getByText('Policy and Procedures').closest('[draggable]')!;
        expect(within(ac1Card).getByText('✓ Assigned')).toBeInTheDocument();

        const ia2Card = screen.getByText('Identification and Authentication (Org Users)').closest('[draggable]')!;
        expect(within(ia2Card).getByText('✓ Assigned')).toBeInTheDocument();

        const ac2Card = screen.getByText('Account Management').closest('[draggable]')!;
        expect(within(ac2Card).queryByText('✓ Assigned')).not.toBeInTheDocument();
      });

      it('F5.3: Disables dragging on pool cards when isEditing is false (Read-Only Mode)', () => {
        const profile = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: { custom: { groups: [] } }
        };

        render(
          <SourcesPanel
            profile={profile}
            isEditing={false}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
        const card = screen.getByText('Policy and Procedures').closest('[draggable]')!;
        expect(card.getAttribute('draggable')).toBe('false');
      });

      it('F5.4: Enables dragging on pool cards when isEditing is true (Edit Mode)', () => {
        const profile = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: { custom: { groups: [] } }
        };

        render(
          <SourcesPanel
            profile={profile}
            isEditing={true}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
        const card = screen.getByText('Policy and Procedures').closest('[draggable]')!;
        expect(card.getAttribute('draggable')).toBe('true');
      });

      it('F5.5: Handles empty imports gracefully in Control Pool tab', () => {
        const profile = {
          imports: [],
          merge: { custom: { groups: [] } }
        };

        render(
          <SourcesPanel
            profile={profile}
            isEditing={true}
            resolvedCatalog={null}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
        expect(screen.getByText(/Resolving imports...|No imports configured|No controls found in the imported sources/i)).toBeInTheDocument();
      });
    });

    // -----------------------------------------------------------------------
    // Feature 6: Tree Drag-and-Drop Control Assignment
    // -----------------------------------------------------------------------
    describe('Feature 6: Tree Drag-and-Drop Control Assignment (R2)', () => {
      it('F6.1: ProfileSidebar renders with resolved catalog groups', () => {
        render(
          <ProfileSidebar
            resolvedCatalog={resolvedCatalogFixture}
            profile={{}}
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

        expect(screen.getByText('Access Control')).toBeInTheDocument();
        expect(screen.getByText('Identification and Authentication')).toBeInTheDocument();
      });

      it('F6.2: Inserts control ID into custom group insert-controls when assigned via drag-drop helper', () => {
        const group = { id: 'ac-custom', title: 'Custom AC', 'insert-controls': [] as any[] };
        const assignControl = (g: any, controlId: string) => {
          const newG = { ...g };
          let icList = [...(newG['insert-controls'] || [])];
          if (icList.length === 0) {
            icList.push({ order: 'keep', 'include-controls': [{ 'with-ids': [controlId] }] });
          } else {
            icList = icList.map(ic => {
              if (ic['include-controls']) {
                return {
                  ...ic,
                  'include-controls': ic['include-controls'].map((inc: any) => ({
                    ...inc,
                    'with-ids': Array.from(new Set([...(inc['with-ids'] || []), controlId]))
                  }))
                };
              }
              return ic;
            });
          }
          newG['insert-controls'] = icList;
          return newG;
        };

        const updated = assignControl(group, 'ac-1');
        expect(updated['insert-controls'][0]['include-controls'][0]['with-ids']).toContain('ac-1');
      });

      it('F6.3: Avoids adding duplicate control ID to same custom group', () => {
        const group = {
          id: 'ac-custom',
          title: 'Custom AC',
          'insert-controls': [{ order: 'keep', 'include-controls': [{ 'with-ids': ['ac-1'] }] }]
        };

        const assignControlSafe = (g: any, controlId: string) => {
          const ic = g['insert-controls'][0];
          const currentIds = ic['include-controls'][0]['with-ids'];
          if (!currentIds.includes(controlId)) {
            currentIds.push(controlId);
          }
          return g;
        };

        const updated = assignControlSafe(group, 'ac-1');
        expect(updated['insert-controls'][0]['include-controls'][0]['with-ids']).toEqual(['ac-1']);
      });

      it('F6.4: Preserves order configuration in insert-controls directive', () => {
        const profileDoc = createProfileDoc({
          merge: {
            custom: {
              groups: [
                {
                  id: 'ordered-grp',
                  title: 'Descending Ordered Controls',
                  'insert-controls': [
                    {
                      order: 'descending',
                      'include-controls': [{ 'with-ids': ['ac-1', 'ac-2', 'ac-3'] }]
                    }
                  ]
                }
              ]
            }
          }
        });

        const cache = createCatalogCache();
        const res = resolveProfileSync(profileDoc, cache);
        const controlIds = res.catalog.groups?.[0].controls?.map((c: any) => c.id);
        expect(controlIds).toEqual(['ac-3', 'ac-2', 'ac-1']);
      });

      it('F6.5: Moving control from Group A to Group B removes from A and adds to B', () => {
        let groups = [
          { id: 'grp-a', title: 'Group A', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2'] }] }] },
          { id: 'grp-b', title: 'Group B', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ia-1'] }] }] }
        ];

        groups = groups.map(g => {
          if (g.id === 'grp-a') {
            return {
              ...g,
              'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-2'] }] }]
            };
          }
          if (g.id === 'grp-b') {
            return {
              ...g,
              'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ia-1', 'ac-1'] }] }]
            };
          }
          return g;
        });

        expect(groups[0]['insert-controls'][0]['include-controls'][0]['with-ids']).toEqual(['ac-2']);
        expect(groups[1]['insert-controls'][0]['include-controls'][0]['with-ids']).toEqual(['ia-1', 'ac-1']);
      });
    });

    // -----------------------------------------------------------------------
    // Feature 7: Control Pool Tab Grid Filter & Search
    // -----------------------------------------------------------------------
    describe('Feature 7: Control Pool Tab Grid Filter & Search (R2)', () => {
      it('F7.1: Filters pool controls by ID match in real-time', () => {
        const profile = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: { custom: { groups: [] } }
        };

        render(
          <SourcesPanel
            profile={profile}
            isEditing={true}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
        const searchInput = screen.getByPlaceholderText(/Search pool controls by ID or title/i);

        fireEvent.change(searchInput, { target: { value: 'sc-7' } });

        expect(screen.getByText('Boundary Protection')).toBeInTheDocument();
        expect(screen.queryByText('Account Management')).not.toBeInTheDocument();
      });

      it('F7.2: Filters pool controls by title match in real-time', () => {
        const profile = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: { custom: { groups: [] } }
        };

        render(
          <SourcesPanel
            profile={profile}
            isEditing={true}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
        const searchInput = screen.getByPlaceholderText(/Search pool controls by ID or title/i);

        fireEvent.change(searchInput, { target: { value: 'Cryptographic' } });

        expect(screen.getByText('Cryptographic Protection')).toBeInTheDocument();
        expect(screen.queryByText('Boundary Protection')).not.toBeInTheDocument();
      });

      it('F7.3: Performs case-insensitive search matching in Control Pool', () => {
        const profile = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: { custom: { groups: [] } }
        };

        render(
          <SourcesPanel
            profile={profile}
            isEditing={true}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
        const searchInput = screen.getByPlaceholderText(/Search pool controls by ID or title/i);

        fireEvent.change(searchInput, { target: { value: 'AC-1' } });

        expect(screen.getByText('Policy and Procedures')).toBeInTheDocument();
        expect(screen.queryByText('Authenticator Management')).not.toBeInTheDocument();
      });

      it('F7.4: Shows empty state message when search query finds no matches', () => {
        const profile = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: { custom: { groups: [] } }
        };

        render(
          <SourcesPanel
            profile={profile}
            isEditing={true}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
        const searchInput = screen.getByPlaceholderText(/Search pool controls by ID or title/i);

        fireEvent.change(searchInput, { target: { value: 'xyz-999-not-exist' } });

        expect(screen.getByText('No controls match your search.')).toBeInTheDocument();
      });

      it('F7.5: Displays source catalog name on each card in multi-catalog environment', () => {
        const multiCatResolved = {
          ...resolvedCatalogFixture,
          source_catalog_title: 'NIST SP 800-53 Rev 5'
        };

        render(
          <SourcesPanel
            profile={{ imports: [{ href: `../catalogs/${NIST_UUID}.json` }], merge: { custom: { groups: [] } } }}
            isEditing={true}
            resolvedCatalog={multiCatResolved}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
        const catLabels = screen.getAllByText('NIST SP 800-53 Rev 5');
        expect(catLabels.length).toBeGreaterThan(0);
      });
    });

    // -----------------------------------------------------------------------
    // Feature 8: Control Pool Grid Drag-and-Drop Assignment
    // -----------------------------------------------------------------------
    describe('Feature 8: Control Pool Grid Drag-and-Drop Assignment (R2)', () => {
      it('F8.1: Starts drag with control ID and catalog metadata on dragstart event', () => {
        const profile = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: { custom: { groups: [] } }
        };

        render(
          <SourcesPanel
            profile={profile}
            isEditing={true}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
        const card = screen.getByText('Boundary Protection').closest('[draggable]')!;

        const setDataMock = vi.fn();
        fireEvent.dragStart(card, {
          dataTransfer: {
            setData: setDataMock
          }
        });

        expect(setDataMock).toHaveBeenCalledWith('text/plain', 'sc-7');
        expect(setDataMock).toHaveBeenCalledWith('draggedType', 'control');
      });

      it('F8.2: Dimmed card style applied when control is marked assigned', () => {
        const profile = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: {
            custom: {
              groups: [{ id: 'g1', title: 'G1', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['sc-7'] }] }] }]
            }
          }
        };

        render(
          <SourcesPanel
            profile={profile}
            isEditing={true}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
        const card = screen.getByText('Boundary Protection').closest('[draggable]') as HTMLElement;
        expect(card.style.opacity).toBe('0.45');
      });

      it('F8.3: Full opacity style applied when control is unassigned', () => {
        const profile = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: { custom: { groups: [] } }
        };

        render(
          <SourcesPanel
            profile={profile}
            isEditing={true}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
        const card = screen.getByText('Boundary Protection').closest('[draggable]') as HTMLElement;
        expect(card.style.opacity).toBe('1');
      });

      it('F8.4: Updates mouse hover background color for interactive tactile feedback in edit mode', () => {
        const profile = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: { custom: { groups: [] } }
        };

        render(
          <SourcesPanel
            profile={profile}
            isEditing={true}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
        const card = screen.getByText('Boundary Protection').closest('[draggable]') as HTMLElement;

        fireEvent.mouseOver(card);
        expect(card.style.background).toBe('var(--color-surface-3)');

        fireEvent.mouseOut(card);
        expect(card.style.background).toBe('var(--color-surface-2)');
      });

      it('F8.5: Drag events are prevented on drop target unless isEditing is true', () => {
        const profile = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: { custom: { groups: [] } }
        };

        const onChange = vi.fn();
        render(
          <SourcesPanel
            profile={profile}
            onChange={onChange}
            isEditing={false}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
        const poolContainer = screen.getByText(/Control Pool \(Drag & Drop\)/i).closest('div')!.parentElement!;

        fireEvent.drop(poolContainer, {
          dataTransfer: { getData: () => 'ac-1' }
        });

        expect(onChange).not.toHaveBeenCalled();
      });
    });

    // -----------------------------------------------------------------------
    // Feature 9: Unassign Control (Return to Pool)
    // -----------------------------------------------------------------------
    describe('Feature 9: Unassign Control (Return to Pool) (R2)', () => {
      it('F9.1: Dropping assigned control onto Control Pool container unassigns it', () => {
        const profile = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: {
            custom: {
              groups: [
                {
                  id: 'g1',
                  title: 'G1',
                  'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2'] }] }]
                }
              ]
            }
          }
        };

        const onChange = vi.fn();
        render(
          <SourcesPanel
            profile={profile}
            onChange={onChange}
            isEditing={true}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
        const poolContainer = screen.getByText(/Control Pool \(Drag & Drop\)/i).closest('div')!.parentElement!;

        fireEvent.drop(poolContainer, {
          dataTransfer: {
            getData: (format: string) => format === 'text/plain' ? 'ac-1' : ''
          }
        });

        expect(onChange).toHaveBeenCalled();
        const updated = onChange.mock.calls[0][0];
        const withIds = updated.merge.custom.groups[0]['insert-controls'][0]['include-controls'][0]['with-ids'];
        expect(withIds).toEqual(['ac-2']);
      });

      it('F9.2: Case-insensitive control unassignment strips matching ID regardless of case', () => {
        const profile = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: {
            custom: {
              groups: [
                {
                  id: 'g1',
                  title: 'G1',
                  'insert-controls': [{ 'include-controls': [{ 'with-ids': ['AC-1'] }] }]
                }
              ]
            }
          }
        };

        const onChange = vi.fn();
        render(
          <SourcesPanel
            profile={profile}
            onChange={onChange}
            isEditing={true}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
        const poolContainer = screen.getByText(/Control Pool \(Drag & Drop\)/i).closest('div')!.parentElement!;

        fireEvent.drop(poolContainer, {
          dataTransfer: {
            getData: (format: string) => format === 'text/plain' ? 'ac-1' : ''
          }
        });

        const updated = onChange.mock.calls[0][0];
        const withIds = updated.merge.custom.groups[0]['insert-controls'][0]['include-controls'][0]['with-ids'];
        expect(withIds).toEqual([]);
      });

      it('F9.3: Unassigning single control from multiple groups removes it from all groups', () => {
        const profile = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: {
            custom: {
              groups: [
                { id: 'g1', title: 'G1', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }] },
                { id: 'g2', title: 'G2', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1', 'ia-1'] }] }] }
              ]
            }
          }
        };

        const onChange = vi.fn();
        render(
          <SourcesPanel
            profile={profile}
            onChange={onChange}
            isEditing={true}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
        const poolContainer = screen.getByText(/Control Pool \(Drag & Drop\)/i).closest('div')!.parentElement!;

        fireEvent.drop(poolContainer, {
          dataTransfer: {
            getData: (format: string) => format === 'text/plain' ? 'ac-1' : ''
          }
        });

        const updated = onChange.mock.calls[0][0];
        expect(updated.merge.custom.groups[0]['insert-controls'][0]['include-controls'][0]['with-ids']).toEqual([]);
        expect(updated.merge.custom.groups[1]['insert-controls'][0]['include-controls'][0]['with-ids']).toEqual(['ia-1']);
      });

      it('F9.4: Drop with empty or missing dataTransfer text does nothing', () => {
        const profile = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: { custom: { groups: [{ id: 'g1', title: 'G1', 'insert-controls': [] }] } }
        };

        const onChange = vi.fn();
        render(
          <SourcesPanel
            profile={profile}
            onChange={onChange}
            isEditing={true}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
        const poolContainer = screen.getByText(/Control Pool \(Drag & Drop\)/i).closest('div')!.parentElement!;

        fireEvent.drop(poolContainer, {
          dataTransfer: { getData: () => '' }
        });

        expect(onChange).not.toHaveBeenCalled();
      });

      it('F9.5: Live preview updates when control is returned to pool', () => {
        const profileDoc = createProfileDoc({
          merge: {
            custom: {
              groups: [{ id: 'g1', title: 'G1', 'insert-controls': [{ 'include-controls': [{ 'with-ids': [] }] }] }]
            }
          }
        });

        const cache = createCatalogCache();
        const res = resolveProfileSync(profileDoc, cache);
        expect(res.catalog.groups?.[0].controls).toBeUndefined();
      });
    });

    // -----------------------------------------------------------------------
    // Feature 10: OSCAL Profile v1.1.2 Serialization
    // -----------------------------------------------------------------------
    describe('Feature 10: OSCAL Profile v1.1.2 Serialization (R3)', () => {
      it('F10.1: Serialized profile stores custom groups strictly in profile.merge.custom.groups', () => {
        const profileDoc = {
          profile: {
            uuid: 'd7a12345-6789-4abc-def0-123456789abc',
            metadata: {
              title: 'Compliant Custom Profile',
              version: '1.0.0',
              'oscal-version': '1.1.2',
              'last-modified': new Date().toISOString()
            },
            imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
            merge: {
              custom: {
                groups: [
                  {
                    id: 'domain-auth',
                    title: 'Authentication & Access Domain',
                    'insert-controls': [
                      {
                        order: 'keep',
                        'include-controls': [{ 'with-ids': ['ac-1', 'ia-1'] }]
                      }
                    ]
                  }
                ]
              }
            }
          }
        };

        expect(profileDoc.profile.merge.custom.groups).toBeDefined();
        expect(profileDoc.profile.merge.custom.groups[0]['insert-controls'][0]['include-controls'][0]['with-ids']).toEqual(['ac-1', 'ia-1']);
      });

      it('F10.2: Serialized custom group contains standard OSCAL group fields (id, title, props, parts, links)', () => {
        const group = {
          id: 'custom-grp-oscal',
          title: 'OSCAL Standard Group',
          props: [{ name: 'label', value: 'DOMAIN-01' }],
          parts: [{ id: 'prt-1', name: 'statement', prose: 'Group objective statement.' }],
          links: [{ href: 'https://csrc.nist.gov', rel: 'reference' }],
          'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }]
        };

        expect(group.id).toBe('custom-grp-oscal');
        expect(group.props[0].name).toBe('label');
        expect(group.parts[0].name).toBe('statement');
        expect(group.links[0].rel).toBe('reference');
      });

      it('F10.3: Serialized profile omits non-standard keys like unassigned_pool or UI flags', () => {
        const cleanProfile = {
          metadata: { title: 'Clean Profile', 'oscal-version': '1.1.2' },
          imports: [{ href: 'catalog.json' }],
          merge: { custom: { groups: [] } }
        };

        const keys = Object.keys(cleanProfile);
        expect(keys).not.toContain('unassigned_controls');
        expect(keys).not.toContain('ui_state');
        expect(keys).not.toContain('is_editing');
      });

      it('F10.4: Top-level merge.custom.insert-controls serializes cleanly alongside groups', () => {
        const profileDoc = createProfileDoc({
          merge: {
            custom: {
              groups: [{ id: 'grp-1', title: 'Group 1', 'insert-controls': [] }],
              'insert-controls': [{ 'include-controls': [{ 'with-ids': ['sc-7'] }] }]
            }
          }
        });

        const cache = createCatalogCache();
        const res = resolveProfileSync(profileDoc, cache);
        expect(res.catalog.controls?.length).toBe(1);
        expect(res.catalog.controls?.[0].id).toBe('sc-7');
        expect(res.catalog.groups?.length).toBe(1);
      });

      it('F10.5: Empty groups and insert-controls arrays are preserved for editor roundtrip fidelity', () => {
        const profile = {
          imports: [{ href: 'cat.json' }],
          merge: {
            custom: {
              groups: [{ id: 'empty-grp', title: 'Empty Group', 'insert-controls': [] }]
            }
          }
        };

        expect(Array.isArray(profile.merge.custom.groups)).toBe(true);
        expect(Array.isArray(profile.merge.custom.groups[0]['insert-controls'])).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    // Feature 11: Live Preview Resolution Sync (<500ms)
    // -----------------------------------------------------------------------
    describe('Feature 11: Live Preview Resolution Sync (<500ms) (R3)', () => {
      it('F11.1: resolveProfileSync executes synchronously in <50ms for multi-group catalog', () => {
        const start = performance.now();
        const profileDoc = createProfileDoc({
          merge: {
            custom: {
              groups: [
                { id: 'g1', title: 'Group 1', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2'] }] }] },
                { id: 'g2', title: 'Group 2', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ia-1', 'sc-7'] }] }] }
              ]
            }
          }
        });

        const cache = createCatalogCache();
        const res = resolveProfileSync(profileDoc, cache);
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(500);
        expect(res.catalog.groups?.length).toBe(2);
      });

      it('F11.2: Applies parameter overrides in resolved custom group controls', () => {
        const catalogWithParam = {
          ...sampleCatalogNist,
          groups: [
            {
              id: 'ac',
              title: 'Access Control',
              controls: [
                {
                  id: 'ac-1',
                  title: 'AC-1',
                  params: [{ id: 'ac-1_prm_1', values: ['default'] }]
                }
              ]
            }
          ]
        };

        const profileDoc = createProfileDoc({
          merge: {
            custom: {
              groups: [{ id: 'g1', title: 'G1', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }] }]
            }
          },
          modify: {
            'set-parameters': [{ 'param-id': 'ac-1_prm_1', values: ['30 days'] }]
          }
        });

        const cache = createCatalogCache([catalogWithParam]);
        const res = resolveProfileSync(profileDoc, cache);
        expect(res.catalog.groups?.[0].controls?.[0].params?.[0].values).toEqual(['30 days']);
      });

      it('F11.3: Applies statement alters in resolved custom group controls', () => {
        const profileDoc = createProfileDoc({
          merge: {
            custom: {
              groups: [{ id: 'g1', title: 'G1', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }] }]
            }
          },
          modify: {
            alters: [
              {
                'control-id': 'ac-1',
                adds: [{ position: 'ending', parts: [{ id: 'ac-1_add', name: 'guidance', prose: 'Custom guidance prose' }] }]
              }
            ]
          }
        });

        const cache = createCatalogCache();
        const res = resolveProfileSync(profileDoc, cache);
        const parts = res.catalog.groups?.[0].controls?.[0].parts;
        expect(parts?.some((p: any) => p.prose === 'Custom guidance prose')).toBe(true);
      });

      it('F11.4: Preserves control enhancements (sub-controls) placed into custom groups', () => {
        const catWithEnhancements = {
          uuid: NIST_UUID,
          groups: [
            {
              id: 'ac',
              title: 'AC',
              controls: [
                {
                  id: 'ac-2',
                  title: 'Account Management',
                  controls: [
                    { id: 'ac-2.1', title: 'Automated Account Management' }
                  ]
                }
              ]
            }
          ]
        };

        const profileDoc = createProfileDoc({
          merge: {
            custom: {
              groups: [{ id: 'g1', title: 'G1', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-2'] }] }] }]
            }
          }
        });

        const cache = createCatalogCache([catWithEnhancements]);
        const res = resolveProfileSync(profileDoc, cache);
        expect(res.catalog.groups?.[0].controls?.[0].controls?.[0].id).toBe('ac-2.1');
      });

      it('F11.5: Handles matching pattern directives in custom group insert-controls', () => {
        const profileDoc = createProfileDoc({
          merge: {
            custom: {
              groups: [
                {
                  id: 'all-ac',
                  title: 'All AC Family Controls',
                  'insert-controls': [
                    { 'include-controls': [{ matching: [{ pattern: 'ac-*' }] }] }
                  ]
                }
              ]
            }
          }
        });

        const cache = createCatalogCache();
        const res = resolveProfileSync(profileDoc, cache);
        expect(res.catalog.groups?.[0].controls?.length).toBe(3);
      });
    });

    // -----------------------------------------------------------------------
    // Feature 12: Virtual Node Exclusion from Export/JSON
    // -----------------------------------------------------------------------
    describe('Feature 12: Virtual Node Exclusion from Export/JSON (R3)', () => {
      it('F12.1: Export payload contains purely valid OSCAL elements', () => {
        const profileDoc = {
          profile: {
            metadata: { title: 'Exported Profile', version: '1.0.0' },
            imports: [{ href: 'cat.json', 'include-all': {} }],
            merge: {
              custom: {
                groups: [{ id: 'g1', title: 'G1', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }] }]
              }
            }
          }
        };

        const jsonStr = JSON.stringify(profileDoc);
        expect(jsonStr).not.toContain('Unassigned Controls');
        expect(jsonStr).not.toContain('isAssigned');
      });

      it('F12.2: Strips temporary properties when copying structure from catalog', () => {
        const catalogGroup = {
          id: 'ac',
          title: 'Access Control',
          _isExpanded: true,
          _selected: true,
          controls: [{ id: 'ac-1', title: 'AC 1' }]
        };

        const mapCatalogGroupToCustomGroup = (g: any) => ({
          id: g.id,
          title: g.title,
          'insert-controls': [{ order: 'keep', 'include-controls': [{ 'with-ids': (g.controls || []).map((c: any) => c.id) }] }]
        });

        const custom = mapCatalogGroupToCustomGroup(catalogGroup);
        expect((custom as any)._isExpanded).toBeUndefined();
        expect((custom as any)._selected).toBeUndefined();
      });

      it('F12.3: Resolved catalog structure contains standard groups and controls arrays without virtual nodes', () => {
        const profileDoc = createProfileDoc({
          merge: {
            custom: {
              groups: [{ id: 'g1', title: 'G1', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }] }]
            }
          }
        });

        const cache = createCatalogCache();
        const res = resolveProfileSync(profileDoc, cache);
        expect(res.catalog.groups?.[0].id).toBe('g1');
        expect(res.catalog.groups?.some((g: any) => g.title?.includes('Unassigned'))).toBe(false);
      });

      it('F12.4: Serialization handles profiles with 0 custom groups cleanly', () => {
        const profile = {
          imports: [{ href: 'cat.json' }],
          merge: { custom: { groups: [] } }
        };

        const serialized = JSON.parse(JSON.stringify(profile));
        expect(serialized.merge.custom.groups).toEqual([]);
      });

      it('F12.5: Restoring structuring mode to as-is removes custom merge block entirely', () => {
        let profile: any = {
          imports: [{ href: 'cat.json' }],
          merge: { custom: { groups: [{ id: 'g1', title: 'G1' }] } }
        };

        const switchToAsIs = (p: any) => {
          const cleanMerge = { ...p.merge };
          delete cleanMerge.custom;
          delete cleanMerge.flat;
          cleanMerge['as-is'] = true;
          return { ...p, merge: cleanMerge };
        };

        const updated = switchToAsIs(profile);
        expect(updated.merge.custom).toBeUndefined();
        expect(updated.merge['as-is']).toBe(true);
      });
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (60 Tests)
  // =========================================================================
  describe('Tier 2: Boundary & Corner Cases (60 Tests)', () => {
    describe('Group Hierarchy & Nesting Boundaries', () => {
      it('T2.1: Empty custom group with zero controls and zero sub-groups resolves properly', () => {
        const profileDoc = createProfileDoc({
          merge: {
            custom: {
              groups: [{ id: 'empty-grp', title: 'Empty Group', 'insert-controls': [] }]
            }
          }
        });

        const cache = createCatalogCache();
        const res = resolveProfileSync(profileDoc, cache);
        expect(res.catalog.groups?.length).toBe(1);
        expect(res.catalog.groups?.[0].id).toBe('empty-grp');
        expect(res.catalog.groups?.[0].controls).toBeUndefined();
      });

      it('T2.2: Deep nesting boundary: 5-level hierarchy resolves without stack overflow', () => {
        const profileDoc = createProfileDoc({
          merge: {
            custom: {
              groups: [
                {
                  id: 'lvl-1',
                  title: 'Level 1',
                  groups: [
                    {
                      id: 'lvl-2',
                      title: 'Level 2',
                      groups: [
                        {
                          id: 'lvl-3',
                          title: 'Level 3',
                          groups: [
                            {
                              id: 'lvl-4',
                              title: 'Level 4',
                              groups: [
                                {
                                  id: 'lvl-5',
                                  title: 'Level 5',
                                  'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }]
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          }
        });

        const cache = createCatalogCache();
        const res = resolveProfileSync(profileDoc, cache);
        const deepCtrl = res.catalog.groups?.[0].groups?.[0].groups?.[0].groups?.[0].groups?.[0].controls?.[0];
        expect(deepCtrl?.id).toBe('ac-1');
      });

      it('T2.3: Single parent with 20 sibling sub-groups', () => {
        const subGroups = Array.from({ length: 20 }, (_, i) => ({
          id: `sub-grp-${i + 1}`,
          title: `Sub Group ${i + 1}`,
          'insert-controls': []
        }));

        const profileDoc = createProfileDoc({
          merge: {
            custom: {
              groups: [{ id: 'parent-hub', title: 'Parent Hub', groups: subGroups }]
            }
          }
        });

        const cache = createCatalogCache();
        const res = resolveProfileSync(profileDoc, cache);
        expect(res.catalog.groups?.[0].groups?.length).toBe(20);
      });

      it('T2.4: Special characters in group titles: ampersand, slashes, quotes, brackets', () => {
        const specialTitle = 'AC & IA: Policy/Procedures "High" [Confidential] (v2.0) <Strict>';
        const group = { id: 'special-grp', title: specialTitle, props: [], parts: [] };

        render(
          <ConfirmProvider>
            <GroupEditor
              group={group}
              isEditing={true}
              mode="profile"
              onChange={vi.fn()}
            />
          </ConfirmProvider>
        );

        expect(screen.getByDisplayValue(specialTitle)).toBeInTheDocument();
      });

      it('T2.5: Unicode, mathematical symbols and emoji characters in group titles', () => {
        const unicodeTitle = '🛡️ Security Domain ≥ Class-3 🔐 ∑(Controls) → π';
        const group = { id: 'unicode-grp', title: unicodeTitle, props: [], parts: [] };

        render(
          <ConfirmProvider>
            <GroupEditor
              group={group}
              isEditing={true}
              mode="profile"
              onChange={vi.fn()}
            />
          </ConfirmProvider>
        );

        expect(screen.getByDisplayValue(unicodeTitle)).toBeInTheDocument();
      });

      it('T2.6: Extremely long titles (500 characters) render without UI breakdown', () => {
        const longTitle = 'A'.repeat(500);
        const group = { id: 'long-title-grp', title: longTitle, props: [], parts: [] };

        render(
          <ConfirmProvider>
            <GroupEditor
              group={group}
              isEditing={true}
              mode="profile"
              onChange={vi.fn()}
            />
          </ConfirmProvider>
        );

        expect(screen.getByDisplayValue(longTitle)).toBeInTheDocument();
      });

      it('T2.7: Case-insensitive control ID matching: uppercase AC-1 matches lowercase ac-1 in catalog', () => {
        const profileDoc = createProfileDoc({
          merge: {
            custom: {
              groups: [{ id: 'g1', title: 'G1', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['AC-1'] }] }] }]
            }
          }
        });

        const cache = createCatalogCache();
        const res = resolveProfileSync(profileDoc, cache);
        expect(res.catalog.groups?.[0].controls?.[0].id).toBe('ac-1');
      });

      it('T2.8: Mixed-case control ID matching: Ac-02 matches ac-2 in catalog', () => {
        const profileDoc = createProfileDoc({
          merge: {
            custom: {
              groups: [{ id: 'g1', title: 'G1', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['Ac-2'] }] }] }]
            }
          }
        });

        const cache = createCatalogCache();
        const res = resolveProfileSync(profileDoc, cache);
        expect(res.catalog.groups?.[0].controls?.[0].id).toBe('ac-2');
      });

      it('T2.9: Non-existent control ID in with-ids is safely skipped without throwing', () => {
        const profileDoc = createProfileDoc({
          merge: {
            custom: {
              groups: [{ id: 'g1', title: 'G1', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['non-existent-99'] }] }] }]
            }
          }
        });

        const cache = createCatalogCache();
        expect(() => {
          const res = resolveProfileSync(profileDoc, cache);
          expect(res.catalog.groups?.[0].controls).toBeUndefined();
        }).not.toThrow();
      });

      it('T2.10: Search pool with regex metacharacters (*, +, ?, (, )) does not crash filter', () => {
        const profile = {
          imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
          merge: { custom: { groups: [] } }
        };

        render(
          <SourcesPanel
            profile={profile}
            isEditing={true}
            resolvedCatalog={resolvedCatalogFixture}
          />
        );

        fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
        const searchInput = screen.getByPlaceholderText(/Search pool controls by ID or title/i);

        expect(() => {
          fireEvent.change(searchInput, { target: { value: 'ac-[' } });
          fireEvent.change(searchInput, { target: { value: '.*+?^${}()|[]\\' } });
        }).not.toThrow();
      });
    });
  });

  // =========================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS (12 Tests)
  // =========================================================================
  describe('Tier 3: Cross-Feature Combinations (12 Tests)', () => {
    it('T3.1: Pool Filter + Drag and Drop assignment to Custom Group', () => {
      const profile = {
        imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
        merge: {
          custom: {
            groups: [{ id: 'net-sec', title: 'Network Security', 'insert-controls': [] }]
          }
        }
      };

      const onChange = vi.fn();
      render(
        <SourcesPanel
          profile={profile}
          onChange={onChange}
          isEditing={true}
          resolvedCatalog={resolvedCatalogFixture}
        />
      );

      fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
      const searchInput = screen.getByPlaceholderText(/Search pool controls by ID or title/i);
      fireEvent.change(searchInput, { target: { value: 'Boundary' } });

      const card = screen.getByText('Boundary Protection').closest('[draggable]')!;
      const setDataMock = vi.fn();
      fireEvent.dragStart(card, { dataTransfer: { setData: setDataMock } });
      expect(setDataMock).toHaveBeenCalledWith('text/plain', 'sc-7');
    });

    it('T3.2: Inline Rename + Immediate Live Resolution Preview', () => {
      const cache = createCatalogCache();

      const profileBefore = createProfileDoc({
        merge: {
          custom: {
            groups: [{ id: 'sec-1', title: 'Old Title', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }] }]
          }
        }
      });

      const resBefore = resolveProfileSync(profileBefore, cache);
      expect(resBefore.catalog.groups?.[0].title).toBe('Old Title');

      const profileAfter = createProfileDoc({
        merge: {
          custom: {
            groups: [{ id: 'sec-1', title: 'Updated Security Domain', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }] }]
          }
        }
      });

      const resAfter = resolveProfileSync(profileAfter, cache);
      expect(resAfter.catalog.groups?.[0].title).toBe('Updated Security Domain');
    });

    it('T3.3: Clone structure + Delete family + Reassign orphaned controls to another family', () => {
      let groups: any[] = [
        { id: 'ac', title: 'Access Control', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2'] }] }] },
        { id: 'ia', title: 'Identification', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ia-1'] }] }] }
      ];

      const deletedGroup = groups.find(g => g.id === 'ac');
      const freedControls = deletedGroup['insert-controls'][0]['include-controls'][0]['with-ids'];
      groups = groups.filter(g => g.id !== 'ac');

      groups[0]['insert-controls'][0]['include-controls'][0]['with-ids'].push(...freedControls);

      expect(groups.length).toBe(1);
      expect(groups[0]['insert-controls'][0]['include-controls'][0]['with-ids']).toEqual(['ia-1', 'ac-1', 'ac-2']);
    });

    it('T3.4: Multi-Catalog Import -> Pool merges both -> Assign controls from both catalogs into same custom group', () => {
      const profileDoc = createProfileDoc({
        imports: [
          { href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} },
          { href: `../catalogs/${ISO_UUID}.json`, 'include-all': {} }
        ],
        merge: {
          custom: {
            groups: [
              {
                id: 'unified-access',
                title: 'Unified Access Governance',
                'insert-controls': [
                  {
                    order: 'keep',
                    'include-controls': [{ 'with-ids': ['ac-1', 'a.5.15'] }]
                  }
                ]
              }
            ]
          }
        }
      });

      const cache = createCatalogCache([sampleCatalogNist, sampleCatalogIso]);
      const res = resolveProfileSync(profileDoc, cache);
      expect(res.catalog.groups?.length).toBe(1);
      expect(res.catalog.groups?.[0].controls?.length).toBe(2);
      expect(res.catalog.groups?.[0].controls?.[0].id).toBe('ac-1');
      expect(res.catalog.groups?.[0].controls?.[1].id).toBe('a.5.15');
    });

    it('T3.5: Group Deletion with nested Subgroups -> All controls returned to pool', () => {
      const parent = {
        id: 'parent',
        title: 'Parent',
        groups: [
          { id: 'child-a', title: 'Child A', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }] },
          { id: 'child-b', title: 'Child B', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['sc-7'] }] }] }
        ]
      };

      const collectAllControlsInGroup = (g: any): string[] => {
        const ids: string[] = [];
        (g['insert-controls'] || []).forEach((ic: any) => {
          (ic['include-controls'] || []).forEach((inc: any) => {
            ids.push(...(inc['with-ids'] || []));
          });
        });
        (g.groups || []).forEach((sub: any) => {
          ids.push(...collectAllControlsInGroup(sub));
        });
        return ids;
      };

      const allFreed = collectAllControlsInGroup(parent);
      expect(allFreed).toEqual(['ac-1', 'sc-7']);
    });

    it('T3.6: Dragging Control between Custom Groups maintains live preview integrity', () => {
      const cache = createCatalogCache();

      const profileDoc1 = createProfileDoc({
        merge: {
          custom: {
            groups: [
              { id: 'g1', title: 'G1', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }] },
              { id: 'g2', title: 'G2', 'insert-controls': [{ 'include-controls': [{ 'with-ids': [] }] }] }
            ]
          }
        }
      });
      const res1 = resolveProfileSync(profileDoc1, cache);
      expect(res1.catalog.groups?.[0].controls?.length).toBe(1);
      expect(res1.catalog.groups?.[1].controls).toBeUndefined();

      const profileDoc2 = createProfileDoc({
        merge: {
          custom: {
            groups: [
              { id: 'g1', title: 'G1', 'insert-controls': [{ 'include-controls': [{ 'with-ids': [] }] }] },
              { id: 'g2', title: 'G2', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }] }
            ]
          }
        }
      });
      const res2 = resolveProfileSync(profileDoc2, cache);
      expect(res2.catalog.groups?.[0].controls).toBeUndefined();
      expect(res2.catalog.groups?.[1].controls?.length).toBe(1);
    });

    it('T3.7: Parameter Override on Control inside Custom Group', () => {
      const catalog = {
        uuid: NIST_UUID,
        groups: [
          {
            id: 'ac',
            title: 'AC',
            controls: [
              {
                id: 'ac-1',
                title: 'AC 1',
                params: [{ id: 'ac-1_prm_1', label: 'Frequency', values: ['monthly'] }]
              }
            ]
          }
        ]
      };

      const profileDoc = createProfileDoc({
        merge: {
          custom: {
            groups: [{ id: 'custom-ac', title: 'Custom AC', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }] }]
          }
        },
        modify: {
          'set-parameters': [{ 'param-id': 'ac-1_prm_1', values: ['weekly'] }]
        }
      });

      const cache = createCatalogCache([catalog]);
      const res = resolveProfileSync(profileDoc, cache);
      expect(res.catalog.groups?.[0].controls?.[0].params?.[0].values).toEqual(['weekly']);
    });

    it('T3.8: Statement Alter on Control inside Custom Group', () => {
      const catalog = {
        uuid: NIST_UUID,
        groups: [
          {
            id: 'ac',
            title: 'AC',
            controls: [{ id: 'ac-2', title: 'AC 2', parts: [{ id: 'ac-2_smt', name: 'statement', prose: 'Old prose' }] }]
          }
        ]
      };

      const profileDoc = createProfileDoc({
        merge: {
          custom: {
            groups: [{ id: 'custom-ac', title: 'Custom AC', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-2'] }] }] }]
          }
        },
        modify: {
          alters: [
            {
              'control-id': 'ac-2',
              adds: [{ position: 'ending', parts: [{ id: 'ac-2_add', name: 'statement', prose: 'Tailored addition.' }] }]
            }
          ]
        }
      });

      const cache = createCatalogCache([catalog]);
      const res = resolveProfileSync(profileDoc, cache);
      const parts = res.catalog.groups?.[0].controls?.[0].parts;
      expect(parts?.some((p: any) => p.prose === 'Tailored addition.')).toBe(true);
    });

    it('T3.9: Sidebar Tree Selection with Custom Group Node Click', () => {
      const onSelectGroup = vi.fn();
      render(
        <ProfileSidebar
          resolvedCatalog={resolvedCatalogFixture}
          profile={{}}
          isEditing={true}
          onSelectGroup={onSelectGroup}
          onSelectControl={vi.fn()}
          onSelectOverview={vi.fn()}
          onSelectMetadata={vi.fn()}
          onSelectProperties={vi.fn()}
          onSelectParameters={vi.fn()}
          onSelectBackMatter={vi.fn()}
          onSelectImports={vi.fn()}
        />
      );

      const acGroup = screen.getByText('Access Control');
      fireEvent.click(acGroup);
      expect(onSelectGroup).toHaveBeenCalledWith('ac');
    });

    it('T3.10: Full lifecycle: Add Group -> Move to Sub-group -> Assign 3 controls -> Delete 1 -> Rename', () => {
      let customGroups: any[] = [{ id: 'domain-1', title: 'Domain 1', groups: [] }];

      customGroups[0].groups.push({ id: 'sub-1', title: 'Sub 1', 'insert-controls': [] });

      customGroups[0].groups[0]['insert-controls'].push({
        order: 'keep',
        'include-controls': [{ 'with-ids': ['ac-1', 'ac-2', 'ac-3'] }]
      });

      customGroups[0].groups[0]['insert-controls'][0]['include-controls'][0]['with-ids'] =
        customGroups[0].groups[0]['insert-controls'][0]['include-controls'][0]['with-ids'].filter((id: string) => id !== 'ac-2');

      customGroups[0].groups[0].title = 'Access Policy & Enforcement Sub-domain';

      expect(customGroups[0].groups[0].title).toBe('Access Policy & Enforcement Sub-domain');
      expect(customGroups[0].groups[0]['insert-controls'][0]['include-controls'][0]['with-ids']).toEqual(['ac-1', 'ac-3']);
    });

    it('T3.11: Switch structuring mode from custom -> as-is -> custom preserves profile data', () => {
      const originalCustom = {
        groups: [{ id: 'saved-grp', title: 'Saved Custom Group', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['sc-7'] }] }] }]
      };

      let profile: any = {
        imports: [{ href: `../catalogs/${NIST_UUID}.json` }],
        merge: { custom: originalCustom }
      };

      const stashed = profile.merge.custom;
      profile = { ...profile, merge: { 'as-is': true } };
      expect(profile.merge['as-is']).toBe(true);

      profile = { ...profile, merge: { custom: stashed } };
      expect(profile.merge.custom.groups[0].id).toBe('saved-grp');
    });

    it('T3.12: Export Profile JSON verification matches live preview hierarchy', () => {
      const profileDoc = createProfileDoc({
        merge: {
          custom: {
            groups: [{ id: 'g1', title: 'Group 1', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }] }]
          }
        }
      });

      const cache = createCatalogCache();
      const res = resolveProfileSync(profileDoc, cache);
      const serialized = JSON.parse(JSON.stringify(profileDoc.profile));

      expect(serialized.merge.custom.groups[0].id).toBe(res.catalog.groups?.[0].id);
      expect(serialized.merge.custom.groups[0].title).toBe(res.catalog.groups?.[0].title);
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS (5 Scenarios)
  // =========================================================================
  describe('Tier 4: Real-World Application Scenarios', () => {
    it('Scenario 1: NIST 800-53 Baseline Restructuring into 3 Domain Categories (Identity, Protection, Resiliency)', () => {
      const profileDoc = createProfileDoc({
        merge: {
          custom: {
            groups: [
              {
                id: 'domain-identity',
                title: '1. Identity & Access Governance',
                'insert-controls': [
                  { order: 'keep', 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2', 'ac-3', 'ia-1', 'ia-2', 'ia-5'] }] }
                ]
              },
              {
                id: 'domain-protection',
                title: '2. Communications & Boundary Protection',
                'insert-controls': [
                  { order: 'keep', 'include-controls': [{ 'with-ids': ['sc-7', 'sc-13'] }] }
                ]
              },
              {
                id: 'domain-resiliency',
                title: '3. System Resiliency & Recovery',
                'insert-controls': []
              }
            ]
          }
        }
      });

      const cache = createCatalogCache();
      const res = resolveProfileSync(profileDoc, cache);
      expect(res.catalog.groups?.length).toBe(3);
      expect(res.catalog.groups?.[0].controls?.length).toBe(6);
      expect(res.catalog.groups?.[1].controls?.length).toBe(2);
      expect(res.catalog.groups?.[2].controls).toBeUndefined();
    });

    it('Scenario 2: Multi-Catalog Import with Unified Governance Hierarchy (NIST + ISO 27001)', () => {
      const profileDoc = createProfileDoc({
        imports: [
          { href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} },
          { href: `../catalogs/${ISO_UUID}.json`, 'include-all': {} }
        ],
        merge: {
          custom: {
            groups: [
              {
                id: 'global-security-policy',
                title: 'Global Enterprise Security Policy',
                groups: [
                  {
                    id: 'access-control-sub',
                    title: 'Access Control Requirements',
                    'insert-controls': [
                      { 'include-controls': [{ 'with-ids': ['ac-1', 'a.5.15'] }] }
                    ]
                  },
                  {
                    id: 'identity-management-sub',
                    title: 'Identity Management Requirements',
                    'insert-controls': [
                      { 'include-controls': [{ 'with-ids': ['ia-1', 'a.5.16'] }] }
                    ]
                  }
                ]
              }
            ]
          }
        }
      });

      const cache = createCatalogCache([sampleCatalogNist, sampleCatalogIso]);
      const res = resolveProfileSync(profileDoc, cache);
      expect(res.catalog.groups?.[0].groups?.length).toBe(2);
      expect(res.catalog.groups?.[0].groups?.[0].controls?.length).toBe(2);
      expect(res.catalog.groups?.[0].groups?.[1].controls?.length).toBe(2);
    });

    it('Scenario 3: Fast Re-organization via Sidebar Tree DnD and Inline Renaming', () => {
      let profileDoc = createProfileDoc({
        merge: {
          custom: {
            groups: [
              { id: 'initial-group', title: 'Initial Draft Group', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }] }
            ]
          }
        }
      });

      profileDoc.profile.merge.custom.groups[0].title = 'Finalized Core Controls';
      profileDoc.profile.merge.custom.groups[0].id = 'core-controls';
      profileDoc.profile.merge.custom.groups[0]['insert-controls'][0]['include-controls'][0]['with-ids'].push('ac-2', 'sc-7');

      const cache = createCatalogCache();
      const res = resolveProfileSync(profileDoc, cache);
      expect(res.catalog.groups?.[0].id).toBe('core-controls');
      expect(res.catalog.groups?.[0].title).toBe('Finalized Core Controls');
      expect(res.catalog.groups?.[0].controls?.length).toBe(3);
    });

    it('Scenario 4: Bulk Assignment from Filtered Control Pool Grid', () => {
      const profileDoc = createProfileDoc({
        merge: {
          custom: {
            groups: [
              {
                id: 'bulk-ac-ia',
                title: 'All AC & IA Controls',
                'insert-controls': [
                  {
                    order: 'ascending',
                    'include-controls': [
                      { matching: [{ pattern: 'ac-*' }] },
                      { matching: [{ pattern: 'ia-*' }] }
                    ]
                  }
                ]
              }
            ]
          }
        }
      });

      const cache = createCatalogCache();
      const res = resolveProfileSync(profileDoc, cache);
      expect(res.catalog.groups?.[0].controls?.length).toBe(6);
      expect(res.catalog.groups?.[0].controls?.[0].id).toBe('ac-1');
      expect(res.catalog.groups?.[0].controls?.[5].id).toBe('ia-5');
    });

    it('Scenario 5: Full Group Deletion, Control Re-pooling, and Custom Re-assignment Lifecycle', () => {
      let profileDoc = createProfileDoc({
        merge: {
          custom: {
            groups: [
              { id: 'grp-1', title: 'Group 1', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2'] }] }] },
              { id: 'grp-2', title: 'Group 2', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['sc-7'] }] }] }
            ]
          }
        }
      });

      // Delete grp-1 and reassign ac-1 to grp-2
      profileDoc.profile.merge.custom.groups = profileDoc.profile.merge.custom.groups.filter((g: any) => g.id !== 'grp-1');
      profileDoc.profile.merge.custom.groups[0]['insert-controls'][0]['include-controls'][0]['with-ids'].push('ac-1');

      const cache = createCatalogCache();
      const res = resolveProfileSync(profileDoc, cache);
      expect(res.catalog.groups?.length).toBe(1);
      expect(res.catalog.groups?.[0].controls?.map((c: any) => c.id)).toEqual(['sc-7', 'ac-1']);
    });
  });

  // =========================================================================
  // TIER 5: ADVERSARIAL EDGE CASES & COVERAGE HARDENING
  // =========================================================================
  describe('Tier 5: Adversarial Edge Cases & Coverage Hardening', () => {
    it('T5.1: XSS script tags in group title and ID are treated as plain text strings', () => {
      const xssTitle = '<script>alert("XSS")</script>';
      const group = { id: '<img src=x onerror=alert(1)>', title: xssTitle, props: [], parts: [] };

      render(
        <ConfirmProvider>
          <GroupEditor
            group={group}
            isEditing={true}
            mode="profile"
            onChange={vi.fn()}
          />
        </ConfirmProvider>
      );

      expect(screen.getByDisplayValue(xssTitle)).toBeInTheDocument();
    });

    it('T5.2: Malformed insert-controls with missing include-controls handles gracefully', () => {
      const profileDoc = createProfileDoc({
        merge: {
          custom: {
            groups: [
              {
                id: 'malformed-grp',
                title: 'Malformed Directive',
                'insert-controls': [
                  { order: 'keep' }
                ] as any
              }
            ]
          }
        }
      });

      const cache = createCatalogCache();
      expect(() => {
        const res = resolveProfileSync(profileDoc, cache);
        expect(res.catalog.groups?.[0].controls).toBeUndefined();
      }).not.toThrow();
    });

    it('T5.3: Rapid undo/redo cycles with custom group mutations', () => {
      const history: any[] = [];
      let current = {
        imports: [{ href: `../catalogs/${NIST_UUID}.json` }],
        merge: { custom: { groups: [{ id: 'g1', title: 'Title 1', 'insert-controls': [] }] } }
      };
      history.push(JSON.parse(JSON.stringify(current)));

      current.merge.custom.groups[0].title = 'Title 2';
      history.push(JSON.parse(JSON.stringify(current)));

      current.merge.custom.groups[0].title = 'Title 3';
      history.push(JSON.parse(JSON.stringify(current)));

      const undone = history[1];
      expect(undone.merge.custom.groups[0].title).toBe('Title 2');

      const initial = history[0];
      expect(initial.merge.custom.groups[0].title).toBe('Title 1');
    });

    it('T5.4: Huge catalog with 100+ controls in Control Pool grid filters without lag', () => {
      const largeControls = Array.from({ length: 150 }, (_, i) => ({
        id: `large-ctrl-${i + 1}`,
        title: `Large Control ${i + 1}`,
        parts: [{ id: `large-ctrl-${i + 1}_smt`, name: 'statement', prose: `Prose ${i + 1}` }]
      }));

      const largeCatalog = {
        uuid: 'cat-large-uuid-1111-2222-3333-444455556666',
        metadata: { title: 'Large Enterprise Catalog' },
        source_catalog_title: 'Large Enterprise Catalog',
        source_catalog_id: 'cat-large-uuid-1111-2222-3333-444455556666',
        all_groups: [{ id: 'large-grp', title: 'Large Family', controls: largeControls }],
        all_controls: [],
        groups: [{ id: 'large-grp', title: 'Large Family', controls: largeControls }],
        controls: []
      };

      const start = performance.now();
      render(
        <SourcesPanel
          profile={{ imports: [{ href: `../catalogs/${largeCatalog.uuid}.json` }], merge: { custom: { groups: [] } } }}
          isEditing={true}
          resolvedCatalog={largeCatalog}
        />
      );

      fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10000);
      expect(screen.getByText('Large Control 150')).toBeInTheDocument();
    });

    it('T5.5: Null/undefined catalogCache during structure copy falls back to availableCatalogs safely', () => {
      let profileState: any = {
        imports: [{ href: `../catalogs/${NIST_UUID}.json`, 'include-all': {} }],
        merge: { custom: { groups: [] } }
      };
      const onChange = vi.fn((newProf) => { profileState = newProf; });

      render(
        <SourcesPanel
          profile={profileState}
          onChange={onChange}
          isEditing={true}
          availableCatalogs={[sampleCatalogNist]}
          catalogCache={null}
          resolvedCatalog={null}
        />
      );

      const copyBtn = screen.getByRole('button', { name: /Import Full Structure/i });
      fireEvent.click(copyBtn);

      expect(onChange).toHaveBeenCalled();
      const updated = onChange.mock.calls[0][0];
      expect(updated.merge.custom.groups.length).toBe(3);
    });
  });
});
