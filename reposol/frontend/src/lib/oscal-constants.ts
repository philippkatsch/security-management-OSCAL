import { Catalog, Group, Control, Profile, SystemSecurityPlan, ComponentDefinition, AssessmentPlan, AssessmentResults, PlanOfActionAndMilestones, MappingCollection, OscalDocument } from './types/oscal';

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
