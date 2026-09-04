import { describe, it, expect, vi } from 'vitest';
import {
  resolveProfilePartsForRendering,
  updateAlter,
  getAlterForControl,
  getModifiedPartIds,
  handleOriginalPartFieldChange
} from '../../lib/profile-alter-utils';
import { Profile, ProfileAlter, Part } from '../../lib/types/oscal';

describe('profile-alter-utils unit tests', () => {
  const sampleParts: Part[] = [
    {
      id: 'ac-1_smt',
      name: 'statement',
      prose: 'The organization establishes policy.'
    },
    {
      id: 'ac-1_gdn',
      name: 'guidance',
      prose: 'Guidance text for policy.'
    }
  ];

  describe('resolveProfilePartsForRendering', () => {
    it('returns original parts unchanged when alter is undefined or empty', () => {
      const rendered = resolveProfilePartsForRendering(sampleParts, undefined);
      expect(rendered).toHaveLength(2);
      expect(rendered[0].isModified).toBe(false);
      expect(rendered[0].isAdded).toBeUndefined();
      expect(rendered[0].isRemoved).toBe(false);
      expect(rendered[0].prose).toBe('The organization establishes policy.');
    });

    it('marks parts as removed when removal alter is present without replacement', () => {
      const alter: ProfileAlter = {
        'control-id': 'ac-1',
        removes: [{ 'by-id': 'ac-1_gdn' }]
      };
      const rendered = resolveProfilePartsForRendering(sampleParts, alter);
      expect(rendered[1].isRemoved).toBe(true);
      expect(rendered[1].isModified).toBe(false);
    });

    it('overlays modified prose when replacement addition is present', () => {
      const alter: ProfileAlter = {
        'control-id': 'ac-1',
        removes: [{ 'by-id': 'ac-1_smt' }],
        adds: [
          {
            position: 'after',
            'by-id': 'ac-1_smt',
            parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'Updated tailored statement prose.' }]
          }
        ]
      };
      const rendered = resolveProfilePartsForRendering(sampleParts, alter);
      expect(rendered[0].isModified).toBe(true);
      expect(rendered[0].isRemoved).toBe(false);
      expect(rendered[0].prose).toBe('Updated tailored statement prose.');
      expect(rendered[0].originalProse).toBe('The organization establishes policy.');
    });

    it('handles added parts at ending position', () => {
      const alter: ProfileAlter = {
        'control-id': 'ac-1',
        adds: [
          {
            position: 'ending',
            parts: [{ id: 'ac-1_custom_1', name: 'statement', prose: 'Appended custom statement.' }]
          }
        ]
      };
      const rendered = resolveProfilePartsForRendering(sampleParts, alter);
      expect(rendered).toHaveLength(3);
      expect(rendered[2].isAdded).toBe(true);
      expect(rendered[2].prose).toBe('Appended custom statement.');
    });

    it('handles added parts at starting position', () => {
      const alter: ProfileAlter = {
        'control-id': 'ac-1',
        adds: [
          {
            position: 'starting',
            parts: [{ id: 'ac-1_preamble', name: 'overview', prose: 'Introductory statement.' }]
          }
        ]
      };
      const rendered = resolveProfilePartsForRendering(sampleParts, alter);
      expect(rendered).toHaveLength(3);
      expect(rendered[0].isAdded).toBe(true);
      expect(rendered[0].prose).toBe('Introductory statement.');
    });
  });

  describe('updateAlter', () => {
    it('creates new alter entry when none exists and passes it to updateFn', () => {
      const mockProfile: Profile = {
        uuid: 'prof-1',
        metadata: { title: 'P1', lastModified: '2026-01-01', version: '1.0', oscalVersion: '1.0.0' },
        imports: []
      };
      const onProfileChange = vi.fn();

      updateAlter(mockProfile, 'ac-1', (alter) => {
        return {
          ...alter,
          adds: [{ position: 'ending', parts: [{ id: 'new_p', name: 'statement', prose: 'Added' }] }]
        };
      }, onProfileChange);

      expect(onProfileChange).toHaveBeenCalled();
      const updated = onProfileChange.mock.calls[0][0];
      expect(updated.modify?.alters).toHaveLength(1);
      expect(updated.modify?.alters[0]['control-id']).toBe('ac-1');
      expect(updated.modify?.alters[0].adds).toHaveLength(1);
    });

    it('prunes alter entry if updateFn returns empty adds and removes', () => {
      const mockProfile: Profile = {
        uuid: 'prof-1',
        metadata: { title: 'P1', lastModified: '2026-01-01', version: '1.0', oscalVersion: '1.0.0' },
        imports: [],
        modify: {
          alters: [{ 'control-id': 'ac-1', removes: [{ 'by-id': 'ac-1_smt' }] }]
        }
      };
      const onProfileChange = vi.fn();

      updateAlter(mockProfile, 'ac-1', (alter) => {
        return { ...alter, removes: [] };
      }, onProfileChange);

      expect(onProfileChange).toHaveBeenCalled();
      const updated = onProfileChange.mock.calls[0][0];
      expect(updated.modify?.alters).toBeUndefined();
    });
  });

  describe('getAlterForControl and getModifiedPartIds', () => {
    it('finds alter by case-insensitive control-id', () => {
      const mockProfile: Profile = {
        uuid: 'prof-1',
        metadata: { title: 'P1', lastModified: '2026-01-01', version: '1.0', oscalVersion: '1.0.0' },
        imports: [],
        modify: {
          alters: [{ 'control-id': 'AC-1', removes: [{ 'by-id': 'ac-1_smt' }] }]
        }
      };
      const alter = getAlterForControl(mockProfile, 'ac-1');
      expect(alter).toBeDefined();
      expect(alter?.['control-id']).toBe('AC-1');
    });

    it('extracts modified part IDs when remove and add match', () => {
      const mockProfile: Profile = {
        uuid: 'prof-1',
        metadata: { title: 'P1', lastModified: '2026-01-01', version: '1.0', oscalVersion: '1.0.0' },
        imports: [],
        modify: {
          alters: [
            {
              'control-id': 'ac-1',
              removes: [{ 'by-id': 'ac-1_smt' }],
              adds: [{ position: 'after', 'by-id': 'ac-1_smt', parts: [{ id: 'ac-1_smt', prose: 'mod' }] }]
            }
          ]
        }
      };
      const modifiedIds = getModifiedPartIds(mockProfile, 'ac-1');
      expect(modifiedIds).toEqual(['ac-1_smt']);
    });
  });

  describe('handleOriginalPartFieldChange', () => {
    it('updates altered prose and resets when value is restored to original baseline', () => {
      const mockProfile: Profile = {
        uuid: 'prof-1',
        metadata: { title: 'P1', lastModified: '2026-01-01', version: '1.0', oscalVersion: '1.0.0' },
        imports: []
      };
      const onProfileChange = vi.fn();

      // Change prose from original baseline
      handleOriginalPartFieldChange(
        'ac-1_smt',
        'prose',
        'Tailored prose',
        { originalName: 'statement', originalProse: 'Original baseline' },
        'ac-1',
        mockProfile,
        onProfileChange
      );

      expect(onProfileChange).toHaveBeenCalled();
      const updated1 = onProfileChange.mock.calls[0][0];
      expect(updated1.modify?.alters[0].adds[0].parts[0].prose).toBe('Tailored prose');

      // Now reset back to original baseline value
      const onProfileChange2 = vi.fn();
      handleOriginalPartFieldChange(
        'ac-1_smt',
        'prose',
        'Original baseline',
        { originalName: 'statement', originalProse: 'Original baseline' },
        'ac-1',
        updated1,
        onProfileChange2
      );

      expect(onProfileChange2).toHaveBeenCalled();
      const updated2 = onProfileChange2.mock.calls[0][0];
      // Alter should be cleaned up because it returned to original baseline
      expect(updated2.modify?.alters).toBeUndefined();
    });
  });
});
