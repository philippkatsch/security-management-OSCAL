import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyModify,
  resolveProfileSync,
  matchesPattern,
  filterControls,
  filterGroups,
  fetchImportedCatalogs
} from '../lib/profile-resolver';

describe('ProfileResolver Engine & applyModify Unit Tests', () => {
  // ---------------------------------------------------------------------------
  // 1. applyModify - set-parameters Overrides
  // ---------------------------------------------------------------------------
  describe('applyModify() - Parameter Overrides (set-parameters)', () => {
    it('overrides catalog parameter default values with set-parameters', () => {
      const catalog = {
        uuid: '11111111-2222-3333-4444-555555555555',
        controls: [
          {
            id: 'ac-1',
            title: 'Access Control Policy',
            params: [
              {
                id: 'ac-1_prm_1',
                label: 'Session Timeout',
                values: ['30 minutes'],
                select: { 'how-many': 'one', choice: ['15 minutes', '30 minutes', '60 minutes'] }
              }
            ]
          }
        ]
      };

      const modify = {
        'set-parameters': [
          {
            'param-id': 'ac-1_prm_1',
            values: ['15 minutes']
          }
        ]
      };

      applyModify(catalog, modify);

      const resolvedParam = catalog.controls[0].params[0];
      // Values overridden
      expect(resolvedParam.values).toEqual(['15 minutes']);
      // Label and choice configuration preserved from catalog
      expect(resolvedParam.label).toBe('Session Timeout');
      expect(resolvedParam.select.choice).toEqual(['15 minutes', '30 minutes', '60 minutes']);
    });

    it('overrides catalog parameter label without modifying values when values are omitted', () => {
      const catalog = {
        uuid: '11111111-2222-3333-4444-555555555555',
        controls: [
          {
            id: 'ia-5',
            params: [
              {
                id: 'ia-5_prm_1',
                label: 'Password Length',
                values: ['12']
              }
            ]
          }
        ]
      };

      const modify = {
        'set-parameters': [
          {
            'param-id': 'ia-5_prm_1',
            label: 'Organization Password Minimum Length'
          }
        ]
      };

      applyModify(catalog, modify);

      const resolvedParam = catalog.controls[0].params[0];
      expect(resolvedParam.label).toBe('Organization Password Minimum Length');
      expect(resolvedParam.values).toEqual(['12']);
    });

    it('performs case-insensitive parameter ID matching for set-parameters', () => {
      const catalog = {
        uuid: '11111111-2222-3333-4444-555555555555',
        controls: [
          {
            id: 'ac-2',
            params: [
              {
                id: 'ac-2_prm_1',
                values: ['Standard User']
              }
            ]
          }
        ]
      };

      const modify = {
        'set-parameters': [
          {
            'param-id': 'AC-2_PRM_1',
            values: ['Administrator', 'Auditor']
          }
        ]
      };

      applyModify(catalog, modify);

      expect(catalog.controls[0].params[0].values).toEqual(['Administrator', 'Auditor']);
    });

    it('applies parameter overrides across nested group controls and sub-controls', () => {
      const catalog = {
        uuid: '11111111-2222-3333-4444-555555555555',
        groups: [
          {
            id: 'ac-group',
            controls: [
              {
                id: 'ac-2',
                controls: [
                  {
                    id: 'ac-2.1',
                    params: [
                      { id: 'ac-2.1_prm_1', values: ['Default Value'] }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };

      const modify = {
        'set-parameters': [
          {
            'param-id': 'ac-2.1_prm_1',
            values: ['Overridden Value']
          }
        ]
      };

      applyModify(catalog, modify);

      const subControlParam = catalog.groups[0].controls[0].controls[0].params[0];
      expect(subControlParam.values).toEqual(['Overridden Value']);
    });

    it('leaves parameters untouched when set-parameters does not match their ID', () => {
      const catalog = {
        uuid: '11111111-2222-3333-4444-555555555555',
        controls: [
          {
            id: 'ac-1',
            params: [
              { id: 'ac-1_prm_1', values: ['30 days'] },
              { id: 'ac-1_prm_2', values: ['5 attempts'] }
            ]
          }
        ]
      };

      const modify = {
        'set-parameters': [
          { 'param-id': 'ac-1_prm_1', values: ['60 days'] }
        ]
      };

      applyModify(catalog, modify);

      expect(catalog.controls[0].params[0].values).toEqual(['60 days']);
      expect(catalog.controls[0].params[1].values).toEqual(['5 attempts']);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. applyModify - Alters (Adds, Removes, Title/ID Overrides)
  // ---------------------------------------------------------------------------
  describe('applyModify() - Alters Directives', () => {
    it('applies alters removes by-id and by-name on control properties and links', () => {
      const catalog = {
        uuid: '11111111-2222-3333-4444-555555555555',
        controls: [
          {
            id: 'ac-1',
            props: [
              { name: 'label', value: 'AC-1' },
              { name: 'status', value: 'draft' }
            ],
            links: [
              { href: '#ref1', rel: 'related' }
            ]
          }
        ]
      };

      const modify = {
        alters: [
          {
            'control-id': 'ac-1',
            removes: [
              { 'by-name': 'status' }
            ]
          }
        ]
      };

      applyModify(catalog, modify);

      expect(catalog.controls[0].props).toEqual([{ name: 'label', value: 'AC-1' }]);
    });

    it('applies alters adds for new props, params, and links', () => {
      const catalog = {
        uuid: '11111111-2222-3333-4444-555555555555',
        controls: [
          {
            id: 'ac-1',
            props: [{ name: 'label', value: 'AC-1' }]
          }
        ]
      };

      const modify = {
        alters: [
          {
            'control-id': 'ac-1',
            adds: [
              {
                props: [{ name: 'sort-id', value: 'ac-01' }],
                params: [{ id: 'ac-1_prm_new', values: ['Added Param'] }]
              }
            ]
          }
        ]
      };

      applyModify(catalog, modify);

      expect(catalog.controls[0].props).toEqual([
        { name: 'label', value: 'AC-1' },
        { name: 'sort-id', value: 'ac-01' }
      ]);
      expect(catalog.controls[0].params).toEqual([
        { id: 'ac-1_prm_new', values: ['Added Param'] }
      ]);
    });

    it('applies title-override and id-override props on controls', () => {
      const catalog = {
        uuid: '11111111-2222-3333-4444-555555555555',
        controls: [
          {
            id: 'ac-1',
            title: 'Original Title',
            props: [
              { name: 'title-override', value: 'Tailored Policy Title' },
              { name: 'id-override', value: 'ac-01-tailored' }
            ]
          }
        ]
      };

      applyModify(catalog, {});

      const ctrl = catalog.controls[0];
      expect(ctrl.title).toBe('Tailored Policy Title');
      expect(ctrl.id).toBe('ac-01-tailored');
      expect(ctrl.originalId).toBe('ac-1');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. resolveProfileSync - Profile Resolution Engine
  // ---------------------------------------------------------------------------
  describe('resolveProfileSync()', () => {
    const validUuid = '11111111-2222-3333-4444-555555555555';
    let mockCache;

    beforeEach(() => {
      mockCache = new Map();
      mockCache.set(validUuid.toLowerCase(), {
        type: 'catalog',
        data: {
          catalog: {
            uuid: validUuid,
            controls: [
              {
                id: 'ac-1',
                title: 'Access Control',
                params: [
                  { id: 'ac-1_prm_1', values: ['Default Catalog 30 days'] }
                ]
              },
              {
                id: 'ac-2',
                title: 'Account Management',
                params: [
                  { id: 'ac-2_prm_1', values: ['Default Roles'] }
                ]
              },
              {
                id: 'ia-5',
                title: 'Authenticator Management',
                params: [
                  { id: 'ia-5_prm_1', values: ['8 characters'] }
                ]
              }
            ]
          }
        }
      });
    });

    it('resolves profile imports and applies set-parameters overrides to resolved controls', () => {
      const profileDoc = {
        profile: {
          uuid: '22222222-3333-4444-5555-666666666666',
          metadata: { title: 'Tailored Security Baseline' },
          imports: [
            {
              href: validUuid,
              'include-all': {}
            }
          ],
          modify: {
            'set-parameters': [
              {
                'param-id': 'ac-1_prm_1',
                values: ['Profile Override 60 days']
              }
            ]
          }
        }
      };

      const resolved = resolveProfileSync(profileDoc, mockCache);
      const catalog = resolved.catalog;

      expect(catalog).toBeDefined();
      expect(catalog.controls.length).toBe(3);

      const ac1Ctrl = catalog.controls.find(c => c.id === 'ac-1');
      expect(ac1Ctrl.params[0].values).toEqual(['Profile Override 60 days']);

      const ac2Ctrl = catalog.controls.find(c => c.id === 'ac-2');
      expect(ac2Ctrl.params[0].values).toEqual(['Default Roles']);
    });

    it('filters controls using include-controls with-ids rule', () => {
      const profileDoc = {
        profile: {
          uuid: '22222222-3333-4444-5555-666666666666',
          metadata: { title: 'Filtered Baseline' },
          imports: [
            {
              href: validUuid,
              'include-controls': [
                { 'with-ids': ['ac-1', 'ia-5'] }
              ]
            }
          ]
        }
      };

      const resolved = resolveProfileSync(profileDoc, mockCache);
      const controls = resolved.catalog.controls;

      expect(controls.length).toBe(2);
      expect(controls.map(c => c.id)).toEqual(['ac-1', 'ia-5']);
    });

    it('filters controls using include-controls glob patterns', () => {
      const profileDoc = {
        profile: {
          uuid: '22222222-3333-4444-5555-666666666666',
          metadata: { title: 'Pattern Filter Baseline' },
          imports: [
            {
              href: validUuid,
              'include-controls': [
                { matching: [{ pattern: 'ac-*' }] }
              ]
            }
          ]
        }
      };

      const resolved = resolveProfileSync(profileDoc, mockCache);
      const controls = resolved.catalog.controls;

      expect(controls.length).toBe(2);
      expect(controls.map(c => c.id)).toEqual(['ac-1', 'ac-2']);
    });

    it('marks excluded controls as isControlInactive when keepAll is true', () => {
      const profileDoc = {
        profile: {
          uuid: '22222222-3333-4444-5555-666666666666',
          metadata: { title: 'KeepAll Baseline' },
          imports: [
            {
              href: validUuid,
              'include-controls': [
                { 'with-ids': ['ac-1'] }
              ]
            }
          ]
        }
      };

      const resolved = resolveProfileSync(profileDoc, mockCache, true);
      const controls = resolved.catalog.controls;

      // With keepAll=true, all 3 controls are retained
      expect(controls.length).toBe(3);

      const ac1 = controls.find(c => c.id === 'ac-1');
      expect(ac1.isControlInactive).toBe(false);

      const ac2 = controls.find(c => c.id === 'ac-2');
      expect(ac2.isControlInactive).toBe(true);
    });

    it('resolves profile with merge.flat strategy', () => {
      const profileDoc = {
        profile: {
          uuid: '22222222-3333-4444-5555-666666666666',
          metadata: { title: 'Flat Baseline' },
          imports: [{ href: validUuid, 'include-all': {} }],
          merge: { flat: {} }
        }
      };

      const resolved = resolveProfileSync(profileDoc, mockCache);
      expect(resolved.catalog.controls).toBeDefined();
      expect(resolved.catalog.groups).toBeUndefined();
    });

    it('resolves profile with merge.custom group configuration', () => {
      const profileDoc = {
        profile: {
          uuid: '22222222-3333-4444-5555-666666666666',
          metadata: { title: 'Custom Groups Baseline' },
          imports: [{ href: validUuid, 'include-all': {} }],
          merge: {
            custom: {
              groups: [
                {
                  id: 'access-mgmt',
                  title: 'Access Management Group',
                  'insert-controls': [
                    { 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2'] }], order: 'ascending' }
                  ]
                }
              ]
            }
          }
        }
      };

      const resolved = resolveProfileSync(profileDoc, mockCache);
      expect(resolved.catalog.groups).toBeDefined();
      expect(resolved.catalog.groups[0].title).toBe('Access Management Group');
      expect(resolved.catalog.groups[0].controls.map(c => c.id)).toEqual(['ac-1', 'ac-2']);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Pattern Matching & Filter Functions
  // ---------------------------------------------------------------------------
  describe('Pattern Matching & Filtering Helpers', () => {
    it('matchesPattern correctly matches glob patterns with wildcard', () => {
      expect(matchesPattern('ac-1', ['ac-*'])).toBe(true);
      expect(matchesPattern('ac-2.1', ['ac-*'])).toBe(true);
      expect(matchesPattern('ia-5', ['ac-*'])).toBe(false);
      expect(matchesPattern('ac-1', ['*-1'])).toBe(true);
      expect(matchesPattern('ac-2', ['*-1'])).toBe(false);
    });

    it('filterControls filters controls array accurately based on sets', () => {
      const controls = [
        { id: 'ac-1' },
        { id: 'ac-2' },
        { id: 'ia-5' }
      ];

      const included = new Set(['ac-1']);
      const excluded = new Set();

      const result = filterControls(controls, false, included, [], excluded, []);
      expect(result.map(c => c.id)).toEqual(['ac-1']);
    });

    it('filterGroups filters groups and nested controls', () => {
      const groups = [
        {
          id: 'g1',
          controls: [{ id: 'ac-1' }, { id: 'ac-2' }]
        },
        {
          id: 'g2',
          controls: [{ id: 'ia-5' }]
        }
      ];

      const included = new Set(['ac-1']);
      const excluded = new Set();

      const result = filterGroups(groups, false, included, [], excluded, []);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('g1');
      expect(result[0].controls.map(c => c.id)).toEqual(['ac-1']);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. fetchImportedCatalogs
  // ---------------------------------------------------------------------------
  describe('fetchImportedCatalogs()', () => {
    it('fetches imported catalog documents and stores them in cache Map', async () => {
      const targetUuid = '11111111-2222-3333-4444-555555555555';
      const profileDoc = {
        profile: {
          uuid: '22222222-3333-4444-5555-666666666666',
          imports: [
            { href: targetUuid }
          ]
        }
      };

      const mockFetchFn = vi.fn().mockImplementation((url) => {
        if (url === '/api/documents/catalogs') {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { catalog: { uuid: targetUuid } }
            ]
          });
        }
        if (url === '/api/documents/profiles') {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        if (url === '/api/import/registry') {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        if (url === `/api/documents/catalogs/${targetUuid}`) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              catalog: {
                uuid: targetUuid,
                controls: [{ id: 'ac-1' }]
              }
            })
          });
        }
        return Promise.resolve({ ok: false });
      });

      const cache = await fetchImportedCatalogs(profileDoc, new Map(), mockFetchFn);

      expect(cache.has(targetUuid)).toBe(true);
      const entry = cache.get(targetUuid);
      expect(entry.type).toBe('catalog');
      expect(entry.data.catalog.controls[0].id).toBe('ac-1');
    });

    it('infers catalog type from href URL path even if availableCatalogs does not list the UUID', async () => {
      const customUuid = '99999999-8888-7777-6666-555555555555';
      const profileDoc = {
        profile: {
          uuid: 'prof-uuid',
          imports: [
            { href: `/api/documents/catalogs/${customUuid}` }
          ]
        }
      };

      const mockFetchFn = vi.fn().mockImplementation((url) => {
        if (url === '/api/documents/catalogs' || url === '/api/documents/profiles' || url === '/api/import/registry') {
          return Promise.resolve({ ok: true, json: async () => [] });
        }
        if (url === `/api/documents/catalogs/${customUuid}`) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              catalog: {
                uuid: customUuid,
                controls: [{ id: 'custom-1' }]
              }
            })
          });
        }
        return Promise.resolve({ ok: false });
      });

      const cache = await fetchImportedCatalogs(profileDoc, new Map(), mockFetchFn);

      expect(cache.has(customUuid)).toBe(true);
      expect(cache.get(customUuid).data.catalog.controls[0].id).toBe('custom-1');
    });
  });
});
