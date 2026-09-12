import { useState, useMemo, useCallback } from 'react';
import { Group, Control, Property } from '@lib/types/oscal';

export interface ControlTreeNode {
  id: string;
  type: 'group' | 'control' | 'enhancement';
  title: string;
  class?: string;
  depth: number;
  parentId: string | null;
  childIds: string[];
  hasEnhancements: boolean;
  enhancementCount: number;
  // Stage-specific metadata (optional)
  implementationStatus?: string; // SSP
  hasAlterations?: boolean; // Profile
  withdrawn?: boolean; // Catalog
  sortId?: string;
  label?: string;
  isExpanded?: boolean;
  children?: ControlTreeNode[];
}

export interface TreeVisibilityFilter {
  showActive: boolean;
  showExcluded: boolean;
  showWithdrawn: boolean;
  showUnassigned?: boolean;
}

export interface UseControlTreeOptions {
  groups?: Group[];
  controls?: Control[];
  initialSelectedId?: string;
  onSelect?: (controlId: string | null) => void;
  showWithdrawn?: boolean;
  excludedControlIds?: Set<string>;
  initialVisibilityFilter?: TreeVisibilityFilter;
  visibilityFilter?: TreeVisibilityFilter;
  onVisibilityFilterChange?: (filter: TreeVisibilityFilter) => void;
}

export interface UseControlTreeReturn {
  // Tree data
  nodes: ControlTreeNode[];
  flatList: ControlTreeNode[]; // For search
  
  // Selection
  selectedId: string | null;
  selectedNode: ControlTreeNode | null;
  select: (id: string | null) => void;
  
  // Expansion
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  expandToNode: (id: string) => void; // Expand all ancestors
  
  // Search & Visibility Filter
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  visibilityFilter: TreeVisibilityFilter;
  setVisibilityFilter: React.Dispatch<React.SetStateAction<TreeVisibilityFilter>>;
  filteredNodes: ControlTreeNode[]; // Nodes matching search and visibility filter
  
  // Ancestors
  getAncestors: (id: string) => string[];
  breadcrumbs: ControlTreeNode[]; // Ancestors of selected node
}

const getPropValue = (props: Property[] | undefined, name: string) => {
  return props?.find(p => p.name?.toLowerCase() === name.toLowerCase())?.value;
};

const buildTree = (
  items: (Group | Control)[], 
  parentId: string | null, 
  depth: number, 
  type: 'group' | 'control'
): ControlTreeNode[] => {
  let nodes: ControlTreeNode[] = [];
  
  const sortId = (item: any) => {
      const id = getPropValue(item.props, 'sort-id');
      return id !== undefined ? id : item.id;
  };
  
  // Preserve the caller-provided document array order so that manual drag-and-drop reordering works as intended
  const sortedItems = [...items];
  
  for (const item of sortedItems) {
    if (!item.id) continue;
    
    const childrenGroups = (item as Group).groups || [];
    const childrenControls = (item as Group | Control).controls || [];
    
    const childIds = [
      ...childrenGroups.map(g => g.id!).filter(Boolean),
      ...childrenControls.map(c => c.id!).filter(Boolean)
    ];
    
    const withdrawn = (item as any).status?.toLowerCase() === 'withdrawn' || 
      getPropValue(item.props, 'status')?.toLowerCase() === 'withdrawn' || 
      getPropValue(item.props, 'state')?.toLowerCase() === 'withdrawn';
    const label = getPropValue(item.props, 'label') || item.id;
    
    // Simplistic heuristic for enhancements vs sub-controls
    const isControl = type === 'control' || (item as any).class === 'control';
    // Check if sub-controls are enhancements (often marked by class 'SP800-53-enhancement')
    const hasEnhancements = childrenControls.some(c => c.class === 'SP800-53-enhancement');
    const enhancementCount = childrenControls.filter(c => c.class === 'SP800-53-enhancement').length;
    
    const node: ControlTreeNode = {
      id: item.id,
      type: (item as any).class === 'SP800-53-enhancement' ? 'enhancement' : type,
      title: item.title || item.id,
      class: item.class,
      depth,
      parentId,
      childIds,
      hasEnhancements,
      enhancementCount,
      withdrawn,
      sortId: sortId(item),
      label
    };
    
    nodes.push(node);
    
    nodes = nodes.concat(buildTree(childrenGroups, item.id, depth + 1, 'group'));
    nodes = nodes.concat(buildTree(childrenControls, item.id, depth + 1, 'control'));
  }
  
  return nodes;
};

export function useControlTree(options: UseControlTreeOptions): UseControlTreeReturn {
  const { groups = [], controls = [], initialSelectedId = null, onSelect, showWithdrawn = false, excludedControlIds, initialVisibilityFilter } = options;
  
  const flatList = useMemo(() => {
    const groupNodes = buildTree(groups, null, 0, 'group');
    const controlNodes = buildTree(controls, null, 0, 'control');
    return [...groupNodes, ...controlNodes];
  }, [groups, controls]);
  
  const nodes = useMemo(() => {
     return flatList.filter(n => n.parentId === null && (showWithdrawn || !n.withdrawn));
  }, [flatList, showWithdrawn]);

  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [internalVisibilityFilter, setInternalVisibilityFilter] = useState<TreeVisibilityFilter>(
    initialVisibilityFilter || {
      showActive: true,
      showExcluded: true,
      showWithdrawn: Boolean(showWithdrawn),
      showUnassigned: false
    }
  );

  const visibilityFilter = options.visibilityFilter || internalVisibilityFilter;
  const setVisibilityFilter = options.onVisibilityFilterChange
    ? (val: React.SetStateAction<TreeVisibilityFilter>) => {
        if (typeof val === 'function') {
          options.onVisibilityFilterChange!(val(visibilityFilter));
        } else {
          options.onVisibilityFilterChange!(val);
        }
      }
    : (setInternalVisibilityFilter as React.Dispatch<React.SetStateAction<TreeVisibilityFilter>>);
  
  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    if (onSelect) onSelect(id);
  }, [onSelect]);
  
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  
  const expandAll = useCallback(() => {
    setExpandedIds(new Set(flatList.map(n => n.id)));
  }, [flatList]);
  
  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);
  
  const getAncestors = useCallback((id: string): string[] => {
    const path: string[] = [];
    let currentId: string | null = id;
    
    while (currentId) {
       const node = flatList.find(n => n.id === currentId);
       if (node && node.parentId) {
           path.unshift(node.parentId);
           currentId = node.parentId;
       } else {
           currentId = null;
       }
    }
    return path;
  }, [flatList]);
  
  const expandToNode = useCallback((id: string) => {
    const ancestors = getAncestors(id);
    setExpandedIds(prev => {
      const next = new Set(prev);
      ancestors.forEach(a => next.add(a));
      next.add(id);
      return next;
    });
  }, [getAncestors]);

  const isNodeOrAncestorWithdrawn = useCallback((node: ControlTreeNode): boolean => {
    if (node.withdrawn) return true;
    const ancestors = getAncestors(node.id);
    return ancestors.some(aId => flatList.find(n => n.id === aId)?.withdrawn);
  }, [flatList, getAncestors]);

  const filteredNodes = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const excludedIds = excludedControlIds;
    
    const nodeMatchesVisibility = (node: ControlTreeNode): boolean => {
      if (node.type === 'group') return true;
      if (node.withdrawn) {
        return visibilityFilter.showWithdrawn;
      }
      const isExcluded = Boolean(excludedIds && excludedIds.has(node.id.toLowerCase()));
      if (isExcluded) {
        return visibilityFilter.showExcluded;
      }
      return visibilityFilter.showActive;
    };
    
    // First find matching nodes
    const matchingIds = new Set<string>();
    
    for (const node of flatList) {
        if (isNodeOrAncestorWithdrawn(node) && !visibilityFilter.showWithdrawn) continue;
        if (!nodeMatchesVisibility(node)) continue;
        
        if (!query || 
            (node.id && node.id.toLowerCase().includes(query)) ||
            (node.title && node.title.toLowerCase().includes(query)) ||
            (node.label && node.label.toLowerCase().includes(query))
        ) {
            matchingIds.add(node.id);
            // Ensure ancestors are included so we can show them in the tree
            getAncestors(node.id).forEach(a => {
              const ancestorNode = flatList.find(n => n.id === a);
              if (visibilityFilter.showWithdrawn || !ancestorNode?.withdrawn) {
                matchingIds.add(a);
              }
            });
        }
    }
    
    return flatList.filter(n => matchingIds.has(n.id));
  }, [flatList, searchQuery, visibilityFilter, excludedControlIds, getAncestors, isNodeOrAncestorWithdrawn]);
  
  const selectedNode = flatList.find(n => n.id === selectedId) || null;
  const breadcrumbs = selectedId ? getAncestors(selectedId).map(id => flatList.find(n => n.id === id)!).filter(Boolean) : [];

  return {
    nodes,
    flatList,
    selectedId,
    selectedNode,
    select,
    expandedIds,
    toggleExpand,
    expandAll,
    collapseAll,
    expandToNode,
    searchQuery,
    setSearchQuery,
    visibilityFilter,
    setVisibilityFilter,
    filteredNodes,
    getAncestors,
    breadcrumbs
  };
}
