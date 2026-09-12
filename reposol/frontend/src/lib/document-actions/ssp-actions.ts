import { createAction, DocumentAction } from './types';
import {
  SystemSecurityPlan,
  SystemCharacteristics,
  SystemId,
  SystemStatus,
  SystemStatusState,
  SystemInformation,
  InformationType,
  InformationTypeCategorization,
  ImpactLevel,
  SecurityImpactLevel,
  AuthorizationBoundary,
  NetworkArchitecture,
  DataFlow,
  Diagram,
  SystemImplementation,
  SystemComponentType,
  SystemComponent,
  SystemUser,
  AuthorizedPrivilege,
  LeveragedAuthorization,
  InventoryItem,
  ImplementedComponent,
  ControlImplementation,
  ImplementedRequirement,
  ByComponent,
  ImplementationStatus,
  ImplementationStatusState,
  StatementImplementation,
  SetParameter,
  InheritedControlImplementation,
  SatisfiedControlImplementation,
  ExportControlImplementation,
  ProvidedControlImplementation,
  ResponsibilityControlImplementation,
  ResponsibleParty,
  ResponsibleRole,
  Property,
  Link
} from '../types/oscal';
import { generateUUID } from '../oscal-utils';

// ============================================================================
// Internal Traversal Helpers
// ============================================================================

function getSSP(draft: any): SystemSecurityPlan | null {
  if (!draft) return null;
  return draft['system-security-plan'] || draft;
}

function ensureSystemCharacteristics(draft: any): SystemCharacteristics | null {
  const ssp = getSSP(draft);
  if (!ssp) return null;
  if (!ssp['system-characteristics']) {
    ssp['system-characteristics'] = {
      'system-ids': [{ id: `sys-${Date.now().toString(36)}` }],
      'system-name': 'New Information System',
      description: '',
      'security-sensitivity-level': 'moderate',
      status: { state: 'operational' },
      'system-information': { 'information-types': [] },
      'authorization-boundary': { description: '' }
    };
  }
  return ssp['system-characteristics'];
}

function ensureSystemImplementation(draft: any): SystemImplementation | null {
  const ssp = getSSP(draft);
  if (!ssp) return null;
  if (!ssp['system-implementation']) {
    ssp['system-implementation'] = {
      users: [],
      components: []
    };
  }
  if (!ssp['system-implementation'].components) {
    ssp['system-implementation'].components = [];
  }
  if (!ssp['system-implementation'].users) {
    ssp['system-implementation'].users = [];
  }
  return ssp['system-implementation'];
}

function ensureControlImplementation(draft: any): ControlImplementation | null {
  const ssp = getSSP(draft);
  if (!ssp) return null;
  if (!ssp['control-implementation']) {
    ssp['control-implementation'] = {
      description: '',
      'implemented-requirements': []
    };
  }
  if (!ssp['control-implementation']['implemented-requirements']) {
    ssp['control-implementation']['implemented-requirements'] = [];
  }
  return ssp['control-implementation'];
}

function findImplementedRequirement(
  draft: any,
  controlIdOrUuid: string
): ImplementedRequirement | null {
  const ctrlImp = ensureControlImplementation(draft);
  if (!ctrlImp || !ctrlImp['implemented-requirements']) return null;
  return (
    ctrlImp['implemented-requirements'].find(
      req => req['control-id'] === controlIdOrUuid || req.uuid === controlIdOrUuid
    ) || null
  );
}

function findSystemComponent(draft: any, componentUuid: string): SystemComponent | null {
  const sysImp = ensureSystemImplementation(draft);
  if (!sysImp || !sysImp.components) return null;
  return sysImp.components.find(c => c.uuid === componentUuid) || null;
}

function findSystemUser(draft: any, userUuid: string): SystemUser | null {
  const sysImp = ensureSystemImplementation(draft);
  if (!sysImp || !sysImp.users) return null;
  return sysImp.users.find(u => u.uuid === userUuid) || null;
}

function findInventoryItem(draft: any, itemUuid: string): InventoryItem | null {
  const sysImp = ensureSystemImplementation(draft);
  if (!sysImp || !sysImp['inventory-items']) return null;
  return sysImp['inventory-items'].find(item => item.uuid === itemUuid) || null;
}

function findLeveragedAuthorization(
  draft: any,
  authUuid: string
): LeveragedAuthorization | null {
  const sysImp = ensureSystemImplementation(draft);
  if (!sysImp || !sysImp['leveraged-authorizations']) return null;
  return sysImp['leveraged-authorizations'].find(auth => auth.uuid === authUuid) || null;
}

function findStatement(
  req: ImplementedRequirement,
  statementIdOrUuid: string
): StatementImplementation | null {
  if (!req.statements) return null;
  return (
    req.statements.find(
      s => s['statement-id'] === statementIdOrUuid || s.uuid === statementIdOrUuid
    ) || null
  );
}

function findByComponent(
  container: { 'by-components'?: ByComponent[] },
  byCompUuid: string
): ByComponent | null {
  if (!container['by-components']) return null;
  return (
    container['by-components'].find(
      bc => bc.uuid === byCompUuid || bc['component-uuid'] === byCompUuid
    ) || null
  );
}

function upsertSetParameterList(
  container: { 'set-parameters'?: SetParameter[] },
  paramId: string,
  values: string[],
  remarks?: string
): void {
  if (!values || values.length === 0) {
    if (container['set-parameters']) {
      container['set-parameters'] = container['set-parameters'].filter(
        p => p['param-id'] !== paramId
      );
      if (container['set-parameters'].length === 0) {
        delete container['set-parameters'];
      }
    }
    return;
  }
  if (!container['set-parameters']) {
    container['set-parameters'] = [];
  }
  const existing = container['set-parameters'].find(p => p['param-id'] === paramId);
  if (existing) {
    existing.values = [...values];
    if (remarks !== undefined) existing.remarks = remarks;
  } else {
    const newParam: SetParameter = {
      'param-id': paramId,
      values: [...values]
    };
    if (remarks) newParam.remarks = remarks;
    container['set-parameters'].push(newParam);
  }
}

// ============================================================================
// Empty Array Purging per DD-014
// ============================================================================

const PRESERVE_EMPTY_ARRAYS = new Set(['maps', 'mappings', 'sources', 'targets']);

export function cleanSSPEmptyArrays(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj
      .map(cleanSSPEmptyArrays)
      .filter((item: unknown) => item !== undefined);
  } else if (obj !== null && typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (Array.isArray(val) && val.length === 0 && !PRESERVE_EMPTY_ARRAYS.has(key)) {
        continue;
      }
      cleaned[key] = cleanSSPEmptyArrays(val);
    }
    return cleaned;
  }
  return obj;
}

function purgeEmptyArraysInPlace(obj: any): void {
  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        purgeEmptyArraysInPlace(obj[i]);
      }
    } else {
      for (const [key, val] of Object.entries(obj)) {
        if (Array.isArray(val)) {
          if (val.length === 0 && !PRESERVE_EMPTY_ARRAYS.has(key)) {
            delete obj[key];
          } else {
            for (const item of val) {
              purgeEmptyArraysInPlace(item);
            }
          }
        } else if (val && typeof val === 'object') {
          purgeEmptyArraysInPlace(val);
        }
      }
    }
  }
}

export function purgeSSPEmptyArrays(): DocumentAction {
  return createAction('ssp', 'PURGE_EMPTY_ARRAYS', 'Purge empty arrays from SSP per DD-014', (draft: any) => {
    const ssp = getSSP(draft);
    if (ssp) {
      purgeEmptyArraysInPlace(ssp);
    }
  });
}

// ============================================================================
// 1. System Characteristics Actions (FE-SSP-02)
// ============================================================================

export function setSystemCharacteristics(characteristics: Partial<SystemCharacteristics>): DocumentAction {
  return createAction('ssp', 'SET_SYSTEM_CHARACTERISTICS', 'Set system characteristics', (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar) return;
    Object.assign(sysChar, characteristics);
  });
}

export function setSystemName(name: string): DocumentAction {
  return createAction('ssp', 'SET_SYSTEM_NAME', `Set system name to "${name}"`, (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar) return;
    sysChar['system-name'] = name;
  });
}

export function setSystemShortName(shortName: string): DocumentAction {
  return createAction('ssp', 'SET_SYSTEM_SHORT_NAME', `Set system short name to "${shortName}"`, (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar) return;
    if (shortName && shortName.trim()) {
      sysChar['system-name-short'] = shortName.trim();
    } else {
      delete sysChar['system-name-short'];
    }
  });
}

export function setSystemDescription(description: string): DocumentAction {
  return createAction('ssp', 'SET_SYSTEM_DESCRIPTION', 'Set system description', (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar) return;
    sysChar.description = description;
  });
}

export function setSystemIds(systemIds: SystemId[]): DocumentAction {
  return createAction('ssp', 'SET_SYSTEM_IDS', 'Set system IDs', (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar) return;
    sysChar['system-ids'] = [...systemIds];
  });
}

export function addSystemId(systemId: SystemId): DocumentAction {
  return createAction('ssp', 'ADD_SYSTEM_ID', `Add system ID "${systemId.id}"`, (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar) return;
    if (!sysChar['system-ids']) {
      sysChar['system-ids'] = [];
    }
    sysChar['system-ids'].push({ ...systemId });
  });
}

export function removeSystemId(id: string): DocumentAction {
  return createAction('ssp', 'REMOVE_SYSTEM_ID', `Remove system ID "${id}"`, (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar || !sysChar['system-ids']) return;
    sysChar['system-ids'] = sysChar['system-ids'].filter(item => item.id !== id);
  });
}

export function setSystemStatus(
  status: SystemStatus | SystemStatusState,
  remarks?: string
): DocumentAction {
  return createAction('ssp', 'SET_SYSTEM_STATUS', 'Set system operational status', (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar) return;
    if (typeof status === 'string') {
      sysChar.status = {
        state: status,
        ...(remarks ? { remarks } : {})
      };
    } else {
      sysChar.status = {
        ...status,
        ...(remarks ? { remarks } : {})
      };
    }
  });
}

export function setSecuritySensitivityLevel(level: string): DocumentAction {
  return createAction('ssp', 'SET_SECURITY_SENSITIVITY_LEVEL', `Set security sensitivity level to "${level}"`, (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar) return;
    sysChar['security-sensitivity-level'] = level;
  });
}

export function setDateAuthorized(date: string): DocumentAction {
  return createAction('ssp', 'SET_DATE_AUTHORIZED', `Set date authorized to "${date}"`, (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar) return;
    if (date && date.trim()) {
      sysChar['date-authorized'] = date.trim();
    } else {
      delete sysChar['date-authorized'];
    }
  });
}

export function setSecurityImpactLevel(impactLevel: SecurityImpactLevel): DocumentAction {
  return createAction('ssp', 'SET_SECURITY_IMPACT_LEVEL', 'Set security impact level (FIPS-199)', (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar) return;
    sysChar['security-impact-level'] = { ...impactLevel };
  });
}

export function addInformationType(infoType: InformationType): DocumentAction {
  return createAction('ssp', 'ADD_INFORMATION_TYPE', `Add information type "${infoType.title}"`, (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar) return;
    if (!sysChar['system-information']) {
      sysChar['system-information'] = { 'information-types': [] };
    }
    if (!sysChar['system-information']['information-types']) {
      sysChar['system-information']['information-types'] = [];
    }
    const newType: InformationType = {
      ...infoType,
      uuid: infoType.uuid || generateUUID(),
      title: infoType.title || 'New Information Type',
      description: infoType.description || '',
    };
    sysChar['system-information']['information-types'].push(newType);
  });
}

export function updateInformationType(
  uuidOrIndex: string | number,
  updates: Partial<InformationType>
): DocumentAction {
  return createAction('ssp', 'UPDATE_INFORMATION_TYPE', `Update information type ${uuidOrIndex}`, (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar?.['system-information']?.['information-types']) return;
    const list = sysChar['system-information']['information-types'];
    const idx =
      typeof uuidOrIndex === 'number'
        ? uuidOrIndex
        : list.findIndex(item => item.uuid === uuidOrIndex);
    if (idx >= 0 && idx < list.length) {
      list[idx] = { ...list[idx], ...updates };
    }
  });
}

export function removeInformationType(uuidOrIndex: string | number): DocumentAction {
  return createAction('ssp', 'REMOVE_INFORMATION_TYPE', `Remove information type ${uuidOrIndex}`, (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar?.['system-information']?.['information-types']) return;
    const list = sysChar['system-information']['information-types'];
    if (typeof uuidOrIndex === 'number') {
      if (uuidOrIndex >= 0 && uuidOrIndex < list.length) {
        list.splice(uuidOrIndex, 1);
      }
    } else {
      sysChar['system-information']['information-types'] = list.filter(
        item => item.uuid !== uuidOrIndex
      );
    }
  });
}

export function setAuthorizationBoundary(boundary: AuthorizationBoundary | string): DocumentAction {
  return createAction('ssp', 'SET_AUTHORIZATION_BOUNDARY', 'Set authorization boundary', (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar) return;
    if (typeof boundary === 'string') {
      if (!sysChar['authorization-boundary']) {
        sysChar['authorization-boundary'] = { description: boundary };
      } else {
        sysChar['authorization-boundary'].description = boundary;
      }
    } else {
      sysChar['authorization-boundary'] = { ...boundary };
    }
  });
}

export function setNetworkArchitecture(networkArch: NetworkArchitecture | string): DocumentAction {
  return createAction('ssp', 'SET_NETWORK_ARCHITECTURE', 'Set network architecture', (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar) return;
    if (typeof networkArch === 'string') {
      if (!sysChar['network-architecture']) {
        sysChar['network-architecture'] = { description: networkArch };
      } else {
        sysChar['network-architecture'].description = networkArch;
      }
    } else {
      sysChar['network-architecture'] = { ...networkArch };
    }
  });
}

export function setDataFlow(dataFlow: DataFlow | string): DocumentAction {
  return createAction('ssp', 'SET_DATA_FLOW', 'Set data flow', (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar) return;
    if (typeof dataFlow === 'string') {
      if (!sysChar['data-flow']) {
        sysChar['data-flow'] = { description: dataFlow };
      } else {
        sysChar['data-flow'].description = dataFlow;
      }
    } else {
      sysChar['data-flow'] = { ...dataFlow };
    }
  });
}

export function addDiagram(
  container: 'authorization-boundary' | 'network-architecture' | 'data-flow',
  diagram: Diagram
): DocumentAction {
  return createAction('ssp', 'ADD_DIAGRAM', `Add diagram to ${container}`, (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar) return;
    if (!sysChar[container]) {
      sysChar[container] = { description: '', diagrams: [] };
    }
    const target = sysChar[container]!;
    if (!target.diagrams) {
      target.diagrams = [];
    }
    target.diagrams.push({
      ...diagram,
      uuid: diagram.uuid || generateUUID(),
    });
  });
}

export function addDiagramWithResource(
  container: 'authorization-boundary' | 'network-architecture' | 'data-flow',
  diagram: Diagram,
  resource?: any
): DocumentAction {
  return createAction('ssp', 'ADD_DIAGRAM_WITH_RESOURCE', `Add diagram and resource to ${container}`, (draft: any) => {
    const ssp = getSSP(draft);
    if (!ssp) return;
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar) return;
    if (!sysChar[container]) {
      sysChar[container] = { description: '', diagrams: [] };
    }
    const target = sysChar[container]!;
    if (!target.diagrams) {
      target.diagrams = [];
    }
    target.diagrams.push({
      ...diagram,
      uuid: diagram.uuid || generateUUID(),
    });

    if (resource) {
      if (!ssp['back-matter']) {
        ssp['back-matter'] = { resources: [] };
      }
      if (!ssp['back-matter'].resources) {
        ssp['back-matter'].resources = [];
      }
      const existingIdx = ssp['back-matter'].resources.findIndex((r: any) => r.uuid === resource.uuid);
      if (existingIdx >= 0) {
        ssp['back-matter'].resources[existingIdx] = { ...resource };
      } else {
        ssp['back-matter'].resources.push({
          uuid: resource.uuid || generateUUID(),
          ...resource
        });
      }
    }
  });
}

export function removeDiagram(
  container: 'authorization-boundary' | 'network-architecture' | 'data-flow',
  diagramUuid: string
): DocumentAction {
  return createAction('ssp', 'REMOVE_DIAGRAM', `Remove diagram ${diagramUuid} from ${container}`, (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar || !sysChar[container] || !sysChar[container]!.diagrams) return;
    sysChar[container]!.diagrams = sysChar[container]!.diagrams!.filter(
      d => d.uuid !== diagramUuid
    );
  });
}

export function removeDiagramWithResource(
  container: 'authorization-boundary' | 'network-architecture' | 'data-flow',
  diagramUuid: string,
  resourceUuid?: string
): DocumentAction {
  return createAction('ssp', 'REMOVE_DIAGRAM_WITH_RESOURCE', `Remove diagram ${diagramUuid} and resource ${resourceUuid || ''} from ${container}`, (draft: any) => {
    const ssp = getSSP(draft);
    if (!ssp) return;
    const sysChar = ensureSystemCharacteristics(draft);
    if (sysChar && sysChar[container] && sysChar[container]!.diagrams) {
      sysChar[container]!.diagrams = sysChar[container]!.diagrams!.filter(
        d => d.uuid !== diagramUuid
      );
    }
    if (resourceUuid && ssp['back-matter']?.resources) {
      ssp['back-matter'].resources = ssp['back-matter'].resources.filter(
        (r: any) => r.uuid !== resourceUuid
      );
    }
  });
}

export function setResponsibleParties(parties: ResponsibleParty[]): DocumentAction {
  return createAction('ssp', 'SET_RESPONSIBLE_PARTIES', 'Set responsible parties', (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar) return;
    sysChar['responsible-parties'] = [...parties];
  });
}

export function addResponsibleParty(party: ResponsibleParty): DocumentAction {
  return createAction('ssp', 'ADD_RESPONSIBLE_PARTY', `Add responsible party for role "${party['role-id']}"`, (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar) return;
    if (!sysChar['responsible-parties']) {
      sysChar['responsible-parties'] = [];
    }
    const idx = sysChar['responsible-parties'].findIndex(
      p => p['role-id'] === party['role-id']
    );
    if (idx >= 0) {
      sysChar['responsible-parties'][idx] = { ...party };
    } else {
      sysChar['responsible-parties'].push({ ...party });
    }
  });
}

export function removeResponsibleParty(roleId: string): DocumentAction {
  return createAction('ssp', 'REMOVE_RESPONSIBLE_PARTY', `Remove responsible party for role "${roleId}"`, (draft: any) => {
    const sysChar = ensureSystemCharacteristics(draft);
    if (!sysChar || !sysChar['responsible-parties']) return;
    sysChar['responsible-parties'] = sysChar['responsible-parties'].filter(
      p => p['role-id'] !== roleId
    );
  });
}

// ============================================================================
// 2. System Implementation Actions (FE-SSP-02)
// ============================================================================

export function setSystemImplementation(impl: Partial<SystemImplementation>): DocumentAction {
  return createAction('ssp', 'SET_SYSTEM_IMPLEMENTATION', 'Set system implementation', (draft: any) => {
    const sysImp = ensureSystemImplementation(draft);
    if (!sysImp) return;
    Object.assign(sysImp, impl);
  });
}

export function initializeSSPComponents(sysName: string): DocumentAction {
  return createAction('ssp', 'INIT_COMPONENTS', 'Initialize default SSP component', (draft: any) => {
    const sysImp = ensureSystemImplementation(draft);
    if (!sysImp) return;
    const hasThisSystem = sysImp.components?.some(c => c.type === 'this-system');
    if (!hasThisSystem) {
      const defaultComp: SystemComponent = {
        uuid: generateUUID(),
        type: 'this-system',
        title: sysName || 'This System',
        description: 'This system',
        status: { state: 'operational' }
      };
      sysImp.components = [defaultComp, ...(sysImp.components || [])];
    }
  });
}

export function addSystemComponent(component?: Partial<SystemComponent>): DocumentAction {
  return createAction('ssp', 'ADD_SYSTEM_COMPONENT', 'Add system component', (draft: any) => {
    const sysImp = ensureSystemImplementation(draft);
    if (!sysImp) return;
    if (!sysImp.components) sysImp.components = [];

    const newComponent: SystemComponent = {
      uuid: component?.uuid || generateUUID(),
      type: component?.type || 'software',
      title: component?.title || 'New Component',
      description: component?.description || '',
      status: component?.status || { state: 'operational' },
      ...component
    };
    sysImp.components.push(newComponent);
  });
}

export function updateSystemComponent(
  componentUuid: string,
  updates: Partial<SystemComponent>
): DocumentAction {
  return createAction('ssp', 'UPDATE_SYSTEM_COMPONENT', `Update system component ${componentUuid}`, (draft: any) => {
    const comp = findSystemComponent(draft, componentUuid);
    if (comp) {
      Object.assign(comp, updates);
    }
  });
}

export function removeSystemComponent(componentUuid: string): DocumentAction {
  return createAction('ssp', 'REMOVE_SYSTEM_COMPONENT', `Remove system component ${componentUuid}`, (draft: any) => {
    const sysImp = ensureSystemImplementation(draft);
    if (!sysImp || !sysImp.components) return;
    sysImp.components = sysImp.components.filter(c => c.uuid !== componentUuid);
  });
}

export function addSystemUser(user?: Partial<SystemUser>): DocumentAction {
  return createAction('ssp', 'ADD_SYSTEM_USER', 'Add system user', (draft: any) => {
    const sysImp = ensureSystemImplementation(draft);
    if (!sysImp) return;
    if (!sysImp.users) sysImp.users = [];

    const newUser: SystemUser = {
      uuid: user?.uuid || generateUUID(),
      title: user?.title || 'New User',
      description: user?.description || '',
      ...user
    };
    sysImp.users.push(newUser);
  });
}

export function updateSystemUser(userUuid: string, updates: Partial<SystemUser>): DocumentAction {
  return createAction('ssp', 'UPDATE_SYSTEM_USER', `Update system user ${userUuid}`, (draft: any) => {
    const user = findSystemUser(draft, userUuid);
    if (user) {
      Object.assign(user, updates);
    }
  });
}

export function removeSystemUser(userUuid: string): DocumentAction {
  return createAction('ssp', 'REMOVE_SYSTEM_USER', `Remove system user ${userUuid}`, (draft: any) => {
    const sysImp = ensureSystemImplementation(draft);
    if (!sysImp || !sysImp.users) return;
    sysImp.users = sysImp.users.filter(u => u.uuid !== userUuid);
  });
}

export function addInventoryItem(item?: Partial<InventoryItem>): DocumentAction {
  return createAction('ssp', 'ADD_INVENTORY_ITEM', 'Add inventory item', (draft: any) => {
    const sysImp = ensureSystemImplementation(draft);
    if (!sysImp) return;
    if (!sysImp['inventory-items']) sysImp['inventory-items'] = [];

    const newItem: InventoryItem = {
      uuid: item?.uuid || generateUUID(),
      description: item?.description || 'New Inventory Item',
      ...item
    };
    sysImp['inventory-items'].push(newItem);
  });
}

export function updateInventoryItem(
  itemUuid: string,
  updates: Partial<InventoryItem>
): DocumentAction {
  return createAction('ssp', 'UPDATE_INVENTORY_ITEM', `Update inventory item ${itemUuid}`, (draft: any) => {
    const item = findInventoryItem(draft, itemUuid);
    if (item) {
      Object.assign(item, updates);
    }
  });
}

export function removeInventoryItem(itemUuid: string): DocumentAction {
  return createAction('ssp', 'REMOVE_INVENTORY_ITEM', `Remove inventory item ${itemUuid}`, (draft: any) => {
    const sysImp = ensureSystemImplementation(draft);
    if (!sysImp || !sysImp['inventory-items']) return;
    sysImp['inventory-items'] = sysImp['inventory-items'].filter(i => i.uuid !== itemUuid);
  });
}

export function addLeveragedAuthorization(
  auth?: Partial<LeveragedAuthorization>
): DocumentAction {
  return createAction('ssp', 'ADD_LEVERAGED_AUTH', 'Add leveraged authorization', (draft: any) => {
    const sysImp = ensureSystemImplementation(draft);
    if (!sysImp) return;
    if (!sysImp['leveraged-authorizations']) sysImp['leveraged-authorizations'] = [];

    const dateAuth = (auth?.['date-authorized'] || new Date().toISOString()).split('T')[0];

    const newAuth: LeveragedAuthorization = {
      uuid: auth?.uuid || generateUUID(),
      title: auth?.title || 'New Leveraged Authorization',
      'party-uuid': auth?.['party-uuid'] || '',
      ...auth,
      'date-authorized': dateAuth
    };
    sysImp['leveraged-authorizations'].push(newAuth);
  });
}

export function updateLeveragedAuthorization(
  authUuid: string,
  updates: Partial<LeveragedAuthorization>
): DocumentAction {
  return createAction('ssp', 'UPDATE_LEVERAGED_AUTH', `Update leveraged authorization ${authUuid}`, (draft: any) => {
    const auth = findLeveragedAuthorization(draft, authUuid);
    if (auth) {
      Object.assign(auth, updates);
    }
  });
}

export function removeLeveragedAuthorization(authUuid: string): DocumentAction {
  return createAction('ssp', 'REMOVE_LEVERAGED_AUTH', `Remove leveraged authorization ${authUuid}`, (draft: any) => {
    const sysImp = ensureSystemImplementation(draft);
    if (!sysImp || !sysImp['leveraged-authorizations']) return;
    sysImp['leveraged-authorizations'] = sysImp['leveraged-authorizations'].filter(
      a => a.uuid !== authUuid
    );
  });
}

// ============================================================================
// 3. Control Implementation Actions (FE-SSP-02)
// ============================================================================

export function setImportProfile(href: string, remarks?: string): DocumentAction {
  return createAction('ssp', 'SET_IMPORT_PROFILE', `Set import profile to "${href}"`, (draft: any) => {
    const ssp = getSSP(draft);
    if (!ssp) return;
    ssp['import-profile'] = {
      href,
      ...(remarks ? { remarks } : {})
    };
  });
}

export function setControlImplementationDescription(description: string): DocumentAction {
  return createAction('ssp', 'SET_CONTROL_IMPLEMENTATION_DESCRIPTION', 'Set control implementation description', (draft: any) => {
    const ctrlImp = ensureControlImplementation(draft);
    if (!ctrlImp) return;
    ctrlImp.description = description;
  });
}

export function setControlImplementation(ctrlImpl: Partial<ControlImplementation>): DocumentAction {
  return createAction('ssp', 'SET_CONTROL_IMPLEMENTATION', 'Set control implementation', (draft: any) => {
    const target = ensureControlImplementation(draft);
    if (!target) return;
    Object.assign(target, ctrlImpl);
  });
}

export function upsertImplementedRequirement(
  req: Partial<ImplementedRequirement> & { 'control-id': string }
): DocumentAction {
  return createAction('ssp', 'UPSERT_IMPLEMENTED_REQ', `Upsert implemented requirement for "${req['control-id']}"`, (draft: any) => {
    const ctrlImp = ensureControlImplementation(draft);
    if (!ctrlImp) return;
    if (!ctrlImp['implemented-requirements']) {
      ctrlImp['implemented-requirements'] = [];
    }

    const existingIdx = ctrlImp['implemented-requirements'].findIndex(
      r =>
        r['control-id'] === req['control-id'] ||
        (req.uuid && r.uuid === req.uuid)
    );

    if (existingIdx >= 0) {
      ctrlImp['implemented-requirements'][existingIdx] = {
        ...ctrlImp['implemented-requirements'][existingIdx],
        ...req
      };
    } else {
      const newReq: ImplementedRequirement = {
        ...req,
        uuid: req.uuid || generateUUID(),
        'control-id': req['control-id'],
        'by-components': req['by-components'] || [],
      };
      ctrlImp['implemented-requirements'].push(newReq);
    }
  });
}

export function removeImplementedRequirement(controlIdOrUuid: string): DocumentAction {
  return createAction('ssp', 'REMOVE_IMPLEMENTED_REQ', `Remove implemented requirement "${controlIdOrUuid}"`, (draft: any) => {
    const ctrlImp = ensureControlImplementation(draft);
    if (!ctrlImp || !ctrlImp['implemented-requirements']) return;
    ctrlImp['implemented-requirements'] = ctrlImp['implemented-requirements'].filter(
      r => r['control-id'] !== controlIdOrUuid && r.uuid !== controlIdOrUuid
    );
  });
}

export function addByComponent(
  controlIdOrUuid: string,
  byComp?: Partial<ByComponent>
): DocumentAction {
  return createAction('ssp', 'ADD_BY_COMPONENT', `Add by-component to requirement "${controlIdOrUuid}"`, (draft: any) => {
    const req = findImplementedRequirement(draft, controlIdOrUuid);
    if (!req) return;
    if (!req['by-components']) {
      req['by-components'] = [];
    }

    const sysImp = ensureSystemImplementation(draft);
    const defaultComponentUuid =
      byComp?.['component-uuid'] ||
      sysImp?.components?.find(c => c.type === 'this-system')?.uuid ||
      sysImp?.components?.[0]?.uuid ||
      generateUUID();

    const desc = (byComp?.description && byComp.description.trim())
      ? byComp.description.trim()
      : 'Implemented by component.';

    const newByComp: ByComponent = {
      uuid: byComp?.uuid || generateUUID(),
      'component-uuid': defaultComponentUuid,
      ...byComp,
      description: desc
    };
    req['by-components'].push(newByComp);
  });
}

export function updateByComponent(
  controlIdOrUuid: string,
  byCompUuid: string,
  updates: Partial<ByComponent>
): DocumentAction {
  return createAction('ssp', 'UPDATE_BY_COMPONENT', `Update by-component "${byCompUuid}" on requirement "${controlIdOrUuid}"`, (draft: any) => {
    const req = findImplementedRequirement(draft, controlIdOrUuid);
    if (!req || !req['by-components']) return;
    const byComp = findByComponent(req, byCompUuid);
    if (byComp) {
      Object.assign(byComp, updates);
    }
  });
}

export function removeByComponent(
  controlIdOrUuid: string,
  byCompUuid: string
): DocumentAction {
  return createAction('ssp', 'REMOVE_BY_COMPONENT', `Remove by-component "${byCompUuid}" from requirement "${controlIdOrUuid}"`, (draft: any) => {
    const req = findImplementedRequirement(draft, controlIdOrUuid);
    if (!req || !req['by-components']) return;
    req['by-components'] = req['by-components'].filter(
      bc => bc.uuid !== byCompUuid && bc['component-uuid'] !== byCompUuid
    );
  });
}

export function addStatementByComponent(
  controlIdOrUuid: string,
  statementId: string,
  byComp?: Partial<ByComponent>
): DocumentAction {
  return createAction('ssp', 'ADD_STATEMENT_BY_COMPONENT', `Add statement by-component for statement "${statementId}" on "${controlIdOrUuid}"`, (draft: any) => {
    const req = findImplementedRequirement(draft, controlIdOrUuid);
    if (!req) return;
    if (!req.statements) {
      req.statements = [];
    }

    let stmt = findStatement(req, statementId);
    if (!stmt) {
      stmt = {
        'statement-id': statementId,
        uuid: generateUUID(),
        'by-components': []
      };
      req.statements.push(stmt);
    }
    if (!stmt['by-components']) {
      stmt['by-components'] = [];
    }

    const sysImp = ensureSystemImplementation(draft);
    const defaultComponentUuid =
      byComp?.['component-uuid'] ||
      sysImp?.components?.find(c => c.type === 'this-system')?.uuid ||
      sysImp?.components?.[0]?.uuid ||
      generateUUID();

    const desc = (byComp?.description && byComp.description.trim())
      ? byComp.description.trim()
      : 'Implemented by component.';

    const newByComp: ByComponent = {
      uuid: byComp?.uuid || generateUUID(),
      'component-uuid': defaultComponentUuid,
      ...byComp,
      description: desc
    };
    stmt['by-components'].push(newByComp);
  });
}

export function updateStatementByComponent(
  controlIdOrUuid: string,
  statementId: string,
  byCompUuid: string,
  updates: Partial<ByComponent>
): DocumentAction {
  return createAction('ssp', 'UPDATE_STATEMENT_BY_COMPONENT', `Update statement by-component "${byCompUuid}" on statement "${statementId}"`, (draft: any) => {
    const req = findImplementedRequirement(draft, controlIdOrUuid);
    if (!req) return;
    const stmt = findStatement(req, statementId);
    if (!stmt) return;
    const byComp = findByComponent(stmt, byCompUuid);
    if (byComp) {
      Object.assign(byComp, updates);
    }
  });
}

export function removeStatementByComponent(
  controlIdOrUuid: string,
  statementId: string,
  byCompUuid: string
): DocumentAction {
  return createAction('ssp', 'REMOVE_STATEMENT_BY_COMPONENT', `Remove statement by-component "${byCompUuid}" from statement "${statementId}"`, (draft: any) => {
    const req = findImplementedRequirement(draft, controlIdOrUuid);
    if (!req || !req.statements) return;
    const stmt = findStatement(req, statementId);
    if (!stmt || !stmt['by-components']) return;
    stmt['by-components'] = stmt['by-components'].filter(
      bc => bc.uuid !== byCompUuid && bc['component-uuid'] !== byCompUuid
    );
  });
}

export function setSSPParameterValue(
  paramId: string,
  values: string[],
  scope?: {
    controlId?: string;
    byCompUuid?: string;
    statementId?: string;
    remarks?: string;
  }
): DocumentAction {
  return createAction('ssp', 'SET_SSP_PARAMETER_VALUE', `Set SSP parameter "${paramId}" at scope ${JSON.stringify(scope || 'global')}`, (draft: any) => {
    const remarks = scope?.remarks;

    // Scope 1: Component level (under a statement or directly under a requirement)
    if (scope?.byCompUuid) {
      if (scope.controlId) {
        const req = findImplementedRequirement(draft, scope.controlId);
        if (req) {
          if (scope.statementId) {
            const stmt = findStatement(req, scope.statementId);
            if (stmt) {
              const byComp = findByComponent(stmt, scope.byCompUuid);
              if (byComp) {
                upsertSetParameterList(byComp, paramId, values, remarks);
                return;
              }
            }
          } else {
            const byComp = findByComponent(req, scope.byCompUuid);
            if (byComp) {
              upsertSetParameterList(byComp, paramId, values, remarks);
              return;
            }
          }
        }
      }

      // If controlId not explicitly provided, search across all requirements
      const ctrlImp = ensureControlImplementation(draft);
      if (ctrlImp?.['implemented-requirements']) {
        for (const req of ctrlImp['implemented-requirements']) {
          const byComp = findByComponent(req, scope.byCompUuid);
          if (byComp) {
            upsertSetParameterList(byComp, paramId, values, remarks);
            return;
          }
          if (req.statements) {
            for (const stmt of req.statements) {
              const stmtByComp = findByComponent(stmt, scope.byCompUuid);
              if (stmtByComp) {
                upsertSetParameterList(stmtByComp, paramId, values, remarks);
                return;
              }
            }
          }
        }
      }
      return;
    }

    // Scope 2: Control level (under implemented-requirement)
    if (scope?.controlId) {
      const req = findImplementedRequirement(draft, scope.controlId);
      if (req) {
        upsertSetParameterList(req, paramId, values, remarks);
      }
      return;
    }

    // Scope 3: Global SSP default (under control-implementation)
    const ctrlImp = ensureControlImplementation(draft);
    if (ctrlImp) {
      upsertSetParameterList(ctrlImp, paramId, values, remarks);
    }
  });
}

export function setSecurityInheritance(
  controlIdOrUuid: string,
  byCompUuid: string,
  inheritance: {
    export?: ExportControlImplementation;
    inherited?: InheritedControlImplementation[];
    satisfied?: SatisfiedControlImplementation[];
  }
): DocumentAction {
  return createAction('ssp', 'SET_SECURITY_INHERITANCE', `Set security inheritance for "${byCompUuid}" on "${controlIdOrUuid}"`, (draft: any) => {
    const req = findImplementedRequirement(draft, controlIdOrUuid);
    if (!req) return;
    const byComp = findByComponent(req, byCompUuid);
    if (!byComp) return;

    if (inheritance.export !== undefined) {
      byComp.export = inheritance.export;
    }
    if (inheritance.inherited !== undefined) {
      byComp.inherited = inheritance.inherited;
    }
    if (inheritance.satisfied !== undefined) {
      byComp.satisfied = inheritance.satisfied;
    }
  });
}

// ============================================================================
// 4. Legacy / Utility Actions (Maintained for Backward Compatibility)
// ============================================================================

export function updateSSPField(path: (string | number)[], value: any): DocumentAction {
  return createAction('ssp', 'UPDATE_FIELD', `Update SSP field ${path.join('.')}`, (draft: any) => {
    let current = draft['system-security-plan'] || draft;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) current[path[i]] = {};
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
  });
}

export function updateSSPListItem(
  listPath: string[],
  itemUuid: string,
  updates: any
): DocumentAction {
  return createAction('ssp', 'UPDATE_LIST_ITEM', `Update list item in ${listPath.join('.')}`, (draft: any) => {
    const sspRef = draft['system-security-plan'] || draft;
    const list = listPath.reduce((obj, key) => (obj && obj[key]) || [], sspRef);
    const idx = list.findIndex((x: any) => x.uuid === itemUuid);
    if (idx > -1) {
      list[idx] = { ...list[idx], ...updates };
    }
  });
}

export function replaceSSP(newSsp: any): DocumentAction {
  return createAction('ssp', 'REPLACE_SSP', 'Replace entire SSP document', (draft: any) => {
    if (draft['system-security-plan']) {
      draft['system-security-plan'] = newSsp;
    } else {
      Object.assign(draft, newSsp);
    }
  });
}
