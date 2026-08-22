import { createAction } from './types';

export function updatePOAMRoot(field: string, value: any) {
  return createAction('poam', 'UPDATE_ROOT', `Update POA&M root field ${field}`,
    (draft: any) => {
      draft['plan-of-action-and-milestones'][field] = value;
    });
}

export function updatePOAMList(listName: string, newList: any[]) {
  return createAction('poam', 'UPDATE_LIST', `Update list ${listName}`,
    (draft: any) => {
      draft['plan-of-action-and-milestones'][listName] = newList;
    });
}

export function savePOAMItem(itemType: string, item: any) {
  return createAction('poam', 'SAVE_ITEM', `Save item in ${itemType}`,
    (draft: any) => {
      const list = draft['plan-of-action-and-milestones'][itemType] || [];
      const idx = list.findIndex((x: any) => x.uuid === item.uuid);
      if (idx >= 0) {
        list[idx] = item;
      } else {
        list.push(item);
      }
      draft['plan-of-action-and-milestones'][itemType] = list;
    });
}

export function replacePOAM(newPoam: any) {
  return createAction('poam', 'REPLACE_POAM', 'Replace entire POA&M document',
    (draft: any) => {
      draft['plan-of-action-and-milestones'] = newPoam;
    });
}

export function importARFindingsAction(items: any[], observations: any[], risks: any[]) {
  return createAction('poam', 'IMPORT_AR_FINDINGS', 'Import findings from AR',
    (draft: any) => {
      const poam = draft['plan-of-action-and-milestones'];
      if (!poam) return;

      // Merge poam-items preserving UUIDs
      const existingItemUuids = new Set((poam['poam-items'] || []).map((i: any) => i.uuid));
      const newItems = items.filter((i: any) => i.uuid && !existingItemUuids.has(i.uuid));
      poam['poam-items'] = [...(poam['poam-items'] || []), ...newItems];

      // Merge observations preserving UUIDs
      const existingObsUuids = new Set((poam.observations || []).map((o: any) => o.uuid));
      const newObs = observations.filter(o => o.uuid && !existingObsUuids.has(o.uuid));
      poam.observations = [...(poam.observations || []), ...newObs];

      // Merge risks preserving UUIDs
      const existingRiskUuids = new Set((poam.risks || []).map((r: any) => r.uuid));
      const newRisks = risks.filter(r => r.uuid && !existingRiskUuids.has(r.uuid));
      poam.risks = [...(poam.risks || []), ...newRisks];
    });
}

