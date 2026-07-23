/**
 * oscal-utils.js
 * Shared OSCAL constants and utility functions.
 * Extracted from CatalogViewer.jsx and DocumentEditor.jsx.
 */

// ---------------------------------------------------------------------------
// UUID generation
// ---------------------------------------------------------------------------

/**
 * Generate a v4-style UUID string.
 * @returns {string} UUID in the format xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------------------------------------------------------------------------
// Stage / model mapping constants
// ---------------------------------------------------------------------------

/**
 * Maps API-level stage names to the root key used in OSCAL JSON documents.
 */
export const ROOT_KEYS = {
  catalogs: 'catalog',
  profiles: 'profile',
  ssps: 'system-security-plan',
  'component-definitions': 'component-definition',
  'assessment-plans': 'assessment-plan',
  'assessment-results': 'assessment-results',
  poams: 'plan-of-action-and-milestones',
  'control-mappings': 'mapping-collection',
};

/**
 * Human-readable labels for each OSCAL stage.
 */
export const STAGE_LABELS = {
  catalogs: 'Catalog',
  profiles: 'Profile',
  ssps: 'System Security Plan',
  'component-definitions': 'Component Definition',
  'assessment-plans': 'Assessment Plan',
  'assessment-results': 'Assessment Results',
  poams: 'POA&M',
  'control-mappings': 'Control Mapping',
};

/**
 * Emoji icons for each OSCAL stage.
 */
export const STAGE_ICONS = {
  catalogs: '📖',
  profiles: '⚙️',
  ssps: '📝',
  'component-definitions': '🧱',
  'assessment-plans': '📅',
  'assessment-results': '✅',
  poams: '⚠️',
  'control-mappings': '🔗',
};

/**
 * Maps API-level stage names to short model identifiers.
 * Used in draft storage keys and registry filtering.
 */
export const STAGE_TO_MODEL = {
  catalogs: 'catalog',
  profiles: 'profile',
  ssps: 'ssp',
  'component-definitions': 'component-definition',
  'assessment-plans': 'assessment-plan',
  'assessment-results': 'assessment-results',
  poams: 'poam',
  'control-mappings': 'control-mappings',
};

/**
 * Full stage configuration used primarily by DocumentEditor.
 * Each entry contains the rootKey, a label, and extra form fields.
 */
export const STAGE_CONFIG = {
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

// ---------------------------------------------------------------------------
// Prose formatting
// ---------------------------------------------------------------------------

/**
 * Replace OSCAL parameter-insert placeholders in prose text with resolved values.
 *
 * Placeholders follow the format: {{ insert: param, <param-id> }}
 *
 * This is the **plain-text** version (no JSX).  It returns a string with
 * parameter values (or the raw param-id when no value is found) substituted
 * inline.
 *
 * @param {string} prose  - The prose string potentially containing placeholders.
 * @param {Array}  params - Array of param objects with `id`, `values`, and `label` fields.
 * @returns {string} The prose with placeholders replaced by parameter values.
 */
export function formatProse(prose, params = []) {
  if (!prose) return '';

  const placeholderRegex = /\{\{\s*insert:\s*param,\s*([^\s}]+)\s*\}\}/g;

  return prose.replace(placeholderRegex, (_match, paramId) => {
    if (Array.isArray(params)) {
      const param = params.find(p => (p.id || p['param-id']) === paramId);
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

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

/**
 * Extract a UUID from an href string (e.g. `#catalog-uuid-here` or a full path).
 * Returns the lowercase UUID or an empty string if not found.
 *
 * @param {string} href
 * @returns {string}
 */
export function getImportUuid(href = '') {
  return (
    href.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i)?.[1]?.toLowerCase() || ''
  );
}

/**
 * The ordered set of keys used when reordering OSCAL control objects
 * to comply with OSCAL JSON key ordering conventions.
 */
export const CONTROL_KEY_ORDER = [
  'id', 'class', 'title', 'params', 'props', 'links', 'parts',
  'responsible-parties', 'controls',
];

/**
 * Reorder the keys of a control object to the OSCAL-standard order.
 *
 * @param {Object} ctrl - A control object.
 * @returns {Object} A new object with keys in standard order.
 */
export function reorderControlKeys(ctrl) {
  const ordered = {};
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

/**
 * Reorder all controls (and controls within groups) in a catalog
 * so their keys follow the OSCAL-standard order.  Mutates the
 * catalog object in-place.
 *
 * @param {Object} catalog - A catalog object with optional `controls` and `groups`.
 */
export function reorderCatalog(catalog) {
  const traverse = (ctrl) => {
    const ordered = reorderControlKeys(ctrl);
    Object.keys(ctrl).forEach(key => delete ctrl[key]);
    Object.assign(ctrl, ordered);
    if (ctrl.controls) {
      ctrl.controls.forEach(traverse);
    }
  };
  const traverseGroup = (g) => {
    if (g.controls) g.controls.forEach(traverse);
    if (g.groups) g.groups.forEach(traverseGroup);
  };
  if (catalog.controls) catalog.controls.forEach(traverse);
  if (catalog.groups) catalog.groups.forEach(traverseGroup);
}

// ---------------------------------------------------------------------------
// Real-time OSCAL datatype format validators
// ---------------------------------------------------------------------------

const ISO_DATETIME_REGEX = /^(((2000|2400|2800|(19|2[0-9](0[48]|[2468][048]|[13579][26])))-02-29)|(((19|2[0-9])[0-9]{2})-02-(0[1-9]|1[0-9]|2[0-8]))|(((19|2[0-9])[0-9]{2})-(0[13578]|10|12)-(0[1-9]|[12][0-9]|3[01]))|(((19|2[0-9])[0-9]{2})-(0[469]|11)-(0[1-9]|[12][0-9]|30)))T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\.[0-9]+)?(Z|(-((0[0-9]|1[0-2]):00|0[39]:30)|\+((0[0-9]|1[0-4]):00|(0[34569]|10):30|(0[58]|12):45)))$/;

/**
 * Validate whether a string conforms to OSCAL ISO 8601 DateTimeWithTimezone format.
 * Returns true if empty (optional field) or valid ISO datetime string.
 *
 * @param {string} val
 * @returns {boolean}
 */
export function isValidIsoDateTime(val) {
  if (!val || typeof val !== 'string' || !val.trim()) return true;
  return ISO_DATETIME_REGEX.test(val.trim());
}

/**
 * Validate whether a string conforms to a standard email address format.
 * Returns true if empty (optional field) or valid email.
 *
 * @param {string} val
 * @returns {boolean}
 */
export function isValidEmail(val) {
  if (!val || typeof val !== 'string' || !val.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
}
