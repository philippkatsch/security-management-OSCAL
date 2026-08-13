import { Catalog, Group, Control } from './types/oscal';

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
