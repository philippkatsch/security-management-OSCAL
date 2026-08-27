import React, { useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useControlTree, TreeVisibilityFilter } from '@hooks/useControlTree';
import { ControlTree } from '@components/shared/control-tree';
import sharedStyles from '@components/shared/SharedComponents.module.css';
import type { ModifyConflicts } from '@hooks/useProfileResolution';
import {
  addCustomGroup,
  renameCustomGroup,
  deleteCustomGroup,
  moveCustomGroup,
  assignControlToCustomGroup,
  assignMultipleControlsToCustomGroup,
  removeControlFromCustomGroup,
  removeMultipleControlsFromCustomGroup,
  importCustomGroupBranch,
  gatherAllAssignedControlIds
} from '@lib/document-actions/profile-actions';

export function ProfileSidebar({
  resolvedCatalog = {},
  profile = {},
  conflicts = null as ModifyConflicts | null,
  selectedControlId = null,
  selectedGroupId = null,
  activeSidebarView = 'overview',
  onSelectControl,
  onSelectGroup,
  onSelectOverview,
  onSelectMetadata,
  onSelectProperties,
  onSelectParameters,
  onSelectBackMatter,
  onSelectImports,
  searchQuery = '',
  onSearchChange,
  isEditing = false,
  onExcludeFromBaseline,
  onIncludeInBaseline,
  dispatch,
  onChange,
  onAddCustomGroup,
  onRenameCustomGroup,
  onDeleteCustomGroup,
  onMoveNode,
  expandedGroups,
  onToggleGroup,
  initialVisibilityFilter
}: any) {
  // Compute annotation sets for tree nodes (US 2.33)
  const { alteredControlIds, orphanedControlIds } = useMemo(() => {
    const altered = new Set<string>();
    const orphaned = new Set<string>();

    // Collect all controls that have modify.alters entries
    const alters = (profile as any)?.modify?.alters || [];
    for (const alter of alters) {
      const cid = alter['control-id'];
      if (cid) altered.add(cid.toLowerCase());
    }

    // Mark orphaned alters from conflict detection
    if (conflicts?.orphaned_alters) {
      for (const o of conflicts.orphaned_alters) {
        orphaned.add(o['control-id'].toLowerCase());
      }
    }

    return { alteredControlIds: altered, orphanedControlIds: orphaned };
  }, [profile, conflicts]);
  const findNodeType = React.useCallback((id: string) => {
    const isGrp = (items: any[]): boolean => {
      if (!items) return false;
      for (const item of items) {
        if (item.id === id) return true;
        if (item.groups && isGrp(item.groups)) return true;
      }
      return false;
    };
    return isGrp(resolvedCatalog.groups || []) ? 'group' : 'control';
  }, [resolvedCatalog]);

  const isCustomMerge = Boolean((profile as any)?.merge?.custom);
  const isFlatMerge = Boolean((profile as any)?.merge?.flat);

  // Collect excluded control and group IDs from resolution result
  const excludedControlIds = useMemo(() => {
    const ids = new Set<string>();
    for (const id of resolvedCatalog.excluded_control_ids || []) {
      if (id) ids.add(id.toLowerCase());
    }

    // Also mark groups as excluded if they contain zero active controls across their subtree
    if (resolvedCatalog.all_groups && resolvedCatalog.all_groups.length > 0) {
      const activeControlIds = new Set<string>();
      const collectActive = (items: any[]) => {
        if (!items) return;
        for (const item of items) {
          if (item.id) activeControlIds.add(item.id.toLowerCase());
          if (item.controls) collectActive(item.controls);
          if (item.groups) collectActive(item.groups);
        }
      };
      collectActive(resolvedCatalog.controls || []);
      collectActive(resolvedCatalog.groups || []);

      const checkGroupExcluded = (grp: any): boolean => {
        let hasActive = false;
        const checkItem = (item: any) => {
          if (item.id && activeControlIds.has(item.id.toLowerCase())) {
            hasActive = true;
          }
          if (item.controls) item.controls.forEach(checkItem);
          if (item.groups) item.groups.forEach(checkItem);
        };
        checkItem(grp);

        if (!hasActive && grp.id) {
          ids.add(grp.id.toLowerCase());
          return true;
        }
        return false;
      };

      const traverseAll = (groupsList: any[]) => {
        for (const g of groupsList) {
          checkGroupExcluded(g);
          if (g.groups) traverseAll(g.groups);
        }
      };
      traverseAll(resolvedCatalog.all_groups);
    }

    if (isCustomMerge) {
      const assignedIds = gatherAllAssignedControlIds((profile as any)?.merge?.custom);
      for (const aid of assignedIds) {
        ids.delete(aid.toLowerCase());
      }
      const collectCustomGroupIds = (gList?: any[]) => {
        if (!gList) return;
        for (const g of gList) {
          if (g.id) ids.delete(g.id.toLowerCase());
          if (g.groups) collectCustomGroupIds(g.groups);
        }
      };
      collectCustomGroupIds((profile as any)?.merge?.custom?.groups);
    }

    return ids;
  }, [resolvedCatalog.excluded_control_ids, resolvedCatalog.all_groups, resolvedCatalog.groups, resolvedCatalog.controls, isCustomMerge, (profile as any)?.merge?.custom]);

  const allImportedControls = useMemo(() => {
    const list: any[] = [];
    const seenIds = new Set<string>();

    const addControl = (c: any) => {
      if (!c?.id) return;
      const idLower = c.id.toLowerCase();
      if (seenIds.has(idLower)) return;
      seenIds.add(idLower);
      list.push(c);
    };

    const traverseControls = (controls?: any[]) => {
      if (!controls) return;
      for (const c of controls) {
        addControl(c);
        if (c.controls) traverseControls(c.controls);
      }
    };

    const traverseGroups = (groups?: any[]) => {
      if (!groups) return;
      for (const g of groups) {
        if (g.controls) traverseControls(g.controls);
        if (g.groups) traverseGroups(g.groups);
      }
    };

    const poolControls = resolvedCatalog?.all_controls || resolvedCatalog?.controls || [];
    const poolGroups = resolvedCatalog?.all_groups || resolvedCatalog?.groups || [];

    traverseControls(poolControls);
    traverseGroups(poolGroups);

    return list;
  }, [resolvedCatalog]);

  const unassignedControls = useMemo(() => {
    if (!isCustomMerge) return [];
    const assignedIds = gatherAllAssignedControlIds((profile as any)?.merge?.custom);

    // Also mark controls already placed inside resolved custom groups as assigned
    const collectFromGroups = (groupsList?: any[]) => {
      if (!groupsList) return;
      for (const g of groupsList) {
        if (g.id === '__unassigned__') continue;
        if (g.controls) {
          for (const c of g.controls) {
            if (c.id) assignedIds.add(c.id.toLowerCase());
            if (c.controls) {
              for (const sub of c.controls) {
                if (sub.id) assignedIds.add(sub.id.toLowerCase());
              }
            }
          }
        }
        if (g.groups) {
          collectFromGroups(g.groups);
        }
      }
    };

    if (resolvedCatalog?.groups) {
      collectFromGroups(resolvedCatalog.groups);
    }

    return allImportedControls.filter((ctrl: any) => !assignedIds.has(ctrl.id.toLowerCase()));
  }, [isCustomMerge, (profile as any)?.merge?.custom, allImportedControls, resolvedCatalog?.groups]);

  const handleAddCustomGroup = (parentGroupId: string | null = null) => {
    if (!isEditing) return;
    if (onAddCustomGroup) {
      onAddCustomGroup(parentGroupId);
    } else if (dispatch) {
      const title = parentGroupId ? 'New Sub-Group' : 'New Custom Group';
      dispatch(addCustomGroup({ title, parentGroupId: parentGroupId || null }));
    }
  };

  const handleRenameGroup = (groupId: string, newTitle: string, newId?: string) => {
    if (!isEditing) return;
    if (onRenameCustomGroup) {
      onRenameCustomGroup(groupId, newTitle, newId);
    } else if (dispatch) {
      dispatch(renameCustomGroup({ groupId, title: newTitle, newId }));
    }
  };

  const handleDeleteNode = (nodeId: string, nodeType: 'group' | 'control') => {
    if (!isEditing || nodeId === '__unassigned__') return;
    if (nodeType === 'group') {
      if (onDeleteCustomGroup) {
        onDeleteCustomGroup(nodeId);
      } else if (dispatch) {
        dispatch(deleteCustomGroup({ groupId: nodeId }));
      }
    }
  };

  const handleMoveNode = (nodeId: string, targetParentId: string | null, targetIndex?: number) => {
    if (!isEditing || nodeId === '__unassigned__') return;
    if (onMoveNode) {
      onMoveNode(nodeId, targetParentId, targetIndex);
    } else if (dispatch) {
      if (nodeId.startsWith('{') && nodeId.includes('"catalog-group-structure"')) {
        try {
          const parsed = JSON.parse(nodeId);
          if (parsed.type === 'catalog-group-structure' && parsed.group) {
            dispatch(importCustomGroupBranch({
              group: parsed.group,
              targetParentId: (targetParentId === '__unassigned__' ? null : targetParentId),
              targetIndex
            }));
            toast.success(`Imported group "${parsed.group.title || parsed.group.id}" into Custom Groups.`);
            return;
          }
        } catch (err) {
          console.error('Failed to import group branch', err);
        }
      }
      if (nodeId.startsWith('{') && nodeId.includes('"batch-controls"')) {
        try {
          const parsed = JSON.parse(nodeId);
          if (parsed.type === 'batch-controls' && Array.isArray(parsed.controlIds)) {
            if (targetParentId === '__unassigned__') {
              dispatch(removeMultipleControlsFromCustomGroup({ controlIds: parsed.controlIds }));
            } else {
              dispatch(assignMultipleControlsToCustomGroup({ controlIds: parsed.controlIds, targetGroupId: targetParentId }));
            }
            return;
          }
        } catch {
          // fallback
        }
      }
      const type = findNodeType(nodeId);
      if (type === 'group') {
        if (targetParentId === '__unassigned__') return;
        dispatch(moveCustomGroup({ sourceGroupId: nodeId, targetGroupId: targetParentId, targetIndex }));
      } else {
        if (targetParentId === '__unassigned__') {
          dispatch(removeControlFromCustomGroup({ controlId: nodeId }));
        } else {
          dispatch(assignControlToCustomGroup({ controlId: nodeId, targetGroupId: targetParentId, targetIndex }));
        }
      }
    }
  };

  const handleUnassignControl = (controlId: string, sourceGroupId?: string | null) => {
    if (!isEditing || !controlId) return;
    if (dispatch) {
      dispatch(removeControlFromCustomGroup({ controlId, sourceGroupId: sourceGroupId || null }));
    }
  };

  const [visibilityFilter, setVisibilityFilter] = useState<TreeVisibilityFilter>(
    initialVisibilityFilter || {
      showActive: true,
      showExcluded: true,
      showWithdrawn: false,
      showUnassigned: false
    }
  );

  React.useEffect(() => {
    if (initialVisibilityFilter) {
      setVisibilityFilter(initialVisibilityFilter);
    }
  }, [initialVisibilityFilter]);

  const treeGroups = useMemo(() => {
    if (isFlatMerge) {
      return [];
    }
    if (isCustomMerge) {
      let baseGroups = (resolvedCatalog?.groups && resolvedCatalog.groups.length > 0)
        ? resolvedCatalog.groups
        : ((profile as any)?.merge?.custom?.groups || []);

      // If baseGroups have empty controls, populate from insert-controls + allImportedControls
      if (allImportedControls.length > 0) {
        const populateControls = (gList: any[]): any[] => {
          return gList.map(g => {
            const newG = { ...g };
            if (newG.groups) {
              newG.groups = populateControls(newG.groups);
            }
            if ((!newG.controls || newG.controls.length === 0) && newG['insert-controls']) {
              const gIds = new Set<string>();
              for (const ic of newG['insert-controls']) {
                for (const inc of ic['include-controls'] || []) {
                  for (const wid of inc['with-ids'] || []) {
                    if (wid) gIds.add(wid.toLowerCase());
                  }
                }
              }
              if (gIds.size > 0) {
                newG.controls = allImportedControls.filter(c => gIds.has(c.id.toLowerCase()));
              }
            }
            return newG;
          });
        };
        baseGroups = populateControls(baseGroups);
      }

      if (isEditing && unassignedControls.length > 0 && visibilityFilter.showUnassigned) {
        const unassignedNode = {
          id: '__unassigned__',
          title: `📥 Unassigned Controls (${unassignedControls.length})`,
          class: 'virtual-unassigned',
          props: [{ name: 'sort-id', value: '\uffff_unassigned' }],
          controls: unassignedControls,
          groups: []
        };
        return [...baseGroups, unassignedNode];
      }

      return baseGroups;
    }
    return (isEditing && resolvedCatalog.all_groups?.length) ? resolvedCatalog.all_groups : (resolvedCatalog.groups || []);
  }, [isCustomMerge, isFlatMerge, isEditing, resolvedCatalog?.all_groups, resolvedCatalog?.groups, (profile as any)?.merge?.custom?.groups, unassignedControls, visibilityFilter.showUnassigned, allImportedControls]);


  const treeControls = useMemo(() => {
    if (isFlatMerge) {
      return isEditing ? allImportedControls : (resolvedCatalog?.controls || []);
    }
    if (isCustomMerge) {
      const customInsert = (profile as any)?.merge?.custom?.['insert-controls'] || [];
      const rootControlIds = new Set<string>();
      for (const ic of customInsert) {
        for (const inc of ic['include-controls'] || []) {
          for (const wid of inc['with-ids'] || []) {
            if (wid) rootControlIds.add(wid.toLowerCase());
          }
        }
      }

      if (rootControlIds.size > 0 && allImportedControls.length > 0) {
        return allImportedControls.filter(c => rootControlIds.has(c.id.toLowerCase()));
      }
      return resolvedCatalog?.controls || [];
    }
    return resolvedCatalog?.controls || [];
  }, [isFlatMerge, isCustomMerge, isEditing, allImportedControls, resolvedCatalog?.controls, (profile as any)?.merge?.custom?.['insert-controls']]);

  const tree = useControlTree({
    groups: treeGroups,
    controls: treeControls,
    initialSelectedId: selectedControlId || selectedGroupId || null,
    visibilityFilter,
    onVisibilityFilterChange: setVisibilityFilter,
    onSelect: (id) => {
      if (!id) return;
      const type = findNodeType(id);
      if (type === 'group') {
        onSelectGroup(id);
      } else {
        onSelectControl(id);
      }
    },
    // Profile mode: NEVER show withdrawn controls from the source catalog.
    // Withdrawn is a catalog-level concept (NIST retired the control).
    // Profiles cannot un-withdraw — they can only exclude/include from baseline.
    showWithdrawn: false,
    excludedControlIds
  });
  
  // Sync external search query if needed (or just use tree's)
  React.useEffect(() => {
     if (searchQuery !== tree.searchQuery) {
         tree.setSearchQuery(searchQuery);
     }
  }, [searchQuery]);

  React.useEffect(() => {
     if (tree.searchQuery !== searchQuery && onSearchChange) {
         onSearchChange(tree.searchQuery);
     }
  }, [tree.searchQuery]);
  
  // Sync selected node
  const activeId = selectedControlId || selectedGroupId;
  React.useEffect(() => {
     if (activeId !== tree.selectedId) {
         tree.select(activeId);
     }
  }, [activeId]);
  
  const handleSelectNode = (id: string | null) => {
    tree.select(id);
    if (!id) return;
    const node = tree.flatList.find(n => n.id === id);
    if (node?.type === 'group') {
      onSelectGroup(id);
    } else {
      onSelectControl(id);
    }
  };

  const headerContent = (
    <div style={{ padding: '12px 12px 0 12px' }}>
      <div
        data-testid="profile-sidebar-imports"
        onClick={() => { tree.select(null); onSelectImports(); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'imports') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>📥</span>
          <span>Imports</span>
        </div>
      </div>
      <div
        data-testid="profile-sidebar-overview"
        onClick={() => { tree.select(null); onSelectOverview(); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'overview') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>🏠</span>
          <span>Overview</span>
        </div>
      </div>
      <div
        data-testid="profile-sidebar-parameters"
        onClick={() => { tree.select(null); onSelectParameters(); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'parameters') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>⚙️</span>
          <span>Parameters</span>
        </div>
      </div>
      <div
        data-testid="profile-sidebar-metadata"
        onClick={() => { tree.select(null); onSelectMetadata(); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'metadata') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>ℹ️</span>
          <span>Metadata</span>
        </div>
      </div>
      <div
        data-testid="profile-sidebar-properties"
        onClick={() => { tree.select(null); onSelectProperties(); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'properties') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>🏷️</span>
          <span>Properties</span>
        </div>
      </div>
      <div
        data-testid="profile-sidebar-backmatter"
        onClick={() => { tree.select(null); onSelectBackMatter(); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'back-matter') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>📖</span>
          <span>Back Matter</span>
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--color-border-subtle)', margin: '8px 0' }} />
    </div>
  );

  return (
    <ControlTree 
      tree={tree} 
      headerContent={headerContent}
      isEditing={isEditing}
      onAddGroup={isCustomMerge && isEditing ? handleAddCustomGroup : undefined}
      addGroupLabel="Add Custom Group"
      onRenameGroup={isCustomMerge && isEditing ? handleRenameGroup : undefined}
      onDeleteNode={isCustomMerge && isEditing ? handleDeleteNode : undefined}
      onMoveNode={isCustomMerge && isEditing ? handleMoveNode : undefined}
      onUnassignControl={isCustomMerge && isEditing ? handleUnassignControl : undefined}
      onExcludeFromBaseline={onExcludeFromBaseline}
      onIncludeInBaseline={onIncludeInBaseline}
      excludedControlIds={excludedControlIds}
      showUnassignedOption={isCustomMerge && isEditing}
      renderNodeExtra={(node) => {
        const nodeId = node.id?.toLowerCase();
        if (!nodeId) return null;
        const isEx = excludedControlIds.has(nodeId);
        const isOrphan = orphanedControlIds.has(nodeId);
        const isAlter = alteredControlIds.has(nodeId);

        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            {isOrphan && (
              <span title="Orphaned modification (target not imported)" style={{ fontSize: '11px', color: '#f97316' }}>🔶</span>
            )}
            {!isOrphan && isAlter && (
              <span title="Modified by alter" style={{ fontSize: '10px', color: '#f59e0b' }}>●</span>
            )}
            {isEx && (
              <span title="Excluded from profile" style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>[excluded]</span>
            )}
          </span>
        );
      }}
    />
  );
}
