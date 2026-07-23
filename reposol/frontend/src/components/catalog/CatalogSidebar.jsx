import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * CatalogSidebar — tree view with pointer-based drag-and-drop.
 *
 * Why pointer events instead of native HTML5 DnD?
 *   – Native DnD's dragend fires unreliably when React re-renders mid-drag.
 *   – Drop zones are finicky: dragover/dragleave events jitter on nested elements.
 *   – Pointer events (mousedown/mousemove/mouseup) give us full control.
 */
export function CatalogSidebar({
  catalog = {},
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
  expandedGroups = {},
  onToggleGroup,
  isEditing = false,
  onAddGroup,
  onAddControl,
  onDeleteGroup,
  onDeleteControl,
  onMoveItem
}) {
  const groups = catalog.groups || [];
  const controls = catalog.controls || [];

  // ── Context menu state ──
  const [contextMenu, setContextMenu] = useState(null);

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
    const activeId = selectedControlId || selectedGroupId;
    if (!activeId) return;

    const timer = setTimeout(() => {
      if (sidebarRef.current) {
        const selectedEl = sidebarRef.current.querySelector('.sidebar-item-selected');
        if (selectedEl) {
          selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [selectedControlId, selectedGroupId]);

  // ── Collect flat list of rendered items for drop-target resolution ──
  const getDropTargets = useCallback(() => {
    if (!sidebarRef.current) return [];
    return Array.from(sidebarRef.current.querySelectorAll('[data-dnd-id]'));
  }, []);

  // ── Recursive helpers ──
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
    const parentNode = findNodeById(catalog, parentId);
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
  }, []);

  // ── Pointer handlers ──
  const DRAG_THRESHOLD = 5; // px before drag actually starts

  const handlePointerDown = useCallback((e, id, type, label) => {
    if (e.button !== 0) return; // left-click only
    e.preventDefault();
    e.stopPropagation();

    // Cache initial vertical layout geometry of all elements to prevent drag-jitter and gap dead-zones
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

      // Start dragging after threshold
      if (!drag.started) {
        if (dy < DRAG_THRESHOLD && dx < DRAG_THRESHOLD) return;
        drag.started = true;
        setDragId(drag.id);

        // Create ghost element
        const ghost = document.createElement('div');
        ghost.className = 'dnd-ghost';
        ghost.textContent = drag.label;
        document.body.appendChild(ghost);
        ghostRef.current = ghost;
      }

      // Move ghost with safe offset to avoid overlapping cursor/row text
      if (ghostRef.current) {
        ghostRef.current.style.top = `${moveEv.clientY + 18}px`;
        ghostRef.current.style.left = `${moveEv.clientX + 24}px`;
      }

      // Resolve drop target using cached layout offset by current scroll offset
      const target = resolveDropTarget(moveEv.clientY, drag.sidebarRect, sidebar.scrollTop, drag.initialRects);
      setDropIndicator(target);
    };

    const handlePointerUpFinal = (upEv) => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUpFinal);

      const drag = dragRef.current;
      if (!drag || !drag.started) {
        // Not a real drag — just clean up
        dragRef.current = null;
        if (ghostRef.current) { ghostRef.current.remove(); ghostRef.current = null; }
        setDragId(null);
        setDropIndicator(null);
        return;
      }

      // Resolve the drop target using cached layout
      const target = resolveDropTarget(upEv.clientY, drag.sidebarRect, sidebar.scrollTop, drag.initialRects);

      // NOW clean up
      dragRef.current = null;
      if (ghostRef.current) { ghostRef.current.remove(); ghostRef.current = null; }
      setDragId(null);
      setDropIndicator(null);

      if (!target) return;

      if (target.position === 'root') {
        onMoveItem(drag.id, drag.type, null, null, 'root');
      } else {
        onMoveItem(drag.id, drag.type, target.id, target.type, target.position);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUpFinal);
  }, [resolveDropTarget, onMoveItem, getDropTargets]);

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

  // ── Context menu item style ──
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
    // Align the horizontal line with the item text indentation
    const indent = isControl ? '24px' : '12px';
    return <div className={`dnd-drop-bar ${isActive ? 'dnd-drop-bar-active' : ''}`} style={{ marginLeft: indent }} />;
  };

  // ── Render a single control ──
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
              if (isEditing) {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ x: e.clientX, y: e.clientY, type: 'control', id: c.id });
              }
            }}
            className={`sidebar-item ${isSelected ? 'sidebar-item-selected' : ''} ${isDragging ? 'sidebar-item-dragging' : ''}`}
            style={{ paddingLeft: subControls.length > 0 ? '12px' : '24px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flex: 1 }}>
              {isEditing && (
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

  // ── Recursively render a group ──
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
              if (isEditing) {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ x: e.clientX, y: e.clientY, type: 'group', id: g.id });
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flex: 1 }}>
              {isEditing && (
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
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>📁</span>
              <span className="sidebar-item-title" style={{ fontWeight: 'bold' }}>
                {g.title || g.id}
              </span>
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
      <div ref={sidebarRef} style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        
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

        {/* Import Source Item (Only when editing catalog) */}
        {isEditing && (
          <div
            onClick={onSelectImports}
            className={`sidebar-item ${(!selectedControlId && !selectedGroupId && activeSidebarView === 'import') ? 'sidebar-item-selected' : ''}`}
            style={{ fontWeight: 'bold' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>📥</span>
              <span>Import Source</span>
            </div>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--color-border-subtle)', margin: '6px 0' }} />

        {/* Catalog Root Groups & Controls */}
        {groups.map((g, i) => renderGroupItem(g, 0, i, groups))}
        {controls.map((c, i) => renderControlItem(c, i, controls, 0))}

        <DropBar targetId="__root__" position="root" />

        {/* Add top-level Group when editing */}
        {isEditing && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onAddGroup(null)}
            style={{ width: '100%', padding: '6px', fontSize: '11px', marginTop: '10px' }}
          >
            ➕ Add Top-level Group
          </button>
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
            minWidth: '170px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'group' && (
            <>
              <div
                className="context-menu-item"
                onClick={() => {
                  onAddGroup(contextMenu.id);
                  setContextMenu(null);
                }}
                style={contextMenuItemStyle}
              >
                📁 Add subgroup
              </div>
              <div
                className="context-menu-item"
                onClick={() => {
                  onAddControl(contextMenu.id);
                  setContextMenu(null);
                }}
                style={contextMenuItemStyle}
              >
                ➕ Add control
              </div>
              <div style={{ borderTop: '1px solid var(--color-border-subtle)', margin: '4px 0' }} />
              <div
                className="context-menu-item"
                onClick={() => {
                  onDeleteGroup(contextMenu.id);
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
                  onDeleteControl(contextMenu.id);
                  setContextMenu(null);
                }}
                style={{ ...contextMenuItemStyle, color: 'var(--color-danger)' }}
              >
                🗑 Delete
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
