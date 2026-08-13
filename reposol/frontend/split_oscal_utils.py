import os

src_dir = 'c:/Users/phili/Desktop/Projects/Security-Management-OSCAL/reposol/frontend/src/lib'

oscal_constants = """import { Catalog, Group, Control, Profile, SystemSecurityPlan, ComponentDefinition, AssessmentPlan, AssessmentResults, PlanOfActionAndMilestones, MappingCollection, OscalDocument } from './types/oscal';

export const ROOT_KEYS: Record<string, string> = {
  catalogs: 'catalog',
  profiles: 'profile',
  ssps: 'system-security-plan',
  'component-definitions': 'component-definition',
  'assessment-plans': 'assessment-plan',
  'assessment-results': 'assessment-results',
  poams: 'plan-of-action-and-milestones',
  'control-mappings': 'mapping-collection',
};

export const STAGE_LABELS: Record<string, string> = {
  catalogs: 'Catalog',
  profiles: 'Profile',
  ssps: 'System Security Plan',
  'component-definitions': 'Component Definition',
  'assessment-plans': 'Assessment Plan',
  'assessment-results': 'Assessment Results',
  poams: 'POA&M',
  'control-mappings': 'Control Mapping',
};

export const STAGE_ICONS: Record<string, string> = {
  catalogs: '📖',
  profiles: '⚙️',
  ssps: '📋',
  'component-definitions': '🧱',
  'assessment-plans': '📅',
  'assessment-results': '✅',
  poams: '⚠️',
  'control-mappings': '🔗',
};

export const STAGE_TO_MODEL: Record<string, string> = {
  catalogs: 'catalog',
  profiles: 'profile',
  ssps: 'ssp',
  'component-definitions': 'component-definition',
  'assessment-plans': 'assessment-plan',
  'assessment-results': 'assessment-results',
  poams: 'poam',
  'control-mappings': 'control-mappings',
};

export const STAGE_CONFIG: Record<string, unknown> = {
  catalogs: {
    rootKey: 'catalog',
    label: 'Catalog',
    extraFields: [
      { key: 'groups', label: 'Groups (JSON array)', type: 'json', placeholder: '[]', required: false },
    ],
  },
  profiles: {
    rootKey: 'profile',
    label: 'Profile',
    extraFields: [
      { key: 'imports', label: 'Imports (JSON array)', type: 'json', placeholder: '[{"href": "catalog-uuid-here"}]', required: true },
      { key: 'merge', label: 'Merge (JSON object)', type: 'json', placeholder: '{}', required: false },
      { key: 'modify', label: 'Modify (JSON object)', type: 'json', placeholder: '{}', required: false },
      { key: 'local-controls', label: 'Local Controls (JSON array)', type: 'json', placeholder: '[]', required: false },
    ],
  },
  ssps: {
    rootKey: 'system-security-plan',
    label: 'System Security Plan',
    extraFields: [
      { key: 'import-profile', label: 'Import Profile (JSON: {"href":"..."})', type: 'json', placeholder: '{"href": "profile-uuid-here"}', required: true },
      { key: 'system-characteristics', label: 'System Characteristics (JSON)', type: 'json', placeholder: '{"system-name": "My System", "description": "..."}', required: false },
      { key: 'control-implementation', label: 'Control Implementation (JSON)', type: 'json', placeholder: '{"implemented-requirements": []}', required: false },
    ],
  },
  'component-definitions': {
    rootKey: 'component-definition',
    label: 'Component Definition',
    extraFields: [
      { key: 'components', label: 'Components (JSON array)', type: 'json', placeholder: '[]', required: false },
    ],
  },
  'assessment-plans': {
    rootKey: 'assessment-plan',
    label: 'Assessment Plan',
    extraFields: [
      { key: 'import-ssp', label: 'Import SSP (JSON: {"href":"..."})', type: 'json', placeholder: '{"href": "ssp-uuid-here"}', required: false },
      { key: 'tasks', label: 'Tasks (JSON array)', type: 'json', placeholder: '[]', required: false },
    ],
  },
  'assessment-results': {
    rootKey: 'assessment-results',
    label: 'Assessment Results',
    extraFields: [
      { key: 'import-ap', label: 'Import Assessment Plan (JSON: {"href":"..."})', type: 'json', placeholder: '{"href": "ap-uuid-here"}', required: false },
      { key: 'results', label: 'Results (JSON array)', type: 'json', placeholder: '[]', required: false },
    ],
  },
  poams: {
    rootKey: 'plan-of-action-and-milestones',
    label: 'POA&M',
    extraFields: [
      { key: 'poam-items', label: 'POA&M Items (JSON array)', type: 'json', placeholder: '[]', required: false },
    ],
  },
  'control-mappings': {
    rootKey: 'mapping-collection',
    label: 'Control Mapping',
    extraFields: [
      { key: 'provenance', label: 'Provenance (JSON)', type: 'json', placeholder: '{"method": "human", "matching-rationale": "syntactic", "status": "draft", "mapping-description": "NIST to ISO control crosswalk"}', required: false },
      { key: 'mappings', label: 'Mappings (JSON array)', type: 'json', placeholder: '[]', required: false },
    ],
  },
};
"""

oscal_formatting = """import { Parameter } from './types/oscal';

export function formatProse(prose: string | null | undefined, params: Parameter[] | Record<string, unknown> = []): string {
  if (!prose) return '';

  const placeholderRegex = /\\{\\{\\s*insert:\\s*param,\\s*([^\\s}]+)\\s*\\}\\}/g;

  return prose.replace(placeholderRegex, (_match, paramId) => {
    if (Array.isArray(params)) {
      const param = params.find(p => (p.id || (p as Record<string, unknown>)['param-id']) === paramId);
      if (param) {
        if (param.values && param.values.length > 0 && param.values[0]) {
          return param.values[0];
        }
        if (param.label) {
          return `[${param.label}]`;
        }
      }
      return `[${paramId}]`;
    } else if (params && typeof params === 'object') {
      return params[paramId] !== undefined ? params[paramId] : `[${paramId}]`;
    }
    return `[${paramId}]`;
  });
}
"""

utils = """import { Catalog, Group, Control } from './types/oscal';

export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return uuid();
}

export function getImportUuid(href = ''): string {
  return (
    href.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i)?.[1]?.toLowerCase() || ''
  );
}

export const CONTROL_KEY_ORDER = [
  'id', 'class', 'title', 'params', 'props', 'links', 'parts',
  'responsible-parties', 'controls',
];

export function reorderControlKeys(ctrl: Record<string, unknown>): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  CONTROL_KEY_ORDER.forEach(key => {
    if (ctrl[key] !== undefined) {
      ordered[key] = ctrl[key];
    }
  });
  Object.keys(ctrl).forEach(key => {
    if (ordered[key] === undefined) {
      ordered[key] = ctrl[key];
    }
  });
  return ordered;
}

export function reorderCatalog(catalog: Catalog): void {
  const traverse = (ctrl: Control) => {
    const ordered = reorderControlKeys(ctrl as unknown as Record<string, unknown>);
    Object.keys(ctrl).forEach(key => delete (ctrl as unknown as Record<string, unknown>)[key]);
    Object.assign(ctrl, ordered);
    if (ctrl.controls) {
      ctrl.controls.forEach(traverse);
    }
  };
  const traverseGroup = (g: Group) => {
    if (g.controls) g.controls.forEach(traverse);
    if (g.groups) g.groups.forEach(traverseGroup);
  };
  if (catalog.controls) catalog.controls.forEach(traverse);
  if (catalog.groups) catalog.groups.forEach(traverseGroup);
}

const PRESERVE_EMPTY_ARRAYS = new Set(['maps', 'mappings', 'sources', 'targets']);

export function cleanEmptyArrays(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(cleanEmptyArrays).filter((item: unknown) => item !== undefined);
  } else if (obj !== null && typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (Array.isArray(val) && val.length === 0 && !PRESERVE_EMPTY_ARRAYS.has(key)) {
        continue;
      }
      cleaned[key] = cleanEmptyArrays(val);
    }
    return cleaned;
  }
  return obj;
}

const ISO_DATETIME_REGEX = /^(((2000|2400|2800|(19|2[0-9](0[48]|[2468][048]|[13579][26])))-02-29)|(((19|2[0-9])[0-9]{2})-02-(0[1-9]|1[0-9]|2[0-8]))|(((19|2[0-9])[0-9]{2})-(0[13578]|10|12)-(0[1-9]|[12][0-9]|3[01]))|(((19|2[0-9])[0-9]{2})-(0[469]|11)-(0[1-9]|[12][0-9]|30)))T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\.[0-9]+)?(Z|(-((0[0-9]|1[0-2]):00|0[39]:30)|\+((0[0-9]|1[0-4]):00|(0[34569]|10):30|(0[58]|12):45)))$/;

export function isValidIsoDateTime(val?: string | null): boolean {
  if (!val || typeof val !== 'string' || !val.trim()) return true;
  return ISO_DATETIME_REGEX.test(val.trim());
}

export function isValidEmail(val?: string | null): boolean {
  if (!val || typeof val !== 'string' || !val.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
}
"""

oscal_utils_barrel = """export * from './oscal-constants';
export * from './oscal-formatting';
export * from './utils';
"""

with open(os.path.join(src_dir, 'oscal-constants.ts'), 'w', encoding='utf-8') as f:
    f.write(oscal_constants)
with open(os.path.join(src_dir, 'oscal-formatting.ts'), 'w', encoding='utf-8') as f:
    f.write(oscal_formatting)
with open(os.path.join(src_dir, 'utils.ts'), 'w', encoding='utf-8') as f:
    f.write(utils)
with open(os.path.join(src_dir, 'oscal-utils.ts'), 'w', encoding='utf-8') as f:
    f.write(oscal_utils_barrel)
