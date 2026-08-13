import { createAction } from './types';

export function initializeSSPComponents(sysName: string) {
  return createAction('ssp', 'INIT_COMPONENTS', 'Initialize default SSP component',
    (draft: any) => {
      if (!draft['system-security-plan']['system-implementation']) {
        draft['system-security-plan']['system-implementation'] = {};
      }
      draft['system-security-plan']['system-implementation'].components = [{
        uuid: crypto.randomUUID(),
        type: 'this-system',
        title: sysName,
        description: 'This system',
        status: { state: 'operational' }
      }];
    });
}

export function updateSSPField(path: (string | number)[], value: any) {
  return createAction('ssp', 'UPDATE_FIELD', `Update SSP field ${path.join('.')}`,
    (draft: any) => {
      let current = draft['system-security-plan'];
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) current[path[i]] = {};
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
    });
}

export function updateSSPListItem(listPath: string[], itemUuid: string, updates: any) {
  return createAction('ssp', 'UPDATE_LIST_ITEM', `Update list item in ${listPath.join('.')}`,
    (draft: any) => {
      const sspRef = draft['system-security-plan'] || {};
      const list = listPath.reduce((obj, key) => (obj && obj[key]) || [], sspRef);
      const idx = list.findIndex((x: any) => x.uuid === itemUuid);
      if (idx > -1) {
        list[idx] = { ...list[idx], ...updates };
      }
    });
}

export function replaceSSP(newSsp: any) {
  return createAction('ssp', 'REPLACE_SSP', 'Replace entire SSP document',
    (draft: any) => {
      draft['system-security-plan'] = newSsp;
    });
}
