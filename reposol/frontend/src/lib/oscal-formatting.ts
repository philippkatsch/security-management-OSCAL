import { Parameter } from './types/oscal';

export function formatProse(
  prose: string | null | undefined,
  params: Parameter[] | Record<string, unknown> = []
): string {
  if (!prose) return '';

  const placeholderRegex = /\{\{\s*insert:\s*param\s*,\s*([^}\s]+)\s*\}\}/g;

  return prose.replace(placeholderRegex, (_match: string, paramId: string): string => {
    if (Array.isArray(params)) {
      const param = params.find((p: any) => p && (p.id || p['param-id']) === paramId) as any;
      if (param) {
        if (Array.isArray(param.values)) {
          const validValues = param.values
            .filter((v: any) => v !== undefined && v !== null && String(v).trim() !== '')
            .map((v: any) => String(v).trim());
          if (validValues.length > 0) {
            return validValues.join(', ');
          }
        }
        if (param.label) {
          return `[${param.label}]`;
        }
      }
      return `[${paramId}]`;
    } else if (params && typeof params === 'object') {
      const val = (params as Record<string, any>)[paramId];
      if (val !== undefined && val !== null) {
        if (Array.isArray(val)) {
          const validValues = val
            .filter((v: any) => v !== undefined && v !== null && String(v).trim() !== '')
            .map((v: any) => String(v).trim());
          if (validValues.length > 0) {
            return validValues.join(', ');
          }
        } else if (typeof val === 'object') {
          const objVal = val as any;
          if (Array.isArray(objVal.values)) {
            const validValues = objVal.values
              .filter((v: any) => v !== undefined && v !== null && String(v).trim() !== '')
              .map((v: any) => String(v).trim());
            if (validValues.length > 0) {
              return validValues.join(', ');
            }
          }
          if (objVal.label) {
            return `[${objVal.label}]`;
          }
        } else {
          const strVal = String(val).trim();
          if (strVal !== '') {
            return String(val);
          }
        }
      }
      return `[${paramId}]`;
    }
    return `[${paramId}]`;
  });
}
