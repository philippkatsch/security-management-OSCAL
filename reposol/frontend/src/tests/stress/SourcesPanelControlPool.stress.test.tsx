import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SourcesPanel } from '@components/profile/SourcesPanel';
import {
  applyAssignControlToCustomGroup,
  applyRemoveControlFromCustomGroup,
  gatherAllAssignedControlIds,
  removeControlFromAllCustomGroups
} from '@lib/document-actions/profile-actions';

describe('Adversarial Stress Suite: SourcesPanel Control Pool & DnD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to generate large catalogs
  const generateLargeCatalog = (count = 150, prefix = 'ctrl', catalogId = 'cat-large', catalogTitle = 'Large Test Catalog') => {
    const controls = [];
    for (let i = 1; i <= count; i++) {
      controls.push({
        id: `${prefix}-${i}`,
        title: `Control Description for ${prefix.toUpperCase()}-${i} with special terms: [tag-${i % 5}] alpha-beta-${i}`,
        isGroup: false,
        catalogId: catalogId,
        catalogTitle: catalogTitle
      });
    }
    return {
      source_catalog_id: catalogId,
      source_catalog_title: catalogTitle,
      all_controls: controls,
      all_groups: [],
      groups: [],
      controls: []
    };
  };

  // Helper to generate multi-tier nested custom groups
  const generateNestedCustomGroups = (depth = 3, breadth = 2) => {
    let idCounter = 1;
    const buildSubgroups = (currentDepth: number): any[] => {
      if (currentDepth > depth) return [];
      const result = [];
      for (let b = 1; b <= breadth; b++) {
        const gid = `cg-d${currentDepth}-b${b}-${idCounter++}`;
        result.push({
          id: gid,
          title: `Custom Group Level ${currentDepth} Item ${b} (${gid})`,
          'insert-controls': [
            {
              order: 'keep',
              'include-controls': [
                {
                  'with-ids': []
                }
              ]
            }
          ],
          groups: buildSubgroups(currentDepth + 1)
        });
      }
      return result;
    };

    return buildSubgroups(1);
  };

  // --------------------------------------------------------------------------
  // Area 1: Large Control Pools (100+ controls) & Rapid Filtering Stress
  // --------------------------------------------------------------------------
  describe('Area 1: Large Control Pools (100+ controls) & Rapid Filtering', () => {
    it('handles 150+ controls with rapid search query typing and regex special characters', () => {
      const largeCatalog = generateLargeCatalog(150, 'nist', 'cat-nist', 'NIST 800-53 Rev 5');
      const profile = {
        imports: [{ href: 'catalogs/nist.json' }],
        merge: {
          custom: {
            groups: [
              {
                id: 'cg-1',
                title: 'Group 1',
                'insert-controls': [{ 'include-controls': [{ 'with-ids': ['nist-1', 'nist-2'] }] }]
              }
            ]
          }
        }
      };

      const start = performance.now();
      render(
        <SourcesPanel
          profile={profile}
          resolvedCatalog={largeCatalog}
          isEditing={true}
          onChange={vi.fn()}
        />
      );

      // Switch to Control Pool tab
      fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
      const renderDuration = performance.now() - start;

      const searchInput = screen.getByTestId('pool-search-input');
      const statsStrip = screen.getByTestId('pool-stats-strip');

      // Verify initial stats
      expect(statsStrip).toHaveTextContent('Total: 150');
      expect(statsStrip).toHaveTextContent('Assigned: 2');
      expect(statsStrip).toHaveTextContent('Unassigned: 148');

      // Rapid adversarial search queries
      const queries = [
        'nist-10',                   // exact partial prefix
        'alpha-beta-149',            // deep title match
        'TAG-4',                     // case-insensitive query
        '[tag-2]',                   // regex brackets in query
        '(organizational)',          // regex parenthesis
        'nist-.*+?^${}()|[]\\',      // adversarial regex metachars
        '   nist-50   ',             // surrounding whitespace
        'non-existent-xyz-99999',    // zero-match query
        ''                           // clear
      ];

      for (const q of queries) {
        fireEvent.change(searchInput, { target: { value: q } });
      }

      // Check final state after clearing
      expect(statsStrip).toHaveTextContent('Total: 150');
      expect(screen.getByTestId('pool-control-card-nist-1')).toBeInTheDocument();
      expect(screen.getByTestId('pool-control-card-nist-150')).toBeInTheDocument();
    }, 15000);

    it('documents empirical flaw: multi-catalog import controls lose their distinct catalogId due to hardcoded root catalog assignment', () => {
      // Catalog 1: NIST SP 800-53
      const cat1Controls = [
        { id: 'ac-1', title: 'Access Control', catalogId: 'cat-nist', catalogTitle: 'NIST SP 800-53' },
        { id: 'ac-2', title: 'Account Management', catalogId: 'cat-nist', catalogTitle: 'NIST SP 800-53' }
      ];
      // Catalog 2: ISO/IEC 27001
      const cat2Controls = [
        { id: 'a.5.1', title: 'Policies for info sec', catalogId: 'cat-iso', catalogTitle: 'ISO/IEC 27001' },
        { id: 'a.5.2', title: 'Information security roles', catalogId: 'cat-iso', catalogTitle: 'ISO/IEC 27001' }
      ];

      const multiCatResolved = {
        source_catalog_id: 'cat-unified-root',
        source_catalog_title: 'Unified Root Catalog',
        all_controls: [...cat1Controls, ...cat2Controls],
        all_groups: [],
        groups: [],
        controls: []
      };

      const profile = {
        imports: [{ href: 'nist.json' }, { href: 'iso.json' }],
        merge: {
          custom: {
            groups: [{ id: 'cg-1', title: 'Group 1', 'insert-controls': [{ 'include-controls': [{ 'with-ids': [] }] }] }]
          }
        }
      };

      render(
        <SourcesPanel
          profile={profile}
          resolvedCatalog={multiCatResolved}
          isEditing={true}
          onChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTestId('control-pool-tab-btn'));

      // Due to SourcesPanel line 234: `catalogId: catId` (where catId is resolvedCatalog.source_catalog_id),
      // all controls get catalogId="cat-unified-root" rather than their respective source catalogId.
      const catalogFilter = screen.queryByTestId('pool-catalog-filter');
      expect(catalogFilter).toBeInTheDocument();
    });

    it('correctly handles empty or degenerate control list without throwing errors', () => {
      const emptyResolved = {
        all_controls: [],
        all_groups: [],
        groups: [],
        controls: []
      };

      const profile = {
        imports: [{ href: 'empty.json' }],
        merge: { custom: { groups: [] } }
      };

      render(
        <SourcesPanel
          profile={profile}
          resolvedCatalog={emptyResolved}
          isEditing={true}
          onChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
      expect(screen.getByText(/No controls found in the imported sources/i)).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Area 2: Cross-Surface Drag-and-Drop with Malformed & Incomplete Payloads
  // --------------------------------------------------------------------------
  describe('Area 2: Cross-Surface Drag-and-Drop with Malformed & Incomplete Payloads', () => {
    it('gracefully handles malformed JSON and corrupted payloads on pool drop', () => {
      const mockOnChange = vi.fn();
      const profile = {
        imports: [{ href: 'nist.json' }],
        merge: {
          custom: {
            groups: [
              {
                id: 'cg-1',
                title: 'Group 1',
                'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2'] }] }]
              }
            ]
          }
        }
      };

      const resolvedCatalog = {
        source_catalog_id: 'cat-1',
        all_controls: [{ id: 'ac-1', title: 'AC 1' }, { id: 'ac-2', title: 'AC 2' }]
      };

      render(
        <SourcesPanel
          profile={profile}
          resolvedCatalog={resolvedCatalog}
          isEditing={true}
          onChange={mockOnChange}
        />
      );

      fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
      const workbench = document.querySelector('.control-pool-workbench')!;
      expect(workbench).toBeInTheDocument();

      // Test 1: Invalid JSON syntax in application/x-oscal-control with valid text/plain fallback
      const mockDataTransfer1 = {
        getData: (type: string) => {
          if (type === 'application/x-oscal-control') return '{ bad json: true';
          if (type === 'text/plain') return 'ac-1';
          return '';
        },
        types: ['application/x-oscal-control', 'text/plain']
      };

      fireEvent.drop(workbench, { dataTransfer: mockDataTransfer1 });
      expect(mockOnChange).toHaveBeenCalledTimes(1);
      let updatedProfile = mockOnChange.mock.calls[0][0];
      let withIds = updatedProfile.merge.custom.groups[0]['insert-controls'][0]['include-controls'][0]['with-ids'];
      expect(withIds).not.toContain('ac-1');
      expect(withIds).toContain('ac-2');

      // Test 2: Incomplete JSON (no id property)
      mockOnChange.mockClear();
      const mockDataTransfer2 = {
        getData: (type: string) => {
          if (type === 'application/x-oscal-control') return JSON.stringify({ title: 'Just a title' });
          if (type === 'text/plain') return '';
          return '';
        },
        types: ['application/x-oscal-control']
      };

      fireEvent.drop(workbench, { dataTransfer: mockDataTransfer2 });
      expect(mockOnChange).not.toHaveBeenCalled();

      // Test 3: Null JSON string ("null")
      mockOnChange.mockClear();
      const mockDataTransferNull = {
        getData: (type: string) => {
          if (type === 'application/x-oscal-control') return 'null';
          if (type === 'text/plain') return '';
          return '';
        },
        types: ['application/x-oscal-control']
      };

      expect(() => {
        fireEvent.drop(workbench, { dataTransfer: mockDataTransferNull });
      }).not.toThrow();

      // Test 4: Completely empty dataTransfer
      mockOnChange.mockClear();
      const mockDataTransferEmpty = {
        getData: () => '',
        types: []
      };

      expect(() => {
        fireEvent.drop(workbench, { dataTransfer: mockDataTransferEmpty });
      }).not.toThrow();
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('identifies vulnerability: dropping non-string control ID payload causes TypeError in downstream action', () => {
      const profile = {
        imports: [{ href: 'nist.json' }],
        merge: {
          custom: {
            groups: [
              {
                id: 'cg-1',
                title: 'Group 1',
                'insert-controls': [{ 'include-controls': [{ 'with-ids': ['123'] }] }]
              }
            ]
          }
        }
      };

      // When controlId is passed as number 123 instead of string '123':
      expect(() => {
        removeControlFromAllCustomGroups(profile.merge.custom, 123 as any);
      }).toThrow(TypeError);
    });

    it('ignores drag-and-drop events when isEditing is false (read-only enforcement)', () => {
      const mockOnChange = vi.fn();
      const profile = {
        imports: [{ href: 'nist.json' }],
        merge: {
          custom: {
            groups: [{ id: 'cg-1', title: 'Group 1', 'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }] }]
          }
        }
      };

      const resolvedCatalog = {
        all_controls: [{ id: 'ac-1', title: 'AC 1' }]
      };

      render(
        <SourcesPanel
          profile={profile}
          resolvedCatalog={resolvedCatalog}
          isEditing={false}
          onChange={mockOnChange}
        />
      );

      fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
      const workbench = document.querySelector('.control-pool-workbench')!;

      const mockDataTransfer = {
        getData: (type: string) => (type === 'text/plain' ? 'ac-1' : ''),
        types: ['text/plain']
      };

      fireEvent.dragOver(workbench, { dataTransfer: mockDataTransfer });
      expect(screen.queryByTestId('pool-dropzone-indicator')).not.toBeInTheDocument();

      fireEvent.drop(workbench, { dataTransfer: mockDataTransfer });
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Area 3: Dropping Multiple Controls onto Pool Dropzone
  // --------------------------------------------------------------------------
  describe('Area 3: Dropping Multiple Controls onto Pool Dropzone & Batch Drops', () => {
    it('handles multiple successive drop events without mutating original profile or state corruption', () => {
      let currentProfile = {
        imports: [{ href: 'nist.json' }],
        merge: {
          custom: {
            groups: [
              {
                id: 'cg-group-a',
                title: 'Group A',
                'insert-controls': [
                  {
                    'include-controls': [
                      { 'with-ids': ['ctrl-1', 'ctrl-2', 'ctrl-3', 'ctrl-4', 'ctrl-5'] }
                    ]
                  }
                ]
              }
            ]
          }
        }
      };

      const onChangeSpy = vi.fn().mockImplementation((updated) => {
        currentProfile = updated;
      });

      const resolvedCatalog = {
        all_controls: [
          { id: 'ctrl-1', title: 'Control 1' },
          { id: 'ctrl-2', title: 'Control 2' },
          { id: 'ctrl-3', title: 'Control 3' },
          { id: 'ctrl-4', title: 'Control 4' },
          { id: 'ctrl-5', title: 'Control 5' }
        ]
      };

      const { rerender } = render(
        <SourcesPanel
          profile={currentProfile}
          resolvedCatalog={resolvedCatalog}
          isEditing={true}
          onChange={onChangeSpy}
        />
      );

      fireEvent.click(screen.getByTestId('control-pool-tab-btn'));

      // Perform 5 drops in rapid succession simulating unassigning ctrl-1 through ctrl-5
      for (let i = 1; i <= 5; i++) {
        const workbench = document.querySelector('.control-pool-workbench')!;
        const dt = {
          getData: (type: string) => {
            if (type === 'application/x-oscal-control') return JSON.stringify({ id: `ctrl-${i}` });
            return `ctrl-${i}`;
          },
          types: ['application/x-oscal-control', 'text/plain']
        };

        fireEvent.drop(workbench, { dataTransfer: dt });

        // Rerender with latest profile state
        rerender(
          <SourcesPanel
            profile={currentProfile}
            resolvedCatalog={resolvedCatalog}
            isEditing={true}
            onChange={onChangeSpy}
          />
        );
      }

      expect(onChangeSpy).toHaveBeenCalledTimes(5);
      const finalWithIds = currentProfile.merge.custom.groups[0]['insert-controls'][0]['include-controls'][0]['with-ids'];
      expect(finalWithIds).toEqual([]);
    });

    it('documents limitation: dropping multiple controls in an array or comma-separated string drops nothing', () => {
      const mockOnChange = vi.fn();
      const profile = {
        imports: [{ href: 'nist.json' }],
        merge: {
          custom: {
            groups: [
              {
                id: 'cg-1',
                title: 'Group 1',
                'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2'] }] }]
              }
            ]
          }
        }
      };

      const resolvedCatalog = {
        all_controls: [{ id: 'ac-1', title: 'AC 1' }, { id: 'ac-2', title: 'AC 2' }]
      };

      render(
        <SourcesPanel
          profile={profile}
          resolvedCatalog={resolvedCatalog}
          isEditing={true}
          onChange={mockOnChange}
        />
      );

      fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
      const workbench = document.querySelector('.control-pool-workbench')!;

      // Drop array of controls
      const dtArray = {
        getData: (type: string) => {
          if (type === 'application/x-oscal-control') return JSON.stringify([{ id: 'ac-1' }, { id: 'ac-2' }]);
          return 'ac-1, ac-2';
        },
        types: ['application/x-oscal-control', 'text/plain']
      };

      fireEvent.drop(workbench, { dataTransfer: dtArray });

      // In SourcesPanel line 476: ctrlId = JSON.parse(rawOscal).id -> Array.id is undefined!
      // Fallback is not triggered because JSON.parse does not throw on array.
      // Therefore ctrlId is undefined, and mockOnChange is not called.
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('unassigns control with case-insensitive ID matching on drop', () => {
      const mockOnChange = vi.fn();
      const profile = {
        imports: [{ href: 'nist.json' }],
        merge: {
          custom: {
            groups: [
              {
                id: 'cg-1',
                title: 'Group 1',
                'insert-controls': [{ 'include-controls': [{ 'with-ids': ['AC-1', 'IA-2'] }] }]
              }
            ]
          }
        }
      };

      const resolvedCatalog = {
        all_controls: [{ id: 'ac-1', title: 'AC 1' }, { id: 'ia-2', title: 'IA 2' }]
      };

      render(
        <SourcesPanel
          profile={profile}
          resolvedCatalog={resolvedCatalog}
          isEditing={true}
          onChange={mockOnChange}
        />
      );

      fireEvent.click(screen.getByTestId('control-pool-tab-btn'));
      const workbench = document.querySelector('.control-pool-workbench')!;

      // Drop lower-case 'ac-1' when profile stored uppercase 'AC-1'
      const dt = {
        getData: (type: string) => (type === 'text/plain' ? 'ac-1' : ''),
        types: ['text/plain']
      };

      fireEvent.drop(workbench, { dataTransfer: dt });

      expect(mockOnChange).toHaveBeenCalled();
      const updated = mockOnChange.mock.calls[0][0];
      const withIds = updated.merge.custom.groups[0]['insert-controls'][0]['include-controls'][0]['with-ids'];
      expect(withIds).toEqual(['IA-2']);
    });
  });

  // --------------------------------------------------------------------------
  // Area 4: Keyboard "Assign to..." Selector under Rapid Succession & Deep Hierarchy
  // --------------------------------------------------------------------------
  describe('Area 4: Keyboard "Assign to..." Selector under Rapid Succession & Deep Hierarchy', () => {
    it('handles sequential assignments of multiple controls across nested hierarchies', () => {
      const nestedGroups = generateNestedCustomGroups(3, 2); // 2 + 4 + 8 = 14 groups
      let currentProfile: any = {
        imports: [{ href: 'nist.json' }],
        merge: {
          custom: {
            groups: nestedGroups
          }
        }
      };

      const resolvedCatalog = generateLargeCatalog(20, 'ctrl', 'cat-test', 'Test Catalog');

      const onChangeSpy = vi.fn().mockImplementation((updated) => {
        currentProfile = updated;
      });

      const { rerender } = render(
        <SourcesPanel
          profile={currentProfile}
          resolvedCatalog={resolvedCatalog}
          isEditing={true}
          onChange={onChangeSpy}
        />
      );

      fireEvent.click(screen.getByTestId('control-pool-tab-btn'));

      // Flatten target groups
      const allGroupIds: string[] = [];
      const collect = (list: any[]) => {
        for (const g of list) {
          allGroupIds.push(g.id);
          if (g.groups) collect(g.groups);
        }
      };
      collect(nestedGroups);

      // Perform rapid assignments for 5 unassigned controls to different nested groups
      for (let i = 1; i <= 5; i++) {
        const ctrlId = `ctrl-${i}`;
        const targetGroup = allGroupIds[i % allGroupIds.length];

        const select = screen.getByTestId(`assign-select-${ctrlId}`);
        expect(select).toBeInTheDocument();

        fireEvent.change(select, { target: { value: targetGroup } });

        // Update rerender
        rerender(
          <SourcesPanel
            profile={currentProfile}
            resolvedCatalog={resolvedCatalog}
            isEditing={true}
            onChange={onChangeSpy}
          />
        );
      }

      expect(onChangeSpy).toHaveBeenCalledTimes(5);

      // Verify all 5 controls are exclusively assigned
      const assignedIds = gatherAllAssignedControlIds(currentProfile.merge.custom);
      for (let i = 1; i <= 5; i++) {
        expect(assignedIds.has(`ctrl-${i}`)).toBe(true);
      }
    });

    it('enforces exclusive assignment when reassigning an already assigned control to another group', () => {
      const profile = {
        imports: [{ href: 'nist.json' }],
        merge: {
          custom: {
            groups: [
              {
                id: 'cg-alpha',
                title: 'Alpha Group',
                'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ctrl-100'] }] }]
              },
              {
                id: 'cg-beta',
                title: 'Beta Group',
                'insert-controls': [{ 'include-controls': [{ 'with-ids': [] }] }]
              }
            ]
          }
        }
      };

      const resolvedCatalog = {
        all_controls: [
          { id: 'ctrl-100', title: 'Control 100' },
          { id: 'ctrl-200', title: 'Control 200' }
        ]
      };

      const mockOnChange = vi.fn();
      render(
        <SourcesPanel
          profile={profile}
          resolvedCatalog={resolvedCatalog}
          isEditing={true}
          onChange={mockOnChange}
        />
      );

      fireEvent.click(screen.getByTestId('control-pool-tab-btn'));

      // Card ctrl-100 is currently assigned to Alpha Group -> unassign it
      const unassignBtn = screen.getByTestId('unassign-btn-ctrl-100');
      expect(unassignBtn).toBeInTheDocument();
      fireEvent.click(unassignBtn);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const updated = mockOnChange.mock.calls[0][0];
      const alphaWithIds = updated.merge.custom.groups.find((g: any) => g.id === 'cg-alpha')['insert-controls'][0]['include-controls'][0]['with-ids'];
      expect(alphaWithIds).not.toContain('ctrl-100');
    });

    it('unassigns and reassigns via direct document-action helper applyAssignControlToCustomGroup idempotently', () => {
      const draft = {
        profile: {
          merge: {
            custom: {
              groups: [
                {
                  id: 'cg-1',
                  title: 'Group 1',
                  'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }]
                },
                {
                  id: 'cg-2',
                  title: 'Group 2',
                  'insert-controls': [{ 'include-controls': [{ 'with-ids': [] }] }]
                }
              ]
            }
          }
        }
      };

      // Assign ac-1 to cg-2 -> should automatically remove from cg-1
      applyAssignControlToCustomGroup(draft, { controlId: 'ac-1', targetGroupId: 'cg-2' });

      const g1Ids = draft.profile.merge.custom.groups[0]['insert-controls'][0]['include-controls'][0]['with-ids'];
      const g2Ids = draft.profile.merge.custom.groups[1]['insert-controls'][0]['include-controls'][0]['with-ids'];

      expect(g1Ids).not.toContain('ac-1');
      expect(g2Ids).toContain('ac-1');
      expect(g2Ids.length).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Area 5: Copy Structure & Import Resolution Stress Scenarios
  // --------------------------------------------------------------------------
  describe('Area 5: Copy Structure & Import Resolution Stress Scenarios', () => {
    it('copies structure in custom mode populating custom groups with all source controls', () => {
      const mockOnChange = vi.fn();
      const profile = {
        imports: [{ href: 'catalogs/11111111-2222-3333-4444-555555555555/catalog.json' }],
        merge: {
          custom: {
            groups: []
          }
        }
      };

      const sourceCatalog = {
        uuid: '11111111-2222-3333-4444-555555555555',
        groups: [
          {
            id: 'ac',
            title: 'Access Control',
            controls: [{ id: 'ac-1' }, { id: 'ac-2' }]
          },
          {
            id: 'ia',
            title: 'Identification',
            controls: [{ id: 'ia-1' }]
          }
        ],
        controls: [{ id: 'top-1' }]
      };

      render(
        <SourcesPanel
          profile={profile}
          availableCatalogs={[sourceCatalog]}
          isEditing={true}
          onChange={mockOnChange}
        />
      );

      // In custom mode on Import Sources tab, Import Full Structure button is visible
      const copyBtn = screen.getByRole('button', { name: /Import Full Structure/i });
      expect(copyBtn).toBeInTheDocument();
      fireEvent.click(copyBtn);

      expect(mockOnChange).toHaveBeenCalled();
      const updated = mockOnChange.mock.calls[0][0];
      expect(updated.merge.custom).toBeDefined();
      expect(updated.merge.custom.groups.length).toBe(2);

      const acGroup = updated.merge.custom.groups.find((g: any) => g.id === 'ac');
      expect(acGroup['insert-controls'][0]['include-controls'][0]['with-ids']).toEqual(['ac-1', 'ac-2']);

      const topInsert = updated.merge.custom['insert-controls'];
      expect(topInsert[0]['include-controls'][0]['with-ids']).toEqual(['top-1']);
    });
  });
});
