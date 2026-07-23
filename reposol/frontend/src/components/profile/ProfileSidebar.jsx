import React, { useState, useEffect, useRef, useCallback } from 'react';

export function ProfileSidebar({
  resolvedCatalog = {},
  profile = {},
  catalogCache = null,
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
  expandedGroups = {},
  onToggleGroup,
  onChange
}) {
  const groups = resolvedCatalog.groups || [];
  const controls = resolvedCatalog.controls || [];
  const isCustomMerge = profile?.merge?.custom !== undefined;
  const canEdit = isEditing && isCustomMerge;

  // ── Context menu state ──
  const [contextMenu, setContextMenu] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState(null);

  // ── Drag state ──
  const dragRef = useRef(null);         // { id, type, startY, started }
  const ghostRef = useRef(null);        // floating DOM element
  const sidebarRef = useRef(null);      // the scrollable sidebar container
  const [dragId, setDragId] = useState(null);         // id of item being dragged
  const [dropIndicator, setDropIndicator] = useState(null); // { id, position: 'before'|'after'|'inside' }

  // Close context menu on outside click
  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  // Auto-scroll selected element into view
  useEffect(() => {
    if (!selectedControlId) return;
    const timer = setTimeout(() => {
      if (sidebarRef.current) {
        const selectedEl = sidebarRef.current.querySelector('.sidebar-item-selected');
        if (selectedEl) {
          selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedControlId]);

  // ── Collect flat list of rendered items for drop-target resolution ──
  const getDropTargets = useCallback(() => {
    if (!sidebarRef.current) return [];
    return Array.from(sidebarRef.current.querySelectorAll('[data-dnd-id]'));
  }, []);

  // Helper to find if an item is a descendant of parentId in the resolved catalog
  const findNodeById = (container, id) => {
    if (container.id === id) return container;
    for (const g of (container.groups || [])) {
      const found = findNodeById(g, id);
      if (found) return found;
    }
    for (const c of (container.controls || [])) {
      const found = findNodeById(c, id);
      if (found) return found;
    }
    return null;
  };

  const isDescendantOf = (parentId, childId) => {
    const parentNode = findNodeById(resolvedCatalog, parentId);
    if (!parentNode) return false;
    if (parentNode.id === childId) return true;
    return !!findNodeById(parentNode, childId);
  };

  // ── Pointer DnD: resolve which item the cursor is over and where ──
  const resolveDropTarget = useCallback((clientY, sidebarRect, scrollTop, initialRects) => {
    if (!initialRects || initialRects.length === 0) return null;
    
    const drag = dragRef.current;
    if (!drag) return null;

    const N = initialRects.length;

    const getNextValidTarget = (startIndex) => {
      for (let j = startIndex; j < N; j++) {
        const nextRect = initialRects[j];
        if (nextRect.id === drag.id || isDescendantOf(drag.id, nextRect.id)) {
          continue;
        }
        return { id: nextRect.id, type: nextRect.type, position: 'before' };
      }
      return null;
    };

    // Calculate vertical cursor offset relative to the scrollable content container
    const y = clientY - sidebarRect.top + scrollTop;

    // 1. Above first element
    if (y < initialRects[0].top) {
      const first = initialRects[0];
      if (first.id === drag.id || isDescendantOf(drag.id, first.id)) return null;
      return { id: first.id, type: first.type, position: 'before' };
    }

    // 2. Below last element
    if (y > initialRects[N - 1].bottom) {
      return { id: '__root__', type: 'root', position: 'root' };
    }

    // 3. Contiguous midpoint partition of static rects (prevents layout-shift dead zones)
    const midpoints = [initialRects[0].top];
    for (let k = 1; k < N; k++) {
      midpoints.push((initialRects[k - 1].bottom + initialRects[k].top) / 2);
    }
    midpoints.push(initialRects[N - 1].bottom);

    for (let i = 0; i < N; i++) {
      const low = midpoints[i];
      const high = midpoints[i + 1];
      if (y >= low && y <= high) {
        const item = initialRects[i];
        const id = item.id;
        const type = item.type;
        const relY = y - item.top;
        const height = item.height;

        // Can't drop on self or descendants
        if (id === drag.id) return null;
        if (isDescendantOf(drag.id, id)) return null;

        if (type === 'trash') {
          return { id, type, position: 'inside' };
        }

        if (type === 'group') {
          if (drag.type === 'group' && type === 'control') return null;

          if (relY < height * 0.25) {
            return { id, type, position: 'before' };
          } else if (relY > height * 0.75) {
            const nextVal = getNextValidTarget(i + 1);
            if (nextVal) return nextVal;
            return { id, type, position: 'after' };
          } else {
            return { id, type, position: 'inside' };
          }
        } else {
          // Controls: top half = before, bottom half = before-next (or after last)
          if (drag.type === 'group' && type === 'control') return null;

          if (relY < height * 0.5) {
            return { id, type, position: 'before' };
          } else {
            const nextVal = getNextValidTarget(i + 1);
            if (nextVal) return nextVal;
            return { id, type, position: 'after' };
          }
        }
      }
    }

    return null;
  }, [resolvedCatalog]);

  // ── Pointer handlers ──
  const DRAG_THRESHOLD = 5; // px before drag actually starts

  const handlePointerDown = useCallback((e, id, type, label) => {
    if (e.button !== 0) return; // left-click only
    e.preventDefault();
    e.stopPropagation();

    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const sidebarRect = sidebar.getBoundingClientRect();
    const targets = getDropTargets();
    const initialRects = targets.map(t => {
      const rect = t.getBoundingClientRect();
      return {
        id: t.dataset.dndId,
        type: t.dataset.dndType,
        top: rect.top - sidebarRect.top + sidebar.scrollTop,
        bottom: rect.bottom - sidebarRect.top + sidebar.scrollTop,
        height: rect.height
      };
    });

    dragRef.current = {
      id,
      type,
      label,
      startY: e.clientY,
      startX: e.clientX,
      started: false,
      sidebarRect,
      initialRects
    };

    const handlePointerMove = (moveEv) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dy = Math.abs(moveEv.clientY - drag.startY);
      const dx = Math.abs(moveEv.clientX - drag.startX);

      if (!drag.started) {
        if (dy < DRAG_THRESHOLD && dx < DRAG_THRESHOLD) return;
        drag.started = true;
        setDragId(drag.id);

        const ghost = document.createElement('div');
        ghost.className = 'dnd-ghost';
        ghost.textContent = drag.label;
        document.body.appendChild(ghost);
        ghostRef.current = ghost;
      }

      if (ghostRef.current) {
        ghostRef.current.style.top = `${moveEv.clientY + 18}px`;
        ghostRef.current.style.left = `${moveEv.clientX + 24}px`;
      }

      const target = resolveDropTarget(moveEv.clientY, drag.sidebarRect, sidebar.scrollTop, drag.initialRects);
      setDropIndicator(target);
    };

    const handlePointerUpFinal = (upEv) => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUpFinal);

      const drag = dragRef.current;
      if (!drag || !drag.started) {
        dragRef.current = null;
        if (ghostRef.current) { ghostRef.current.remove(); ghostRef.current = null; }
        setDragId(null);
        setDropIndicator(null);
        return;
      }

      const target = resolveDropTarget(upEv.clientY, drag.sidebarRect, sidebar.scrollTop, drag.initialRects);

      dragRef.current = null;
      if (ghostRef.current) { ghostRef.current.remove(); ghostRef.current = null; }
      setDragId(null);
      setDropIndicator(null);

      if (!target) return;

      handleMoveItem(drag.id, drag.type, target.id, target.type, target.position);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUpFinal);
  }, [resolveDropTarget, getDropTargets]);

  // ── Profile custom-merge state mutation helpers ──
  const updateCustomGroups = (updatedGroups, updatedInsertControls) => {
    if (!onChange) return;
    const mergeCustom = { ...(profile.merge?.custom || {}), groups: updatedGroups };
    if (updatedInsertControls !== undefined) {
      mergeCustom['insert-controls'] = updatedInsertControls;
    }
    onChange({ ...profile, merge: { ...profile.merge, custom: mergeCustom } });
  };

  // Helper: recursively find and remove a custom group by ID
  const findAndRemoveGroup = (groupsList, groupId) => {
    let foundGroup = null;
    const clean = groupsList.filter(g => {
      if (g.id === groupId) {
        foundGroup = g;
        return false;
      }
      return true;
    }).map(g => {
      if (g.groups) {
        const subResult = findAndRemoveGroup(g.groups, groupId);
        if (subResult.item) foundGroup = subResult.item;
        return { ...g, groups: subResult.list };
      }
      return g;
    });
    return { list: clean, item: foundGroup };
  };

  // Helper: insert group at target location
  const insertGroupAtTarget = (groupsList, draggedGroup, targetId, position) => {
    if (position === 'inside') {
      return groupsList.map(g => {
        if (g.id === targetId) {
          return { ...g, groups: g.groups ? [...g.groups, draggedGroup] : [draggedGroup] };
        }
        if (g.groups) {
          return { ...g, groups: insertGroupAtTarget(g.groups, draggedGroup, targetId, position) };
        }
        return g;
      });
    }

    // position === 'before' or 'after'
    const idx = groupsList.findIndex(g => g.id === targetId);
    if (idx !== -1) {
      const nextList = [...groupsList];
      const insertIdx = position === 'before' ? idx : idx + 1;
      nextList.splice(insertIdx, 0, draggedGroup);
      return nextList;
    }

    return groupsList.map(g => {
      if (g.groups) {
        return { ...g, groups: insertGroupAtTarget(g.groups, draggedGroup, targetId, position) };
      }
      return g;
    });
  };

  // Helper: recursively remove a control from groups and root insert-controls
  const removeControlFromCustom = (groupsList, controlId) => {
    return groupsList.map(g => {
      let icArray = Array.isArray(g['insert-controls']) ? g['insert-controls'] : (g['insert-controls'] ? [g['insert-controls']] : []);
      icArray = icArray.map(ic => {
        if (ic['include-controls']) {
          return { ...ic, 'include-controls': ic['include-controls'].map(inc => {
            if (inc['with-ids']) return { ...inc, 'with-ids': inc['with-ids'].filter(id => id.toLowerCase() !== controlId.toLowerCase()) };
            return inc;
          })};
        }
        return ic;
      });
      return { ...g, 'insert-controls': icArray, groups: g.groups ? removeControlFromCustom(g.groups, controlId) : undefined };
    });
  };

  const removeControlFromRoot = (rootInsertControls, controlId) => {
    const list = Array.isArray(rootInsertControls) ? rootInsertControls : (rootInsertControls ? [rootInsertControls] : []);
    return list.map(ic => {
      if (ic['include-controls']) {
        return { ...ic, 'include-controls': ic['include-controls'].map(inc => {
          if (inc['with-ids']) return { ...inc, 'with-ids': inc['with-ids'].filter(id => id.toLowerCase() !== controlId.toLowerCase()) };
          return inc;
        })};
      }
      return ic;
    });
  };

  // Helper: append a control to target group's insert-controls
  const appendControlToGroup = (groupsList, controlId, targetGroupId) => {
    return groupsList.map(g => {
      if (g.id === targetGroupId) {
        let icArray = Array.isArray(g['insert-controls']) ? g['insert-controls'] : (g['insert-controls'] ? [g['insert-controls']] : []);
        if (icArray.length === 0) icArray = [{ 'include-controls': [{ 'with-ids': [] }], order: 'keep' }];
        let firstIc = { ...icArray[0] };
        if (firstIc['include-all']) {
          delete firstIc['include-all'];
          firstIc['include-controls'] = [{ 'with-ids': [controlId] }];
        } else {
          let incArray = firstIc['include-controls'] ? [...firstIc['include-controls']] : [{ 'with-ids': [] }];
          let firstInc = { ...incArray[0] };
          let withIds = firstInc['with-ids'] ? [...firstInc['with-ids']] : [];
          if (!withIds.some(id => id.toLowerCase() === controlId.toLowerCase())) withIds.push(controlId);
          firstInc['with-ids'] = withIds;
          incArray[0] = firstInc;
          firstIc['include-controls'] = incArray;
        }
        icArray[0] = firstIc;
        return { ...g, 'insert-controls': icArray };
      }
      if (g.groups) return { ...g, groups: appendControlToGroup(g.groups, controlId, targetGroupId) };
      return g;
    });
  };

  // Helper: insert a control before or after a target control inside group or root
  const insertControlSibling = (groupsList, draggedControlId, targetControlId, position) => {
    // Traverse groups to find targetControlId in any `with-ids`
    let inserted = false;
    const nextList = groupsList.map(g => {
      let icArray = Array.isArray(g['insert-controls']) ? g['insert-controls'] : (g['insert-controls'] ? [g['insert-controls']] : []);
      let targetFound = false;

      icArray = icArray.map(ic => {
        if (ic['include-controls']) {
          return { ...ic, 'include-controls': ic['include-controls'].map(inc => {
            if (inc['with-ids']) {
              const idx = inc['with-ids'].findIndex(id => id.toLowerCase() === targetControlId.toLowerCase());
              if (idx !== -1) {
                targetFound = true;
                inserted = true;
                const nextWithIds = [...inc['with-ids']];
                const insertIdx = position === 'before' ? idx : idx + 1;
                nextWithIds.splice(insertIdx, 0, draggedControlId);
                return { ...inc, 'with-ids': nextWithIds };
              }
            }
            return inc;
          })};
        }
        return ic;
      });

      return {
        ...g,
        'insert-controls': icArray,
        groups: g.groups ? insertControlSibling(g.groups, draggedControlId, targetControlId, position) : undefined
      };
    });

    return { list: nextList, inserted };
  };

  const insertControlSiblingInRoot = (rootInsertControls, draggedControlId, targetControlId, position) => {
    const list = Array.isArray(rootInsertControls) ? rootInsertControls : (rootInsertControls ? [rootInsertControls] : []);
    let inserted = false;

    const nextList = list.map(ic => {
      if (ic['include-controls']) {
        return { ...ic, 'include-controls': ic['include-controls'].map(inc => {
          if (inc['with-ids']) {
            const idx = inc['with-ids'].findIndex(id => id.toLowerCase() === targetControlId.toLowerCase());
            if (idx !== -1) {
              inserted = true;
              const nextWithIds = [...inc['with-ids']];
              const insertIdx = position === 'before' ? idx : idx + 1;
              nextWithIds.splice(insertIdx, 0, draggedControlId);
              return { ...inc, 'with-ids': nextWithIds };
            }
          }
          return inc;
        })};
      }
      return ic;
    });

    return { list: nextList, inserted };
  };

  // ── handleMoveItem implementation for Profiles ──
  const handleMoveItem = (draggedId, draggedType, targetId, targetType, position) => {
    const currentGroups = profile.merge?.custom?.groups || [];
    const rootInsertControls = profile.merge?.custom?.['insert-controls'] || [];

    if (targetType === 'trash' || targetId === 'trash') {
      if (draggedType === 'group') {
        if (window.confirm('Delete this group and all its assignments?')) {
          handleDeleteGroup(draggedId);
        }
      } else if (draggedType === 'control') {
        handleRemoveControl(draggedId);
      }
      return;
    }

    if (draggedType === 'group') {
      // 1. Splice the dragged group out of the groups tree
      const removeResult = findAndRemoveGroup(currentGroups, draggedId);
      if (!removeResult.item) return; // not found

      let updatedGroups = removeResult.list;

      // 2. Insert group at target
      if (position === 'inside') {
        updatedGroups = insertGroupAtTarget(updatedGroups, removeResult.item, targetId, 'inside');
      } else if (position === 'root') {
        updatedGroups.push(removeResult.item);
      } else {
        // before or after
        updatedGroups = insertGroupAtTarget(updatedGroups, removeResult.item, targetId, position);
      }

      updateCustomGroups(updatedGroups);
    } else if (draggedType === 'control') {
      // 1. Remove control from all custom locations
      let updatedGroups = removeControlFromCustom(currentGroups, draggedId);
      let updatedRootInsert = removeControlFromRoot(rootInsertControls, draggedId);

      // 2. Insert control at target
      if (position === 'inside') {
        updatedGroups = appendControlToGroup(updatedGroups, draggedId, targetId);
      } else if (position === 'root') {
        // Add to root insert-controls
        if (updatedRootInsert.length === 0) updatedRootInsert = [{ 'include-controls': [{ 'with-ids': [] }], order: 'keep' }];
        let firstIc = { ...updatedRootInsert[0] };
        if (firstIc['include-all']) {
          delete firstIc['include-all'];
          firstIc['include-controls'] = [{ 'with-ids': [draggedId] }];
        } else {
          let incArray = firstIc['include-controls'] ? [...firstIc['include-controls']] : [{ 'with-ids': [] }];
          let firstInc = { ...incArray[0] };
          let withIds = firstInc['with-ids'] ? [...firstInc['with-ids']] : [];
          if (!withIds.some(id => id.toLowerCase() === draggedId.toLowerCase())) withIds.push(draggedId);
          firstInc['with-ids'] = withIds;
          incArray[0] = firstInc;
          firstIc['include-controls'] = incArray;
        }
        updatedRootInsert[0] = firstIc;
      } else {
        // Position is before or after a target control (targetType is control) or group
        if (targetType === 'control') {
          // Splice sibling control in groups
          const siblingResult = insertControlSibling(updatedGroups, draggedId, targetId, position);
          updatedGroups = siblingResult.list;
          if (!siblingResult.inserted) {
            // Splice sibling control in root
            const rootSiblingResult = insertControlSiblingInRoot(updatedRootInsert, draggedId, targetId, position);
            updatedRootInsert = rootSiblingResult.list;
          }
        } else {
          // Target is a group, and position is before/after. We can add to parent's insert-controls if needed,
          // or just put it inside that target group. Let's append inside for group targets when before/after isn't fully defined.
          updatedGroups = appendControlToGroup(updatedGroups, draggedId, targetId);
        }
      }

      updateCustomGroups(updatedGroups, updatedRootInsert);
    }
  };

  const mapCatalogGroupToCustomGroup = (g) => {
    const customGroup = {
      id: g.id || `custom_grp_${Math.random().toString(36).slice(2, 6)}`,
      title: g.title || 'Untitled Group',
    };

    const controlIds = (g.controls || []).map(c => c.id);
    if (controlIds.length > 0) {
      customGroup['insert-controls'] = [
        {
          order: 'keep',
          'include-controls': [
            { 'with-ids': controlIds }
          ]
        }
      ];
    } else {
      customGroup['insert-controls'] = [{ 'include-controls': [{ 'with-ids': [] }], order: 'keep' }];
    }

    if (g.groups && g.groups.length > 0) {
      customGroup.groups = g.groups.map(mapCatalogGroupToCustomGroup);
    }

    return customGroup;
  };

  const findGroupInCatalog = (catalog, groupId) => {
    const traverse = (g) => {
      if (g.id === groupId) return g;
      if (g.groups) {
        for (const sg of g.groups) {
          const found = traverse(sg);
          if (found) return found;
        }
      }
      return null;
    };
    for (const g of catalog.groups || []) {
      const found = traverse(g);
      if (found) return found;
    }
    return null;
  };

  const handleExternalDrop = (draggedId, draggedType, catalogUuid, targetId, targetType, position) => {
    const currentGroups = profile.merge?.custom?.groups || [];
    const rootInsertControls = profile.merge?.custom?.['insert-controls'] || [];

    if (draggedType === 'group') {
      let customGroup = null;
      if (catalogUuid && catalogCache) {
        const cacheEntry = catalogCache.get(catalogUuid);
        const docData = cacheEntry?.data || cacheEntry;
        const catalog = docData?.catalog || docData?.profile;
        if (catalog) {
          const catGroup = findGroupInCatalog(catalog, draggedId);
          if (catGroup) {
            customGroup = mapCatalogGroupToCustomGroup(catGroup);
          }
        }
      }
      
      if (!customGroup) {
        customGroup = {
          id: draggedId,
          title: draggedId,
          'insert-controls': [{ 'include-controls': [{ 'with-ids': [] }], order: 'keep' }]
        };
      }

      const exists = (list) => {
        for (const g of list) {
          if (g.id === customGroup.id) return true;
          if (g.groups && exists(g.groups)) return true;
        }
        return false;
      };
      if (exists(currentGroups)) {
        alert(`The group "${customGroup.title}" is already present in the structure.`);
        return;
      }

      let updatedGroups = [...currentGroups];

      if (position === 'inside') {
        updatedGroups = insertGroupAtTarget(updatedGroups, customGroup, targetId, 'inside');
      } else if (position === 'root') {
        updatedGroups.push(customGroup);
      } else {
        updatedGroups = insertGroupAtTarget(updatedGroups, customGroup, targetId, position);
      }

      updateCustomGroups(updatedGroups);
    } else {
      let updatedGroups = removeControlFromCustom(currentGroups, draggedId);
      let updatedRootInsert = removeControlFromRoot(rootInsertControls, draggedId);

      if (position === 'inside') {
        updatedGroups = appendControlToGroup(updatedGroups, draggedId, targetId);
      } else if (position === 'root') {
        if (updatedRootInsert.length === 0) updatedRootInsert = [{ 'include-controls': [{ 'with-ids': [] }], order: 'keep' }];
        let firstIc = { ...updatedRootInsert[0] };
        if (firstIc['include-all']) {
          delete firstIc['include-all'];
          firstIc['include-controls'] = [{ 'with-ids': [draggedId] }];
        } else {
          let incArray = firstIc['include-controls'] ? [...firstIc['include-controls']] : [{ 'with-ids': [] }];
          let firstInc = { ...incArray[0] };
          let withIds = firstInc['with-ids'] ? [...firstInc['with-ids']] : [];
          if (!withIds.some(id => id.toLowerCase() === draggedId.toLowerCase())) withIds.push(draggedId);
          firstInc['with-ids'] = withIds;
          incArray[0] = firstInc;
          firstIc['include-controls'] = incArray;
        }
        updatedRootInsert[0] = firstIc;
      } else {
        if (targetType === 'control') {
          const siblingResult = insertControlSibling(updatedGroups, draggedId, targetId, position);
          updatedGroups = siblingResult.list;
          if (!siblingResult.inserted) {
            const rootSiblingResult = insertControlSiblingInRoot(updatedRootInsert, draggedId, targetId, position);
            updatedRootInsert = rootSiblingResult.list;
          }
        } else {
          updatedGroups = appendControlToGroup(updatedGroups, draggedId, targetId);
        }
      }

      updateCustomGroups(updatedGroups, updatedRootInsert);
    }
  };

  // --- Group CRUD ---
  const insertGroupRecursive = (groupsList, parentId, newGroup) => {
    if (parentId === null) return [...groupsList, newGroup];
    return groupsList.map(g => {
      if (g.id === parentId) return { ...g, groups: g.groups ? [...g.groups, newGroup] : [newGroup] };
      if (g.groups) return { ...g, groups: insertGroupRecursive(g.groups, parentId, newGroup) };
      return g;
    });
  };

  const updateGroupTitleRecursive = (groupsList, groupId, newTitle) => {
    return groupsList.map(g => {
      if (g.id === groupId) return { ...g, title: newTitle };
      if (g.groups) return { ...g, groups: updateGroupTitleRecursive(g.groups, groupId, newTitle) };
      return g;
    });
  };

  const deleteGroupRecursive = (groupsList, groupId) => {
    return groupsList.filter(g => g.id !== groupId).map(g => {
      if (g.groups) return { ...g, groups: deleteGroupRecursive(g.groups, groupId) };
      return g;
    });
  };

  const handleAddGroup = (parentId) => {
    const title = window.prompt(parentId === null ? 'Name for new top-level group:' : 'Name for new subgroup:');
    if (!title || !title.trim()) return;
    const newGroup = {
      id: `custom_grp_${Date.now().toString().slice(-4)}`,
      title: title.trim(),
      'insert-controls': [{ 'include-controls': [{ 'with-ids': [] }], order: 'keep' }]
    };
    updateCustomGroups(insertGroupRecursive(profile.merge?.custom?.groups || [], parentId, newGroup));
  };

  const handleRenameGroup = (groupId, newTitle) => {
    if (!newTitle || !newTitle.trim()) return;
    updateCustomGroups(updateGroupTitleRecursive(profile.merge?.custom?.groups || [], groupId, newTitle.trim()));
  };

  const handleDeleteGroup = (groupId) => {
    updateCustomGroups(deleteGroupRecursive(profile.merge?.custom?.groups || [], groupId));
  };

  const handleRemoveControl = (controlId) => {
    const currentGroups = profile.merge?.custom?.groups || [];
    const rootInsertControls = profile.merge?.custom?.['insert-controls'] || [];
    const updatedGroups = removeControlFromCustom(currentGroups, controlId);
    const updatedRootInsert = removeControlFromRoot(rootInsertControls, controlId);
    updateCustomGroups(updatedGroups, updatedRootInsert);
  };

  // ── Search helpers ──
  const matchesSearch = (item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (item.id || '').toLowerCase().includes(q) || (item.title || '').toLowerCase().includes(q);
  };

  const hasMatchingControlDescendants = (c) => {
    if (!searchQuery.trim()) return true;
    if (matchesSearch(c)) return true;
    if (c.controls) {
      return c.controls.some(sub => hasMatchingControlDescendants(sub));
    }
    return false;
  };

  const hasMatchingDescendants = (group) => {
    if (!searchQuery.trim()) return true;
    if (matchesSearch(group)) return true;
    if ((group.controls || []).some(c => hasMatchingControlDescendants(c))) return true;
    return (group.groups || []).some(g => hasMatchingDescendants(g));
  };

  // ── Context menu style ──
  const contextMenuItemStyle = {
    padding: '8px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: 'var(--color-text)'
  };

  // ── Drop indicator bar ──
  const DropBar = ({ targetId, position, isControl = false }) => {
    const isActive = dropIndicator && dropIndicator.id === targetId && dropIndicator.position === position;
    const indent = isControl ? '24px' : '12px';
    return (
      <div
        className={`dnd-drop-bar ${isActive ? 'dnd-drop-bar-active' : ''}`}
        style={{ marginLeft: indent, height: '6px' }}
        onDragOver={(e) => {
          if (canEdit) e.preventDefault();
        }}
        onDrop={(e) => {
          if (!canEdit) return;
          e.preventDefault();
          e.stopPropagation();
          const draggedId = e.dataTransfer.getData('text/plain');
          const draggedType = e.dataTransfer.getData('draggedType') || 'control';
          const catalogUuid = e.dataTransfer.getData('catalogUuid');
          if (draggedId) {
            handleExternalDrop(draggedId, draggedType, catalogUuid, targetId, isControl ? 'control' : 'group', position);
          }
        }}
      />
    );
  };

  // ── Render a single control (1:1 CatalogSidebar style) ──
  const renderControlItem = (c, index, siblingControls, depth = 0) => {
    if (!hasMatchingControlDescendants(c)) return null;
    const isSelected = selectedControlId === c.id;
    const isDragging = dragId === c.id;
    const subControls = c.controls || [];
    const isExpanded = expandedGroups[c.id] || searchQuery.trim() !== '';

    return (
      <React.Fragment key={c.id}>
        <DropBar targetId={c.id} position="before" isControl={true} />
        <div style={{ marginLeft: `${depth * 8}px` }}>
          <div
            data-dnd-id={c.id}
            data-dnd-type="control"
            onClick={() => onSelectControl(c.id)}
            onContextMenu={(e) => {
              if (canEdit) {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ x: e.clientX, y: e.clientY, type: 'control', id: c.id });
              }
            }}
            className={`sidebar-item ${isSelected ? 'sidebar-item-selected' : ''} ${isDragging ? 'sidebar-item-dragging' : ''}`}
            style={{ paddingLeft: subControls.length > 0 ? '12px' : '24px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flex: 1 }}>
              {canEdit && (
                <span
                  className="drag-handle"
                  onPointerDown={(e) => handlePointerDown(e, c.id, 'control', c.title || c.id)}
                  title="Move"
                >
                  ⠿
                </span>
              )}
              {subControls.length > 0 && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleGroup(c.id);
                  }}
                  style={{ padding: '0 4px', color: 'var(--color-text-muted)', fontSize: '10px', cursor: 'pointer' }}
                >
                  {isExpanded ? '▼' : '▶'}
                </span>
              )}
              <span className="sidebar-item-badge">{c.id}</span>
              <span className="sidebar-item-title">{c.title || 'Untitled'}</span>
            </div>
          </div>
          {subControls.length > 0 && isExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', borderLeft: '1px solid var(--color-border-subtle)', marginLeft: '24px' }}>
              {subControls.map((sc, i) => renderControlItem(sc, i, subControls, depth + 1))}
            </div>
          )}
        </div>
        {index === siblingControls.length - 1 && <DropBar targetId={c.id} position="after" isControl={true} />}
      </React.Fragment>
    );
  };

  // ── Recursively render a group (1:1 CatalogSidebar style) ──
  const renderGroupItem = (g, depth = 0, index = 0, siblingGroups = []) => {
    if (!hasMatchingDescendants(g)) return null;

    const isSelected = selectedGroupId === g.id;
    const isExpanded = expandedGroups[g.id] || searchQuery.trim() !== '';
    const subGroups = g.groups || [];
    const groupControls = g.controls || [];
    const isDragging = dragId === g.id;
    const isInsideTarget = dropIndicator && dropIndicator.id === g.id && dropIndicator.position === 'inside';

    return (
      <React.Fragment key={g.id}>
        <DropBar targetId={g.id} position="before" isControl={false} />
        <div style={{ marginLeft: `${depth * 8}px` }}>
          <div
            data-dnd-id={g.id}
            data-dnd-type="group"
            className={`sidebar-item sidebar-item-group ${isSelected ? 'sidebar-item-selected' : ''} ${isDragging ? 'sidebar-item-dragging' : ''} ${isInsideTarget ? 'sidebar-item-drop-inside' : ''}`}
            onClick={() => onSelectGroup(g.id)}
            onContextMenu={(e) => {
              if (canEdit) {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ x: e.clientX, y: e.clientY, type: 'group', id: g.id });
              }
            }}
            onDragOver={(e) => {
              if (canEdit) e.preventDefault();
            }}
            onDrop={(e) => {
              if (!canEdit) return;
              e.preventDefault();
              e.stopPropagation();
              const draggedId = e.dataTransfer.getData('text/plain');
              const draggedType = e.dataTransfer.getData('draggedType') || 'control';
              const catalogUuid = e.dataTransfer.getData('catalogUuid');
              if (draggedId) {
                handleExternalDrop(draggedId, draggedType, catalogUuid, g.id, 'group', 'inside');
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flex: 1 }}>
              {canEdit && (
                <span
                  className="drag-handle"
                  onPointerDown={(e) => handlePointerDown(e, g.id, 'group', g.title || g.id)}
                  title="Move"
                >
                  ⠿
                </span>
              )}
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleGroup(g.id);
                }}
                style={{ padding: '0 4px', color: 'var(--color-text-muted)', fontSize: '10px', cursor: 'pointer' }}
              >
                {isExpanded ? '▼' : '▶'}
              </span>
              {editingGroupId === g.id && canEdit ? (
                <input
                  type="text"
                  defaultValue={g.title}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { handleRenameGroup(g.id, e.target.value); setEditingGroupId(null); }
                    else if (e.key === 'Escape') { setEditingGroupId(null); }
                  }}
                  onBlur={(e) => { handleRenameGroup(g.id, e.target.value); setEditingGroupId(null); }}
                  className="form-input"
                  style={{
                    fontSize: '13px', padding: '2px 6px', height: '24px', flex: 1,
                    marginRight: '8px', background: 'var(--color-surface-3)',
                    border: '1px solid var(--color-accent)', borderRadius: '4px',
                    color: 'var(--color-text)'
                  }}
                />
              ) : (
                <>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>📁</span>
                  <span
                    className="sidebar-item-title"
                    style={{ fontWeight: 'bold' }}
                    onDoubleClick={(e) => {
                      if (canEdit) { e.stopPropagation(); setEditingGroupId(g.id); }
                    }}
                  >
                    {g.title || g.id}
                  </span>
                </>
              )}
            </div>
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
              ({groupControls.length})
            </span>
          </div>

          {isExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', borderLeft: '1px solid var(--color-border-subtle)', marginLeft: '12px' }}>
              {subGroups.map((sg, i) => renderGroupItem(sg, depth + 1, i, subGroups))}
              {groupControls.map((c, i) => renderControlItem(c, i, groupControls, 0))}
            </div>
          )}
        </div>
        {index === siblingGroups.length - 1 && <DropBar targetId={g.id} position="after" isControl={false} />}
      </React.Fragment>
    );
  };

  const getTrashText = () => {
    if (!dragId) {
      return '🗑️ Drag elements here to delete';
    }
    const isHovered = dropIndicator?.id === 'trash';
    if (!isHovered) {
      return '🗑️ Drag here to delete...';
    }
    const dragType = dragRef.current?.type;
    const dragLabel = dragRef.current?.label || dragId;
    if (dragType === 'group') {
      return `🗑️ Delete group "${dragLabel}"`;
    } else if (dragType === 'control') {
      return `🗑️ Unassign "${dragLabel}"`;
    }
    return '🗑️ Release to delete';
  };

  return (
    <div
      className="catalog-sidebar"
      style={{
        width: '300px',
        borderRight: '1px solid var(--color-border)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-surface)',
        userSelect: dragId ? 'none' : 'auto'
      }}
    >
      {/* Search Input */}
      <div style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search..."
          className="form-input"
          style={{ width: '100%', height: '30px', fontSize: '12px' }}
        />
      </div>

      {/* Main Navigation List */}
      <div
        ref={sidebarRef}
        onDragOver={(e) => {
          if (canEdit) e.preventDefault();
        }}
        onDrop={(e) => {
          if (!canEdit) return;
          e.preventDefault();
          const draggedId = e.dataTransfer.getData('text/plain');
          const draggedType = e.dataTransfer.getData('draggedType') || 'control';
          const catalogUuid = e.dataTransfer.getData('catalogUuid');
          if (draggedId) {
            handleExternalDrop(draggedId, draggedType, catalogUuid, null, null, 'root');
          }
        }}
        style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '2px' }}
      >
        
        {/* Overview Item */}
        <div
          onClick={onSelectOverview}
          className={`sidebar-item ${(!selectedControlId && !selectedGroupId && activeSidebarView === 'overview') ? 'sidebar-item-selected' : ''}`}
          style={{ fontWeight: 'bold' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>🏠</span>
            <span>Overview</span>
          </div>
        </div>

        {/* Metadata Item */}
        <div
          onClick={onSelectMetadata}
          className={`sidebar-item ${(!selectedControlId && !selectedGroupId && activeSidebarView === 'metadata') ? 'sidebar-item-selected' : ''}`}
          style={{ fontWeight: 'bold' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>ℹ️</span>
            <span>Metadata</span>
          </div>
        </div>

        {/* Properties Item */}
        <div
          onClick={onSelectProperties}
          className={`sidebar-item ${(!selectedControlId && !selectedGroupId && activeSidebarView === 'properties') ? 'sidebar-item-selected' : ''}`}
          style={{ fontWeight: 'bold' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>🏷️</span>
            <span>Properties</span>
          </div>
        </div>

        {/* Parameters Item */}
        <div
          onClick={onSelectParameters}
          className={`sidebar-item ${(!selectedControlId && !selectedGroupId && activeSidebarView === 'parameters') ? 'sidebar-item-selected' : ''}`}
          style={{ fontWeight: 'bold' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>⚙️</span>
            <span>Parameters (Global)</span>
          </div>
        </div>

        {/* Import Sources Item (Only when editing profile) */}
        {isEditing && (
          <div
            onClick={onSelectImports}
            className={`sidebar-item ${(!selectedControlId && !selectedGroupId && activeSidebarView === 'imports') ? 'sidebar-item-selected' : ''}`}
            style={{ fontWeight: 'bold' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>📥</span>
              <span>Import Sources</span>
            </div>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--color-border-subtle)', margin: '6px 0' }} />

        {/* Catalog Root Groups & Controls */}
        {groups.map((g, i) => renderGroupItem(g, 0, i, groups))}
        {controls.map((c, i) => renderControlItem(c, i, controls, 0))}

        <DropBar targetId="__root__" position="root" />

        {/* Add top-level Group when editing */}
        {canEdit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => handleAddGroup(null)}
              style={{ width: '100%', padding: '6px', fontSize: '11px', whiteSpace: 'nowrap' }}
            >
              ➕ Add Top-level Group
            </button>
            <div
              data-dnd-id="trash"
              data-dnd-type="trash"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-sm)',
                border: dropIndicator?.id === 'trash'
                  ? '2px solid var(--color-danger)'
                  : dragId
                    ? '1.5px dashed var(--color-danger)'
                    : '1px dashed var(--color-border)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '500',
                textAlign: 'center',
                padding: '8px',
                boxSizing: 'border-box',
                transition: 'all 0.2s ease-in-out',
                backgroundColor: dropIndicator?.id === 'trash'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : dragId
                    ? 'rgba(239, 68, 68, 0.05)'
                    : 'var(--color-surface-hover)',
                color: dropIndicator?.id === 'trash' || dragId
                  ? 'var(--color-danger)'
                  : 'var(--color-text-muted)',
                transform: dropIndicator?.id === 'trash' ? 'scale(1.02)' : 'scale(1)',
                boxShadow: dropIndicator?.id === 'trash' ? '0 0 8px rgba(239, 68, 68, 0.3)' : 'none',
                minHeight: '34px'
              }}
              title="Delete / unassign (drag here)"
            >
              {getTrashText()}
            </div>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--color-border-subtle)', margin: '8px 0' }} />

        {/* Back Matter Item */}
        <div
          onClick={onSelectBackMatter}
          className={`sidebar-item ${(!selectedControlId && !selectedGroupId && activeSidebarView === 'back-matter') ? 'sidebar-item-selected' : ''}`}
          style={{ fontWeight: 'bold' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>📖</span>
            <span>Back Matter</span>
          </div>
        </div>
      </div>

      {/* Context Menu Popup */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 9999,
            padding: '4px 0',
            minWidth: '180px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'group' && (
            <>
              <div
                className="context-menu-item"
                onClick={() => {
                  handleAddGroup(contextMenu.id);
                  setContextMenu(null);
                }}
                style={contextMenuItemStyle}
              >
                📁 Add subgroup
              </div>
              <div
                className="context-menu-item"
                onClick={() => {
                  setEditingGroupId(contextMenu.id);
                  setContextMenu(null);
                }}
                style={contextMenuItemStyle}
              >
                ✏️ Rename Group
              </div>
              <div style={{ borderTop: '1px solid var(--color-border-subtle)', margin: '4px 0' }} />
              <div
                className="context-menu-item"
                onClick={() => {
                  if (window.confirm('Delete this group and all its assignments?')) {
                    handleDeleteGroup(contextMenu.id);
                  }
                  setContextMenu(null);
                }}
                style={{ ...contextMenuItemStyle, color: 'var(--color-danger)' }}
              >
                🗑 Delete
              </div>
            </>
          )}

          {contextMenu.type === 'control' && (
            <>
              <div
                className="context-menu-item"
                onClick={() => {
                  onSelectControl(contextMenu.id);
                  setContextMenu(null);
                }}
                style={contextMenuItemStyle}
              >
                👁 View Details
              </div>
              <div
                className="context-menu-item"
                onClick={() => {
                  handleRemoveControl(contextMenu.id);
                  setContextMenu(null);
                }}
                style={{ ...contextMenuItemStyle, color: 'var(--color-danger)' }}
              >
                ✖ Remove from Group
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
