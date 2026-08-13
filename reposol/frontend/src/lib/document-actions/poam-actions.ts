import { createAction } from './types';

export function updatePOAMRoot(field: string, value: any) {
  return createAction('poam', 'UPDATE_ROOT', `Update POA&M root field ${field}`,
    (draft: any) => {
      draft['plan-of-action-and-milestones'][field] = value;
    });
}

export function updatePOAMList(listName: string, newList: any[]) {
  return createAction('poam', 'UPDATE_LIST', `Update list ${listName}`,
    (draft: any) => {
      draft['plan-of-action-and-milestones'][listName] = newList;
    });
}

export function savePOAMItem(itemType: string, item: any) {
  return createAction('poam', 'SAVE_ITEM', `Save item in ${itemType}`,
    (draft: any) => {
      const list = draft['plan-of-action-and-milestones'][itemType] || [];
      const idx = list.findIndex((x: any) => x.uuid === item.uuid);
      if (idx >= 0) {
        list[idx] = item;
      } else {
        list.push(item);
      }
      draft['plan-of-action-and-milestones'][itemType] = list;
    });
}

export function replacePOAM(newPoam: any) {
  return createAction('poam', 'REPLACE_POAM', 'Replace entire POA&M document',
    (draft: any) => {
      draft['plan-of-action-and-milestones'] = newPoam;
    });
}
