import { describe, it, expect } from 'vitest';
import { getAncestorsPath, getGroupParamsForControl, getAllVisibleParamsMap } from '../../lib/catalog-utils';
import { Catalog } from '../../lib/types/oscal';

describe('catalog-utils unit tests', () => {
  const mockCatalog: Catalog = {
    uuid: 'cat-1',
    metadata: {
      title: 'Sample Catalog',
      lastModified: '2026-01-01T00:00:00Z',
      version: '1.0',
      oscalVersion: '1.0.0'
    },
    params: [
      { id: 'cat_prm_1', label: 'Catalog Level Param 1' },
      { id: 'shared_prm', label: 'Catalog Shared Param' }
    ],
    groups: [
      {
        id: 'group-ac',
        title: 'Access Control',
        params: [
          { id: 'ac_grp_prm_1', label: 'AC Group Param 1' },
          { id: 'shared_prm', label: 'AC Group Overridden Param' }
        ],
        groups: [
          {
            id: 'subgroup-policy',
            title: 'Policy & Procedures',
            params: [
              { id: 'sub_grp_prm_1', label: 'Subgroup Param 1' }
            ],
            controls: [
              {
                id: 'ac-1',
                title: 'Policy and Procedures',
                params: [
                  { id: 'ac-1_prm_1', label: 'Control Param 1' },
                  { id: 'shared_prm', label: 'Control Specific Overridden Param' }
                ]
              }
            ]
          }
        ],
        controls: [
          {
            id: 'ac-2',
            title: 'Account Management',
            params: [
              { id: 'ac-2_prm_1', label: 'AC-2 Param' }
            ]
          }
        ]
      }
    ],
    controls: [
      {
        id: 'root-ctrl-1',
        title: 'Root Control Outside Groups',
        params: [
          { id: 'root_prm_1', label: 'Root Param' }
        ]
      }
    ]
  };

  describe('getAncestorsPath', () => {
    it('returns empty array when targetId or catalogData is missing', () => {
      expect(getAncestorsPath('', mockCatalog)).toEqual([]);
      expect(getAncestorsPath('ac-1', undefined)).toEqual([]);
    });

    it('returns empty array for root level controls not inside any group', () => {
      const path = getAncestorsPath('root-ctrl-1', mockCatalog);
      expect(path).toEqual([]);
    });

    it('returns correct ancestor path for top-level group child', () => {
      const path = getAncestorsPath('ac-2', mockCatalog);
      expect(path).toEqual([
        { id: 'group-ac', title: 'Access Control' }
      ]);
    });

    it('returns hierarchical ancestor path for nested subgroup controls', () => {
      const path = getAncestorsPath('ac-1', mockCatalog);
      expect(path).toEqual([
        { id: 'group-ac', title: 'Access Control' },
        { id: 'subgroup-policy', title: 'Policy & Procedures' }
      ]);
    });

    it('returns empty array when targetId does not exist in catalog', () => {
      const path = getAncestorsPath('non-existent-id', mockCatalog);
      expect(path).toEqual([]);
    });
  });

  describe('getGroupParamsForControl', () => {
    it('returns empty array when control has no ancestor groups or catalog is undefined', () => {
      expect(getGroupParamsForControl('root-ctrl-1', mockCatalog)).toEqual([]);
      expect(getGroupParamsForControl('ac-1', undefined)).toEqual([]);
    });

    it('collects parameters across all ancestor group tiers', () => {
      const params = getGroupParamsForControl('ac-1', mockCatalog);
      expect(params).toHaveLength(3);
      expect(params.map(p => p.id)).toEqual(['ac_grp_prm_1', 'shared_prm', 'sub_grp_prm_1']);
    });

    it('collects parameters for direct group controls', () => {
      const params = getGroupParamsForControl('ac-2', mockCatalog);
      expect(params).toHaveLength(2);
      expect(params.map(p => p.id)).toEqual(['ac_grp_prm_1', 'shared_prm']);
    });
  });

  describe('getAllVisibleParamsMap', () => {
    it('resolves and correctly overrides parameters from catalog -> group -> control levels', () => {
      const controlParams = [
        { id: 'ac-1_prm_1', label: 'Control Param 1' },
        { id: 'shared_prm', label: 'Control Specific Overridden Param' }
      ];

      const visibleMap = getAllVisibleParamsMap('ac-1', controlParams, mockCatalog);

      expect(visibleMap['cat_prm_1']).toEqual({ id: 'cat_prm_1', label: 'Catalog Level Param 1' });
      expect(visibleMap['ac_grp_prm_1']).toEqual({ id: 'ac_grp_prm_1', label: 'AC Group Param 1' });
      expect(visibleMap['sub_grp_prm_1']).toEqual({ id: 'sub_grp_prm_1', label: 'Subgroup Param 1' });
      expect(visibleMap['ac-1_prm_1']).toEqual({ id: 'ac-1_prm_1', label: 'Control Param 1' });

      // Verification of override precedence: control param overrides group & catalog param
      expect(visibleMap['shared_prm'].label).toBe('Control Specific Overridden Param');
    });

    it('handles undefined catalogData gracefully', () => {
      const controlParams = [{ id: 'ctrl_prm', label: 'Ctrl Param' }];
      const map = getAllVisibleParamsMap('ctrl-1', controlParams, undefined);
      expect(map['ctrl_prm']).toEqual({ id: 'ctrl_prm', label: 'Ctrl Param' });
      expect(Object.keys(map)).toHaveLength(1);
    });
  });
});
