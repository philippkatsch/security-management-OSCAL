import { createAction } from './types';

export function updateCatalogRoot(field: string, value: any) {
  return createAction('catalog', 'UPDATE_ROOT', `Update catalog root field ${field}`,
    (draft: any) => {
      if (draft.catalog) draft.catalog[field] = value;
    });
}
