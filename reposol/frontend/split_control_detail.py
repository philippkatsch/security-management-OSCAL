import os

src_dir = 'c:/Users/phili/Desktop/Projects/Security-Management-OSCAL/reposol/frontend/src/lib'

catalog_utils = """import { Catalog, Group, Control, Parameter } from './types/oscal';

interface Ancestor {
  id: string;
  title: string;
}

export const getAncestorsPath = (targetId: string, catalogData: Catalog | undefined): Ancestor[] => {
  if (!targetId || !catalogData) return [];
  const traverse = (node: Group | Control, path: Ancestor[]): Ancestor[] | null => {
    if (node.id === targetId) return path;
    if ('groups' in node && node.groups) {
      for (const g of node.groups) {
        if (g.id) {
          const found = traverse(g, [...path, { id: g.id, title: g.title }]);
          if (found) return found;
        }
      }
    }
    if (node.controls) {
      for (const c of node.controls) {
        const found = traverse(c, path);
        if (found) return found;
      }
    }
    return null;
  };
  return traverse({ groups: catalogData.groups || [], controls: catalogData.controls || [], title: '' }, []) || [];
};

export const getGroupParamsForControl = (controlId: string, catalogData: Catalog | undefined): Parameter[] => {
  const ancestors = getAncestorsPath(controlId, catalogData);
  if (!ancestors || ancestors.length === 0) return [];
  
  const groupParams: Parameter[] = [];
  
  const findGroup = (groups: Group[], id: string): Group | null => {
    for (const g of groups) {
      if (g.id === id) return g;
      if (g.groups) {
        const found = findGroup(g.groups, id);
        if (found) return found;
      }
    }
    return null;
  };
  
  ancestors.forEach((anc: Ancestor) => {
    const groupObj = findGroup(catalogData?.groups || [], anc.id);
    if (groupObj && groupObj.params) {
      groupParams.push(...groupObj.params);
    }
  });
  
  return groupParams;
};

export const getAllVisibleParamsMap = (controlId: string, controlParams: Parameter[], catalogData: Catalog | undefined): Record<string, Parameter> => {
  const resolved: Record<string, Parameter> = {};

  if (catalogData && catalogData.params) {
    catalogData.params.forEach((p: Parameter) => {
      resolved[p.id] = p;
    });
  }

  const groupParams = getGroupParamsForControl(controlId, catalogData);
  groupParams.forEach(p => {
    resolved[p.id] = p;
  });

  controlParams.forEach(p => {
    resolved[p.id] = p;
  });

  return resolved;
};
"""

assessment_utils = """import { Control, Part } from './types/oscal';

export const extractAssessmentMethods = (controlObject: Control) => {
  const methods: { id: string; method: string; prose?: string }[] = [];
  const traverse = (part: Part) => {
    const partName = part.name?.toLowerCase();
    if (partName === 'objective') {
      if (part.parts) {
        part.parts.forEach((sub: Part) => {
          const subName = sub.name?.toLowerCase();
          if (subName === 'method' || ['examine', 'interview', 'test'].includes(subName || '')) {
            const methodVal = sub.props?.find((p: Record<string, unknown>) => typeof p.name === 'string' && p.name.toLowerCase() === 'method')?.value || sub.name;
            methods.push({
              id: sub.id || `${controlObject.id}_obj.${methodVal.toLowerCase()}`,
              method: methodVal,
              prose: sub.prose
            });
          }
        });
      }
    }
    if (partName === 'assessment-method' || ['examine', 'interview', 'test'].includes(partName || '')) {
      const methodVal = part.props?.find((p: Record<string, unknown>) => typeof p.name === 'string' && p.name.toLowerCase() === 'method')?.value || part.name;
      methods.push({
        id: part.id || `${controlObject.id}_obj.${methodVal.toLowerCase()}`,
        method: methodVal,
        prose: part.prose
      });
    }
    if (part.parts) {
      part.parts.forEach(traverse);
    }
  };
  if (controlObject.parts) {
    controlObject.parts.forEach(traverse);
  }
  return methods;
};

export const formatMethodId = (ctrlId: string, methodName: string): string => {
  let paddedId = ctrlId.toUpperCase();
  const match = ctrlId.match(/^([a-zA-Z]+)-([0-9]+)$/);
  if (match) {
    const num = parseInt(match[2], 10);
    if (num < 10) {
      paddedId = `${match[1].toUpperCase()}-0${num}`;
    }
  }
  const capMethod = methodName.charAt(0).toUpperCase() + methodName.slice(1).toLowerCase();
  return `${paddedId}-${capMethod}`;
};
"""

profile_alter_utils = """import { Profile, Part, ProfileAlter, Addition, Removal } from './types/oscal';

export const resolveProfilePartsForRendering = (origParts: Part[] | undefined, alter: ProfileAlter | undefined, level = 0): (Part & { isRemoved?: boolean, isModified?: boolean, isAdded?: boolean, originalId?: string, originalName?: string, originalProse?: string })[] => {
  if (!origParts) origParts = [];
  const removes = alter?.removes || [];
  const adds = alter?.adds || [];
  
  let result = origParts.map(p => {
    const isReplacementRemoves = removes.some((r: Removal) => r['by-id'] === p.id);
    const replacementAdd = isReplacementRemoves
      ? adds.find((a: Addition) => a['by-id'] === p.id && a.position === 'after' && a.parts?.some((pt: Part) => pt.id === p.id))
      : null;
    
    const isReplaced = !!replacementAdd;
    const isRemoved = isReplacementRemoves && !isReplaced;
    const subparts = resolveProfilePartsForRendering(p.parts || [], alter, level + 1);
    
    return {
      ...p,
      id: replacementAdd?.parts?.[0]?.id || p.id,
      name: replacementAdd?.parts?.[0]?.name || p.name,
      prose: replacementAdd?.parts?.[0]?.prose !== undefined ? replacementAdd.parts[0].prose : p.prose,
      isRemoved,
      isModified: isReplaced,
      originalId: p.id,
      originalName: p.name,
      originalProse: p.prose,
      parts: subparts
    };
  });

  adds.forEach((add: Addition) => {
    if (!add.parts) return;
    
    add.parts.forEach((newPart: Part) => {
      const isReplacement = origParts!.some((op: Part) => op.id === add['by-id'] && removes.some((r: Removal) => r['by-id'] === op.id) && add.position === 'after' && newPart.id === op.id);
      if (isReplacement) return;

      if (add['by-id']) {
        if (add.position === 'before') {
          const targetIdx = result.findIndex(p => p.id === add['by-id'] || p.originalId === add['by-id']);
          if (targetIdx >= 0 && !result.some(p => p.id === newPart.id)) {
            result.splice(targetIdx, 0, { ...newPart, isAdded: true });
          }
        } else if (add.position === 'after') {
          const targetIdx = result.findIndex(p => p.id === add['by-id'] || p.originalId === add['by-id']);
          if (targetIdx >= 0 && !result.some(p => p.id === newPart.id)) {
            result.splice(targetIdx + 1, 0, { ...newPart, isAdded: true });
          }
        } else if (add.position === 'starting') {
          const parent = result.find(p => p.id === add['by-id'] || p.originalId === add['by-id']);
          if (parent) {
            if (!parent.parts) parent.parts = [];
            if (!parent.parts.some((sp: Part) => sp.id === newPart.id)) {
              parent.parts.unshift({ ...newPart, isAdded: true });
            }
          }
        } else if (add.position === 'ending') {
          const parent = result.find(p => p.id === add['by-id'] || p.originalId === add['by-id']);
          if (parent) {
            if (!parent.parts) parent.parts = [];
            if (!parent.parts.some((sp: Part) => sp.id === newPart.id)) {
              parent.parts.push({ ...newPart, isAdded: true });
            }
          }
        }
      } else {
        if (level === 0) {
          if (add.position === 'starting') {
            if (!result.some(p => p.id === newPart.id)) {
              result.unshift({ ...newPart, isAdded: true });
            }
          } else if (add.position === 'ending') {
            if (!result.some(p => p.id === newPart.id)) {
              result.push({ ...newPart, isAdded: true });
            }
          }
        }
      }
    });
  });

  return result;
};

export const updateAlter = (
  profile: Profile,
  controlId: string,
  updateFn: (alter: ProfileAlter) => ProfileAlter,
  onProfileChange: (profile: Profile) => void
) => {
  const modify = profile?.modify ? { ...profile.modify } : {};
  const alters = modify.alters ? [...modify.alters] : [];
  const alterIdx = alters.findIndex((a: ProfileAlter) => a['control-id'] === controlId);

  let currentAlter = alterIdx >= 0 ? { ...alters[alterIdx] } : { 'control-id': controlId };
  currentAlter = updateFn(currentAlter);

  const hasAdds = currentAlter.adds && currentAlter.adds.length > 0;
  const hasRemoves = currentAlter.removes && currentAlter.removes.length > 0;

  if (!hasAdds && !hasRemoves) {
    if (alterIdx >= 0) alters.splice(alterIdx, 1);
  } else {
    if (alterIdx >= 0) alters[alterIdx] = currentAlter;
    else alters.push(currentAlter);
  }

  onProfileChange({ ...profile, modify: { ...modify, alters } });
};

export const getAlterForControl = (profile: Profile | undefined, controlId: string): ProfileAlter | undefined => {
  return (profile?.modify?.alters || []).find((a: ProfileAlter) => a['control-id'] === controlId);
};

export const getModifiedPartIds = (profile: Profile | undefined, controlId: string): string[] => {
  const alter = getAlterForControl(profile, controlId);
  if (!alter) return [];
  const ids: string[] = [];
  (alter.removes || []).forEach((r: Removal) => {
    if (r['by-id'] && alter.adds?.some((a: Addition) => a['by-id'] === r['by-id'])) {
      ids.push(r['by-id']);
    }
  });
  return ids;
};

export const handleOriginalPartFieldChange = (
  originalId: string,
  field: string,
  newVal: unknown,
  originalPart: Record<string, unknown>,
  targetControlId: string,
  profile: Profile,
  onProfileChange: (p: Profile) => void
) => {
  updateAlter(profile, targetControlId, (alter) => {
    let removes = alter.removes ? [...alter.removes] : [];
    let adds = alter.adds ? [...alter.adds] : [];

    if (!removes.some((r: Removal) => r['by-id'] === originalId)) {
      removes.push({ 'by-id': originalId });
    }

    const addIdx = adds.findIndex((a: Addition) => a['by-id'] === originalId && a.position === 'after');
    
    let currentPart = {
      id: originalId,
      name: originalPart.originalName || 'statement',
      prose: originalPart.originalProse || ''
    } as Record<string, unknown>;
    
    if (addIdx >= 0 && adds[addIdx].parts?.[0]) {
      currentPart = { ...currentPart, ...adds[addIdx].parts![0] };
    }

    if (newVal === undefined) {
      delete currentPart[field];
    } else {
      currentPart[field] = newVal;
    }

    const isIdentical = currentPart.id === originalId &&
                        currentPart.name === originalPart.originalName &&
                        currentPart.prose === originalPart.originalProse;
    
    if (isIdentical) {
      removes = removes.filter((r: Removal) => r['by-id'] !== originalId);
      adds = adds.filter((a: Addition) => !(a['by-id'] === originalId && a.position === 'after'));
    } else {
      const newAddBlock: Addition = {
        position: 'after',
        'by-id': originalId,
        parts: [currentPart]
      };
      if (addIdx >= 0) {
        adds[addIdx] = newAddBlock;
      } else {
        adds.push(newAddBlock);
      }
    }

    return { ...alter, removes, adds };
  }, onProfileChange);
};
"""

control_detail_utils_barrel = """export * from './catalog-utils';
export * from './assessment-utils';
export * from './profile-alter-utils';
"""

with open(os.path.join(src_dir, 'catalog-utils.ts'), 'w', encoding='utf-8') as f:
    f.write(catalog_utils)
with open(os.path.join(src_dir, 'assessment-utils.ts'), 'w', encoding='utf-8') as f:
    f.write(assessment_utils)
with open(os.path.join(src_dir, 'profile-alter-utils.ts'), 'w', encoding='utf-8') as f:
    f.write(profile_alter_utils)
with open(os.path.join(src_dir, 'control-detail-utils.ts'), 'w', encoding='utf-8') as f:
    f.write(control_detail_utils_barrel)
