import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import {
  updateMappingRoot,
  setMappingProvenance,
  updateMappingProvenance,
  addMapping,
  updateMapping,
  removeMapping,
  updateResourceReference,
  addMapEntry,
  updateMapEntry,
  removeMapEntry,
  deleteMapEntries,
  setMapEntryRelationship,
  batchSetRelationship,
  replaceMappingCollection
} from '../../lib/document-actions/mapping-actions';

describe('Mapping Actions (DD-029)', () => {
  const createBaseDoc = () => ({
    'mapping-collection': {
      uuid: 'mc-uuid-1',
      metadata: {
        title: 'NIST to ISO Mapping',
        version: '1.0.0',
        'last-modified': '2026-09-01T00:00:00Z',
        'oscal-version': '1.2.2'
      },
      provenance: {
        method: 'human' as const,
        status: 'draft' as const,
        'matching-rationale': 'semantic' as const,
        'mapping-description': 'Initial mapping'
      },
      mappings: [
        {
          uuid: 'm-set-1',
          'source-resource': { href: 'catalog-nist.json', type: 'catalog' as const },
          'target-resource': { href: 'catalog-iso.json', type: 'catalog' as const },
          maps: [
            {
              uuid: 'map-1',
              relationship: 'equivalent-to' as const,
              sources: [{ 'id-ref': 'ac-1', type: 'control' as const }],
              targets: [{ 'id-ref': 'a.9.1.1', type: 'control' as const }]
            },
            {
              uuid: 'map-2',
              relationship: 'subset-of' as const,
              sources: [{ 'id-ref': 'ac-2', type: 'control' as const }],
              targets: [{ 'id-ref': 'a.9.2.1', type: 'control' as const }]
            }
          ]
        }
      ]
    }
  });

  it('updateMappingRoot updates root fields', () => {
    const base = createBaseDoc();
    const action = updateMappingRoot('metadata', {
      title: 'Updated Title',
      version: '2.0.0',
      'last-modified': '2026-09-02T00:00:00Z',
      'oscal-version': '1.2.2'
    });
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['mapping-collection'].metadata.title).toBe('Updated Title');
  });

  it('setMappingProvenance replaces provenance', () => {
    const base = createBaseDoc();
    const action = setMappingProvenance({
      method: 'ai-assisted',
      status: 'published',
      'matching-rationale': 'lexical',
      'mapping-description': 'AI generated mapping'
    });
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['mapping-collection'].provenance?.method).toBe('ai-assisted');
    expect(next['mapping-collection'].provenance?.status).toBe('published');
  });

  it('updateMappingProvenance partially updates provenance', () => {
    const base = createBaseDoc();
    const action = updateMappingProvenance({ status: 'final' as any });
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['mapping-collection'].provenance?.status).toBe('final');
    expect(next['mapping-collection'].provenance?.method).toBe('human');
  });

  it('addMapping adds a new framework mapping set', () => {
    const base = createBaseDoc();
    const action = addMapping({
      uuid: 'm-set-2',
      'source-resource': { href: 'catalog-cis.json', type: 'catalog' },
      'target-resource': { href: 'catalog-iso.json', type: 'catalog' }
    });
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['mapping-collection'].mappings).toHaveLength(2);
    expect(next['mapping-collection'].mappings[1].uuid).toBe('m-set-2');
  });

  it('updateMapping updates mapping set properties', () => {
    const base = createBaseDoc();
    const action = updateMapping('m-set-1', { remarks: 'Review completed' });
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['mapping-collection'].mappings[0].remarks).toBe('Review completed');
  });

  it('removeMapping removes mapping set and guarantees min 1 item', () => {
    const base = createBaseDoc();
    const action = removeMapping('m-set-1');
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['mapping-collection'].mappings).toHaveLength(1);
    expect(next['mapping-collection'].mappings[0].uuid).not.toBe('m-set-1');
  });

  it('updateResourceReference updates source/target resource refs', () => {
    const base = createBaseDoc();
    const action = updateResourceReference('source-resource', { href: 'new-source.json' });
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['mapping-collection'].mappings[0]['source-resource'].href).toBe('new-source.json');
  });

  it('addMapEntry adds a new map rule', () => {
    const base = createBaseDoc();
    const action = addMapEntry({
      uuid: 'map-3',
      relationship: 'superset-of',
      sources: [{ 'id-ref': 'ia-2', type: 'control' }],
      targets: [{ 'id-ref': 'a.9.4.2', type: 'control' }]
    });
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['mapping-collection'].mappings[0].maps).toHaveLength(3);
    expect(next['mapping-collection'].mappings[0].maps[2].uuid).toBe('map-3');
  });

  it('updateMapEntry patches a map rule', () => {
    const base = createBaseDoc();
    const action = updateMapEntry('map-1', {
      remarks: 'Validated by auditor',
      'confidence-score': 95
    });
    const next = produce(base, draft => { action.apply(draft); });
    const entry = next['mapping-collection'].mappings[0].maps.find(m => m.uuid === 'map-1');
    expect(entry?.remarks).toBe('Validated by auditor');
    expect(entry?.['confidence-score']).toBe(95);
  });

  it('removeMapEntry removes a single map rule', () => {
    const base = createBaseDoc();
    const action = removeMapEntry('map-1');
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['mapping-collection'].mappings[0].maps).toHaveLength(1);
    expect(next['mapping-collection'].mappings[0].maps[0].uuid).toBe('map-2');
  });

  it('deleteMapEntries deletes multiple map rules in batch', () => {
    const base = createBaseDoc();
    const action = deleteMapEntries(['map-1', 'map-2']);
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['mapping-collection'].mappings[0].maps).toHaveLength(0);
  });

  it('setMapEntryRelationship updates relation token', () => {
    const base = createBaseDoc();
    const action = setMapEntryRelationship('map-1', 'intersects-with');
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['mapping-collection'].mappings[0].maps[0].relationship).toBe('intersects-with');
  });

  it('batchSetRelationship sets relationship for multiple maps', () => {
    const base = createBaseDoc();
    const action = batchSetRelationship(['map-1', 'map-2'], 'no-relationship');
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['mapping-collection'].mappings[0].maps[0].relationship).toBe('no-relationship');
    expect(next['mapping-collection'].mappings[0].maps[1].relationship).toBe('no-relationship');
  });

  it('replaceMappingCollection replaces whole document', () => {
    const base = createBaseDoc();
    const action = replaceMappingCollection({
      'mapping-collection': {
        uuid: 'new-mc-uuid',
        metadata: { title: 'Fresh Mapping', version: '2.0.0', 'last-modified': '', 'oscal-version': '1.2.2' },
        mappings: []
      }
    });
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['mapping-collection'].uuid).toBe('new-mc-uuid');
  });
});
