import { Parameter } from './types/oscal';

export function formatProse(prose: string | null | undefined, params: Parameter[] | Record<string, unknown> = []): string {
  if (!prose) return '';

  const placeholderRegex = /\{\{\s*insert:\s*param,\s*([^\s}]+)\s*\}\}/g;

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
