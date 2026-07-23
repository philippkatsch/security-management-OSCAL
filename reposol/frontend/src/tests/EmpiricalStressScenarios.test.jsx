import { describe, it, expect } from 'vitest';
import { applyModify, resolveProfileSync } from '../lib/profile-resolver.js';

describe('Empirical Stress Scenarios for Profile Resolution & Parameter Assignment', () => {

  // =========================================================================
  // SCENARIO 1: Parameter Value Assignment Edge Cases
  // =========================================================================
  describe('Scenario 1: Parameter Value Assignment Edge Cases', () => {
    it('S1-01: handles special characters, unicode, emojis, HTML/script tags, quotes, backslashes', () => {
      const catalog = {
        uuid: '11111111-1111-1111-1111-111111111111',
        controls: [
          {
            id: 'ac-1',
            params: [
              { id: 'ac-1_prm_1', label: 'Default Label', values: ['default'] }
            ]
          }
        ]
      };

      const specialVals = [
        "🔒 Passphrase @#$%^&*()_+ space <> \"quote\" 'single' \\backslash /slash",
        "<script>alert('xss')</script>",
        "Überschreibung & Umläute 🔥 日本語 🚀"
      ];

      const modify = {
        'set-parameters': [
          {
            'param-id': 'ac-1_prm_1',
            label: 'Special Label <>&"',
            values: specialVals
          }
        ]
      };

      applyModify(catalog, modify);
      const param = catalog.controls[0].params[0];
      expect(param.values).toEqual(specialVals);
      expect(param.label).toBe('Special Label <>&"');
    });

    it('S1-02: handles empty values, omitted values, and preserves label/choice', () => {
      const catalog = {
        uuid: '11111111-1111-1111-1111-111111111111',
        controls: [
          {
            id: 'ac-1',
            params: [
              {
                id: 'ac-1_prm_1',
                label: 'Base Label',
                values: ['val1'],
                select: { 'how-many': 'one', choice: ['val1', 'val2'] }
              }
            ]
          }
        ]
      };

      // Set parameter with empty values array vs omitted values key
      const modify = {
        'set-parameters': [
          {
            'param-id': 'ac-1_prm_1',
            label: 'Updated Label Only'
          }
        ]
      };

      applyModify(catalog, modify);
      const param = catalog.controls[0].params[0];
      expect(param.label).toBe('Updated Label Only');
      expect(param.values).toEqual(['val1']);
      expect(param.select.choice).toEqual(['val1', 'val2']);
    });

    it('S1-03: multi-choice parameter selections and custom select objects', () => {
      const catalog = {
        uuid: '11111111-1111-1111-1111-111111111111',
        controls: [
          {
            id: 'ac-2',
            params: [
              { id: 'ac-2_prm_3', values: ['otp'] }
            ]
          }
        ]
      };

      const modify = {
        'set-parameters': [
          {
            'param-id': 'ac-2_prm_3',
            values: ['otp', 'biometric'],
            select: {
              'how-many': 'one-or-more',
              choice: ['otp', 'biometric', 'fido2']
            }
          }
        ]
      };

      applyModify(catalog, modify);
      const param = catalog.controls[0].params[0];
      expect(param.values).toEqual(['otp', 'biometric']);
      expect(param.select['how-many']).toBe('one-or-more');
      expect(param.select.choice).toEqual(['otp', 'biometric', 'fido2']);
    });

    it('S1-04: parameter constraints and guideline properties preserved during applyModify', () => {
      const catalog = {
        uuid: '11111111-1111-1111-1111-111111111111',
        controls: [
          {
            id: 'ac-1',
            params: [{ id: 'ac-1_prm_1', values: ['30'] }]
          }
        ]
      };

      const modify = {
        'set-parameters': [
          {
            'param-id': 'ac-1_prm_1',
            values: ['60'],
            constraints: [
              {
                description: 'Format restriction',
                tests: [{ expression: '^[0-9]+$', remarks: 'Numeric test' }]
              }
            ]
          }
        ]
      };

      applyModify(catalog, modify);
      const param = catalog.controls[0].params[0];
      expect(param.values).toEqual(['60']);
      expect(param.constraints[0].tests[0].expression).toBe('^[0-9]+$');
    });
  });

  // =========================================================================
  // SCENARIO 2: Profile Overrides at Catalog, Group, and Control Levels
  // =========================================================================
  describe('Scenario 2: Overrides at Catalog, Group, and Control Levels', () => {
    it('S2-01: overrides params at catalog, group, sub-group, control, and sub-control levels', () => {
      const catalog = {
        uuid: '11111111-1111-1111-1111-111111111111',
        params: [
          { id: 'cat_p1', values: ['cat_def'] }
        ],
        groups: [
          {
            id: 'g1',
            params: [{ id: 'grp_p1', values: ['grp_def'] }],
            groups: [
              {
                id: 'g1-sub',
                params: [{ id: 'subgrp_p1', values: ['subgrp_def'] }]
              }
            ],
            controls: [
              {
                id: 'c1',
                params: [{ id: 'ctrl_p1', values: ['ctrl_def'] }],
                controls: [
                  {
                    id: 'c1-sub',
                    params: [{ id: 'subctrl_p1', values: ['subctrl_def'] }]
                  }
                ]
              }
            ]
          }
        ]
      };

      const modify = {
        'set-parameters': [
          { 'param-id': 'cat_p1', values: ['cat_override'] },
          { 'param-id': 'grp_p1', values: ['grp_override'] },
          { 'param-id': 'subgrp_p1', values: ['subgrp_override'] },
          { 'param-id': 'ctrl_p1', values: ['ctrl_override'] },
          { 'param-id': 'subctrl_p1', values: ['subctrl_override'] }
        ]
      };

      applyModify(catalog, modify);

      expect(catalog.params[0].values).toEqual(['cat_override']);
      expect(catalog.groups[0].params[0].values).toEqual(['grp_override']);
      expect(catalog.groups[0].groups[0].params[0].values).toEqual(['subgrp_override']);
      expect(catalog.groups[0].controls[0].params[0].values).toEqual(['ctrl_override']);
      expect(catalog.groups[0].controls[0].controls[0].params[0].values).toEqual(['subctrl_override']);
    });

    it('S2-02: duplicate param-ids in set-parameters array (last entry wins)', () => {
      const catalog = {
        uuid: '11111111-1111-1111-1111-111111111111',
        controls: [
          { id: 'ac-1', params: [{ id: 'ac-1_prm_1', values: ['base'] }] }
        ]
      };

      const modify = {
        'set-parameters': [
          { 'param-id': 'ac-1_prm_1', values: ['first_override'] },
          { 'param-id': 'ac-1_prm_1', values: ['second_override_wins'] }
        ]
      };

      applyModify(catalog, modify);
      expect(catalog.controls[0].params[0].values).toEqual(['second_override_wins']);
    });

    it('S2-03: case-insensitive param-id matching', () => {
      const catalog = {
        uuid: '11111111-1111-1111-1111-111111111111',
        controls: [
          { id: 'ac-1', params: [{ id: 'AC-1_PRM_1', values: ['lowercase_target'] }] }
        ]
      };

      const modify = {
        'set-parameters': [
          { 'param-id': 'ac-1_prm_1', values: ['uppercase_override'] }
        ]
      };

      applyModify(catalog, modify);
      expect(catalog.controls[0].params[0].values).toEqual(['uppercase_override']);
    });
  });

  // =========================================================================
  // SCENARIO 3: Resolving Profiles with Conflicting or Nested Overrides
  // =========================================================================
  describe('Scenario 3: Resolving Profiles with Conflicting/Nested Overrides', () => {
    it('S3-01: nested profile resolution chain (Profile B -> Profile A -> Catalog)', () => {
      const baseCatalog = {
        catalog: {
          uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          controls: [
            {
              id: 'ac-1',
              title: 'Access Control',
              params: [{ id: 'ac-1_prm_1', values: ['Base Catalog Value'] }]
            }
          ]
        }
      };

      const profileA = {
        profile: {
          uuid: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          metadata: { title: 'Profile A' },
          imports: [
            { href: '../catalogs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.json', 'include-all': {} }
          ],
          modify: {
            'set-parameters': [
              { 'param-id': 'ac-1_prm_1', values: ['Profile A Value'] }
            ]
          }
        }
      };

      const profileB = {
        profile: {
          uuid: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          metadata: { title: 'Profile B' },
          imports: [
            { href: '../profiles/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.json', 'include-all': {} }
          ],
          modify: {
            'set-parameters': [
              { 'param-id': 'ac-1_prm_1', values: ['Profile B Value Wins'] }
            ]
          }
        }
      };

      const cache = new Map();
      cache.set('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', baseCatalog);
      cache.set('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', profileA);

      const resolved = resolveProfileSync(profileB, cache);
      const ctrl = resolved.catalog.controls[0];
      expect(ctrl.params[0].values).toEqual(['Profile B Value Wins']);
    });

    it('S3-02: partial overrides across nested profiles (Profile A overrides label, Profile B overrides values)', () => {
      const baseCatalog = {
        catalog: {
          uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          controls: [
            {
              id: 'ac-1',
              params: [{ id: 'ac-1_prm_1', label: 'Base Label', values: ['Base Value'] }]
            }
          ]
        }
      };

      const profileA = {
        profile: {
          uuid: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          metadata: { title: 'Profile A' },
          imports: [
            { href: '../catalogs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.json', 'include-all': {} }
          ],
          modify: {
            'set-parameters': [
              { 'param-id': 'ac-1_prm_1', label: 'Profile A Custom Label' }
            ]
          }
        }
      };

      const profileB = {
        profile: {
          uuid: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          metadata: { title: 'Profile B' },
          imports: [
            { href: '../profiles/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.json', 'include-all': {} }
          ],
          modify: {
            'set-parameters': [
              { 'param-id': 'ac-1_prm_1', values: ['Profile B Custom Value'] }
            ]
          }
        }
      };

      const cache = new Map();
      cache.set('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', baseCatalog);
      cache.set('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', profileA);

      const resolved = resolveProfileSync(profileB, cache);
      const param = resolved.catalog.controls[0].params[0];
      expect(param.label).toBe('Profile A Custom Label');
      expect(param.values).toEqual(['Profile B Custom Value']);
    });
  });

  // =========================================================================
  // SCENARIO 4: Schema and Property Edge Cases
  // =========================================================================
  describe('Scenario 4: Resolution Edge Cases and Empty Array Resilience', () => {
    it('S4-01: resolves profile cleanly when set-parameters is omitted or empty', () => {
      const baseCatalog = {
        catalog: {
          uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          controls: [
            { id: 'ac-1', params: [{ id: 'ac-1_prm_1', values: ['Base Value'] }] }
          ]
        }
      };

      const profile = {
        profile: {
          uuid: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          metadata: { title: 'Empty Modify Profile' },
          imports: [
            { href: '../catalogs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.json', 'include-all': {} }
          ],
          modify: {}
        }
      };

      const cache = new Map();
      cache.set('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', baseCatalog);

      const resolved = resolveProfileSync(profile, cache);
      expect(resolved.catalog.controls[0].params[0].values).toEqual(['Base Value']);
    });
  });
});
