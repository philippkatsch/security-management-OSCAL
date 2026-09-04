import { describe, it, expect } from 'vitest';
import {
  matchesPattern,
  collectWithdrawnIds,
  applyModify,
  resolveProfileSync
} from '../../lib/profile/profile-resolver';

describe('M2_1 Adversarial Phase 2 Resolution Engine Stress Suite', () => {
  // ---------------------------------------------------------------------------
  // 1. Wildcard Pattern Matching Stress (matchesPattern)
  // ---------------------------------------------------------------------------
  describe('Pillar 1: Wildcard Pattern Matching & Regex Resilience', () => {
    it('matches prefix, suffix, infix, and single-character wildcards accurately', () => {
      expect(matchesPattern('ac-1', ['ac-*'])).toBe(true);
      expect(matchesPattern('ac-2.1', ['ac-*'])).toBe(true);
      expect(matchesPattern('ia-5', ['ac-*'])).toBe(false);

      // Suffix wildcard
      expect(matchesPattern('corp-ac-1', ['*-1'])).toBe(true);
      expect(matchesPattern('corp-ac-2', ['*-1'])).toBe(false);

      // Infix wildcard
      expect(matchesPattern('ac-custom-ext', ['ac-*-ext'])).toBe(true);
      expect(matchesPattern('ac-custom-oth', ['ac-*-ext'])).toBe(false);

      // Single-character '?' wildcard
      expect(matchesPattern('sc-7.1', ['sc-7.?'])).toBe(true);
      expect(matchesPattern('sc-7.2', ['sc-7.?'])).toBe(true);
      expect(matchesPattern('sc-7.10', ['sc-7.?'])).toBe(false); // 2 chars after '.'
    });

    it('performs case-insensitive pattern matching', () => {
      expect(matchesPattern('ac-1', ['AC-*'])).toBe(true);
      expect(matchesPattern('AC-1', ['ac-*'])).toBe(true);
      expect(matchesPattern('Ac-1', ['aC-*'])).toBe(true);
    });

    it('handles special characters in control IDs safely without regex corruption', () => {
      expect(matchesPattern('ctrl.dot', ['ctrl.*'])).toBe(true);
      expect(matchesPattern('ctrl[bracket]', ['ctrl*'])).toBe(true);
      expect(matchesPattern('ctrl+plus', ['ctrl+*'])).toBe(true);
    });

    it('survives malformed pattern strings gracefully without throwing errors', () => {
      // Unclosed brackets or backslashes
      expect(() => matchesPattern('ac-1', ['[unclosed', '(?=invalid']))
        .not.toThrow();
      expect(matchesPattern('ac-1', ['[unclosed'])).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. In-Place Statement Replacement & Recursion Depth Guard (applyModify)
  // ---------------------------------------------------------------------------
  describe('Pillar 2 & 3: Deep Hierarchy Statement Alterations & Depth Guard', () => {
    it('preserves atomically replaced statement and does not delete it in removal pass (R2-03)', () => {
      const catalog = {
        uuid: 'cat-deep-1',
        controls: [
          {
            id: 'deep-1',
            title: 'Deep Control',
            parts: [
              {
                id: 'deep-1_smt',
                name: 'statement',
                prose: 'Root statement prose',
                parts: [
                  {
                    id: 'deep-1_smt.a',
                    name: 'item',
                    prose: 'Item a prose',
                    parts: [
                      {
                        id: 'deep-1_smt.a.1',
                        name: 'subitem',
                        prose: 'Original deep subitem prose'
                      }
                    ]
                  },
                  {
                    id: 'deep-1_smt.b',
                    name: 'item',
                    prose: 'Item b to be removed'
                  }
                ]
              }
            ]
          }
        ]
      };

      const modify = {
        alters: [
          {
            'control-id': 'deep-1',
            removes: [
              { 'by-id': 'deep-1_smt.a.1' }, // Targeted for replacement
              { 'by-id': 'deep-1_smt.b' }     // Targeted for pure deletion
            ],
            adds: [
              {
                'by-id': 'deep-1_smt.a.1',
                position: 'after',
                parts: [
                  {
                    id: 'deep-1_smt.a.1',
                    name: 'subitem',
                    prose: 'Replaced in-place deep subitem prose'
                  }
                ]
              }
            ]
          }
        ]
      };

      applyModify(catalog, modify);

      const rootParts = catalog.controls[0].parts;
      expect(rootParts).toHaveLength(1);
      const rootSmt = rootParts[0];

      // Item b is removed
      expect(rootSmt.parts).toHaveLength(1);
      const itemA = rootSmt.parts[0];
      expect(itemA.id).toBe('deep-1_smt.a');

      // Subitem a.1 is preserved with replaced prose (NOT removed)
      expect(itemA.parts).toHaveLength(1);
      expect(itemA.parts[0].id).toBe('deep-1_smt.a.1');
      expect(itemA.parts[0].prose).toBe('Replaced in-place deep subitem prose');
    });

    it('strictly prevents non-targeted additions from duplicating into nested subparts (R2-04)', () => {
      // 5-level deep part hierarchy
      const catalog = {
        uuid: 'cat-5levels',
        controls: [
          {
            id: 'nested-ctrl-1',
            title: '5-Level Control',
            parts: [
              {
                id: 'l1',
                name: 'level1',
                prose: 'Level 1',
                parts: [
                  {
                    id: 'l2',
                    name: 'level2',
                    prose: 'Level 2',
                    parts: [
                      {
                        id: 'l3',
                        name: 'level3',
                        prose: 'Level 3',
                        parts: [
                          {
                            id: 'l4',
                            name: 'level4',
                            prose: 'Level 4',
                            parts: [
                              {
                                id: 'l5',
                                name: 'level5',
                                prose: 'Level 5'
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
        ]
      };

      const modify = {
        alters: [
          {
            'control-id': 'nested-ctrl-1',
            adds: [
              {
                position: 'ending',
                parts: [
                  {
                    id: 'root-guidance',
                    name: 'guidance',
                    prose: 'Global root addition only'
                  }
                ]
              }
            ]
          }
        ]
      };

      applyModify(catalog, modify);

      const rootParts = catalog.controls[0].parts;
      // Root level (level 0) should have 2 elements: l1 and root-guidance
      expect(rootParts).toHaveLength(2);
      expect(rootParts.map((p: any) => p.id)).toEqual(['l1', 'root-guidance']);

      // Level 1 (child of l1) must contain ONLY l2
      const l1 = rootParts[0];
      expect(l1.parts).toHaveLength(1);
      expect(l1.parts[0].id).toBe('l2');

      // Level 2 (child of l2) must contain ONLY l3
      const l2 = l1.parts[0];
      expect(l2.parts).toHaveLength(1);
      expect(l2.parts[0].id).toBe('l3');

      // Level 3 must contain ONLY l4
      const l3 = l2.parts[0];
      expect(l3.parts).toHaveLength(1);
      expect(l3.parts[0].id).toBe('l4');

      // Level 4 must contain ONLY l5
      const l4 = l3.parts[0];
      expect(l4.parts).toHaveLength(1);
      expect(l4.parts[0].id).toBe('l5');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Withdrawn Controls Auto-Exclusion Parity (collectWithdrawnIds & resolveProfileSync)
  // ---------------------------------------------------------------------------
  describe('Pillar 4: Withdrawn Controls Auto-Exclusion Parity', () => {
    it('collects all withdrawn control IDs regardless of status/state prop name and value casing', () => {
      const catalog = {
        uuid: 'cat-withdrawn-test',
        controls: [
          {
            id: 'ctrl-w1',
            title: 'Withdrawn 1',
            props: [{ name: 'status', value: 'withdrawn' }]
          },
          {
            id: 'ctrl-w2',
            title: 'Withdrawn 2 (casing)',
            props: [{ name: 'STATUS', value: 'Withdrawn' }]
          },
          {
            id: 'ctrl-active',
            title: 'Active Control',
            props: [{ name: 'status', value: 'active' }]
          }
        ],
        groups: [
          {
            id: 'g1',
            controls: [
              {
                id: 'ctrl-w3',
                title: 'Withdrawn 3 (state)',
                props: [{ name: 'state', value: 'withdrawn' }]
              },
              {
                id: 'ctrl-w4',
                title: 'Withdrawn 4 (STATE uppercase)',
                props: [{ name: 'STATE', value: 'WITHDRAWN' }]
              }
            ],
            groups: [
              {
                id: 'sub-g1',
                controls: [
                  {
                    id: 'ctrl-w5',
                    title: 'Nested Withdrawn 5',
                    controls: [
                      {
                        id: 'ctrl-w6',
                        title: 'Child Withdrawn 6',
                        props: [{ name: 'Status', value: 'withdrawn' }]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };

      const withdrawn = collectWithdrawnIds(catalog);
      expect(withdrawn.has('ctrl-w1')).toBe(true);
      expect(withdrawn.has('ctrl-w2')).toBe(true);
      expect(withdrawn.has('ctrl-w3')).toBe(true);
      expect(withdrawn.has('ctrl-w4')).toBe(true);
      expect(withdrawn.has('ctrl-w6')).toBe(true);
      expect(withdrawn.has('ctrl-active')).toBe(false);
    });

    it('resolveProfileSync auto-excludes withdrawn controls even when include-all or wildcards are specified', () => {
      const catUuid = '11111111-2222-3333-4444-555555555555';
      const cache = new Map();
      cache.set(catUuid, {
        type: 'catalog',
        data: {
          catalog: {
            uuid: catUuid,
            controls: [
              { id: 'ac-1', title: 'Active 1', props: [{ name: 'status', value: 'active' }] },
              { id: 'ac-2', title: 'Withdrawn 2', props: [{ name: 'status', value: 'withdrawn' }] },
              { id: 'ia-1', title: 'Active IA 1' }
            ]
          }
        }
      });

      const profileDoc = {
        profile: {
          uuid: 'prof-uuid',
          metadata: { title: 'Test Profile' },
          imports: [
            {
              href: catUuid,
              'include-all': {}
            }
          ]
        }
      };

      const resolved = resolveProfileSync(profileDoc, cache);
      const controlIds = resolved.catalog.controls.map((c: any) => c.id);

      expect(controlIds).toContain('ac-1');
      expect(controlIds).toContain('ia-1');
      expect(controlIds).not.toContain('ac-2');
    });

    it('preserves unsaved local-controls and merges them into resolved catalog', () => {
      const catUuid = '11111111-2222-3333-4444-555555555555';
      const cache = new Map();
      cache.set(catUuid, {
        type: 'catalog',
        data: {
          catalog: {
            uuid: catUuid,
            controls: [
              { id: 'imp-1', title: 'Imported Control' }
            ]
          }
        }
      });

      const profileDoc = {
        profile: {
          uuid: 'prof-local-test',
          metadata: { title: 'Local Test Profile' },
          imports: [
            {
              href: catUuid,
              'include-all': {}
            }
          ],
          'local-controls': [
            {
              id: 'local-sec-1',
              title: 'Local Security Architecture',
              parts: [{ id: 'local-1_smt', name: 'statement', prose: 'Local prose' }]
            }
          ]
        }
      };

      const resolved = resolveProfileSync(profileDoc, cache);
      const controlIds = resolved.catalog.controls.map((c: any) => c.id);

      expect(controlIds).toContain('imp-1');
      expect(controlIds).toContain('local-sec-1');
    });
  });
});
