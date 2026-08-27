import { createAction } from './types';
import { Group, Control, Property } from '../types/oscal';

function findGroupById(container: { groups?: Group[] }, id: string): Group | null {
  if (!container.groups) return null;
  for (const g of container.groups) {
    if (g.id === id) return g;
    const found = findGroupById(g, id);
    if (found) return found;
  }
  return null;
}

function findAndRemoveGroup(container: { groups?: Group[] }, id: string): Group | null {
  if (!container.groups) return null;
  const idx = container.groups.findIndex(g => g.id === id);
  if (idx !== -1) {
    const [removed] = container.groups.splice(idx, 1);
    return removed;
  }
  for (const g of container.groups) {
    const found = findAndRemoveGroup(g, id);
    if (found) return found;
  }
  return null;
}

function findControlById(container: { groups?: Group[]; controls?: Control[] }, id: string): Control | null {
  const searchControls = (controls: Control[] = []): Control | null => {
    for (const c of controls) {
      if (c.id === id) return c;
      if (c.controls) {
        const found = searchControls(c.controls);
        if (found) return found;
      }
    }
    return null;
  };
  const searchGroups = (groups: Group[] = []): Control | null => {
    for (const g of groups) {
      const foundInCtrl = searchControls(g.controls);
      if (foundInCtrl) return foundInCtrl;
      if (g.groups) {
        const foundInGrp = searchGroups(g.groups);
        if (foundInGrp) return foundInGrp;
      }
    }
    return null;
  };
  return searchControls(container.controls) || searchGroups(container.groups);
}

function findAndRemoveControl(container: { groups?: Group[]; controls?: Control[] }, id: string): Control | null {
  const searchAndRemove = (controls: Control[] = []): Control | null => {
    const idx = controls.findIndex(c => c.id === id);
    if (idx !== -1) {
      const [removed] = controls.splice(idx, 1);
      return removed;
    }
    for (const c of controls) {
      if (c.controls) {
        const found = searchAndRemove(c.controls);
        if (found) return found;
      }
    }
    return null;
  };
  if (container.controls) {
    const found = searchAndRemove(container.controls);
    if (found) return found;
  }
  if (container.groups) {
    for (const g of container.groups) {
      const found = findAndRemoveControl(g, id);
      if (found) return found;
    }
  }
  return null;
}

export function updateCatalogRoot(field: string, value: any) {
  return createAction('catalog', 'UPDATE_ROOT', `Update catalog root field ${field}`,
    (draft: any) => {
      if (draft.catalog) draft.catalog[field] = value;
    });
}

export function addGroup(parentGroupId: string | null, groupData?: Partial<Group>) {
  const newId = groupData?.id || `group-${Date.now().toString(36)}`;
  const newTitle = groupData?.title || 'New Group';
  
  return createAction('catalog', 'ADD_GROUP', `Add group ${newId} ${parentGroupId ? `to group ${parentGroupId}` : 'to root'}`,
    (draft: any) => {
      if (!draft.catalog) return;
      const group: Group = {
        id: newId,
        title: newTitle,
        class: groupData?.class || 'family',
        groups: groupData?.groups || [],
        controls: groupData?.controls || [],
        props: groupData?.props || [],
        parts: groupData?.parts || [],
        params: groupData?.params || [],
        ...groupData
      };

      if (!parentGroupId) {
        if (!draft.catalog.groups) draft.catalog.groups = [];
        draft.catalog.groups.push(group);
      } else {
        const parent = findGroupById(draft.catalog, parentGroupId);
        if (parent) {
          if (!parent.groups) parent.groups = [];
          parent.groups.push(group);
        }
      }
    });
}

export function addControl(parentId: string | null, controlData?: Partial<Control>) {
  const newId = controlData?.id || `ctrl-${Date.now().toString(36)}`;
  const newTitle = controlData?.title || 'New Control';
  
  return createAction('catalog', 'ADD_CONTROL', `Add control ${newId} ${parentId ? `to ${parentId}` : 'to root'}`,
    (draft: any) => {
      if (!draft.catalog) return;
      const control: Control = {
        id: newId,
        title: newTitle,
        class: controlData?.class || 'control',
        props: controlData?.props || [],
        parts: controlData?.parts || [
          {
            id: `${newId}_smt`,
            name: 'statement',
            prose: 'Requirement description...'
          }
        ],
        params: controlData?.params || [],
        controls: controlData?.controls || [],
        links: controlData?.links || [],
        ...controlData
      };

      if (!parentId) {
        if (!draft.catalog.controls) draft.catalog.controls = [];
        draft.catalog.controls.push(control);
      } else {
        const parentGrp = findGroupById(draft.catalog, parentId);
        if (parentGrp) {
          if (!parentGrp.controls) parentGrp.controls = [];
          parentGrp.controls.push(control);
          return;
        }
        const parentCtrl = findControlById(draft.catalog, parentId);
        if (parentCtrl) {
          if (!parentCtrl.controls) parentCtrl.controls = [];
          parentCtrl.controls.push(control);
          return;
        }
        if (!draft.catalog.controls) draft.catalog.controls = [];
        draft.catalog.controls.push(control);
      }
    });
}

export function removeControl(controlId: string) {
  return createAction('catalog', 'REMOVE_CONTROL', `Remove control ${controlId}`,
    (draft: any) => {
      if (!draft.catalog) return;
      findAndRemoveControl(draft.catalog, controlId);
    });
}

export function removeGroup(groupId: string) {
  return createAction('catalog', 'REMOVE_GROUP', `Remove group ${groupId}`,
    (draft: any) => {
      if (!draft.catalog) return;
      findAndRemoveGroup(draft.catalog, groupId);
    });
}

export function moveNode(nodeId: string, targetParentId: string | null, targetIndex?: number) {
  return createAction('catalog', 'MOVE_NODE', `Move node ${nodeId} to ${targetParentId || 'root'}${targetIndex !== undefined ? ` at index ${targetIndex}` : ''}`,
    (draft: any) => {
      if (!draft.catalog) return;
      
      // Try to find and remove as Group first
      let removedGroup = findAndRemoveGroup(draft.catalog, nodeId);
      if (removedGroup) {
        if (!targetParentId) {
          if (!draft.catalog.groups) draft.catalog.groups = [];
          if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= draft.catalog.groups.length) {
            draft.catalog.groups.splice(targetIndex, 0, removedGroup);
          } else {
            draft.catalog.groups.push(removedGroup);
          }
        } else {
          const parent = findGroupById(draft.catalog, targetParentId);
          if (parent) {
            if (!parent.groups) parent.groups = [];
            if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= parent.groups.length) {
              parent.groups.splice(targetIndex, 0, removedGroup);
            } else {
              parent.groups.push(removedGroup);
            }
          } else {
            // Fallback: restore back to root if parent not found
            if (!draft.catalog.groups) draft.catalog.groups = [];
            draft.catalog.groups.push(removedGroup);
          }
        }
        return;
      }

      // If not group, try to find and remove as Control
      let removedControl = findAndRemoveControl(draft.catalog, nodeId);
      if (removedControl) {
        if (!targetParentId) {
          if (!draft.catalog.controls) draft.catalog.controls = [];
          if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= draft.catalog.controls.length) {
            draft.catalog.controls.splice(targetIndex, 0, removedControl);
          } else {
            draft.catalog.controls.push(removedControl);
          }
        } else {
          const parent = findGroupById(draft.catalog, targetParentId);
          if (parent) {
            if (!parent.controls) parent.controls = [];
            if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= parent.controls.length) {
              parent.controls.splice(targetIndex, 0, removedControl);
            } else {
              parent.controls.push(removedControl);
            }
          } else {
            // Fallback: restore back to root
            if (!draft.catalog.controls) draft.catalog.controls = [];
            draft.catalog.controls.push(removedControl);
          }
        }
      }
    });
}

export function withdrawControl(controlId: string, replacementId?: string) {
  return createAction('catalog', 'WITHDRAW_CONTROL', `Withdraw control ${controlId}${replacementId ? ` (replaced by ${replacementId})` : ''}`,
    (draft: any) => {
      if (!draft.catalog) return;
      const control = findControlById(draft.catalog, controlId);
      if (!control) return;

      if (!control.props) control.props = [];
      const statusProp = control.props.find(p => p.name?.toLowerCase() === 'status');
      if (statusProp) {
        statusProp.value = 'withdrawn';
      } else {
        control.props.push({ name: 'status', value: 'withdrawn' });
      }

      if (replacementId) {
        if (!control.links) control.links = [];
        const existingLink = control.links.find(l => l.rel === 'incorporated-into');
        if (existingLink) {
          existingLink.href = `#${replacementId}`;
        } else {
          control.links.push({ rel: 'incorporated-into', href: `#${replacementId}` });
        }
      }
    });
}

export function restoreControl(controlId: string) {
  return createAction('catalog', 'RESTORE_CONTROL', `Restore withdrawn control ${controlId}`,
    (draft: any) => {
      if (!draft.catalog) return;
      const control = findControlById(draft.catalog, controlId);
      if (!control) return;

      if (control.props) {
        control.props = control.props.filter(p => !(p.name?.toLowerCase() === 'status' && p.value?.toLowerCase() === 'withdrawn'));
      }
      if (control.links) {
        control.links = control.links.filter(l => l.rel !== 'incorporated-into');
      }
    });
}

function applyToAllControlsInGroup(group: Group, fn: (control: Control) => void) {
  if (group.controls) {
    for (const c of group.controls) {
      fn(c);
      if (c.controls) {
        applyToAllSubControls(c, fn);
      }
    }
  }
  if (group.groups) {
    for (const subg of group.groups) {
      applyToAllControlsInGroup(subg, fn);
    }
  }
}

function applyToAllSubControls(control: Control, fn: (control: Control) => void) {
  if (control.controls) {
    for (const subc of control.controls) {
      fn(subc);
      applyToAllSubControls(subc, fn);
    }
  }
}

export function withdrawAllControlsInGroup(groupId: string) {
  return createAction('catalog', 'WITHDRAW_ALL_CONTROLS_IN_GROUP', `Withdraw all controls in group ${groupId}`,
    (draft: any) => {
      if (!draft.catalog) return;
      const group = findGroupById(draft.catalog, groupId);
      if (!group) return;

      applyToAllControlsInGroup(group, (control) => {
        if (!control.props) control.props = [];
        const statusProp = control.props.find(p => p.name?.toLowerCase() === 'status');
        if (statusProp) {
          statusProp.value = 'withdrawn';
        } else {
          control.props.push({ name: 'status', value: 'withdrawn' });
        }
      });
    });
}

export function restoreAllControlsInGroup(groupId: string) {
  return createAction('catalog', 'RESTORE_ALL_CONTROLS_IN_GROUP', `Restore all controls in group ${groupId}`,
    (draft: any) => {
      if (!draft.catalog) return;
      const group = findGroupById(draft.catalog, groupId);
      if (!group) return;

      applyToAllControlsInGroup(group, (control) => {
        if (control.props) {
          control.props = control.props.filter(p => !(p.name?.toLowerCase() === 'status' && p.value?.toLowerCase() === 'withdrawn'));
        }
        if (control.links) {
          control.links = control.links.filter(l => l.rel !== 'incorporated-into');
        }
      });
    });
}

