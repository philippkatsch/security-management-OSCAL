import { createAction, DocumentAction } from './types';
import {
  ComponentDefinition,
  DefinedComponent,
  Capability,
  IncorporatesComponent,
  ComponentControlImplementation,
  ComponentImplementedRequirement,
  ComponentStatement,
  ServiceProtocol,
  PortRange,
  SetParameter,
  ResponsibleRole,
  Property,
  Link,
  ImportComponentDefinition
} from '../types/oscal';
import { generateUUID } from '../oscal-utils';

// ============================================================================
// Internal Traversal Helpers
// ============================================================================

function getCompDef(draft: any): ComponentDefinition | null {
  return draft?.['component-definition'] || null;
}

function findTargetContainer(
  draft: any,
  targetUuid: string,
  isCapability = false
): DefinedComponent | Capability | null {
  const compDef = getCompDef(draft);
  if (!compDef) return null;

  if (isCapability) {
    return compDef.capabilities?.find(c => c.uuid === targetUuid) || null;
  }
  return compDef.components?.find(c => c.uuid === targetUuid) || null;
}

function findControlImplementation(
  container: DefinedComponent | Capability,
  implUuid: string
): ComponentControlImplementation | null {
  return container['control-implementations']?.find(ci => ci.uuid === implUuid) || null;
}

function findImplementedRequirement(
  impl: ComponentControlImplementation,
  reqUuid: string
): ComponentImplementedRequirement | null {
  return impl['implemented-requirements']?.find(ir => ir.uuid === reqUuid) || null;
}

function findStatement(
  req: ComponentImplementedRequirement,
  stmtUuid: string
): ComponentStatement | null {
  return req.statements?.find(s => s.uuid === stmtUuid) || null;
}

// ============================================================================
// Root / Document Actions
// ============================================================================

export function updateComponentDefinitionRoot(field: string, value: any): DocumentAction {
  return createAction('component-definition', 'UPDATE_ROOT', `Update root field ${field}`, (draft: any) => {
    if (draft['component-definition']) {
      draft['component-definition'][field] = value;
    }
  });
}

export function setComponentDefinition(compDef: ComponentDefinition): DocumentAction {
  return createAction('component-definition', 'SET_DOC', 'Replace component definition document', (draft: any) => {
    draft['component-definition'] = compDef;
  });
}

// ============================================================================
// Defined Component CRUD Actions
// ============================================================================

export function addComponent(initialData?: Partial<DefinedComponent>): DocumentAction {
  return createAction('component-definition', 'ADD_COMPONENT', 'Add component', (draft: any) => {
    const compDef = getCompDef(draft);
    if (!compDef) return;
    if (!compDef.components) compDef.components = [];

    const newComponent: DefinedComponent = {
      uuid: initialData?.uuid || generateUUID(),
      type: initialData?.type || 'software',
      title: initialData?.title || 'New Component',
      description: initialData?.description || '',
      purpose: initialData?.purpose || '',
      props: initialData?.props || [],
      links: initialData?.links || [],
      'responsible-roles': initialData?.['responsible-roles'] || [],
      protocols: initialData?.protocols || [],
      'control-implementations': initialData?.['control-implementations'] || [],
      remarks: initialData?.remarks || ''
    };

    compDef.components.push(newComponent);
  });
}

export function updateComponent(componentUuid: string, patch: Partial<DefinedComponent>): DocumentAction {
  return createAction('component-definition', 'UPDATE_COMPONENT', `Update component ${componentUuid}`, (draft: any) => {
    const compDef = getCompDef(draft);
    if (!compDef?.components) return;
    const index = compDef.components.findIndex(c => c.uuid === componentUuid);
    if (index !== -1) {
      compDef.components[index] = {
        ...compDef.components[index],
        ...patch
      };
    }
  });
}

export function deleteComponents(componentUuids: string[]): DocumentAction {
  return createAction('component-definition', 'DELETE_COMPONENTS', `Delete ${componentUuids.length} component(s)`, (draft: any) => {
    const compDef = getCompDef(draft);
    if (!compDef?.components) return;

    compDef.components = compDef.components.filter(c => !componentUuids.includes(c.uuid));

    // Also remove any incorporated-component references in capabilities
    if (compDef.capabilities) {
      compDef.capabilities.forEach(cap => {
        if (cap['incorporates-components']) {
          cap['incorporates-components'] = cap['incorporates-components'].filter(
            ic => !componentUuids.includes(ic['component-uuid'])
          );
        }
      });
    }
  });
}

// ============================================================================
// Standard Property Palette Actions (US 3.4)
// ============================================================================

export function setComponentStandardProperty(
  componentUuid: string,
  name: string,
  value: string | null | undefined,
  customNs?: string
): DocumentAction {
  return createAction('component-definition', 'SET_STD_PROP', `Set property ${name}`, (draft: any) => {
    const comp = findTargetContainer(draft, componentUuid, false) as DefinedComponent | null;
    if (!comp) return;
    if (!comp.props) comp.props = [];

    const ns = customNs || 'http://csrc.nist.gov/ns/oscal';
    const existingIndex = comp.props.findIndex(p => p.name === name);

    if (value === null || value === undefined || value.trim() === '') {
      if (existingIndex !== -1) {
        comp.props.splice(existingIndex, 1);
      }
    } else {
      const trimmedVal = value.trim();
      if (existingIndex !== -1) {
        comp.props[existingIndex].value = trimmedVal;
        if (!comp.props[existingIndex].ns) {
          comp.props[existingIndex].ns = ns;
        }
      } else {
        comp.props.push({
          name,
          value: trimmedVal,
          ns
        });
      }
    }
  });
}

export function removeComponentStandardProperty(componentUuid: string, name: string): DocumentAction {
  return setComponentStandardProperty(componentUuid, name, null);
}

export function setComponentProperties(componentUuid: string, props: Property[]): DocumentAction {
  return createAction('component-definition', 'SET_PROPS', `Set properties for ${componentUuid}`, (draft: any) => {
    const comp = findTargetContainer(draft, componentUuid, false) as DefinedComponent | null;
    if (!comp) return;
    comp.props = props;
  });
}

// ============================================================================
// Service Protocols & Port Ranges (US 3.7, US 3.2)
// ============================================================================

export function addProtocol(componentUuid: string, protocolData?: Partial<ServiceProtocol>): DocumentAction {
  return createAction('component-definition', 'ADD_PROTOCOL', `Add protocol to ${componentUuid}`, (draft: any) => {
    const comp = findTargetContainer(draft, componentUuid, false) as DefinedComponent | null;
    if (!comp) return;
    if (!comp.protocols) comp.protocols = [];

    const newProtocol: ServiceProtocol = {
      uuid: protocolData?.uuid || generateUUID(),
      name: protocolData?.name || 'https',
      title: protocolData?.title || 'HTTPS Protocol',
      'port-ranges': protocolData?.['port-ranges'] || []
    };

    comp.protocols.push(newProtocol);
  });
}

export function updateProtocol(
  componentUuid: string,
  protocolUuid: string,
  patch: Partial<ServiceProtocol>
): DocumentAction {
  return createAction('component-definition', 'UPDATE_PROTOCOL', `Update protocol ${protocolUuid}`, (draft: any) => {
    const comp = findTargetContainer(draft, componentUuid, false) as DefinedComponent | null;
    if (!comp?.protocols) return;

    const index = comp.protocols.findIndex(p => p.uuid === protocolUuid);
    if (index !== -1) {
      comp.protocols[index] = {
        ...comp.protocols[index],
        ...patch
      };
    }
  });
}

export function removeProtocol(componentUuid: string, protocolUuid: string): DocumentAction {
  return createAction('component-definition', 'REMOVE_PROTOCOL', `Remove protocol ${protocolUuid}`, (draft: any) => {
    const comp = findTargetContainer(draft, componentUuid, false) as DefinedComponent | null;
    if (!comp?.protocols) return;
    comp.protocols = comp.protocols.filter(p => p.uuid !== protocolUuid);
  });
}

export function addPortRange(componentUuid: string, protocolUuid: string, portRange: PortRange): DocumentAction {
  return createAction('component-definition', 'ADD_PORT_RANGE', `Add port range to protocol ${protocolUuid}`, (draft: any) => {
    const comp = findTargetContainer(draft, componentUuid, false) as DefinedComponent | null;
    const proto = comp?.protocols?.find(p => p.uuid === protocolUuid);
    if (!proto) return;
    if (!proto['port-ranges']) proto['port-ranges'] = [];

    proto['port-ranges'].push({
      start: portRange.start,
      end: portRange.end,
      transport: portRange.transport || 'TCP'
    });
  });
}

export function updatePortRange(
  componentUuid: string,
  protocolUuid: string,
  portRangeIndex: number,
  patch: Partial<PortRange>
): DocumentAction {
  return createAction('component-definition', 'UPDATE_PORT_RANGE', `Update port range #${portRangeIndex}`, (draft: any) => {
    const comp = findTargetContainer(draft, componentUuid, false) as DefinedComponent | null;
    const proto = comp?.protocols?.find(p => p.uuid === protocolUuid);
    if (!proto?.['port-ranges'] || !proto['port-ranges'][portRangeIndex]) return;

    proto['port-ranges'][portRangeIndex] = {
      ...proto['port-ranges'][portRangeIndex],
      ...patch
    };
  });
}

export function removePortRange(componentUuid: string, protocolUuid: string, portRangeIndex: number): DocumentAction {
  return createAction('component-definition', 'REMOVE_PORT_RANGE', `Remove port range #${portRangeIndex}`, (draft: any) => {
    const comp = findTargetContainer(draft, componentUuid, false) as DefinedComponent | null;
    const proto = comp?.protocols?.find(p => p.uuid === protocolUuid);
    if (!proto?.['port-ranges']) return;

    proto['port-ranges'].splice(portRangeIndex, 1);
  });
}

export function applyProtocolTemplate(
  componentUuid: string,
  template: { name: string; title: string; start: number; end: number; transport: 'TCP' | 'UDP' }
): DocumentAction {
  return createAction('component-definition', 'APPLY_PROTOCOL_TEMPLATE', `Apply preset ${template.name}`, (draft: any) => {
    const comp = findTargetContainer(draft, componentUuid, false) as DefinedComponent | null;
    if (!comp) return;
    if (!comp.protocols) comp.protocols = [];

    const newProtocol: ServiceProtocol = {
      uuid: generateUUID(),
      name: template.name,
      title: template.title,
      'port-ranges': [
        {
          start: template.start,
          end: template.end,
          transport: template.transport
        }
      ]
    };

    comp.protocols.push(newProtocol);
  });
}

// ============================================================================
// Control Implementation Sets (US 3.9, US 3.10)
// ============================================================================

export function addControlImplementation(
  targetUuid: string,
  implData?: Partial<ComponentControlImplementation>,
  isCapability = false
): DocumentAction {
  return createAction('component-definition', 'ADD_CONTROL_IMPL', `Add control implementation to ${targetUuid}`, (draft: any) => {
    const container = findTargetContainer(draft, targetUuid, isCapability);
    if (!container) return;
    if (!container['control-implementations']) container['control-implementations'] = [];

    const newImpl: ComponentControlImplementation = {
      uuid: implData?.uuid || generateUUID(),
      source: implData?.source || '',
      description: implData?.description || 'Control implementation set',
      props: implData?.props || [],
      links: implData?.links || [],
      'set-parameters': implData?.['set-parameters'] || [],
      'implemented-requirements': implData?.['implemented-requirements'] || []
    };

    container['control-implementations'].push(newImpl);
  });
}

export function updateControlImplementation(
  targetUuid: string,
  implUuid: string,
  patch: Partial<ComponentControlImplementation>,
  isCapability = false
): DocumentAction {
  return createAction('component-definition', 'UPDATE_CONTROL_IMPL', `Update control implementation ${implUuid}`, (draft: any) => {
    const container = findTargetContainer(draft, targetUuid, isCapability);
    if (!container) return;
    const impl = findControlImplementation(container, implUuid);
    if (!impl) return;

    Object.assign(impl, patch);
  });
}

export function removeControlImplementation(
  targetUuid: string,
  implUuid: string,
  isCapability = false
): DocumentAction {
  return createAction('component-definition', 'REMOVE_CONTROL_IMPL', `Remove control implementation ${implUuid}`, (draft: any) => {
    const container = findTargetContainer(draft, targetUuid, isCapability);
    if (!container?.['control-implementations']) return;

    container['control-implementations'] = container['control-implementations'].filter(ci => ci.uuid !== implUuid);
  });
}

// ============================================================================
// Implemented Requirements & Bulk Control Addition (US 3.9, US 3.10)
// ============================================================================

export function addImplementedRequirement(
  targetUuid: string,
  implUuid: string,
  reqData?: Partial<ComponentImplementedRequirement>,
  isCapability = false
): DocumentAction {
  return createAction('component-definition', 'ADD_IMPLEMENTED_REQ', `Add requirement for ${reqData?.['control-id'] || 'control'}`, (draft: any) => {
    const container = findTargetContainer(draft, targetUuid, isCapability);
    if (!container) return;
    const impl = findControlImplementation(container, implUuid);
    if (!impl) return;
    if (!impl['implemented-requirements']) impl['implemented-requirements'] = [];

    const newReq: ComponentImplementedRequirement = {
      uuid: reqData?.uuid || generateUUID(),
      'control-id': reqData?.['control-id'] || 'new-control',
      description: reqData?.description || 'Implemented requirement description',
      props: reqData?.props || [],
      links: reqData?.links || [],
      'set-parameters': reqData?.['set-parameters'] || [],
      'responsible-roles': reqData?.['responsible-roles'] || [],
      statements: reqData?.statements || [],
      remarks: reqData?.remarks || ''
    };

    impl['implemented-requirements'].push(newReq);
  });
}

export function addImplementedRequirementsBulk(
  targetUuid: string,
  implUuid: string,
  reqs: Array<{ controlId: string; description?: string; uuid?: string }>,
  isCapability = false
): DocumentAction {
  return createAction('component-definition', 'ADD_IMPLEMENTED_REQS_BULK', `Bulk add ${reqs.length} requirements`, (draft: any) => {
    const container = findTargetContainer(draft, targetUuid, isCapability);
    if (!container) return;
    const impl = findControlImplementation(container, implUuid);
    if (!impl) return;
    if (!impl['implemented-requirements']) impl['implemented-requirements'] = [];

    const existingControlIds = new Set(impl['implemented-requirements'].map(r => r['control-id']));

    reqs.forEach(req => {
      if (!existingControlIds.has(req.controlId)) {
        impl['implemented-requirements'].push({
          uuid: req.uuid || generateUUID(),
          'control-id': req.controlId,
          description: req.description || `Implementation narrative for ${req.controlId.toUpperCase()}`,
          statements: [],
          'set-parameters': [],
          props: [],
          links: [],
          'responsible-roles': []
        });
      }
    });
  });
}

export function updateImplementedRequirement(
  targetUuid: string,
  implUuid: string,
  reqUuid: string,
  patch: Partial<ComponentImplementedRequirement>,
  isCapability = false
): DocumentAction {
  return createAction('component-definition', 'UPDATE_IMPLEMENTED_REQ', `Update requirement ${reqUuid}`, (draft: any) => {
    const container = findTargetContainer(draft, targetUuid, isCapability);
    if (!container) return;
    const impl = findControlImplementation(container, implUuid);
    if (!impl) return;
    const req = findImplementedRequirement(impl, reqUuid);
    if (!req) return;

    Object.assign(req, patch);
  });
}

export function removeImplementedRequirement(
  targetUuid: string,
  implUuid: string,
  reqUuid: string,
  isCapability = false
): DocumentAction {
  return createAction('component-definition', 'REMOVE_IMPLEMENTED_REQ', `Remove requirement ${reqUuid}`, (draft: any) => {
    const container = findTargetContainer(draft, targetUuid, isCapability);
    if (!container) return;
    const impl = findControlImplementation(container, implUuid);
    if (!impl?.['implemented-requirements']) return;

    impl['implemented-requirements'] = impl['implemented-requirements'].filter(r => r.uuid !== reqUuid);
  });
}

// ============================================================================
// Statements Editor Actions (US 3.11)
// ============================================================================

export function addStatement(
  targetUuid: string,
  implUuid: string,
  reqUuid: string,
  stmtData?: Partial<ComponentStatement>,
  isCapability = false
): DocumentAction {
  return createAction('component-definition', 'ADD_STATEMENT', `Add statement ${stmtData?.['statement-id'] || ''}`, (draft: any) => {
    const container = findTargetContainer(draft, targetUuid, isCapability);
    if (!container) return;
    const impl = findControlImplementation(container, implUuid);
    if (!impl) return;
    const req = findImplementedRequirement(impl, reqUuid);
    if (!req) return;
    if (!req.statements) req.statements = [];

    const newStatement: ComponentStatement = {
      'statement-id': stmtData?.['statement-id'] || `${req['control-id']}_smt_a`,
      uuid: stmtData?.uuid || generateUUID(),
      description: stmtData?.description || 'Statement implementation narrative',
      props: stmtData?.props || [],
      links: stmtData?.links || [],
      'responsible-roles': stmtData?.['responsible-roles'] || [],
      remarks: stmtData?.remarks || ''
    };

    req.statements.push(newStatement);
  });
}

export function updateStatement(
  targetUuid: string,
  implUuid: string,
  reqUuid: string,
  stmtUuid: string,
  patch: Partial<ComponentStatement>,
  isCapability = false
): DocumentAction {
  return createAction('component-definition', 'UPDATE_STATEMENT', `Update statement ${stmtUuid}`, (draft: any) => {
    const container = findTargetContainer(draft, targetUuid, isCapability);
    if (!container) return;
    const impl = findControlImplementation(container, implUuid);
    if (!impl) return;
    const req = findImplementedRequirement(impl, reqUuid);
    if (!req) return;
    const stmt = findStatement(req, stmtUuid);
    if (!stmt) return;

    Object.assign(stmt, patch);
  });
}

export function removeStatement(
  targetUuid: string,
  implUuid: string,
  reqUuid: string,
  stmtUuid: string,
  isCapability = false
): DocumentAction {
  return createAction('component-definition', 'REMOVE_STATEMENT', `Remove statement ${stmtUuid}`, (draft: any) => {
    const container = findTargetContainer(draft, targetUuid, isCapability);
    if (!container) return;
    const impl = findControlImplementation(container, implUuid);
    if (!impl) return;
    const req = findImplementedRequirement(impl, reqUuid);
    if (!req?.statements) return;

    req.statements = req.statements.filter(s => s.uuid !== stmtUuid);
  });
}

// ============================================================================
// Parameter Values / Overrides Actions (US 3.12, DD-012, DD-014)
// ============================================================================

export function setComponentParameterValue(
  targetUuid: string,
  implUuid: string,
  reqUuid: string | null,
  paramId: string,
  values: string[],
  remarks?: string,
  isCapability = false
): DocumentAction {
  return createAction('component-definition', 'SET_PARAM_VALUE', `Set parameter ${paramId}`, (draft: any) => {
    const container = findTargetContainer(draft, targetUuid, isCapability);
    if (!container) return;
    const impl = findControlImplementation(container, implUuid);
    if (!impl) return;

    const targetHolder = reqUuid ? findImplementedRequirement(impl, reqUuid) : impl;
    if (!targetHolder) return;

    if (!targetHolder['set-parameters']) targetHolder['set-parameters'] = [];

    const cleanedValues = values.map(v => v.trim()).filter(v => v.length > 0);
    const existingIndex = targetHolder['set-parameters'].findIndex(p => p['param-id'] === paramId);

    if (cleanedValues.length === 0) {
      if (existingIndex !== -1) {
        targetHolder['set-parameters'].splice(existingIndex, 1);
      }
    } else {
      if (existingIndex !== -1) {
        targetHolder['set-parameters'][existingIndex].values = cleanedValues;
        if (remarks !== undefined) {
          targetHolder['set-parameters'][existingIndex].remarks = remarks;
        }
      } else {
        targetHolder['set-parameters'].push({
          'param-id': paramId,
          values: cleanedValues,
          remarks: remarks || ''
        });
      }
    }
  });
}

export function removeComponentParameter(
  targetUuid: string,
  implUuid: string,
  reqUuid: string | null,
  paramId: string,
  isCapability = false
): DocumentAction {
  return createAction('component-definition', 'REMOVE_PARAM', `Remove parameter ${paramId}`, (draft: any) => {
    const container = findTargetContainer(draft, targetUuid, isCapability);
    if (!container) return;
    const impl = findControlImplementation(container, implUuid);
    if (!impl) return;

    const targetHolder = reqUuid ? findImplementedRequirement(impl, reqUuid) : impl;
    if (!targetHolder?.['set-parameters']) return;

    targetHolder['set-parameters'] = targetHolder['set-parameters'].filter(p => p['param-id'] !== paramId);
  });
}

// ============================================================================
// Responsible Roles Actions (US 3.8)
// ============================================================================

export function addComponentRole(componentUuid: string, role: ResponsibleRole): DocumentAction {
  return createAction('component-definition', 'ADD_ROLE', `Add role ${role['role-id']}`, (draft: any) => {
    const comp = findTargetContainer(draft, componentUuid, false) as DefinedComponent | null;
    if (!comp) return;
    if (!comp['responsible-roles']) comp['responsible-roles'] = [];

    const existingIndex = comp['responsible-roles'].findIndex(r => r['role-id'] === role['role-id']);
    if (existingIndex !== -1) {
      comp['responsible-roles'][existingIndex] = role;
    } else {
      comp['responsible-roles'].push(role);
    }
  });
}

export function updateComponentRole(
  componentUuid: string,
  roleId: string,
  patch: Partial<ResponsibleRole>
): DocumentAction {
  return createAction('component-definition', 'UPDATE_ROLE', `Update role ${roleId}`, (draft: any) => {
    const comp = findTargetContainer(draft, componentUuid, false) as DefinedComponent | null;
    if (!comp?.['responsible-roles']) return;

    const index = comp['responsible-roles'].findIndex(r => r['role-id'] === roleId);
    if (index !== -1) {
      comp['responsible-roles'][index] = {
        ...comp['responsible-roles'][index],
        ...patch
      };
    }
  });
}

export function removeComponentRole(componentUuid: string, roleId: string): DocumentAction {
  return createAction('component-definition', 'REMOVE_ROLE', `Remove role ${roleId}`, (draft: any) => {
    const comp = findTargetContainer(draft, componentUuid, false) as DefinedComponent | null;
    if (!comp?.['responsible-roles']) return;

    comp['responsible-roles'] = comp['responsible-roles'].filter(r => r['role-id'] !== roleId);
  });
}

// ============================================================================
// Links Actions (US 3.6)
// ============================================================================

export function addComponentLink(componentUuid: string, link: Link): DocumentAction {
  return createAction('component-definition', 'ADD_LINK', `Add link ${link.href}`, (draft: any) => {
    const comp = findTargetContainer(draft, componentUuid, false) as DefinedComponent | null;
    if (!comp) return;
    if (!comp.links) comp.links = [];

    comp.links.push(link);
  });
}

export function updateComponentLink(componentUuid: string, linkIndex: number, patch: Partial<Link>): DocumentAction {
  return createAction('component-definition', 'UPDATE_LINK', `Update link #${linkIndex}`, (draft: any) => {
    const comp = findTargetContainer(draft, componentUuid, false) as DefinedComponent | null;
    if (!comp?.links || !comp.links[linkIndex]) return;

    comp.links[linkIndex] = {
      ...comp.links[linkIndex],
      ...patch
    };
  });
}

export function removeComponentLink(componentUuid: string, linkIndex: number): DocumentAction {
  return createAction('component-definition', 'REMOVE_LINK', `Remove link #${linkIndex}`, (draft: any) => {
    const comp = findTargetContainer(draft, componentUuid, false) as DefinedComponent | null;
    if (!comp?.links) return;

    comp.links.splice(linkIndex, 1);
  });
}

// ============================================================================
// Capabilities CRUD & Component Incorporation Actions (US 3.13)
// ============================================================================

export function addCapability(capData?: Partial<Capability>): DocumentAction {
  return createAction('component-definition', 'ADD_CAPABILITY', 'Add capability', (draft: any) => {
    const compDef = getCompDef(draft);
    if (!compDef) return;
    if (!compDef.capabilities) compDef.capabilities = [];

    const newCap: Capability = {
      uuid: capData?.uuid || generateUUID(),
      name: capData?.name || 'New Security Capability',
      description: capData?.description || '',
      props: capData?.props || [],
      links: capData?.links || [],
      'incorporates-components': capData?.['incorporates-components'] || [],
      'control-implementations': capData?.['control-implementations'] || [],
      remarks: capData?.remarks || ''
    };

    compDef.capabilities.push(newCap);
  });
}

export function updateCapability(capUuid: string, patch: Partial<Capability>): DocumentAction {
  return createAction('component-definition', 'UPDATE_CAPABILITY', `Update capability ${capUuid}`, (draft: any) => {
    const compDef = getCompDef(draft);
    if (!compDef?.capabilities) return;

    const index = compDef.capabilities.findIndex(c => c.uuid === capUuid);
    if (index !== -1) {
      compDef.capabilities[index] = {
        ...compDef.capabilities[index],
        ...patch
      };
    }
  });
}

export function deleteCapabilities(capUuids: string[]): DocumentAction {
  return createAction('component-definition', 'DELETE_CAPABILITIES', `Delete ${capUuids.length} capability(ies)`, (draft: any) => {
    const compDef = getCompDef(draft);
    if (!compDef?.capabilities) return;

    compDef.capabilities = compDef.capabilities.filter(c => !capUuids.includes(c.uuid));
  });
}

export function addIncorporatedComponent(
  capUuid: string,
  componentUuid: string,
  description?: string
): DocumentAction {
  return createAction('component-definition', 'ADD_INCORPORATED_COMP', `Incorporate component ${componentUuid}`, (draft: any) => {
    const compDef = getCompDef(draft);
    const cap = compDef?.capabilities?.find(c => c.uuid === capUuid);
    if (!cap) return;
    if (!cap['incorporates-components']) cap['incorporates-components'] = [];

    const existingIndex = cap['incorporates-components'].findIndex(ic => ic['component-uuid'] === componentUuid);
    if (existingIndex === -1) {
      // Both component-uuid and description are REQUIRED by schema
      const compTitle = compDef?.components?.find(c => c.uuid === componentUuid)?.title || 'Component';
      cap['incorporates-components'].push({
        'component-uuid': componentUuid,
        description: description || `Incorporates ${compTitle} into this capability.`
      });
    }
  });
}

export function updateIncorporatedComponent(
  capUuid: string,
  componentUuid: string,
  patch: Partial<IncorporatesComponent>
): DocumentAction {
  return createAction('component-definition', 'UPDATE_INCORPORATED_COMP', `Update incorporated component ${componentUuid}`, (draft: any) => {
    const compDef = getCompDef(draft);
    const cap = compDef?.capabilities?.find(c => c.uuid === capUuid);
    if (!cap?.['incorporates-components']) return;

    const item = cap['incorporates-components'].find(ic => ic['component-uuid'] === componentUuid);
    if (item) {
      Object.assign(item, patch);
    }
  });
}

export function removeIncorporatedComponent(capUuid: string, componentUuid: string): DocumentAction {
  return createAction('component-definition', 'REMOVE_INCORPORATED_COMP', `Remove incorporated component ${componentUuid}`, (draft: any) => {
    const compDef = getCompDef(draft);
    const cap = compDef?.capabilities?.find(c => c.uuid === capUuid);
    if (!cap?.['incorporates-components']) return;

    cap['incorporates-components'] = cap['incorporates-components'].filter(ic => ic['component-uuid'] !== componentUuid);
  });
}

// ============================================================================
// Import Component Definitions Actions (US 3.14)
// ============================================================================

export function addImportComponentDefinition(importDef: ImportComponentDefinition): DocumentAction {
  return createAction('component-definition', 'ADD_IMPORT_DEF', `Add import ${importDef.href}`, (draft: any) => {
    const compDef = getCompDef(draft);
    if (!compDef) return;
    if (!compDef['import-component-definitions']) compDef['import-component-definitions'] = [];

    compDef['import-component-definitions'].push(importDef);
  });
}

export function updateImportComponentDefinition(
  index: number,
  patch: Partial<ImportComponentDefinition>
): DocumentAction {
  return createAction('component-definition', 'UPDATE_IMPORT_DEF', `Update import #${index}`, (draft: any) => {
    const compDef = getCompDef(draft);
    if (!compDef?.['import-component-definitions'] || !compDef['import-component-definitions'][index]) return;

    compDef['import-component-definitions'][index] = {
      ...compDef['import-component-definitions'][index],
      ...patch
    };
  });
}

export function removeImportComponentDefinition(hrefOrIndex: string | number): DocumentAction {
  return createAction('component-definition', 'REMOVE_IMPORT_DEF', `Remove import ${hrefOrIndex}`, (draft: any) => {
    const compDef = getCompDef(draft);
    if (!compDef?.['import-component-definitions']) return;

    if (typeof hrefOrIndex === 'number') {
      compDef['import-component-definitions'].splice(hrefOrIndex, 1);
    } else {
      compDef['import-component-definitions'] = compDef['import-component-definitions'].filter(
        imp => imp.href !== hrefOrIndex
      );
    }
  });
}

export function updateComponentDefinitionMetadata(metadata: any): DocumentAction {
  return createAction('component-definition', 'UPDATE_METADATA', 'Update metadata', (draft: any) => {
    const compDef = getCompDef(draft);
    if (!compDef) return;
    compDef.metadata = metadata;
  });
}

export function updateComponentDefinitionBackMatter(backMatter: any): DocumentAction {
  return createAction('component-definition', 'UPDATE_BACK_MATTER', 'Update back matter', (draft: any) => {
    const compDef = getCompDef(draft);
    if (!compDef) return;
    compDef['back-matter'] = backMatter;
  });
}

export function setImportComponentDefinitions(imports: ImportComponentDefinition[]): DocumentAction {
  return createAction('component-definition', 'SET_IMPORT_DEFS', 'Set import component definitions', (draft: any) => {
    const compDef = getCompDef(draft);
    if (!compDef) return;
    compDef['import-component-definitions'] = imports;
  });
}

// ============================================================================
// DD-014 Empty Array Purging & Serialization Pipeline
// ============================================================================


/**
 * Recursively removes empty arrays, cleans whitespace-only values,
 * and strips forbidden properties (e.g. status) per DD-014.
 */
export function sanitizeComponentDefinition(compDef: ComponentDefinition): ComponentDefinition {
  const deepClean = (obj: any): any => {
    if (obj === null || obj === undefined) return undefined;

    if (Array.isArray(obj)) {
      const cleanedArr = obj
        .map(deepClean)
        .filter(item => item !== undefined && item !== null && item !== '');
      return cleanedArr.length > 0 ? cleanedArr : undefined;
    }

    if (typeof obj === 'object') {
      const cleanedObj: Record<string, any> = {};
      for (const [key, val] of Object.entries(obj)) {
        // Rule 1: Strip forbidden SSP fields from defined-component
        if (key === 'status') {
          continue;
        }

        // Rule 2: Clean and validate specific sub-structures
        if (key === 'set-parameters' && Array.isArray(val)) {
          const validParams = val
            .map((p: any) => ({
              ...p,
              values: Array.isArray(p.values)
                ? p.values.map((v: any) => String(v).trim()).filter((v: string) => v.length > 0)
                : undefined
            }))
            .filter((p: any) => p['param-id'] && p.values && p.values.length > 0);

          if (validParams.length > 0) {
            cleanedObj[key] = validParams;
          }
          continue;
        }

        if (key === 'props' && Array.isArray(val)) {
          const validProps = val
            .filter((p: any) => p && typeof p.name === 'string' && p.name.trim() && p.value !== undefined && p.value !== null && String(p.value).trim() !== '')
            .map((p: any) => ({
              ...p,
              name: p.name.trim(),
              value: String(p.value).trim()
            }));

          if (validProps.length > 0) {
            cleanedObj[key] = validProps;
          }
          continue;
        }

        const cleanedVal = deepClean(val);
        if (cleanedVal !== undefined) {
          cleanedObj[key] = cleanedVal;
        }
      }

      // Ensure required description on OSCAL defined-components, capabilities, requirements, and statements
      if (cleanedObj.uuid && cleanedObj.type && cleanedObj.title && (!cleanedObj.description || !String(cleanedObj.description).trim())) {
        cleanedObj.description = 'Component description.';
      }
      if (cleanedObj.uuid && cleanedObj.name && (!cleanedObj.description || !String(cleanedObj.description).trim())) {
        cleanedObj.description = 'Capability description.';
      }
      if (cleanedObj.uuid && cleanedObj['control-id'] && (!cleanedObj.description || !String(cleanedObj.description).trim())) {
        cleanedObj.description = 'Control implementation narrative.';
      }
      if (cleanedObj.uuid && cleanedObj['statement-id'] && (!cleanedObj.description || !String(cleanedObj.description).trim())) {
        cleanedObj.description = 'Statement implementation narrative.';
      }

      // If back-matter exists but has no resources, drop back-matter
      if (cleanedObj['back-matter'] && Object.keys(cleanedObj['back-matter']).length === 0) {
        delete cleanedObj['back-matter'];
      }

      return Object.keys(cleanedObj).length > 0 ? cleanedObj : undefined;
    }

    return obj;
  };

  const result = deepClean(compDef);
  return (result || {}) as ComponentDefinition;
}

/**
 * Sanitizes an entire OSCAL document wrapper containing 'component-definition'.
 */
export function sanitizeComponentDefinitionDocument(doc: { 'component-definition'?: ComponentDefinition; [key: string]: any }): any {
  if (!doc['component-definition']) return doc;
  return {
    ...doc,
    'component-definition': sanitizeComponentDefinition(doc['component-definition'])
  };
}
