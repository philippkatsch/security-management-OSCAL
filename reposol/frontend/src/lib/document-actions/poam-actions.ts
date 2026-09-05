import { createAction, DocumentAction } from './types';
import {
  PlanOfActionAndMilestones,
  POAMItem,
  Finding,
  Observation,
  Risk,
  DefinedComponent,
  SystemUser
} from '../types/oscal';
import { generateUUID } from '../oscal-utils';

function getPOAM(draft: any): PlanOfActionAndMilestones | null {
  if (!draft) return null;
  return draft['plan-of-action-and-milestones'] || draft;
}

export function updatePOAMRoot(field: string, value: any): DocumentAction {
  return createAction('poam', 'UPDATE_ROOT', `Update POA&M root field ${field}`, (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam) return;
    (poam as any)[field] = value;
  });
}

export function updatePOAMList(listName: string, newList: any[]): DocumentAction {
  return createAction('poam', 'UPDATE_LIST', `Update list ${listName}`, (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam) return;
    (poam as any)[listName] = newList;
  });
}

export function savePOAMItem(itemType: string, item: any): DocumentAction {
  return createAction('poam', 'SAVE_ITEM', `Save item in ${itemType}`, (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam) return;
    const list = (poam as any)[itemType] || [];
    const idx = list.findIndex((x: any) => x.uuid === item.uuid);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.push(item);
    }
    (poam as any)[itemType] = list;
  });
}

export function replacePOAM(newPoam: any): DocumentAction {
  return createAction('poam', 'REPLACE_POAM', 'Replace entire POA&M document', (draft: any) => {
    draft['plan-of-action-and-milestones'] = newPoam['plan-of-action-and-milestones'] || newPoam;
  });
}

export function importARFindingsAction(items: any[], observations: any[], risks: any[]): DocumentAction {
  return createAction('poam', 'IMPORT_AR_FINDINGS', 'Import findings from AR', (draft: any) => {
    const poam = getPOAM(draft);
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

// ============================================================================
// Granular POAM Items Actions
// ============================================================================

export function addPOAMItem(itemData?: Partial<POAMItem>): DocumentAction {
  return createAction('poam', 'ADD_POAM_ITEM', 'Add POA&M item', (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam) return;
    if (!poam['poam-items']) poam['poam-items'] = [];

    const newItem: POAMItem = {
      uuid: itemData?.uuid || generateUUID(),
      title: itemData?.title || 'New Remediation Item',
      description: itemData?.description || '',
      props: itemData?.props || [{ name: 'status', value: 'open' }],
      'related-observations': itemData?.['related-observations'] || [],
      'related-risks': itemData?.['related-risks'] || [],
      'related-findings': itemData?.['related-findings'] || [],
      ...itemData
    };
    poam['poam-items'].push(newItem);
  });
}

export function updatePOAMItem(itemUuid: string, patch: Partial<POAMItem>): DocumentAction {
  return createAction('poam', 'UPDATE_POAM_ITEM', `Update POA&M item ${itemUuid}`, (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam?.['poam-items']) return;
    const target = poam['poam-items'].find(i => i.uuid === itemUuid);
    if (target) {
      Object.assign(target, patch);
    }
  });
}

export function removePOAMItem(itemUuid: string): DocumentAction {
  return createAction('poam', 'REMOVE_POAM_ITEM', `Remove POA&M item ${itemUuid}`, (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam?.['poam-items']) return;
    poam['poam-items'] = poam['poam-items'].filter(i => i.uuid !== itemUuid);
  });
}

export function deletePOAMItems(itemUuids: string[]): DocumentAction {
  return createAction('poam', 'DELETE_POAM_ITEMS', `Delete ${itemUuids.length} POA&M items`, (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam?.['poam-items']) return;
    const uuidSet = new Set(itemUuids);
    poam['poam-items'] = poam['poam-items'].filter(i => !uuidSet.has(i.uuid));
  });
}

// ============================================================================
// Findings Actions (Root Level)
// ============================================================================

export function addPOAMFinding(findingData?: Partial<Finding>): DocumentAction {
  return createAction('poam', 'ADD_FINDING', 'Add POA&M root finding', (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam) return;
    if (!poam.findings) poam.findings = [];

    const newFinding: Finding = {
      uuid: findingData?.uuid || generateUUID(),
      title: findingData?.title || 'New Finding',
      description: findingData?.description || '',
      target: findingData?.target || {
        type: 'statement-id',
        'target-id': '',
        status: { state: 'not-satisfied' }
      },
      ...findingData
    };
    poam.findings.push(newFinding);
  });
}

export function updatePOAMFinding(findingUuid: string, patch: Partial<Finding>): DocumentAction {
  return createAction('poam', 'UPDATE_FINDING', `Update POA&M finding ${findingUuid}`, (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam?.findings) return;
    const target = poam.findings.find(f => f.uuid === findingUuid);
    if (target) {
      Object.assign(target, patch);
    }
  });
}

export function removePOAMFinding(findingUuid: string): DocumentAction {
  return createAction('poam', 'REMOVE_FINDING', `Remove POA&M finding ${findingUuid}`, (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam?.findings) return;
    poam.findings = poam.findings.filter(f => f.uuid !== findingUuid);
  });
}

export function deletePOAMFindings(findingUuids: string[]): DocumentAction {
  return createAction('poam', 'DELETE_FINDINGS', `Delete ${findingUuids.length} findings`, (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam?.findings) return;
    const uuidSet = new Set(findingUuids);
    poam.findings = poam.findings.filter(f => !uuidSet.has(f.uuid));
  });
}

// ============================================================================
// Observations Actions (Root Level)
// ============================================================================

export function addPOAMObservation(obsData?: Partial<Observation>): DocumentAction {
  return createAction('poam', 'ADD_OBSERVATION', 'Add POA&M root observation', (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam) return;
    if (!poam.observations) poam.observations = [];

    const newObs: Observation = {
      uuid: obsData?.uuid || generateUUID(),
      title: obsData?.title || 'New Observation',
      description: obsData?.description || '',
      methods: obsData?.methods || ['EXAMINE'],
      collected: obsData?.collected || new Date().toISOString(),
      ...obsData
    };
    poam.observations.push(newObs);
  });
}

export function updatePOAMObservation(obsUuid: string, patch: Partial<Observation>): DocumentAction {
  return createAction('poam', 'UPDATE_OBSERVATION', `Update POA&M observation ${obsUuid}`, (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam?.observations) return;
    const target = poam.observations.find(o => o.uuid === obsUuid);
    if (target) {
      Object.assign(target, patch);
    }
  });
}

export function removePOAMObservation(obsUuid: string): DocumentAction {
  return createAction('poam', 'REMOVE_OBSERVATION', `Remove POA&M observation ${obsUuid}`, (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam?.observations) return;
    poam.observations = poam.observations.filter(o => o.uuid !== obsUuid);
  });
}

export function deletePOAMObservations(obsUuids: string[]): DocumentAction {
  return createAction('poam', 'DELETE_OBSERVATIONS', `Delete ${obsUuids.length} observations`, (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam?.observations) return;
    const uuidSet = new Set(obsUuids);
    poam.observations = poam.observations.filter(o => !uuidSet.has(o.uuid));
  });
}

// ============================================================================
// Risks Actions (Root Level)
// ============================================================================

export function addPOAMRisk(riskData?: Partial<Risk>): DocumentAction {
  return createAction('poam', 'ADD_RISK', 'Add POA&M root risk', (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam) return;
    if (!poam.risks) poam.risks = [];

    const newRisk: Risk = {
      uuid: riskData?.uuid || generateUUID(),
      title: riskData?.title || 'New Identified Risk',
      description: riskData?.description || '',
      statement: riskData?.statement || 'Remediation risk requiring mitigation or tracking.',
      status: riskData?.status || 'open',
      ...riskData
    };
    poam.risks.push(newRisk);
  });
}

export function updatePOAMRisk(riskUuid: string, patch: Partial<Risk>): DocumentAction {
  return createAction('poam', 'UPDATE_RISK', `Update POA&M risk ${riskUuid}`, (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam?.risks) return;
    const target = poam.risks.find(r => r.uuid === riskUuid);
    if (target) {
      Object.assign(target, patch);
    }
  });
}

export function removePOAMRisk(riskUuid: string): DocumentAction {
  return createAction('poam', 'REMOVE_RISK', `Remove POA&M risk ${riskUuid}`, (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam?.risks) return;
    poam.risks = poam.risks.filter(r => r.uuid !== riskUuid);
  });
}

export function deletePOAMRisks(riskUuids: string[]): DocumentAction {
  return createAction('poam', 'DELETE_RISKS', `Delete ${riskUuids.length} risks`, (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam?.risks) return;
    const uuidSet = new Set(riskUuids);
    poam.risks = poam.risks.filter(r => !uuidSet.has(r.uuid));
  });
}

// ============================================================================
// Scoping & Local Definitions Actions
// ============================================================================

export function setPOAMImportSSP(href: string, remarks?: string): DocumentAction {
  return createAction('poam', 'SET_IMPORT_SSP', `Set import-ssp href to "${href}"`, (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam) return;
    poam['import-ssp'] = { href, ...(remarks ? { remarks } : {}) };
  });
}

export function setPOAMSystemId(id: string, identifierType?: string): DocumentAction {
  return createAction('poam', 'SET_SYSTEM_ID', `Set system-id to "${id}"`, (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam) return;
    poam['system-id'] = { id, ...(identifierType ? { 'identifier-type': identifierType } : {}) };
  });
}

export function addPOAMLocalComponent(componentData?: Partial<DefinedComponent>): DocumentAction {
  return createAction('poam', 'ADD_LOCAL_COMP', 'Add local definition component', (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam) return;
    if (!poam['local-definitions']) poam['local-definitions'] = {};
    if (!poam['local-definitions'].components) poam['local-definitions'].components = [];

    const newComp: DefinedComponent = {
      uuid: componentData?.uuid || generateUUID(),
      type: componentData?.type || 'software',
      title: componentData?.title || 'Local Remediation Component',
      description: componentData?.description || '',
      ...componentData
    };
    poam['local-definitions'].components.push(newComp);
  });
}

export function updatePOAMLocalComponent(componentUuid: string, patch: Partial<DefinedComponent>): DocumentAction {
  return createAction('poam', 'UPDATE_LOCAL_COMP', `Update local component ${componentUuid}`, (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam?.['local-definitions']?.components) return;
    const target = poam['local-definitions'].components.find(c => c.uuid === componentUuid);
    if (target) {
      Object.assign(target, patch);
    }
  });
}

export function removePOAMLocalComponent(componentUuid: string): DocumentAction {
  return createAction('poam', 'REMOVE_LOCAL_COMP', `Remove local component ${componentUuid}`, (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam?.['local-definitions']?.components) return;
    poam['local-definitions'].components = poam['local-definitions'].components.filter(c => c.uuid !== componentUuid);
  });
}

export function addPOAMLocalUser(userData?: Partial<SystemUser>): DocumentAction {
  return createAction('poam', 'ADD_LOCAL_USER', 'Add local remediation user', (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam) return;
    if (!poam['local-definitions']) poam['local-definitions'] = {};
    if (!poam['local-definitions'].users) poam['local-definitions'].users = [];

    const newUser: SystemUser = {
      uuid: userData?.uuid || generateUUID(),
      title: userData?.title || 'Remediation Assignee',
      description: userData?.description || '',
      ...userData
    };
    poam['local-definitions'].users.push(newUser);
  });
}

export function updatePOAMLocalUser(userUuid: string, patch: Partial<SystemUser>): DocumentAction {
  return createAction('poam', 'UPDATE_LOCAL_USER', `Update local user ${userUuid}`, (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam?.['local-definitions']?.users) return;
    const target = poam['local-definitions'].users.find(u => u.uuid === userUuid);
    if (target) {
      Object.assign(target, patch);
    }
  });
}

export function removePOAMLocalUser(userUuid: string): DocumentAction {
  return createAction('poam', 'REMOVE_LOCAL_USER', `Remove local user ${userUuid}`, (draft: any) => {
    const poam = getPOAM(draft);
    if (!poam?.['local-definitions']?.users) return;
    poam['local-definitions'].users = poam['local-definitions'].users.filter(u => u.uuid !== userUuid);
  });
}
