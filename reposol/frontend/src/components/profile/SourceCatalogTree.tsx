import React, { useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { TreeVisibilityFilter } from '../../hooks/useControlTree';
import { TreeFilterPopover } from '../shared/control-tree/TreeFilterPopover';

export interface SourceCatalogTreeProps {
  profile?: any;
  resolvedCatalog?: any;
  availableCatalogs?: any[];
  availableProfiles?: any[];
  catalogCache?: any;
  isEditing?: boolean;
  mergeMode?: string;
  availableCustomGroups?: Array<{ id: string; title: string; depth: number }>;
  assignedControlIds?: Set<string>;
  getControlAssignment?: (cid: string) => { groupId: string; groupTitle: string } | null;
  onAssignControl?: (controlId: string, targetGroupId: string) => void;
  onAssignMultipleControls?: (controlIds: string[], targetGroupId: string) => void;
  onRemoveControl?: (controlId: string) => void;
  onRemoveMultipleControls?: (controlIds: string[]) => void;
  onCopyStructure?: (href: string, mode?: string) => void;
  onRemoveImport?: (importIdx: number) => void;
  onUpdateImport?: (importIdx: number, newImport: any) => void;
  onAddImport?: (uuid: string, type: 'catalog' | 'profile') => void;
  onMergeModeChange?: (newMode: string) => void;
  onCombineMethodChange?: (newMethod: string) => void;
}

interface TreeControlItem {
  id: string;
  title: string;
  catalogId: string;
  catalogTitle: string;
  isAssigned: boolean;
  isIncluded: boolean;
  isPartial?: boolean;
  activeSubCount?: number;
  totalSubCount?: number;
  isWithdrawn?: boolean;
  assignedGroupId: string | null;
  assignedGroupTitle: string | null;
  controls?: TreeControlItem[];
}

interface TreeGroupItem {
  id: string;
  title: string;
  catalogId: string;
  catalogTitle: string;
  class?: string;
  controls: TreeControlItem[];
  groups: TreeGroupItem[];
}

interface TreeCatalogItem {
  id: string;
  importIdx: number;
  title: string;
  version?: string;
  href?: string;
  isIncludeAll: boolean;
  includedCount: number;
  totalCount: number;
  groups: TreeGroupItem[];
  controls: TreeControlItem[];
}

export function SourceCatalogTree({
  profile = {},
  resolvedCatalog = null,
  availableCatalogs = [],
  availableProfiles = [],
  catalogCache = null,
  isEditing = false,
  mergeMode = 'as-is',
  availableCustomGroups = [],
  assignedControlIds = new Set(),
  getControlAssignment = () => null,
  onAssignControl = () => {},
  onAssignMultipleControls = () => {},
  onRemoveControl = () => {},
  onRemoveMultipleControls = () => {},
  onCopyStructure,
  onRemoveImport,
  onUpdateImport,
  onAddImport,
  onMergeModeChange,
  onCombineMethodChange
}: SourceCatalogTreeProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<TreeVisibilityFilter>({
    showActive: true,
    showExcluded: true,
    showWithdrawn: false
  });
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [selectedControlIds, setSelectedControlIds] = useState<Set<string>>(new Set());

  const activeMergeMode = useMemo(() => {
    if (mergeMode && mergeMode !== 'as-is') return mergeMode;
    if (profile?.merge?.custom !== undefined) return 'custom';
    if (profile?.merge?.flat) return 'flat';
    return mergeMode || 'as-is';
  }, [mergeMode, profile?.merge]);

  // ─── Build Hierarchical Tree Structure from Source Data ─────────────────
  const sourceCatalogs = useMemo(() => {
    const list: TreeCatalogItem[] = [];
    const imports = profile?.imports || [];

    const processDoc = (imp: any, idx: number, sourceDoc: any, catId: string, catTitle: string, href: string, catVersion?: string) => {
      const catDoc = sourceDoc?.catalog || sourceDoc?.profile || sourceDoc?.data?.catalog || sourceDoc?.data?.profile || sourceDoc;
      
      const sourceGroups = catDoc?.all_groups || catDoc?.groups || resolvedCatalog?.all_groups || [];
      const sourceControls = catDoc?.all_controls || catDoc?.controls || resolvedCatalog?.all_controls || [];

      const rawControlIds: string[] = [];
      const collectControls = (controlsList?: any[]) => {
        if (!controlsList) return;
        for (const c of controlsList) {
          if (c?.id) rawControlIds.push(c.id);
          if (c?.controls) collectControls(c.controls);
        }
      };
      const collectFromGroups = (groupsList?: any[]) => {
        if (!groupsList) return;
        for (const g of groupsList) {
          if (g?.controls) collectControls(g.controls);
          if (g?.groups) collectFromGroups(g.groups);
        }
      };
      collectControls(sourceControls);
      collectFromGroups(sourceGroups);

      const isIncludeAll = imp ? (imp['include-all'] !== undefined) : true;
      const includedIdsSet = new Set<string>();
      if (isIncludeAll) {
        rawControlIds.forEach(id => includedIdsSet.add(id.toLowerCase()));
        if (imp?.['exclude-controls']) {
          for (const exc of imp['exclude-controls']) {
            for (const id of exc['with-ids'] || []) {
              includedIdsSet.delete(id.toLowerCase());
            }
          }
        }
      } else if (imp?.['include-controls']) {
        for (const inc of imp['include-controls']) {
          for (const id of inc['with-ids'] || []) {
            includedIdsSet.add(id.toLowerCase());
          }
        }
      } else {
        rawControlIds.forEach(id => includedIdsSet.add(id.toLowerCase()));
      }

      if (resolvedCatalog?.excluded_control_ids && Array.isArray(resolvedCatalog.excluded_control_ids)) {
        for (const excId of resolvedCatalog.excluded_control_ids) {
          if (excId) includedIdsSet.delete(excId.toLowerCase());
        }
      }

      const mapControl = (c: any): TreeControlItem => {
        const assignment = getControlAssignment(c.id);
        const isAssigned = Boolean(assignment || assignedControlIds.has(c.id?.toLowerCase()));
        const isWithdrawn = Boolean(
          c.props?.some((p: any) => (p.name === 'status' || p.name === 'state') && p.value?.toLowerCase() === 'withdrawn') ||
          c.status?.toLowerCase() === 'withdrawn'
        );
        const subControls = (c.controls || []).map(mapControl);
        
        let isIncluded = includedIdsSet.has(c.id?.toLowerCase());
        let isPartial = false;
        let activeSubCount = 0;
        const totalSubCount = subControls.length;

        if (totalSubCount > 0) {
          activeSubCount = subControls.filter(sub => sub.isIncluded).length;
          if (activeSubCount === totalSubCount) {
            isIncluded = true;
            isPartial = false;
          } else if (activeSubCount > 0) {
            isIncluded = true;
            isPartial = true;
          } else {
            isIncluded = includedIdsSet.has(c.id?.toLowerCase());
            isPartial = false;
          }
        }

        return {
          id: c.id,
          title: c.title || 'Untitled',
          catalogId: catId,
          catalogTitle: catTitle,
          isAssigned,
          isIncluded,
          isPartial,
          activeSubCount,
          totalSubCount,
          isWithdrawn,
          assignedGroupId: assignment?.groupId || null,
          assignedGroupTitle: assignment?.groupTitle || null,
          controls: subControls.length > 0 ? subControls : undefined
        };
      };

      const mapGroup = (g: any): TreeGroupItem => {
        const directControls = (g.controls || []).map(mapControl);
        const subGroups = (g.groups || []).map(mapGroup);
        return {
          id: g.id || `grp_${Math.random().toString(36).slice(2, 6)}`,
          title: g.title || g.id || 'Untitled Group',
          catalogId: catId,
          catalogTitle: catTitle,
          class: g.class,
          controls: directControls,
          groups: subGroups
        };
      };

      const groups = sourceGroups.map(mapGroup);
      const topControls = sourceControls.map(mapControl);

      const countIncludedInTree = (groupsList: TreeGroupItem[], controlsList: TreeControlItem[]): number => {
        let count = 0;
        const countInControl = (c: TreeControlItem) => {
          if (c.isIncluded) count++;
          if (c.controls) c.controls.forEach(countInControl);
        };
        controlsList.forEach(countInControl);
        for (const g of groupsList) {
          g.controls.forEach(countInControl);
          if (g.groups) {
            count += countIncludedInTree(g.groups, []);
          }
        }
        return count;
      };

      const totalCount = rawControlIds.length;
      const includedCount = countIncludedInTree(groups, topControls);
      const isExplicitIncludeAll = Boolean(imp && imp['include-all'] !== undefined && (!imp['exclude-controls'] || imp['exclude-controls'].length === 0));

      return {
        id: catId,
        importIdx: idx,
        title: catTitle,
        version: catVersion || catDoc?.metadata?.version,
        href,
        isIncludeAll: isExplicitIncludeAll || (includedCount === totalCount && totalCount > 0),
        includedCount,
        totalCount,
        groups,
        controls: topControls
      };
    };

    if (imports.length === 0) {
      if (resolvedCatalog) {
        const catTitle = resolvedCatalog.source_catalog_title || (resolvedCatalog.metadata?.title !== profile?.metadata?.title ? resolvedCatalog.metadata?.title : 'Resolved Catalog');
        const catId = resolvedCatalog.source_catalog_id || 'resolved_root';
        const item = processDoc(null, 0, resolvedCatalog, catId, catTitle, '');
        list.push(item);
      }
      return list;
    }

    imports.forEach((imp: any, idx: number) => {
      const href = imp?.href || '';
      const match = href.match(/([a-f0-9-]{36})/i);
      const uuid = match ? match[1]?.toLowerCase() : null;

      // 1. Check if backend resolution provided per-source isolated tree
      const backendSource = resolvedCatalog?.imported_sources?.find((s: any) => 
        (uuid && s.id?.toLowerCase() === uuid) ||
        s.href === href ||
        (s.id && href.includes(s.id))
      ) || resolvedCatalog?.imported_sources?.[idx];

      let sourceDoc: any = null;
      let sourceTitle: string | null = backendSource?.title || null;
      let sourceVersion: string | null = backendSource?.version || null;

      if (backendSource) {
        sourceDoc = {
          all_groups: backendSource.all_groups || backendSource.groups,
          all_controls: backendSource.all_controls || backendSource.controls,
          groups: backendSource.groups,
          controls: backendSource.controls,
          metadata: {
            title: backendSource.title,
            version: backendSource.version
          }
        };
      }

      // 2. Fallback to catalogCache if available
      if (!sourceDoc && uuid && catalogCache) {
        const cacheEntry = typeof catalogCache.get === 'function'
          ? (catalogCache.get(uuid) || catalogCache.get(uuid.toLowerCase()))
          : (catalogCache[uuid] || catalogCache[uuid.toLowerCase()]);
        if (cacheEntry) {
          sourceDoc = cacheEntry?.data || cacheEntry;
          const entryDoc = sourceDoc?.catalog || sourceDoc?.profile;
          if (entryDoc?.metadata?.title) {
            sourceTitle = sourceTitle || entryDoc.metadata.title;
            sourceVersion = sourceVersion || entryDoc.metadata.version;
          }
        }
      }

      // 3. Fallback to availableCatalogs list
      if (availableCatalogs.length > 0) {
        const found = availableCatalogs.find((c: any) => {
          const catObj = c?.catalog || c;
          const catId = (catObj.uuid || catObj.id || c.uuid || c.id)?.toLowerCase();
          const catTitleMeta = catObj.metadata?.title || c.metadata?.title || c.title;
          return (
            (uuid && catId === uuid) ||
            c.href === href ||
            (catId && href.toLowerCase().includes(catId)) ||
            (catTitleMeta && href.includes(catTitleMeta))
          );
        });
        if (found) {
          const catObj = found?.catalog || found;
          if (!sourceDoc) sourceDoc = catObj;
          sourceTitle = sourceTitle || catObj?.metadata?.title || found?.metadata?.title || found?.title || null;
          sourceVersion = sourceVersion || catObj?.metadata?.version || found?.metadata?.version || null;
        } else if (!sourceDoc && availableCatalogs.length === 1 && imports.length === 1) {
          const catObj = availableCatalogs[0]?.catalog || availableCatalogs[0];
          sourceDoc = catObj;
          sourceTitle = sourceTitle || catObj?.metadata?.title || availableCatalogs[0]?.metadata?.title || availableCatalogs[0]?.title || null;
          sourceVersion = sourceVersion || catObj?.metadata?.version || availableCatalogs[0]?.metadata?.version || null;
        }
      }

      // 4. Fallback to availableProfiles list
      if (availableProfiles.length > 0) {
        const found = availableProfiles.find((p: any) => {
          const profObj = p?.profile || p;
          const profId = (profObj.uuid || profObj.id || p.uuid || p.id)?.toLowerCase();
          const profTitleMeta = profObj.metadata?.title || p.metadata?.title || p.title;
          return (
            (uuid && profId === uuid) ||
            p.href === href ||
            (profId && href.toLowerCase().includes(profId)) ||
            (profTitleMeta && href.includes(profTitleMeta))
          );
        });
        if (found) {
          const profObj = found?.profile || found;
          if (!sourceDoc) sourceDoc = profObj;
          sourceTitle = sourceTitle || profObj?.metadata?.title || found?.metadata?.title || found?.title || null;
          sourceVersion = sourceVersion || profObj?.metadata?.version || found?.metadata?.version || null;
        } else if (!sourceDoc && availableProfiles.length === 1 && imports.length === 1) {
          const profObj = availableProfiles[0]?.profile || availableProfiles[0];
          sourceDoc = profObj;
          sourceTitle = sourceTitle || profObj?.metadata?.title || availableProfiles[0]?.metadata?.title || availableProfiles[0]?.title || null;
          sourceVersion = sourceVersion || profObj?.metadata?.version || availableProfiles[0]?.metadata?.version || null;
        }
      }

      // 5. Final fallback to resolvedCatalog
      if (!sourceDoc && resolvedCatalog) {
        sourceDoc = resolvedCatalog;
        if (!sourceTitle && imports.length === 1) {
          sourceTitle = resolvedCatalog.source_catalog_title;
        }
      }

      const catDoc = sourceDoc?.catalog || sourceDoc?.profile || sourceDoc?.data?.catalog || sourceDoc?.data?.profile || sourceDoc;
      const profileTitle = profile?.metadata?.title;
      let catTitle = sourceTitle 
        || (catDoc?.metadata?.title && catDoc.metadata.title !== profileTitle ? catDoc.metadata.title : null)
        || (imports.length === 1 && resolvedCatalog?.source_catalog_title && resolvedCatalog.source_catalog_title !== profileTitle ? resolvedCatalog.source_catalog_title : null)
        || (uuid ? `Source (${uuid.slice(0, 8)})` : `Import #${idx + 1}`);

      const catVersion = sourceVersion || catDoc?.metadata?.version || (catDoc === resolvedCatalog ? undefined : resolvedCatalog?.metadata?.version);
      const catId = uuid || backendSource?.id || (imports.length === 1 ? resolvedCatalog?.source_catalog_id : null) || `import_${idx}`;

      list.push(processDoc(imp, idx, sourceDoc, catId, catTitle, href, catVersion));
    });

    return list;
  }, [profile?.imports, catalogCache, availableCatalogs, availableProfiles, resolvedCatalog, assignedControlIds, getControlAssignment]);

  // ─── Helper: Collect all controls from a control, group, catalog (recursive) ──
  const collectControlIds = (c: TreeControlItem): string[] => {
    const ids = [c.id];
    if (c.controls) {
      c.controls.forEach(sub => ids.push(...collectControlIds(sub)));
    }
    return ids;
  };

  const collectGroupControlIds = (g: TreeGroupItem): string[] => {
    const ids: string[] = [];
    g.controls.forEach(c => ids.push(...collectControlIds(c)));
    g.groups.forEach(sub => ids.push(...collectGroupControlIds(sub)));
    return ids;
  };

  const countGroupActiveControls = (g: TreeGroupItem): number => {
    let count = 0;
    const countInCtrl = (c: TreeControlItem) => {
      if (c.isIncluded) count++;
      if (c.controls) c.controls.forEach(countInCtrl);
    };
    g.controls.forEach(countInCtrl);
    g.groups.forEach(subG => { count += countGroupActiveControls(subG); });
    return count;
  };

  const collectCatalogControlIds = (cat: TreeCatalogItem): string[] => {
    const ids: string[] = [];
    cat.controls.forEach(c => ids.push(...collectControlIds(c)));
    cat.groups.forEach(g => ids.push(...collectGroupControlIds(g)));
    return ids;
  };

  // ─── Statistics Calculation ─────────────────────────────────────────────
  const treeStats = useMemo(() => {
    let total = 0;
    let assigned = 0;
    let included = 0;

    sourceCatalogs.forEach(cat => {
      const allIds = collectCatalogControlIds(cat);
      total += allIds.length;
      allIds.forEach(id => {
        if (assignedControlIds.has(id.toLowerCase())) {
          assigned++;
        }
      });
      const countIncluded = (items: { controls: TreeControlItem[]; groups: TreeGroupItem[] }) => {
        const countInControl = (c: TreeControlItem) => {
          if (c.isIncluded) included++;
          if (c.controls) c.controls.forEach(countInControl);
        };
        items.controls.forEach(countInControl);
        items.groups.forEach(g => countIncluded(g));
      };
      countIncluded(cat);
    });

    return {
      total,
      assigned,
      unassigned: Math.max(0, total - assigned),
      included,
      excluded: Math.max(0, total - included)
    };
  }, [sourceCatalogs, assignedControlIds]);

  // ─── Filter & Search Matching ───────────────────────────────────────────
  const query = searchQuery.trim().toLowerCase();

  const controlMatches = (c: TreeControlItem): boolean => {
    if (!query) return true;
    return c.id.toLowerCase().includes(query) ||
           c.title.toLowerCase().includes(query) ||
           c.catalogTitle.toLowerCase().includes(query);
  };

  const isDefaultVisibility = visibilityFilter.showActive && visibilityFilter.showExcluded && !visibilityFilter.showWithdrawn;

  const filterControl = (c: TreeControlItem): TreeControlItem | null => {
    if (c.isWithdrawn) {
      if (!visibilityFilter.showWithdrawn) return null;
    } else {
      const isActive = c.isIncluded && !c.isPartial;
      const isExcluded = !c.isIncluded || Boolean(c.isPartial);
      if (isActive && !visibilityFilter.showActive) return null;
      if (isExcluded && !visibilityFilter.showExcluded) return null;
    }

    const matchingSubControls = (c.controls || []).map(filterControl).filter(Boolean) as TreeControlItem[];

    if (!query) {
      if (!isDefaultVisibility && c.controls) {
        return {
          ...c,
          controls: matchingSubControls
        };
      }
      return c;
    }

    const directMatch = c.id.toLowerCase().includes(query) ||
                        c.title.toLowerCase().includes(query) ||
                        c.catalogTitle.toLowerCase().includes(query);
    if (directMatch || matchingSubControls.length > 0) {
      return {
        ...c,
        controls: directMatch && isDefaultVisibility ? c.controls : matchingSubControls
      };
    }
    return null;
  };

  const filterGroup = (g: TreeGroupItem): TreeGroupItem | null => {
    if (!query && isDefaultVisibility) {
      return g;
    }
    const matchingControls = g.controls.map(filterControl).filter(Boolean) as TreeControlItem[];
    const matchingSubgroups = g.groups.map(filterGroup).filter(Boolean) as TreeGroupItem[];

    const groupTitleMatches = query && (g.title.toLowerCase().includes(query) || g.id.toLowerCase().includes(query));

    if (matchingControls.length > 0 || matchingSubgroups.length > 0 || (groupTitleMatches && isDefaultVisibility)) {
      return {
        ...g,
        controls: groupTitleMatches && isDefaultVisibility ? g.controls : matchingControls,
        groups: matchingSubgroups
      };
    }
    return null;
  };

  const filteredCatalogs = useMemo(() => {
    return sourceCatalogs
      .map(cat => {
        if (!query && isDefaultVisibility) {
          return cat;
        }
        const filteredGroups = cat.groups.map(filterGroup).filter(Boolean) as TreeGroupItem[];
        const filteredControls = cat.controls.map(filterControl).filter(Boolean) as TreeControlItem[];
        const catTitleMatches = query && cat.title.toLowerCase().includes(query);

        if (filteredGroups.length > 0 || filteredControls.length > 0 || catTitleMatches) {
          return {
            ...cat,
            groups: catTitleMatches && isDefaultVisibility ? cat.groups : filteredGroups,
            controls: catTitleMatches && isDefaultVisibility ? cat.controls : filteredControls
          };
        }
        return null;
      })
      .filter(Boolean) as TreeCatalogItem[];
  }, [sourceCatalogs, query, isDefaultVisibility, filterGroup, filterControl]);

  // ─── Expand / Collapse State Management ─────────────────────────────────
  const toggleNode = (nodeId: string, defaultExpanded = true) => {
    setExpandedNodes(prev => {
      const current = prev[nodeId] !== undefined ? prev[nodeId] : defaultExpanded;
      return { ...prev, [nodeId]: !current };
    });
  };

  const isNodeExpanded = (nodeId: string, defaultExpanded = true): boolean => {
    return expandedNodes[nodeId] !== undefined ? expandedNodes[nodeId] : defaultExpanded;
  };

  // ─── Multi-Selection for Batch Assignment ────────────────────────────────
  const handleToggleSelectControl = (controlId: string, e?: React.MouseEvent | React.ChangeEvent, childIds?: string[]) => {
    if (e) e.stopPropagation();
    const idsToToggle = [controlId, ...(childIds || [])];
    const isSelected = selectedControlIds.has(controlId);
    setSelectedControlIds(prev => {
      const next = new Set(prev);
      idsToToggle.forEach(id => {
        if (isSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });
      return next;
    });
  };

  const handleSelectAllInGroup = (g: TreeGroupItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const groupControlIds = collectGroupControlIds(g);
    setSelectedControlIds(prev => {
      const next = new Set(prev);
      const allSelected = groupControlIds.every(id => next.has(id));
      if (allSelected) {
        groupControlIds.forEach(id => next.delete(id));
      } else {
        groupControlIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleSelectAllInCatalog = (cat: TreeCatalogItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const catControlIds = collectCatalogControlIds(cat);
    setSelectedControlIds(prev => {
      const next = new Set(prev);
      const allSelected = catControlIds.every(id => next.has(id));
      if (allSelected) {
        catControlIds.forEach(id => next.delete(id));
      } else {
        catControlIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    const visibleIds = new Set<string>();
    filteredCatalogs.forEach(cat => {
      cat.controls.forEach(c => collectControlIds(c).forEach(id => visibleIds.add(id)));
      cat.groups.forEach(g => collectGroupControlIds(g).forEach(id => visibleIds.add(id)));
    });
    setSelectedControlIds(visibleIds);
  };

  const handleClearSelection = () => {
    setSelectedControlIds(new Set());
  };

  const handleToggleControlInclusion = (cat: TreeCatalogItem, controlId: string, childIds?: string[], isPartial?: boolean) => {
    if (!onUpdateImport) return;
    const currentImp = profile.imports?.[cat.importIdx] || { href: cat.href };
    const allCatIds = collectCatalogControlIds(cat);
    
    // Calculate current included IDs
    const currentlyIncluded = new Set<string>();
    const countIncluded = (items: { controls: TreeControlItem[]; groups: TreeGroupItem[] }) => {
      const collectInCtrl = (c: TreeControlItem) => {
        if (c.isIncluded) currentlyIncluded.add(c.id.toLowerCase());
        if (c.controls) c.controls.forEach(collectInCtrl);
      };
      items.controls.forEach(collectInCtrl);
      items.groups.forEach(g => countIncluded(g));
    };
    countIncluded(cat);

    const idsToToggle = [controlId, ...(childIds || [])];
    const willInclude = isPartial ? true : !currentlyIncluded.has(controlId.toLowerCase());

    idsToToggle.forEach(id => {
      if (willInclude) {
        currentlyIncluded.add(id.toLowerCase());
      } else {
        currentlyIncluded.delete(id.toLowerCase());
      }
    });

    const newImp = { ...currentImp };
    if (currentlyIncluded.size === allCatIds.length) {
      delete newImp['include-controls'];
      delete newImp['exclude-controls'];
      newImp['include-all'] = {};
    } else {
      delete newImp['include-all'];
      delete newImp['exclude-controls'];
      const withIds = allCatIds.filter(id => currentlyIncluded.has(id.toLowerCase()));
      newImp['include-controls'] = [{ 'with-ids': withIds }];
    }
    onUpdateImport(cat.importIdx, newImp);
  };

  const handleIncludeAllInCatalog = (cat: TreeCatalogItem) => {
    if (!onUpdateImport) return;
    const currentImp = profile.imports?.[cat.importIdx] || { href: cat.href };
    const newImp = { ...currentImp };
    delete newImp['include-controls'];
    delete newImp['exclude-controls'];
    newImp['include-all'] = {};
    onUpdateImport(cat.importIdx, newImp);
    toast.success(`Included all controls in "${cat.title}"`);
  };

  const handleToggleGroupInclusion = (cat: TreeCatalogItem, groupControlIds: string[], groupTitle: string, targetState: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!onUpdateImport) return;
    const currentImp = profile.imports?.[cat.importIdx] || { href: cat.href };
    const allCatIds = collectCatalogControlIds(cat);
    
    // Calculate current included IDs
    const currentlyIncluded = new Set<string>();
    const countIncluded = (items: { controls: TreeControlItem[]; groups: TreeGroupItem[] }) => {
      const collectInCtrl = (c: TreeControlItem) => {
        if (c.isIncluded) currentlyIncluded.add(c.id.toLowerCase());
        if (c.controls) c.controls.forEach(collectInCtrl);
      };
      items.controls.forEach(collectInCtrl);
      items.groups.forEach(subG => countIncluded(subG));
    };
    countIncluded(cat);

    groupControlIds.forEach(id => {
      if (targetState) {
        currentlyIncluded.add(id.toLowerCase());
      } else {
        currentlyIncluded.delete(id.toLowerCase());
      }
    });

    const newImp = { ...currentImp };
    if (currentlyIncluded.size === allCatIds.length) {
      delete newImp['include-controls'];
      delete newImp['exclude-controls'];
      newImp['include-all'] = {};
    } else {
      delete newImp['include-all'];
      delete newImp['exclude-controls'];
      const withIds = allCatIds.filter(id => currentlyIncluded.has(id.toLowerCase()));
      newImp['include-controls'] = [{ 'with-ids': withIds }];
    }
    onUpdateImport(cat.importIdx, newImp);
    if (targetState) {
      toast.success(`Included all ${groupControlIds.length} controls in "${groupTitle}"`);
    } else {
      toast(`Excluded all ${groupControlIds.length} controls in "${groupTitle}"`, { icon: '⊘' });
    }
  };

  // ─── Drag & Drop Handlers ────────────────────────────────────────────────
  const handleDragStartControl = (e: React.DragEvent, control: TreeControlItem) => {
    (window as any).__isDraggingFromPool = true;
    const payload = JSON.stringify({
      id: control.id,
      title: control.title,
      catalogId: control.catalogId
    });
    e.dataTransfer.setData('draggedType', 'control');
    e.dataTransfer.setData('sourceSurface', 'control-pool');
    e.dataTransfer.setData('application/x-oscal-control', payload);
    e.dataTransfer.setData('text/plain', control.id);
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDragStartGroup = (e: React.DragEvent, group: TreeGroupItem) => {
    (window as any).__isDraggingFromPool = true;
    const groupControlIds = collectGroupControlIds(group);
    const payload = JSON.stringify({
      id: group.id,
      title: group.title,
      catalogId: group.catalogId,
      controlIds: groupControlIds,
      group: group
    });
    e.dataTransfer.setData('sourceSurface', 'control-pool');
    e.dataTransfer.setData('application/x-oscal-group-pool', payload);
    e.dataTransfer.setData('text/plain', group.id);
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDragEnd = () => {
    (window as any).__isDraggingFromPool = false;
  };

  // ─── Render: Single Control Node (Recursive for Sub-controls) ────────────
  const renderControlNode = (ctrl: TreeControlItem, depth = 0, cat?: TreeCatalogItem) => {
    const isSelected = selectedControlIds.has(ctrl.id);
    const hasSubControls = Boolean(ctrl.controls && ctrl.controls.length > 0);
    const isExpanded = hasSubControls ? isNodeExpanded(ctrl.id, true) : false;
    const childIds = hasSubControls ? collectControlIds(ctrl).filter(id => id !== ctrl.id) : undefined;

    return (
      <div key={ctrl.id} style={{ margin: '2px 0' }}>
        <div
          data-testid={`pool-control-card-${ctrl.id}`}
          draggable={isEditing && activeMergeMode === 'custom'}
          onDragStart={(e) => handleDragStartControl(e, ctrl)}
          onDragEnd={handleDragEnd}
          onClick={hasSubControls ? () => toggleNode(ctrl.id) : undefined}
          onMouseOver={(e) => { if (isEditing) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-3)'; }}
          onMouseOut={(e) => { if (isEditing) (e.currentTarget as HTMLElement).style.background = isSelected ? 'var(--color-primary-subtle, rgba(59, 130, 246, 0.12))' : (activeMergeMode === 'custom' && ctrl.isAssigned) ? 'var(--color-surface)' : 'var(--color-surface-2)'; }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            paddingLeft: `${depth * 20 + 24}px`,
            borderRadius: 'var(--radius-sm)',
            background: isSelected
              ? 'var(--color-primary-subtle, rgba(59, 130, 246, 0.12))'
              : (activeMergeMode === 'custom' && ctrl.isAssigned)
                ? 'var(--color-surface)'
                : 'var(--color-surface-2)',
            border: isSelected
              ? '1px solid var(--color-primary, #3b82f6)'
              : (activeMergeMode === 'custom' && ctrl.isAssigned)
                ? '1px dashed var(--color-border-subtle)'
                : '1px solid var(--color-border)',
            fontSize: '12.5px',
            opacity: (activeMergeMode === 'custom' && ctrl.isAssigned) || (!ctrl.isIncluded && activeMergeMode !== 'custom') ? 0.45 : 1,
            transition: 'all var(--transition-fast)',
            cursor: isEditing && activeMergeMode === 'custom' ? 'grab' : (hasSubControls ? 'pointer' : 'default'),
            userSelect: 'none'
          }}
        >
          {/* Left Side: Expand Arrow (if subcontrols) + Checkbox + Drag Handle + ID Badge + Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
            {hasSubControls ? (
              <span
                onClick={(e) => { e.stopPropagation(); toggleNode(ctrl.id); }}
                style={{ fontSize: '11px', color: 'var(--color-text-muted)', width: '12px', textAlign: 'center', cursor: 'pointer' }}
                title={isExpanded ? "Collapse sub-controls" : "Expand sub-controls"}
              >
                {isExpanded ? '▼' : '▶'}
              </span>
            ) : (
              <span style={{ width: '12px' }} />
            )}

            {isEditing && (
              <input
                type="checkbox"
                ref={(el) => {
                  if (el) {
                    el.indeterminate = Boolean(activeMergeMode !== 'custom' && ctrl.isPartial);
                  }
                }}
                checked={activeMergeMode === 'custom' ? isSelected : Boolean(ctrl.isIncluded && !ctrl.isPartial)}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  if (activeMergeMode === 'custom') {
                    handleToggleSelectControl(ctrl.id, e, childIds);
                  } else if (cat) {
                    handleToggleControlInclusion(cat, ctrl.id, childIds, ctrl.isPartial);
                  }
                }}
                style={{ cursor: 'pointer', margin: 0 }}
                title={activeMergeMode === 'custom' ? "Select for batch assignment" : (ctrl.isIncluded ? "Click to exclude from baseline" : "Click to include in baseline")}
              />
            )}

            {isEditing && activeMergeMode === 'custom' && (
              <span style={{ cursor: 'grab', color: 'var(--color-text-muted)', fontSize: '11px' }} title="Drag to target group in sidebar">
                ⋮⋮
              </span>
            )}

            <span
              className="badge"
              style={{
                fontSize: '10px',
                fontFamily: 'monospace',
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: 700,
                background: (activeMergeMode === 'custom' && ctrl.isAssigned) ? 'var(--color-surface-3)' : 'rgba(59, 130, 246, 0.15)',
                color: (activeMergeMode === 'custom' && ctrl.isAssigned) ? 'var(--color-text-muted)' : 'var(--color-primary, #3b82f6)',
                border: `1px solid ${(activeMergeMode === 'custom' && ctrl.isAssigned) ? 'var(--color-border-subtle)' : 'rgba(59, 130, 246, 0.3)'}`,
                flexShrink: 0,
                textDecoration: (!ctrl.isIncluded && activeMergeMode !== 'custom') ? 'line-through' : 'none'
              }}
            >
              {ctrl.id}
            </span>

            <span
              style={{
                fontWeight: 500,
                color: (!ctrl.isIncluded && activeMergeMode !== 'custom')
                  ? 'var(--color-text-muted)'
                  : (activeMergeMode === 'custom' && ctrl.isAssigned ? 'var(--color-text-muted)' : 'var(--color-text)'),
                textDecoration: (!ctrl.isIncluded && activeMergeMode !== 'custom') ? 'line-through' : 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
              title={ctrl.title}
            >
              {ctrl.title}
            </span>

            {hasSubControls && (
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 'normal', flexShrink: 0 }}>
                ({ctrl.controls!.length} sub-controls)
              </span>
            )}
          </div>

          {/* Right Side: Status Badge + Direct Assignment Select */}
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {activeMergeMode === 'custom' || availableCustomGroups.length > 0 ? (
              ctrl.isAssigned ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--color-success, #22c55e)',
                      background: 'rgba(34, 197, 94, 0.12)',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title={`Assigned to ${ctrl.assignedGroupTitle || ctrl.assignedGroupId}`}
                  >
                    <span>✓ Assigned</span>
                    {ctrl.assignedGroupTitle && (
                      <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.85 }}>
                        → {ctrl.assignedGroupTitle}
                      </span>
                    )}
                  </span>

                  {isEditing && (
                    <button
                      type="button"
                      data-testid={`unassign-btn-${ctrl.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveControl(ctrl.id);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-danger, #ef4444)',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px'
                      }}
                      title="Unassign this control"
                    >
                      ✖
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--color-text-muted)',
                      background: 'var(--color-surface-3)',
                      padding: '2px 8px',
                      borderRadius: '10px'
                    }}
                  >
                    Unassigned
                  </span>

                  {isEditing && (
                    <select
                      data-testid={`assign-select-${ctrl.id}`}
                      aria-label={`Assign control ${ctrl.id} to group`}
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          onAssignControl(ctrl.id, e.target.value);
                        }
                      }}
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--color-text)',
                        cursor: 'pointer',
                        maxWidth: '130px'
                      }}
                    >
                      <option value="">➕ Assign to...</option>
                      {availableCustomGroups.map(g => (
                        <option key={g.id} value={g.id}>
                          {g.title || g.id}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {ctrl.isWithdrawn ? (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--color-warning, #f59e0b)',
                      background: 'rgba(245, 158, 11, 0.12)',
                      padding: '2px 8px',
                      borderRadius: '10px'
                    }}
                    title="Control is marked as withdrawn in the original source catalog"
                  >
                    ⛔ Withdrawn in Catalog
                  </span>
                ) : ctrl.isPartial ? (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--color-primary, #3b82f6)',
                      background: 'rgba(59, 130, 246, 0.12)',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title={`${ctrl.activeSubCount} of ${ctrl.totalSubCount} sub-controls active in baseline`}
                  >
                    <span>◐ {ctrl.activeSubCount}/{ctrl.totalSubCount} Active</span>
                  </span>
                ) : ctrl.isIncluded ? (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--color-success, #22c55e)',
                      background: 'rgba(34, 197, 94, 0.12)',
                      padding: '2px 8px',
                      borderRadius: '10px'
                    }}
                  >
                    ✓ {hasSubControls ? `All Active (${ctrl.totalSubCount}/${ctrl.totalSubCount})` : 'Active in Baseline'}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--color-danger, #ef4444)',
                      background: 'rgba(239, 68, 68, 0.12)',
                      padding: '2px 8px',
                      borderRadius: '10px'
                    }}
                    title="Excluded by profile tailoring"
                  >
                    ⊘ Excluded
                  </span>
                )}
                {isEditing && cat && (
                  <button
                    type="button"
                    onClick={() => handleToggleControlInclusion(cat, ctrl.id, childIds, ctrl.isPartial)}
                    style={{
                      fontSize: '10.5px',
                      padding: '1px 6px',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--color-primary, #3b82f6)',
                      cursor: 'pointer'
                    }}
                  >
                    {ctrl.isIncluded && !ctrl.isPartial ? (hasSubControls ? 'Exclude All' : 'Exclude') : (ctrl.isPartial ? 'Include All' : 'Include')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sub-controls recursive rendering */}
        {hasSubControls && isExpanded && (
          <div style={{ marginTop: '2px' }}>
            {ctrl.controls!.map(sub => renderControlNode(sub, depth + 1, cat))}
          </div>
        )}
      </div>
    );
  };

  // ─── Render: Group Node ──────────────────────────────────────────────────
  const renderGroupNode = (g: TreeGroupItem, depth = 0, cat?: TreeCatalogItem) => {
    const isExpanded = isNodeExpanded(g.id, true);
    const groupControlIds = collectGroupControlIds(g);
    const assignedCount = groupControlIds.filter(id => assignedControlIds.has(id.toLowerCase())).length;
    const totalCount = groupControlIds.length;
    const activeGroupCount = countGroupActiveControls(g);
    const allSelected = groupControlIds.length > 0 && groupControlIds.every(id => selectedControlIds.has(id));
    const someSelected = groupControlIds.some(id => selectedControlIds.has(id));

    return (
      <div key={g.id} style={{ margin: '4px 0' }}>
        {/* Group Header Row */}
        <div
          onClick={() => toggleNode(g.id)}
          draggable={isEditing && activeMergeMode === 'custom'}
          onDragStart={(e) => handleDragStartGroup(e, g)}
          onDragEnd={handleDragEnd}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            paddingLeft: `${depth * 20 + 8}px`,
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            userSelect: 'none',
            transition: 'background var(--transition-fast)'
          }}
        >
          {/* Left: Arrow + Folder Icon + Title + Counts */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', width: '12px', textAlign: 'center' }}>
              {isExpanded ? '▼' : '▶'}
            </span>

            <span style={{ fontSize: '14px' }}>📁</span>

            <span style={{ color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {g.title}
            </span>

            <span
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: (activeMergeMode === 'custom' || availableCustomGroups.length > 0)
                  ? 'var(--color-text-muted)'
                  : activeGroupCount === totalCount && totalCount > 0
                    ? 'var(--color-success, #22c55e)'
                    : activeGroupCount > 0
                      ? 'var(--color-primary, #3b82f6)'
                      : 'var(--color-text-muted)',
                background: 'var(--color-surface)',
                padding: '1px 6px',
                borderRadius: '8px',
                border: '1px solid var(--color-border-subtle)',
                flexShrink: 0
              }}
            >
              {activeMergeMode === 'custom' || availableCustomGroups.length > 0
                ? `${assignedCount} / ${totalCount} assigned`
                : `${activeGroupCount} / ${totalCount} active`}
            </span>
          </div>

          {/* Right: Include/Exclude All in Group (Baseline tailoring modes) */}
          {isEditing && activeMergeMode !== 'custom' && cat && onUpdateImport && totalCount > 0 && (
            <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {activeGroupCount > 0 && (
                <button
                  type="button"
                  data-testid={`exclude-all-group-${g.id}`}
                  onClick={(e) => handleToggleGroupInclusion(cat, groupControlIds, g.title, false, e)}
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 600,
                    padding: '1px 7px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-danger, #ef4444)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}
                  title={`Exclude all ${totalCount} controls in "${g.title}" from baseline`}
                >
                  ⊘ Exclude All ({totalCount})
                </button>
              )}
              {activeGroupCount < totalCount && (
                <button
                  type="button"
                  data-testid={`include-all-group-${g.id}`}
                  onClick={(e) => handleToggleGroupInclusion(cat, groupControlIds, g.title, true, e)}
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 600,
                    padding: '1px 7px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-primary, #3b82f6)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}
                  title={`Include all ${totalCount} controls in "${g.title}" in baseline`}
                >
                  ➕ Include All ({totalCount})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Group Children (Subgroups and Direct Controls) */}
        {isExpanded && (
          <div style={{ paddingLeft: '4px' }}>
            {g.groups.map(sub => renderGroupNode(sub, depth + 1, cat))}
            {g.controls.map(c => renderControlNode(c, depth + 1, cat))}
          </div>
        )}
      </div>
    );
  };

  // ─── Render: Catalog Root Node ───────────────────────────────────────────
  const renderCatalogNode = (cat: TreeCatalogItem) => {
    const isExpanded = isNodeExpanded(cat.id, true);
    const allCatalogIds = collectCatalogControlIds(cat);
    const assignedCount = allCatalogIds.filter(id => assignedControlIds.has(id.toLowerCase())).length;
    const totalCount = allCatalogIds.length;
    const allSelected = allCatalogIds.length > 0 && allCatalogIds.every(id => selectedControlIds.has(id));
    const someSelected = allCatalogIds.some(id => selectedControlIds.has(id));

    return (
      <div
        key={`${cat.id}_${cat.importIdx}`}
        style={{
          marginBottom: '14px',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-surface)',
          overflow: 'hidden'
        }}
      >
        {/* Catalog Header Row */}
        <div
          onClick={() => toggleNode(cat.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: 'var(--color-surface-3)',
            borderBottom: isExpanded ? '1px solid var(--color-border)' : 'none',
            cursor: 'pointer',
            fontSize: '13.5px',
            fontWeight: 700,
            userSelect: 'none',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          {/* Left: Arrow + Icon + Title + Version + Counts */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: '1 1 280px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', width: '12px', textAlign: 'center' }}>
              {isExpanded ? '▼' : '▶'}
            </span>

            <span style={{ fontSize: '15px' }}>📖</span>

            <span style={{ color: 'var(--color-text)' }}>
              {cat.title}
            </span>

            {cat.version && (
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                v{cat.version}
              </span>
            )}

            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: activeMergeMode === 'custom'
                  ? (assignedCount === totalCount && totalCount > 0 ? 'var(--color-success, #22c55e)' : 'var(--color-primary, #3b82f6)')
                  : (cat.includedCount === totalCount ? 'var(--color-success, #22c55e)' : 'var(--color-accent, #f59e0b)'),
                background: 'var(--color-surface)',
                padding: '2px 8px',
                borderRadius: '10px',
                border: '1px solid var(--color-border-subtle)',
                flexShrink: 0
              }}
            >
              {activeMergeMode === 'custom' ? `${assignedCount} / ${totalCount} Assigned` : `${cat.includedCount} / ${totalCount} Controls Active`}
            </span>
          </div>

          {/* Right: Actions & Tailoring Controls */}
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Include All / Tailored Toggle in As-Is & Flat modes */}
            {isEditing && onUpdateImport && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {cat.isIncludeAll || cat.includedCount === totalCount ? (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--color-success, #22c55e)',
                      background: 'rgba(34, 197, 94, 0.12)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(34, 197, 94, 0.3)'
                    }}
                    title="All controls from this source are included in profile baseline"
                  >
                    ✓ All Included
                  </span>
                ) : (
                  <button
                    type="button"
                    data-testid={`include-all-btn-${cat.id}`}
                    onClick={() => handleIncludeAllInCatalog(cat)}
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-primary, #3b82f6)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--color-primary, #3b82f6)',
                      cursor: 'pointer'
                    }}
                    title="Include all controls from this catalog in baseline"
                  >
                    ➕ Include All ({totalCount})
                  </button>
                )}

                {/* Compatibility radio inputs for legacy test suites */}
                <input
                  type="radio"
                  data-testid={`selection-mode-include-all-${cat.importIdx}`}
                  style={{ display: 'none' }}
                  checked={cat.isIncludeAll}
                  onChange={() => handleIncludeAllInCatalog(cat)}
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <input
                  type="radio"
                  data-testid={`selection-mode-include-specific-${cat.importIdx}`}
                  style={{ display: 'none' }}
                  checked={!cat.isIncludeAll}
                  onChange={() => {
                    const currentImp = profile.imports?.[cat.importIdx] || { href: cat.href };
                    const newImp = { ...currentImp };
                    delete newImp['include-all'];
                    newImp['include-controls'] = [{ 'with-ids': allCatalogIds }];
                    onUpdateImport(cat.importIdx, newImp);
                  }}
                  tabIndex={-1}
                  aria-hidden="true"
                />
              </div>
            )}

            {/* Custom mode only: Import Full Structure */}
            {isEditing && activeMergeMode === 'custom' && onCopyStructure && (
              <button
                type="button"
                data-testid={`clone-structure-btn-${cat.id}`}
                onClick={() => onCopyStructure(cat.href || cat.id || '', 'all')}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Clone this catalog's group hierarchy into your profile as custom groups"
              >
                📥 Import Full Structure
              </button>
            )}

            {isEditing && availableCustomGroups.length > 0 && totalCount > 0 && (
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    onAssignMultipleControls(allCatalogIds, e.target.value);
                    const targetGroup = availableCustomGroups.find(grp => grp.id === e.target.value);
                    toast.success(`Assigned all ${totalCount} controls in "${cat.title}" to "${targetGroup?.title || e.target.value}"`);
                    e.target.value = '';
                  }
                }}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-primary, #3b82f6)',
                  cursor: 'pointer'
                }}
                title={`Assign all ${totalCount} controls in this catalog`}
              >
                <option value="" disabled>➕ Assign All ({totalCount}) to...</option>
                {availableCustomGroups.map(grp => (
                  <option key={grp.id} value={grp.id}>
                    {'\u00A0'.repeat(grp.depth * 2)}{grp.title}
                  </option>
                ))}
              </select>
            )}

            {isEditing && onRemoveImport && (
              <button
                type="button"
                data-testid={`remove-source-btn-${cat.id}`}
                onClick={() => onRemoveImport(cat.importIdx)}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-danger, #ef4444)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-danger, #ef4444)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Remove this import source from profile"
              >
                🗑️ Remove
              </button>
            )}
          </div>
        </div>

        {/* Catalog Body (Groups & Top-Level Controls) */}
        {isExpanded && (
          <div style={{ padding: '10px 14px' }}>
            {cat.groups.length === 0 && cat.controls.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12.5px', fontStyle: 'italic' }}>
                No controls found in the imported sources (no groups or controls defined).
              </div>
            ) : (
              <>
                {cat.groups.map(g => renderGroupNode(g, 0, cat))}
                {cat.controls.map(c => renderControlNode(c, 0, cat))}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="source-catalog-tree-workbench"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* ─── Compact Workbench Header (Search, Filters & Stats) ───────────── */}
      <div
        style={{
          marginBottom: '12px',
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        {/* Row 1: Title & Controls Stats */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '13.5px', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🌳 Source Catalog Hierarchy & Control Pool (Drag & Drop)
          </h3>

          <div
            data-testid="pool-stats-strip"
            style={{
              display: 'flex',
              gap: '12px',
              fontSize: '12px',
              color: 'var(--color-text-muted)',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}
          >
            {activeMergeMode === 'custom' || availableCustomGroups.length > 0 ? (
              <>
                <span>Total: <strong style={{ color: 'var(--color-text)' }}>{treeStats.total}</strong></span>
                <span>Assigned: <strong style={{ color: 'var(--color-success, #22c55e)' }}>{treeStats.assigned}</strong></span>
                <span>Unassigned: <strong style={{ color: 'var(--color-accent, #f59e0b)' }}>{treeStats.unassigned}</strong></span>
              </>
            ) : (
              <>
                <span>Total: <strong style={{ color: 'var(--color-text)' }}>{treeStats.total}</strong></span>
                <span>Active: <strong style={{ color: 'var(--color-success, #22c55e)' }}>{treeStats.included}</strong></span>
                {treeStats.excluded > 0 ? (
                  <span>Excluded: <strong style={{ color: 'var(--color-danger, #ef4444)' }}>{treeStats.excluded}</strong></span>
                ) : (
                  <span style={{ color: 'var(--color-text-subtle)' }}>(All active)</span>
                )}
              </>
            )}

            {isEditing && activeMergeMode === 'custom' && (
              <div style={{ display: 'flex', gap: '8px', marginLeft: '4px' }}>
                <button
                  type="button"
                  onClick={handleSelectAllVisible}
                  style={{
                    fontSize: '11px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-primary, #3b82f6)',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Select All Visible
                </button>
                {selectedControlIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    style={{
                      fontSize: '11px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    Clear Selection ({selectedControlIds.size})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Search Bar with Integrated Small Filter Popover */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, position: 'relative', gap: '6px' }}>
            <input
              type="text"
              data-testid="pool-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pool controls by ID or title, or group name..."
              className="form-input"
              style={{ flex: 1, height: '28px', fontSize: '12px', minWidth: 0 }}
            />
            <TreeFilterPopover
              filter={visibilityFilter}
              onChange={setVisibilityFilter}
              testId="pool-filter"
              align="right"
            />
          </div>

          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                height: '28px',
                padding: '2px 8px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                fontSize: '11px'
              }}
              title="Clear search"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ─── Main Scrollable Tree Surface ───────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingRight: '4px',
          paddingBottom: selectedControlIds.size > 0 ? '60px' : '10px'
        }}
      >
        {filteredCatalogs.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
            {searchQuery
              ? 'No controls match your search.'
              : 'No controls found in the imported sources.'}
          </div>
        ) : (
          filteredCatalogs.map(renderCatalogNode)
        )}
      </div>

      {/* ─── Floating Batch Assignment Action Bar ──────────────────────── */}
      {isEditing && (activeMergeMode === 'custom' || availableCustomGroups.length > 0) && selectedControlIds.size > 0 && (
        <div
          data-testid="source-tree-batch-bar"
          data-test-batch-bar="pool-batch-action-bar"
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '20px',
            right: '20px',
            background: 'var(--color-surface-3)',
            border: '1px solid var(--color-primary, #3b82f6)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10,
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
              📦 {selectedControlIds.size} control{selectedControlIds.size > 1 ? 's' : ''} selected
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <select
              data-testid="batch-assign-select"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  onAssignMultipleControls(Array.from(selectedControlIds), e.target.value);
                  const targetGroup = e.target.value === '__root__' ? { title: 'Top-Level' } : availableCustomGroups.find(grp => grp.id === e.target.value);
                  toast.success(`Assigned ${selectedControlIds.size} controls to "${targetGroup?.title || e.target.value}"`);
                  setSelectedControlIds(new Set());
                }
              }}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-primary, #3b82f6)',
                background: 'var(--color-primary, #3b82f6)',
                color: '#ffffff',
                cursor: 'pointer'
              }}
            >
              <option value="" disabled>Assign selected to...</option>
              <option value="__root__" style={{ background: 'var(--color-surface)', color: 'var(--color-text)', fontWeight: 600 }}>
                🌐 Top-Level / Root (No Group)
              </option>
              {availableCustomGroups.map(g => (
                <option key={g.id} value={g.id} style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>
                  {'\u00A0'.repeat(g.depth * 2)}📁 {g.title}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleClearSelection}
              style={{
                fontSize: '12px',
                padding: '4px 10px',
                background: 'transparent',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-muted)',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
