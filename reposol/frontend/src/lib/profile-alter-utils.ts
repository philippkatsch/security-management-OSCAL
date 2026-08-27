import { Profile, Part, ProfileAlter, Addition, Removal } from './types/oscal';

export type RenderablePart = Part & {
  isRemoved?: boolean;
  isModified?: boolean;
  isAdded?: boolean;
  originalId?: string;
  originalName?: string;
  originalProse?: string;
  parts?: RenderablePart[];
};

const idMatches = (id1?: string, id2?: string): boolean => {
  if (!id1 || !id2) return false;
  return id1 === id2 || id1.toLowerCase() === id2.toLowerCase();
};

export const resolveProfilePartsForRendering = (origParts: Part[] | undefined, alter: ProfileAlter | undefined, level = 0): RenderablePart[] => {
  if (!origParts) origParts = [];
  const removes = alter?.removes || [];
  const adds = alter?.adds || [];
  
  let result: RenderablePart[] = origParts.map(p => {
    const isReplacementRemoves = removes.some((r: Removal) => idMatches(r['by-id'], p.id));
    const replacementAdd = isReplacementRemoves
      ? adds.find((a: Addition) => idMatches(a['by-id'], p.id) && a.position === 'after' && a.parts && a.parts.length > 0)
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
      const isReplacement = Boolean(
        add['by-id'] && 
        add.position === 'after' && 
        removes.some((r: Removal) => idMatches(r['by-id'], add['by-id']))
      );
      if (isReplacement) return;

      if (add['by-id']) {
        if (add.position === 'before') {
          const targetIdx = result.findIndex(p => idMatches(p.id, add['by-id']) || idMatches(p.originalId, add['by-id']));
          if (targetIdx >= 0 && !result.some(p => idMatches(p.id, newPart.id))) {
            result.splice(targetIdx, 0, { ...newPart, isAdded: true } as RenderablePart);
          }
        } else if (add.position === 'after') {
          const targetIdx = result.findIndex(p => idMatches(p.id, add['by-id']) || idMatches(p.originalId, add['by-id']));
          if (targetIdx >= 0 && !result.some(p => idMatches(p.id, newPart.id))) {
            result.splice(targetIdx + 1, 0, { ...newPart, isAdded: true } as RenderablePart);
          }
        } else if (add.position === 'starting') {
          const parent = result.find(p => idMatches(p.id, add['by-id']) || idMatches(p.originalId, add['by-id']));
          if (parent) {
            if (!parent.parts) parent.parts = [];
            if (!parent.parts.some((sp: Part) => idMatches(sp.id, newPart.id))) {
              parent.parts.unshift({ ...newPart, isAdded: true } as RenderablePart);
            }
          }
        } else if (add.position === 'ending') {
          const parent = result.find(p => idMatches(p.id, add['by-id']) || idMatches(p.originalId, add['by-id']));
          if (parent) {
            if (!parent.parts) parent.parts = [];
            if (!parent.parts.some((sp: Part) => idMatches(sp.id, newPart.id))) {
              parent.parts.push({ ...newPart, isAdded: true } as RenderablePart);
            }
          }
        }
      } else {
        if (level === 0) {
          if (add.position === 'starting') {
            if (!result.some(p => idMatches(p.id, newPart.id))) {
              result.unshift({ ...newPart, isAdded: true } as RenderablePart);
            }
          } else if (add.position === 'ending') {
            if (!result.some(p => idMatches(p.id, newPart.id))) {
              result.push({ ...newPart, isAdded: true } as RenderablePart);
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
  const alterIdx = alters.findIndex((a: ProfileAlter) => 
    a['control-id'] === controlId || (a['control-id'] && controlId && a['control-id'].toLowerCase() === controlId.toLowerCase())
  );

  let currentAlter = alterIdx >= 0 ? { ...alters[alterIdx] } : { 'control-id': controlId };
  currentAlter = updateFn(currentAlter);

  const hasAdds = currentAlter.adds && currentAlter.adds.length > 0;
  const hasRemoves = currentAlter.removes && currentAlter.removes.length > 0;

  if (!hasAdds && !hasRemoves) {
    if (alterIdx >= 0) {
      alters.splice(alterIdx, 1);
    }
  } else {
    if (alterIdx >= 0) {
      alters[alterIdx] = currentAlter;
    } else {
      alters.push(currentAlter);
    }
  }

  onProfileChange({
    ...profile,
    modify: {
      ...modify,
      alters: alters.length > 0 ? alters : undefined
    }
  });
};

export const getAlterForControl = (profile: Profile | undefined, controlId: string): ProfileAlter | undefined => {
  return (profile?.modify?.alters || []).find((a: ProfileAlter) => 
    a['control-id'] === controlId || (a['control-id'] && controlId && a['control-id'].toLowerCase() === controlId.toLowerCase())
  );
};

export const getModifiedPartIds = (profile: Profile | undefined, controlId: string): string[] => {
  const alter = getAlterForControl(profile, controlId);
  if (!alter) return [];
  const ids: string[] = [];
  (alter.removes || []).forEach((r: Removal) => {
    if (r['by-id'] && alter.adds?.some((a: Addition) => idMatches(a['by-id'], r['by-id']))) {
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
        parts: [currentPart as unknown as Part]
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
