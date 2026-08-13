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
}

export interface UseControlTreeOptions {
  groups?: Group[];
  controls?: Control[];
  initialSelectedId?: string;
  onSelect?: (controlId: string | null) => void;
  showWithdrawn?: boolean;
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
  
  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredNodes: ControlTreeNode[]; // Nodes matching search
  
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
  
  const sortedItems = [...items].sort((a, b) => sortId(a).localeCompare(sortId(b)));
  
  for (const item of sortedItems) {
    if (!item.id) continue;
    
    const childrenGroups = (item as Group).groups || [];
    const childrenControls = (item as Group | Control).controls || [];
    
    const childIds = [
      ...childrenGroups.map(g => g.id!).filter(Boolean),
      ...childrenControls.map(c => c.id!).filter(Boolean)
    ];
    
    const withdrawn = getPropValue(item.props, 'status')?.toLowerCase() === 'withdrawn';
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
  const { groups = [], controls = [], initialSelectedId = null, onSelect, showWithdrawn = false } = options;
  
  const flatList = useMemo(() => {
    const groupNodes = buildTree(groups, null, 0, 'group');
    const controlNodes = buildTree(controls, null, 0, 'control');
    return [...groupNodes, ...controlNodes];
  }, [groups, controls]);
  
  const nodes = useMemo(() => {
     return flatList.filter(n => n.parentId === null);
  }, [flatList]);

  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  
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

  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim() && showWithdrawn) return flatList;
    
    const query = searchQuery.toLowerCase();
    
    // First find matching nodes
    const matchingIds = new Set<string>();
    
    for (const node of flatList) {
        if (!showWithdrawn && node.withdrawn) continue;
        
        if (!query || 
            (node.id && node.id.toLowerCase().includes(query)) ||
            (node.title && node.title.toLowerCase().includes(query)) ||
            (node.label && node.label.toLowerCase().includes(query))
        ) {
            matchingIds.add(node.id);
            // Ensure ancestors are included so we can show them in the tree
            getAncestors(node.id).forEach(a => matchingIds.add(a));
        }
    }
    
    return flatList.filter(n => matchingIds.has(n.id));
  }, [flatList, searchQuery, showWithdrawn, getAncestors]);
  
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
    filteredNodes,
    getAncestors,
    breadcrumbs
  };
}
