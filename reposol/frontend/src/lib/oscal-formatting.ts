import { Parameter } from './types/oscal';

export function formatProse(prose: string | null | undefined, params: Parameter[] | Record<string, unknown> = []): string {
  if (!prose) return '';

  const placeholderRegex = /\{\{\s*insert:\s*param,\s*([^\s}]+)\s*\}\}/g;

  return prose.replace(placeholderRegex, (_match: string, paramId: string): string => {
    if (Array.isArray(params)) {
      const param = params.find((p: any) => (p.id || p['param-id']) === paramId) as any;
      if (param) {
        if (param.values && param.values.length > 0 && param.values[0]) {
          return String(param.values[0]);
        }
        if (param.label) {
          return `[${param.label}]`;
        }
      }
      return `[${paramId}]`;
    } else if (params && typeof params === 'object') {
      const val = (params as Record<string, any>)[paramId];
      return val !== undefined ? String(val) : `[${paramId}]`;
    }
    return `[${paramId}]`;
  });
}
