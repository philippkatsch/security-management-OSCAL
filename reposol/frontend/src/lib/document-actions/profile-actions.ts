import { createAction, DocumentAction } from './types';
import {
  Profile,
  Property,
  Parameter,
  Part,
  Link
} from '../types/oscal';

/**
 * Custom Group structure within profile.merge.custom.groups
 */
export interface CustomGroup {
  id: string;
  class?: string;
  title: string;
  params?: Parameter[];
  props?: Property[];
  links?: Link[];
  parts?: Part[];
  groups?: CustomGroup[];
  'insert-controls'?: InsertControls[];
}

/**
 * OSCAL Profile insert-controls directive
 */
export interface InsertControls {
  order?: 'keep' | 'ascending' | 'descending';
  'include-all'?: Record<string, unknown>;
  'include-controls'?: SelectControlById[];
  'exclude-controls'?: SelectControlById[];
}

/**
 * OSCAL Profile select-control-by-id directive
 */
export interface SelectControlById {
  'with-child-controls'?: 'yes' | 'no';
  'with-ids'?: string[];
  'matching'?: { pattern: string }[];
}

/**
 * Action Payloads
 */
export interface AddCustomGroupPayload {
  title: string;
  id?: string;
  parentGroupId?: string | null;
  class?: string;
  order?: 'keep' | 'ascending' | 'descending';
  props?: Property[];
}

export interface RenameCustomGroupPayload {
  groupId: string;
  title?: string;
  newId?: string;
  class?: string;
}

export interface DeleteCustomGroupPayload {
  groupId: string;
  deleteChildren?: boolean;
  reassignToGroupId?: string | null;
}

export interface MoveCustomGroupPayload {
  sourceGroupId: string;
  targetGroupId?: string | null;
  targetIndex?: number;
}

export interface AssignControlToCustomGroupPayload {
  controlId: string;
  targetGroupId?: string | null;
  order?: 'keep' | 'ascending' | 'descending';
  targetIndex?: number;
}

export interface AssignMultipleControlsToCustomGroupPayload {
  controlIds: string[];
  targetGroupId?: string | null;
  order?: 'keep' | 'ascending' | 'descending';
}

export interface RemoveControlFromCustomGroupPayload {
  controlId: string;
  sourceGroupId?: string | null;
}

export interface RemoveMultipleControlsFromCustomGroupPayload {
  controlIds: string[];
  sourceGroupId?: string | null;
}

export interface ReorderControlsInCustomGroupPayload {
  groupId: string;
  controlIds?: string[];
  order?: 'keep' | 'ascending' | 'descending';
}

export interface ImportCustomGroupBranchPayload {
  group: any;
  targetParentId?: string | null;
  targetIndex?: number;
}

export interface SetMergeModePayload {
  mode: 'as-is' | 'flat' | 'custom';
}

export interface SetCombineMethodPayload {
  method: 'use-first' | 'merge' | 'keep';
}

/**
 * Normalizes draft to extract the Profile object regardless of whether draft is
 * the root OscalDocument { profile: { ... } } or the Profile itself.
 */
export function getProfileFromDraft(draft: any): Profile | null {
  if (!draft) return null;
  if (draft.profile) return draft.profile;
  if (draft.imports || draft.merge || draft.metadata || draft.uuid || draft.modify) return draft as Profile;
  return null;
}

/**
 * Ensures profile.merge.custom exists and purges mutually exclusive keys (as-is, flat).
 */
export function ensureCustomMergeStructure(profile: any): void {
  if (!profile.merge) {
    profile.merge = {
      combine: { method: 'use-first' }
    };
  }
  if (!profile.merge.custom) {
    profile.merge.custom = {
      groups: []
    };
  }
  if (!Array.isArray(profile.merge.custom.groups)) {
    profile.merge.custom.groups = [];
  }
  delete profile.merge['as-is'];
  delete profile.merge.flat;
}

/**
 * Recursively locates a CustomGroup by ID (case-insensitive).
 */
export function findCustomGroupById(
  container: { groups?: CustomGroup[] } | CustomGroup[] | null | undefined,
  groupId: string
): CustomGroup | null {
  if (!container || !groupId) return null;
  const groups = Array.isArray(container) ? container : container.groups;
  if (!groups) return null;

  const targetIdLower = groupId.toLowerCase();
  for (const g of groups) {
    if (g.id && g.id.toLowerCase() === targetIdLower) return g;
    if (g.groups && g.groups.length > 0) {
      const found = findCustomGroupById(g, groupId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Finds parent group and index for a given groupId.
 */
export function findCustomGroupLocation(
  container: { groups?: CustomGroup[] },
  groupId: string
): { parent: CustomGroup | null; index: number; siblings: CustomGroup[] } | null {
  if (!container.groups) return null;
  const targetIdLower = groupId.toLowerCase();

  const idx = container.groups.findIndex(g => g.id && g.id.toLowerCase() === targetIdLower);
  if (idx !== -1) {
    return { parent: null, index: idx, siblings: container.groups };
  }

  for (const g of container.groups) {
    if (g.groups) {
      const subIdx = g.groups.findIndex(sub => sub.id && sub.id.toLowerCase() === targetIdLower);
      if (subIdx !== -1) {
        return { parent: g, index: subIdx, siblings: g.groups };
      }
      const deep = findCustomGroupLocation(g, groupId);
      if (deep) return deep;
    }
  }
  return null;
}

/**
 * Recursively finds and detaches a group from its parent container.
 */
export function findAndRemoveCustomGroup(
  container: { groups?: CustomGroup[] },
  groupId: string
): CustomGroup | null {
  if (!container.groups) return null;
  const targetIdLower = groupId.toLowerCase();

  const idx = container.groups.findIndex(g => g.id && g.id.toLowerCase() === targetIdLower);
  if (idx !== -1) {
    const [removed] = container.groups.splice(idx, 1);
    return removed;
  }

  for (const g of container.groups) {
    const removed = findAndRemoveCustomGroup(g, groupId);
    if (removed) return removed;
  }
  return null;
}

/**
 * Checks if a potential child ID is a descendant of parentId to prevent cyclic hierarchies.
 */
export function isGroupDescendant(
  rootContainer: { groups?: CustomGroup[] },
  parentId: string,
  potentialChildId: string
): boolean {
  const parent = findCustomGroupById(rootContainer, parentId);
  if (!parent) return false;
  return findCustomGroupById(parent, potentialChildId) !== null;
}

/**
 * Normalizes insert-controls in a group and ensures at least one valid include-controls entry exists.
 */
export function ensureInsertControls(group: CustomGroup): InsertControls {
  if (!group['insert-controls'] || !Array.isArray(group['insert-controls']) || group['insert-controls'].length === 0) {
    group['insert-controls'] = [
      {
        order: 'keep',
        'include-controls': [
          {
            'with-ids': []
          }
        ]
      }
    ];
  }
  const primaryIc = group['insert-controls'][0];
  if (!primaryIc['include-controls'] || !Array.isArray(primaryIc['include-controls']) || primaryIc['include-controls'].length === 0) {
    primaryIc['include-controls'] = [{ 'with-ids': [] }];
  }
  const primaryInc = primaryIc['include-controls'][0];
  if (!primaryInc['with-ids'] || !Array.isArray(primaryInc['with-ids'])) {
    primaryInc['with-ids'] = [];
  }
  return primaryIc;
}

/**
 * Gathers all control IDs assigned to a specific group.
 */
export function gatherControlsInGroup(group: CustomGroup): string[] {
  const ids: string[] = [];
  const icArray = group['insert-controls'] || [];
  for (const ic of icArray) {
    if (ic['include-controls']) {
      for (const inc of ic['include-controls']) {
        if (inc['with-ids']) {
          for (const cid of inc['with-ids']) {
            if (cid && !ids.includes(cid)) {
              ids.push(cid);
            }
          }
        }
      }
    }
  }
  return ids;
}

/**
 * Gathers all control IDs assigned across all custom groups and top-level insert-controls.
 */
export function gatherAllAssignedControlIds(
  mergeCustom?: { groups?: CustomGroup[]; 'insert-controls'?: InsertControls[] } | null
): Set<string> {
  const assigned = new Set<string>();
  if (!mergeCustom) return assigned;

  const collectFromIc = (icList?: InsertControls[]) => {
    if (!icList) return;
    for (const ic of icList) {
      if (ic['include-controls']) {
        for (const inc of ic['include-controls']) {
          if (inc['with-ids']) {
            for (const id of inc['with-ids']) {
              if (id) assigned.add(id.toLowerCase());
            }
          }
        }
      }
    }
  };

  const collectFromGroup = (g: CustomGroup) => {
    if ((g as any).controls) {
      for (const c of (g as any).controls) {
        if (c?.id) assigned.add(c.id.toLowerCase());
        if (c?.controls) {
          for (const sub of c.controls) {
            if (sub?.id) assigned.add(sub.id.toLowerCase());
          }
        }
      }
    }
    collectFromIc(g['insert-controls']);
    if (g.groups) {
      for (const sub of g.groups) {
        collectFromGroup(sub);
      }
    }
  };

  if (mergeCustom.groups) {
    for (const g of mergeCustom.groups) {
      collectFromGroup(g);
    }
  }
  collectFromIc(mergeCustom['insert-controls']);

  return assigned;
}

/**
 * Removes a control ID from all custom groups and top-level insert-controls (enforces exclusive assignment).
 */
export function removeControlFromAllCustomGroups(
  mergeCustom: { groups?: CustomGroup[]; 'insert-controls'?: InsertControls[] },
  controlId: string
): void {
  const cidLower = controlId.toLowerCase();

  const cleanIcList = (icList?: InsertControls[]) => {
    if (!icList) return;
    for (const ic of icList) {
      if (ic['include-controls']) {
        for (const inc of ic['include-controls']) {
          if (inc['with-ids']) {
            inc['with-ids'] = inc['with-ids'].filter(id => id.toLowerCase() !== cidLower);
          }
        }
      }
    }
  };

  const cleanGroup = (g: CustomGroup) => {
    cleanIcList(g['insert-controls']);
    if ((g as any).controls) {
      (g as any).controls = (g as any).controls.filter((c: any) => c?.id?.toLowerCase() !== cidLower);
    }
    if (g.groups) {
      for (const sub of g.groups) {
        cleanGroup(sub);
      }
    }
  };

  if (mergeCustom.groups) {
    for (const g of mergeCustom.groups) {
      cleanGroup(g);
    }
  }
  cleanIcList(mergeCustom['insert-controls']);
}

// ---------------------------------------------------------------------------
// Action Mutators & Action Creators
// ---------------------------------------------------------------------------

export function applyAddCustomGroup(draft: any, payload: AddCustomGroupPayload): CustomGroup | null {
  const profile = getProfileFromDraft(draft);
  if (!profile) return null;

  ensureCustomMergeStructure(profile);
  const custom = profile.merge!.custom as { groups: CustomGroup[] };

  const groupId = (payload.id && payload.id.trim()) || `custom_grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const title = (payload.title && payload.title.trim()) || 'New Custom Group';

  const newGroup: CustomGroup = {
    id: groupId,
    title: title,
    class: payload.class || 'family',
    props: payload.props || [],
    groups: [],
    'insert-controls': [
      {
        order: payload.order || 'keep',
        'include-controls': [
          {
            'with-ids': []
          }
        ]
      }
    ]
  };

  if (!payload.parentGroupId) {
    custom.groups.push(newGroup);
  } else {
    const parent = findCustomGroupById(custom, payload.parentGroupId);
    if (parent) {
      if (!parent.groups) parent.groups = [];
      parent.groups.push(newGroup);
    } else {
      custom.groups.push(newGroup);
    }
  }

  return newGroup;
}

export function addCustomGroup(payload: AddCustomGroupPayload): DocumentAction<AddCustomGroupPayload> {
  return createAction(
    'profile',
    'ADD_CUSTOM_GROUP',
    `Add custom group "${payload.title || payload.id || 'New Group'}"${payload.parentGroupId ? ` under ${payload.parentGroupId}` : ' at root'}`,
    (draft: any) => { applyAddCustomGroup(draft, payload); },
    payload
  );
}

export function applyRenameCustomGroup(draft: any, payload: RenameCustomGroupPayload): boolean {
  const profile = getProfileFromDraft(draft);
  if (!profile?.merge?.custom) return false;

  const custom = profile.merge.custom as { groups?: CustomGroup[] };
  const group = findCustomGroupById(custom, payload.groupId);
  if (!group) return false;

  if (payload.title !== undefined && payload.title.trim() !== '') {
    group.title = payload.title.trim();
  }
  if (payload.newId !== undefined && payload.newId.trim() !== '') {
    const trimmedId = payload.newId.trim();
    if (trimmedId.toLowerCase() !== payload.groupId.toLowerCase()) {
      const existing = findCustomGroupById(custom, trimmedId);
      if (!existing) {
        group.id = trimmedId;
      }
    }
  }
  if (payload.class !== undefined) {
    group.class = payload.class;
  }
  return true;
}

export function renameCustomGroup(payload: RenameCustomGroupPayload): DocumentAction<RenameCustomGroupPayload> {
  return createAction(
    'profile',
    'RENAME_CUSTOM_GROUP',
    `Rename custom group ${payload.groupId} to "${payload.title || payload.newId}"`,
    (draft: any) => { applyRenameCustomGroup(draft, payload); },
    payload
  );
}

export function applyDeleteCustomGroup(draft: any, payload: DeleteCustomGroupPayload): boolean {
  const profile = getProfileFromDraft(draft);
  if (!profile?.merge?.custom) return false;

  const custom = profile.merge.custom as { groups?: CustomGroup[] };
  const loc = findCustomGroupLocation(custom, payload.groupId);
  if (!loc) return false;

  const { index, siblings } = loc;
  const [removedGroup] = siblings.splice(index, 1);
  if (!removedGroup) return false;

  if (payload.reassignToGroupId) {
    const targetGroup = findCustomGroupById(custom, payload.reassignToGroupId);
    if (targetGroup) {
      if (removedGroup.groups && removedGroup.groups.length > 0) {
        if (!targetGroup.groups) targetGroup.groups = [];
        targetGroup.groups.push(...removedGroup.groups);
      }
      const controlsToMove = gatherControlsInGroup(removedGroup);
      if (controlsToMove.length > 0) {
        const targetIc = ensureInsertControls(targetGroup);
        const withIds = targetIc['include-controls']![0]['with-ids']!;
        for (const cid of controlsToMove) {
          if (!withIds.some(id => id.toLowerCase() === cid.toLowerCase())) {
            withIds.push(cid);
          }
        }
      }
    }
  } else if (payload.deleteChildren === false) {
    if (removedGroup.groups && removedGroup.groups.length > 0) {
      siblings.splice(index, 0, ...removedGroup.groups);
    }
  }

  return true;
}

export function deleteCustomGroup(payload: DeleteCustomGroupPayload): DocumentAction<DeleteCustomGroupPayload> {
  return createAction(
    'profile',
    'DELETE_CUSTOM_GROUP',
    `Delete custom group ${payload.groupId}${payload.reassignToGroupId ? ` (reassigning to ${payload.reassignToGroupId})` : ''}`,
    (draft: any) => { applyDeleteCustomGroup(draft, payload); },
    payload
  );
}

export function applyMoveCustomGroup(draft: any, payload: MoveCustomGroupPayload): boolean {
  const profile = getProfileFromDraft(draft);
  if (!profile?.merge?.custom) return false;

  const custom = profile.merge.custom as { groups?: CustomGroup[] };
  const { sourceGroupId, targetGroupId, targetIndex } = payload;
  if (!sourceGroupId) return false;

  if (targetGroupId) {
    if (sourceGroupId.toLowerCase() === targetGroupId.toLowerCase()) return false;
    if (isGroupDescendant(custom, sourceGroupId, targetGroupId)) return false;
  }

  const removedGroup = findAndRemoveCustomGroup(custom, sourceGroupId);
  if (!removedGroup) return false;

  if (!targetGroupId) {
    const rootGroups = custom.groups || [];
    if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= rootGroups.length) {
      rootGroups.splice(targetIndex, 0, removedGroup);
    } else {
      rootGroups.push(removedGroup);
    }
    custom.groups = rootGroups;
  } else {
    const targetGroup = findCustomGroupById(custom, targetGroupId);
    if (targetGroup) {
      if (!targetGroup.groups) targetGroup.groups = [];
      if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= targetGroup.groups.length) {
        targetGroup.groups.splice(targetIndex, 0, removedGroup);
      } else {
        targetGroup.groups.push(removedGroup);
      }
    } else {
      if (!custom.groups) custom.groups = [];
      custom.groups.push(removedGroup);
    }
  }

  return true;
}

export function moveCustomGroup(payload: MoveCustomGroupPayload): DocumentAction<MoveCustomGroupPayload> {
  return createAction(
    'profile',
    'MOVE_CUSTOM_GROUP',
    `Move custom group ${payload.sourceGroupId} to ${payload.targetGroupId || 'root'}${payload.targetIndex !== undefined ? ` at index ${payload.targetIndex}` : ''}`,
    (draft: any) => { applyMoveCustomGroup(draft, payload); },
    payload
  );
}

export function applyAssignControlToCustomGroup(
  draft: any,
  payload: AssignControlToCustomGroupPayload
): boolean {
  const profile = getProfileFromDraft(draft);
  if (!profile) return false;

  ensureCustomMergeStructure(profile);
  const custom = profile.merge!.custom as { groups: CustomGroup[]; 'insert-controls'?: InsertControls[] };

  const { controlId, targetGroupId, order, targetIndex } = payload;
  if (!controlId) return false;

  let targetGroup: CustomGroup | null = null;
  const isRoot = !targetGroupId || targetGroupId === '__root__';

  if (!isRoot) {
    targetGroup = findCustomGroupById(custom, targetGroupId!);
    if (!targetGroup) return false;
  }

  // Enforce exclusive assignment only after target is validated
  removeControlFromAllCustomGroups(custom, controlId);

  if (isRoot) {
    if (!custom['insert-controls']) {
      custom['insert-controls'] = [
        {
          order: order || 'keep',
          'include-controls': [{ 'with-ids': [] }]
        }
      ];
    }
    const ic = custom['insert-controls'][0];
    if (order) ic.order = order;
    if (!ic['include-controls']) ic['include-controls'] = [{ 'with-ids': [] }];
    const inc = ic['include-controls'][0];
    if (!inc['with-ids']) inc['with-ids'] = [];
    if (!inc['with-ids'].some(id => id.toLowerCase() === controlId.toLowerCase())) {
      if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= inc['with-ids'].length) {
        inc['with-ids'].splice(targetIndex, 0, controlId);
      } else {
        inc['with-ids'].push(controlId);
      }
    }
    return true;
  }

  const ic = ensureInsertControls(targetGroup!);
  if (order) {
    ic.order = order;
  }

  const inc = ic['include-controls']![0];
  if (!inc['with-ids']) {
    inc['with-ids'] = [];
  }
  const withIds = inc['with-ids'];

  if (!withIds.some(id => id.toLowerCase() === controlId.toLowerCase())) {
    if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= withIds.length) {
      withIds.splice(targetIndex, 0, controlId);
    } else {
      withIds.push(controlId);
    }
  }

  return true;
}

export function assignControlToCustomGroup(
  payload: AssignControlToCustomGroupPayload
): DocumentAction<AssignControlToCustomGroupPayload> {
  return createAction(
    'profile',
    'ASSIGN_CONTROL_TO_CUSTOM_GROUP',
    `Assign control ${payload.controlId} to ${payload.targetGroupId ? `custom group ${payload.targetGroupId}` : 'top-level'}`,
    (draft: any) => { applyAssignControlToCustomGroup(draft, payload); },
    payload
  );
}

export function applyAssignMultipleControlsToCustomGroup(
  draft: any,
  payload: AssignMultipleControlsToCustomGroupPayload
): boolean {
  const profile = getProfileFromDraft(draft);
  if (!profile) return false;

  ensureCustomMergeStructure(profile);
  const custom = profile.merge!.custom as { groups: CustomGroup[]; 'insert-controls'?: InsertControls[] };

  const { controlIds, targetGroupId, order } = payload;
  if (!controlIds || controlIds.length === 0) return false;

  let targetGroup: CustomGroup | null = null;
  const isRoot = !targetGroupId || targetGroupId === '__root__';

  if (!isRoot) {
    targetGroup = findCustomGroupById(custom, targetGroupId!);
    if (!targetGroup) return false;
  }

  // 1. Remove all target controls from all existing custom groups first
  for (const cid of controlIds) {
    if (cid) {
      removeControlFromAllCustomGroups(custom, cid);
    }
  }

  if (isRoot) {
    if (!custom['insert-controls']) {
      custom['insert-controls'] = [
        {
          order: order || 'keep',
          'include-controls': [{ 'with-ids': [] }]
        }
      ];
    }
    const ic = custom['insert-controls'][0];
    if (order) ic.order = order;
    if (!ic['include-controls']) ic['include-controls'] = [{ 'with-ids': [] }];
    const inc = ic['include-controls'][0];
    if (!inc['with-ids']) inc['with-ids'] = [];
    for (const cid of controlIds) {
      if (cid && !inc['with-ids'].some(id => id.toLowerCase() === cid.toLowerCase())) {
        inc['with-ids'].push(cid);
      }
    }
    return true;
  }

  // 2. Obtain insert-controls reference after removals are complete
  const ic = ensureInsertControls(targetGroup!);
  if (order) {
    ic.order = order;
  }

  const inc = ic['include-controls']![0];
  if (!inc['with-ids']) {
    inc['with-ids'] = [];
  }
  const withIds = inc['with-ids'];

  for (const cid of controlIds) {
    if (cid && !withIds.some(id => id.toLowerCase() === cid.toLowerCase())) {
      withIds.push(cid);
    }
  }

  return true;
}

export function assignMultipleControlsToCustomGroup(
  payload: AssignMultipleControlsToCustomGroupPayload
): DocumentAction<AssignMultipleControlsToCustomGroupPayload> {
  return createAction(
    'profile',
    'ASSIGN_MULTIPLE_CONTROLS_TO_CUSTOM_GROUP',
    `Assign ${payload.controlIds.length} controls to custom group ${payload.targetGroupId}`,
    (draft: any) => { applyAssignMultipleControlsToCustomGroup(draft, payload); },
    payload
  );
}

export function applyRemoveControlFromCustomGroup(
  draft: any,
  payload: RemoveControlFromCustomGroupPayload
): boolean {
  const profile = getProfileFromDraft(draft);
  if (!profile?.merge?.custom) return false;

  const custom = profile.merge.custom as { groups?: CustomGroup[]; 'insert-controls'?: InsertControls[] };
  const { controlId, sourceGroupId } = payload;
  if (!controlId) return false;

  const cidLower = controlId.toLowerCase();

  if (sourceGroupId) {
    const group = findCustomGroupById(custom, sourceGroupId);
    if (!group || !group['insert-controls']) return false;

    for (const ic of group['insert-controls']) {
      if (ic['include-controls']) {
        for (const inc of ic['include-controls']) {
          if (inc['with-ids']) {
            inc['with-ids'] = inc['with-ids'].filter(id => id.toLowerCase() !== cidLower);
          }
        }
      }
    }
  } else {
    removeControlFromAllCustomGroups(custom, controlId);
  }

  return true;
}

export function removeControlFromCustomGroup(
  payload: RemoveControlFromCustomGroupPayload
): DocumentAction<RemoveControlFromCustomGroupPayload> {
  return createAction(
    'profile',
    'REMOVE_CONTROL_FROM_CUSTOM_GROUP',
    `Remove control ${payload.controlId} from ${payload.sourceGroupId ? `custom group ${payload.sourceGroupId}` : 'all custom groups'}`,
    (draft: any) => { applyRemoveControlFromCustomGroup(draft, payload); },
    payload
  );
}

export function applyRemoveMultipleControlsFromCustomGroup(
  draft: any,
  payload: RemoveMultipleControlsFromCustomGroupPayload
): boolean {
  const profile = getProfileFromDraft(draft);
  if (!profile?.merge?.custom) return false;

  const custom = profile.merge.custom as { groups?: CustomGroup[]; 'insert-controls'?: InsertControls[] };
  const { controlIds, sourceGroupId } = payload;
  if (!controlIds || controlIds.length === 0) return false;

  const idsSet = new Set(controlIds.map(id => id.toLowerCase()));

  if (sourceGroupId) {
    const group = findCustomGroupById(custom, sourceGroupId);
    if (!group || !group['insert-controls']) return false;

    for (const ic of group['insert-controls']) {
      if (ic['include-controls']) {
        for (const inc of ic['include-controls']) {
          if (inc['with-ids']) {
            inc['with-ids'] = inc['with-ids'].filter(id => !idsSet.has(id.toLowerCase()));
          }
        }
      }
    }
  } else {
    for (const cid of controlIds) {
      removeControlFromAllCustomGroups(custom, cid);
    }
  }

  return true;
}

export function removeMultipleControlsFromCustomGroup(
  payload: RemoveMultipleControlsFromCustomGroupPayload
): DocumentAction<RemoveMultipleControlsFromCustomGroupPayload> {
  return createAction(
    'profile',
    'REMOVE_MULTIPLE_CONTROLS_FROM_CUSTOM_GROUP',
    `Remove ${payload.controlIds.length} controls from custom groups`,
    (draft: any) => { applyRemoveMultipleControlsFromCustomGroup(draft, payload); },
    payload
  );
}

export function applyReorderControlsInCustomGroup(
  draft: any,
  payload: ReorderControlsInCustomGroupPayload
): boolean {
  const profile = getProfileFromDraft(draft);
  if (!profile?.merge?.custom) return false;

  const custom = profile.merge.custom as { groups?: CustomGroup[] };
  const { groupId, controlIds, order } = payload;
  const group = findCustomGroupById(custom, groupId);
  if (!group) return false;

  const ic = ensureInsertControls(group);
  if (order) {
    ic.order = order;
  }

  const inc = ic['include-controls']![0];

  if (controlIds && Array.isArray(controlIds)) {
    inc['with-ids'] = [...controlIds];
  }

  if (order === 'ascending' && inc['with-ids']) {
    inc['with-ids'].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } else if (order === 'descending' && inc['with-ids']) {
    inc['with-ids'].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  }

  return true;
}

export function reorderControlsInCustomGroup(
  payload: ReorderControlsInCustomGroupPayload
): DocumentAction<ReorderControlsInCustomGroupPayload> {
  return createAction(
    'profile',
    'REORDER_CONTROLS_IN_CUSTOM_GROUP',
    `Reorder controls in custom group ${payload.groupId}`,
    (draft: any) => { applyReorderControlsInCustomGroup(draft, payload); },
    payload
  );
}

/**
 * Switch merge structuring mode (as-is, flat, custom)
 */
export function setMergeMode(mode: 'as-is' | 'flat' | 'custom'): DocumentAction<SetMergeModePayload> {
  return createAction(
    'profile',
    'SET_MERGE_MODE',
    `Set profile merge mode to ${mode}`,
    (draft: any) => {
      const profile = getProfileFromDraft(draft);
      if (!profile) return;
      if (!profile.merge) profile.merge = { combine: { method: 'use-first' } };

      if (mode === 'as-is') {
        delete (profile.merge as any).custom;
        delete (profile.merge as any).flat;
        (profile.merge as any)['as-is'] = true;
      } else if (mode === 'flat') {
        delete (profile.merge as any).custom;
        delete (profile.merge as any)['as-is'];
        (profile.merge as any).flat = {};
      } else if (mode === 'custom') {
        delete (profile.merge as any)['as-is'];
        delete (profile.merge as any).flat;
        if (!(profile.merge as any).custom) {
          (profile.merge as any).custom = { groups: [] };
        }
      }
    },
    { mode }
  );
}

/**
 * Set combine strategy (use-first, merge, keep)
 */
export function setCombineMethod(method: 'use-first' | 'merge' | 'keep'): DocumentAction<SetCombineMethodPayload> {
  return createAction(
    'profile',
    'SET_COMBINE_METHOD',
    `Set profile combine method to ${method}`,
    (draft: any) => {
      const profile = getProfileFromDraft(draft);
      if (!profile) return;
      if (!profile.merge) profile.merge = {};
      if (!profile.merge.combine) profile.merge.combine = {};
      (profile.merge.combine as any).method = method;
    },
    { method }
  );
}

/**
 * Include control in baseline imports
 */
export function includeControlInBaseline(importIndex: number, controlId: string): DocumentAction<{ importIndex: number; controlId: string }> {
  return createAction(
    'profile',
    'INCLUDE_CONTROL',
    `Include control ${controlId} in import baseline`,
    (draft: any) => {
      const profile = getProfileFromDraft(draft);
      if (!profile?.imports?.[importIndex]) return;
      const imp = profile.imports[importIndex] as any;

      if (imp['exclude-controls']) {
        for (const exc of imp['exclude-controls']) {
          if (exc['with-ids']) {
            exc['with-ids'] = exc['with-ids'].filter((id: string) => id.toLowerCase() !== controlId.toLowerCase());
          }
        }
      }

      if (!imp['include-all']) {
        if (!imp['include-controls']) imp['include-controls'] = [{ 'with-ids': [] }];
        const inc = imp['include-controls'][0];
        if (!inc['with-ids']) inc['with-ids'] = [];
        if (!inc['with-ids'].some((id: string) => id.toLowerCase() === controlId.toLowerCase())) {
          inc['with-ids'].push(controlId);
        }
      }
    },
    { importIndex, controlId }
  );
}

/**
 * Exclude control from baseline imports
 */
export function excludeControlFromBaseline(importIndex: number, controlId: string): DocumentAction<{ importIndex: number; controlId: string }> {
  return createAction(
    'profile',
    'EXCLUDE_CONTROL',
    `Exclude control ${controlId} from import baseline`,
    (draft: any) => {
      const profile = getProfileFromDraft(draft);
      if (!profile?.imports?.[importIndex]) return;
      const imp = profile.imports[importIndex] as any;

      if (imp['include-controls']) {
        for (const inc of imp['include-controls']) {
          if (inc['with-ids']) {
            inc['with-ids'] = inc['with-ids'].filter((id: string) => id.toLowerCase() !== controlId.toLowerCase());
          }
        }
      }

      if (!imp['exclude-controls']) imp['exclude-controls'] = [{ 'with-ids': [] }];
      const exc = imp['exclude-controls'][0];
      if (!exc['with-ids']) exc['with-ids'] = [];
      if (!exc['with-ids'].some((id: string) => id.toLowerCase() === controlId.toLowerCase())) {
        exc['with-ids'].push(controlId);
      }
    },
    { importIndex, controlId }
  );
}

export function applyImportCustomGroupBranch(
  draft: any,
  payload: ImportCustomGroupBranchPayload
): CustomGroup | null {
  const profile = getProfileFromDraft(draft);
  if (!profile) return null;

  ensureCustomMergeStructure(profile);
  const custom = profile.merge!.custom as { groups: CustomGroup[]; 'insert-controls'?: InsertControls[] };

  const sourceGroup = payload.group;
  if (!sourceGroup) return null;

  const existingGroupIds = new Set<string>();
  const collectExisting = (gList?: CustomGroup[]) => {
    if (!gList) return;
    for (const g of gList) {
      if (g.id) existingGroupIds.add(g.id.toLowerCase());
      if (g.groups) collectExisting(g.groups);
    }
  };
  collectExisting(custom.groups);

  const mapGroupBranch = (g: any): CustomGroup => {
    let rawId = g.id || `custom_${Math.random().toString(36).slice(2, 6)}`;
    let finalId = rawId;
    let counter = 1;
    while (existingGroupIds.has(finalId.toLowerCase())) {
      finalId = `${rawId}_${counter++}`;
    }
    existingGroupIds.add(finalId.toLowerCase());

    const directControlIds: string[] = (g.controls || [])
      .map((ctrl: any) => ctrl?.id)
      .filter(Boolean);

    // Recursively unassign any previously assigned instances of these controls or subcontrols
    const unassignAllDeep = (ctrl: any) => {
      if (ctrl?.id) {
        removeControlFromAllCustomGroups(custom, ctrl.id);
      }
      if (ctrl?.controls) {
        ctrl.controls.forEach(unassignAllDeep);
      }
    };
    (g.controls || []).forEach(unassignAllDeep);

    const nestedGroups = (g.groups || []).map(mapGroupBranch);

    const newCustomG: CustomGroup = {
      id: finalId,
      title: g.title || finalId,
      class: g.class || 'family',
      props: g.props ? JSON.parse(JSON.stringify(g.props)) : [],
      groups: nestedGroups,
      'insert-controls': directControlIds.length > 0 ? [
        {
          order: 'keep',
          'include-controls': [
            {
              'with-ids': directControlIds
            }
          ]
        }
      ] : []
    };

    return newCustomG;
  };

  const createdGroup = mapGroupBranch(sourceGroup);

  if (!payload.targetParentId || payload.targetParentId === '__unassigned__') {
    if (payload.targetIndex !== undefined && payload.targetIndex >= 0 && payload.targetIndex <= custom.groups.length) {
      custom.groups.splice(payload.targetIndex, 0, createdGroup);
    } else {
      custom.groups.push(createdGroup);
    }
  } else {
    const parent = findCustomGroupById(custom, payload.targetParentId);
    if (parent) {
      if (!parent.groups) parent.groups = [];
      if (payload.targetIndex !== undefined && payload.targetIndex >= 0 && payload.targetIndex <= parent.groups.length) {
        parent.groups.splice(payload.targetIndex, 0, createdGroup);
      } else {
        parent.groups.push(createdGroup);
      }
    } else {
      custom.groups.push(createdGroup);
    }
  }

  return createdGroup;
}

export function importCustomGroupBranch(
  payload: ImportCustomGroupBranchPayload
): DocumentAction<ImportCustomGroupBranchPayload> {
  return createAction(
    'profile',
    'IMPORT_CUSTOM_GROUP_BRANCH',
    `Import catalog group "${payload.group?.title || payload.group?.id || 'Group'}" into custom groups${payload.targetParentId ? ` under ${payload.targetParentId}` : ' at root'}`,
    (draft: any) => { applyImportCustomGroupBranch(draft, payload); },
    payload
  );
}

export function toggleControlInBaseline(controlId: string, isChecked: boolean) {
  return createAction('profile', 'TOGGLE_CONTROL_BASELINE', `${isChecked ? 'Include' : 'Exclude'} control ${controlId} in baseline`,
    (draft: any) => {
      const profile = getProfileFromDraft(draft);
      if (!profile || !controlId) return;
      const imports = profile.imports || [];
      if (imports.length === 0) return;

      const findImportIndex = (): number => {
        const cid = controlId.toLowerCase();
        for (let i = 0; i < imports.length; i++) {
          const imp = imports[i];
          const incList = (imp['include-controls'] || []).flatMap((ic: any) => ic['with-ids'] || []);
          const excList = (imp['exclude-controls'] || []).flatMap((ec: any) => typeof ec === 'string' ? [ec] : (ec?.['with-ids'] || []));
          if (incList.some((id: string) => id.toLowerCase() === cid) || excList.some((id: string) => id.toLowerCase() === cid)) {
            return i;
          }
        }
        const prefix = cid.split(/[-_.]/)[0];
        if (prefix) {
          for (let i = 0; i < imports.length; i++) {
            const imp = imports[i];
            const incList = (imp['include-controls'] || []).flatMap((ic: any) => ic['with-ids'] || []);
            const excList = (imp['exclude-controls'] || []).flatMap((ec: any) => typeof ec === 'string' ? [ec] : (ec?.['with-ids'] || []));
            if (incList.some((id: string) => id.toLowerCase().startsWith(prefix)) ||
                excList.some((id: string) => id.toLowerCase().startsWith(prefix))) {
              return i;
            }
          }
        }
        if (isChecked) {
          for (let i = 0; i < imports.length; i++) {
            if (Array.isArray(imports[i]['include-controls'])) {
              return i;
            }
          }
        }
        return 0;
      };

      const idx = findImportIndex();
      const item = imports[idx];
      const isIncludeAll = item['include-all'] !== undefined;

      if (isIncludeAll) {
        let existingExcludes: string[] = [];
        if (Array.isArray(item['exclude-controls'])) {
          for (const exc of item['exclude-controls']) {
            if (typeof exc === 'string') {
              existingExcludes.push(exc);
            } else if (exc && Array.isArray(exc['with-ids'])) {
              existingExcludes.push(...exc['with-ids']);
            }
          }
        }

        if (isChecked) {
          existingExcludes = existingExcludes.filter(
            id => id.toLowerCase() !== controlId.toLowerCase()
          );
        } else {
          const alreadyExcluded = existingExcludes.some(
            id => id.toLowerCase() === controlId.toLowerCase()
          );
          if (!alreadyExcluded) {
            existingExcludes.push(controlId);
          }
        }

        if (existingExcludes.length > 0) {
          item['exclude-controls'] = [{ 'with-ids': existingExcludes }];
        } else {
          delete item['exclude-controls'];
        }
      } else {
        let existingIncludes: string[] = [];
        if (Array.isArray(item['include-controls'])) {
          for (const inc of item['include-controls']) {
            if (inc && Array.isArray(inc['with-ids'])) {
              existingIncludes.push(...inc['with-ids']);
            }
          }
        }

        if (isChecked) {
          const alreadyIncluded = existingIncludes.some(
            id => id.toLowerCase() === controlId.toLowerCase()
          );
          if (!alreadyIncluded) {
            existingIncludes.push(controlId);
          }
        } else {
          existingIncludes = existingIncludes.filter(
            id => id.toLowerCase() !== controlId.toLowerCase()
          );
        }

        item['include-controls'] = [{ 'with-ids': existingIncludes }];
      }
    });
}

export function updateCustomGroup(targetGroupId: string, updatedGroup: any) {
  return createAction('profile', 'UPDATE_CUSTOM_GROUP', `Update custom group ${targetGroupId}`,
    (draft: any) => {
      const profile = getProfileFromDraft(draft);
      if (!profile?.merge?.custom?.groups) return;
      const updateGroupRecursive = (list: any[]) => {
        for (let i = 0; i < list.length; i++) {
          if (list[i].id === targetGroupId || list[i].id === updatedGroup.id) {
            list[i] = {
              ...list[i],
              id: updatedGroup.id,
              title: updatedGroup.title,
              props: updatedGroup.props,
              parts: updatedGroup.parts,
              links: updatedGroup.links
            };
            return;
          }
          if (list[i].groups) {
            updateGroupRecursive(list[i].groups);
          }
        }
      };
      updateGroupRecursive(profile.merge.custom.groups as any[]);
    });
}

export function renameProfileGlobalProperty(oldName: string, newName: string) {
  return createAction('profile', 'RENAME_GLOBAL_PROPERTY', `Rename profile property ${oldName} to ${newName}`,
    (draft: any) => {
      if (!oldName || !newName || oldName === newName) return;
      const profile = getProfileFromDraft(draft);
      if (!profile?.metadata?.props) return;
      profile.metadata.props = profile.metadata.props.map((p: any) =>
        p.name === oldName ? { ...p, name: newName } : p
      );
    });
}

export function deleteProfileGlobalProperty(propName: string) {
  return createAction('profile', 'DELETE_GLOBAL_PROPERTY', `Delete profile property ${propName}`,
    (draft: any) => {
      if (!propName) return;
      const profile = getProfileFromDraft(draft);
      if (!profile?.metadata?.props) return;
      const filtered = profile.metadata.props.filter((p: any) => p.name !== propName);
      if (filtered.length > 0) {
        profile.metadata.props = filtered;
      } else {
        delete profile.metadata.props;
      }
    });
}

export function removeProfileOrphans(conflicts: {
  orphaned_alters?: any[];
  orphaned_params?: any[];
  orphaned_custom_refs?: any[];
}) {
  return createAction('profile', 'REMOVE_ORPHANS', 'Remove orphaned alters, params, and custom group refs',
    (draft: any) => {
      const profile = getProfileFromDraft(draft);
      if (!profile) return;
      const orphanedControlIds = new Set(
        (conflicts.orphaned_alters || []).map((a: any) => (a['control-id'] || '').toLowerCase())
      );
      const orphanedParamIds = new Set(
        (conflicts.orphaned_params || []).map((p: any) => (p['param-id'] || '').toLowerCase())
      );
      const orphanedCustomControlIds = new Set(
        (conflicts.orphaned_custom_refs || []).map((c: any) => (c['control-id'] || '').toLowerCase())
      );

      // Clean modify
      if (profile.modify) {
        if (Array.isArray(profile.modify.alters) && orphanedControlIds.size > 0) {
          profile.modify.alters = profile.modify.alters.filter(
            (a: any) => !orphanedControlIds.has((a['control-id'] || '').toLowerCase())
          );
          if (profile.modify.alters.length === 0) delete profile.modify.alters;
        }
        if (Array.isArray(profile.modify['set-parameters']) && orphanedParamIds.size > 0) {
          profile.modify['set-parameters'] = profile.modify['set-parameters'].filter(
            (p: any) => !orphanedParamIds.has((p['param-id'] || '').toLowerCase())
          );
          if (profile.modify['set-parameters'].length === 0) delete profile.modify['set-parameters'];
        }
        if (Object.keys(profile.modify).length === 0) {
          delete profile.modify;
        }
      }

      // Clean custom group references
      if (profile.merge?.custom && orphanedCustomControlIds.size > 0) {
        const cleanInsertControls = (insertControlsList: any[]) => {
          if (!Array.isArray(insertControlsList)) return;
          for (const ic of insertControlsList) {
            if (Array.isArray(ic['include-controls'])) {
              for (const inc of ic['include-controls']) {
                if (Array.isArray(inc['with-ids'])) {
                  inc['with-ids'] = inc['with-ids'].filter(
                    (id: string) => !orphanedCustomControlIds.has((id || '').toLowerCase())
                  );
                }
              }
            }
          }
        };

        const cleanGroup = (group: any) => {
          if (!group) return;
          if (Array.isArray(group['insert-controls'])) {
            cleanInsertControls(group['insert-controls']);
          }
          if (Array.isArray(group.groups)) {
            for (const subG of group.groups) {
              cleanGroup(subG);
            }
          }
        };

        if (Array.isArray(profile.merge.custom.groups)) {
          for (const g of profile.merge.custom.groups) {
            cleanGroup(g);
          }
        }
        if (Array.isArray(profile.merge.custom['insert-controls'])) {
          cleanInsertControls(profile.merge.custom['insert-controls']);
        }
      }
    });
}

export function updateProfileDocument(updatedProfile: any) {
  return createAction('profile', 'UPDATE_PROFILE_DOCUMENT', 'Update profile document',
    (draft: any) => {
      if (draft.profile) {
        draft.profile = { ...draft.profile, ...updatedProfile };
      } else {
        Object.assign(draft, updatedProfile);
      }
    });
}


