import { createAction, DocumentAction } from './types';
import {
  MappingCollection,
  Mapping,
  MapEntry,
  MappingProvenance,
  MappingRelationship,
  MappingResourceReference
} from '../types/oscal';
import { generateUUID } from '../oscal-utils';

function getMC(draft: any): MappingCollection | null {
  if (!draft) return null;
  return draft['mapping-collection'] || draft['control-mapping'] || null;
}

function ensureMappings(mc: MappingCollection): Mapping[] {
  if (!mc.mappings || !Array.isArray(mc.mappings) || mc.mappings.length === 0) {
    mc.mappings = [
      {
        uuid: generateUUID(),
        'source-resource': { href: '', type: 'catalog' },
        'target-resource': { href: '', type: 'catalog' },
        maps: []
      }
    ];
  }
  return mc.mappings;
}

function findMapping(mc: MappingCollection, mappingUuid?: string): Mapping | null {
  const mappings = ensureMappings(mc);
  if (!mappingUuid) return mappings[0] || null;
  return mappings.find(m => m.uuid === mappingUuid) || mappings[0] || null;
}

export function updateMappingRoot(field: string, value: any): DocumentAction {
  return createAction('mapping', 'UPDATE_ROOT', `Update Mapping Collection root field ${field}`, (draft: any) => {
    const mc = getMC(draft);
    if (!mc) return;
    (mc as any)[field] = value;
  });
}

export function setMappingProvenance(provenance: MappingProvenance): DocumentAction {
  return createAction('mapping', 'SET_PROVENANCE', 'Set mapping collection provenance', (draft: any) => {
    const mc = getMC(draft);
    if (!mc) return;
    mc.provenance = { ...provenance };
  });
}

export function updateMappingProvenance(patch: Partial<MappingProvenance>): DocumentAction {
  return createAction('mapping', 'UPDATE_PROVENANCE', 'Update mapping collection provenance', (draft: any) => {
    const mc = getMC(draft);
    if (!mc) return;
    if (!mc.provenance) {
      mc.provenance = {
        method: 'human',
        'matching-rationale': 'semantic',
        status: 'draft',
        'mapping-description': ''
      };
    }
    Object.assign(mc.provenance, patch);
  });
}

export function addMapping(mappingData?: Partial<Mapping>): DocumentAction {
  return createAction('mapping', 'ADD_MAPPING', 'Add new mapping framework pair', (draft: any) => {
    const mc = getMC(draft);
    if (!mc) return;
    if (!mc.mappings) mc.mappings = [];

    const newMapping: Mapping = {
      uuid: mappingData?.uuid || generateUUID(),
      'source-resource': mappingData?.['source-resource'] || { href: '', type: 'catalog' },
      'target-resource': mappingData?.['target-resource'] || { href: '', type: 'catalog' },
      maps: mappingData?.maps || [],
      ...mappingData
    };
    mc.mappings.push(newMapping);
  });
}

export function updateMapping(mappingUuid: string, patch: Partial<Mapping>): DocumentAction {
  return createAction('mapping', 'UPDATE_MAPPING', `Update mapping ${mappingUuid}`, (draft: any) => {
    const mc = getMC(draft);
    if (!mc?.mappings) return;
    const target = mc.mappings.find(m => m.uuid === mappingUuid);
    if (target) {
      Object.assign(target, patch);
    }
  });
}

export function removeMapping(mappingUuid: string): DocumentAction {
  return createAction('mapping', 'REMOVE_MAPPING', `Remove mapping ${mappingUuid}`, (draft: any) => {
    const mc = getMC(draft);
    if (!mc?.mappings) return;
    mc.mappings = mc.mappings.filter(m => m.uuid !== mappingUuid);
    if (mc.mappings.length === 0) {
      ensureMappings(mc);
    }
  });
}

export function updateResourceReference(
  resourceKey: 'source-resource' | 'target-resource',
  patch: Partial<MappingResourceReference>,
  mappingUuid?: string
): DocumentAction {
  return createAction('mapping', 'UPDATE_RESOURCE', `Update ${resourceKey}`, (draft: any) => {
    const mc = getMC(draft);
    if (!mc) return;
    const mapping = findMapping(mc, mappingUuid);
    if (!mapping) return;
    if (!mapping[resourceKey]) {
      mapping[resourceKey] = { href: '', type: 'catalog' };
    }
    Object.assign(mapping[resourceKey], patch);
  });
}

export function addMapEntry(entryData?: Partial<MapEntry>, mappingUuid?: string): DocumentAction {
  return createAction('mapping', 'ADD_MAP_ENTRY', 'Add map entry', (draft: any) => {
    const mc = getMC(draft);
    if (!mc) return;
    const mapping = findMapping(mc, mappingUuid);
    if (!mapping) return;
    if (!mapping.maps) mapping.maps = [];

    const newEntry: MapEntry = {
      uuid: entryData?.uuid || generateUUID(),
      relationship: entryData?.relationship || 'equivalent-to',
      sources: entryData?.sources || [{ 'id-ref': '', type: 'control' }],
      targets: entryData?.targets || [{ 'id-ref': '', type: 'control' }],
      ...entryData
    };
    mapping.maps.push(newEntry);
  });
}

export function updateMapEntry(mapUuid: string, patch: Partial<MapEntry>, mappingUuid?: string): DocumentAction {
  return createAction('mapping', 'UPDATE_MAP_ENTRY', `Update map entry ${mapUuid}`, (draft: any) => {
    const mc = getMC(draft);
    if (!mc) return;
    const mapping = findMapping(mc, mappingUuid);
    if (!mapping?.maps) return;
    const entry = mapping.maps.find(m => m.uuid === mapUuid);
    if (entry) {
      Object.assign(entry, patch);
    }
  });
}

export function removeMapEntry(mapUuid: string, mappingUuid?: string): DocumentAction {
  return createAction('mapping', 'REMOVE_MAP_ENTRY', `Remove map entry ${mapUuid}`, (draft: any) => {
    const mc = getMC(draft);
    if (!mc) return;
    const mapping = findMapping(mc, mappingUuid);
    if (!mapping?.maps) return;
    mapping.maps = mapping.maps.filter(m => m.uuid !== mapUuid);
  });
}

export function deleteMapEntries(mapUuids: string[], mappingUuid?: string): DocumentAction {
  return createAction('mapping', 'DELETE_MAP_ENTRIES', `Delete ${mapUuids.length} map entries`, (draft: any) => {
    const mc = getMC(draft);
    if (!mc) return;
    const mapping = findMapping(mc, mappingUuid);
    if (!mapping?.maps) return;
    const uuidSet = new Set(mapUuids);
    mapping.maps = mapping.maps.filter(m => !uuidSet.has(m.uuid));
  });
}

export function setMapEntryRelationship(
  mapUuid: string,
  relationship: MappingRelationship,
  mappingUuid?: string
): DocumentAction {
  return createAction('mapping', 'SET_RELATIONSHIP', `Set map entry relationship to "${relationship}"`, (draft: any) => {
    const mc = getMC(draft);
    if (!mc) return;
    const mapping = findMapping(mc, mappingUuid);
    if (!mapping?.maps) return;
    const entry = mapping.maps.find(m => m.uuid === mapUuid);
    if (entry) {
      entry.relationship = relationship;
    }
  });
}

export function batchSetRelationship(
  mapUuids: string[],
  relationship: MappingRelationship,
  mappingUuid?: string
): DocumentAction {
  return createAction('mapping', 'BATCH_SET_RELATIONSHIP', `Batch set relationship to "${relationship}"`, (draft: any) => {
    const mc = getMC(draft);
    if (!mc) return;
    const mapping = findMapping(mc, mappingUuid);
    if (!mapping?.maps) return;
    const uuidSet = new Set(mapUuids);
    mapping.maps.forEach(m => {
      if (uuidSet.has(m.uuid)) {
        m.relationship = relationship;
      }
    });
  });
}

export function replaceMappingCollection(newDoc: any): DocumentAction {
  return createAction('mapping', 'REPLACE_DOC', 'Replace Mapping Collection document', (draft: any) => {
    const rootKey = draft['mapping-collection'] ? 'mapping-collection' : (draft['control-mapping'] ? 'control-mapping' : 'mapping-collection');
    draft[rootKey] = newDoc['mapping-collection'] || newDoc['control-mapping'] || newDoc;
  });
}
