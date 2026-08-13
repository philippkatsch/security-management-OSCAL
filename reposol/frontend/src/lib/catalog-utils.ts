import { Catalog, Group, Control, Parameter } from './types/oscal';

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
