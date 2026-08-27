import React, { useState, useMemo } from 'react';
import { UseControlTreeReturn, ControlTreeNode } from '../../../hooks/useControlTree';
import { TreeContextMenu } from './TreeContextMenu';
import styles from './ControlTree.module.css';

export interface ControlTreeNodeProps {
  node: ControlTreeNode;
  tree: UseControlTreeReturn;
  renderNodeExtra?: (node: ControlTreeNode) => React.ReactNode;
  isEditing?: boolean;
  onMoveNode?: (nodeId: string, targetParentId: string | null, targetIndex?: number) => void;
  onAddGroup?: (parentGroupId: string | null) => void;
  onAddControl?: (parentGroupId: string | null) => void;
  onDeleteNode?: (nodeId: string, nodeType: 'group' | 'control') => void;
  onRenameGroup?: (groupId: string, newTitle: string, newId?: string) => void;
  onWithdrawNode?: (controlId: string) => void;
  onRestoreNode?: (controlId: string) => void;
  onWithdrawAllInGroup?: (groupId: string) => void;
  onRestoreAllInGroup?: (groupId: string) => void;
  // Profile mode baseline
  onExcludeFromBaseline?: (controlId: string) => void;
  onIncludeInBaseline?: (controlId: string) => void;
  excludedControlIds?: Set<string>;
  isDraggingNode?: boolean;
  onDragStartNode?: (nodeId: string) => void;
  onDragEndNode?: () => void;
  activeDraggedId?: string | null;
  onUnassignControl?: (controlId: string, sourceGroupId?: string | null) => void;
}

export const ControlTreeNodeComponent: React.FC<ControlTreeNodeProps> = ({
  node,
  tree,
  renderNodeExtra,
  isEditing = false,
  onMoveNode,
  onAddGroup,
  onAddControl,
  onDeleteNode,
  onRenameGroup,
  onWithdrawNode,
  onRestoreNode,
  onWithdrawAllInGroup,
  onRestoreAllInGroup,
  onExcludeFromBaseline,
  onIncludeInBaseline,
  excludedControlIds,
  onDragStartNode,
  onDragEndNode,
  activeDraggedId,
  onUnassignControl
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'inside' | 'after' | null>(null);
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [inlineTitle, setInlineTitle] = useState(node.title || '');

  const isVirtualUnassigned = node.id === '__unassigned__' || node.class === 'virtual-unassigned';
  const isDraggable = isEditing && Boolean(onMoveNode) && !isVirtualUnassigned;


  React.useEffect(() => {
    setInlineTitle(node.title || '');
  }, [node.title]);

  const handleCommitRename = () => {
    setIsInlineEditing(false);
    const trimmed = inlineTitle.trim();
    if (trimmed && trimmed !== node.title && onRenameGroup) {
      onRenameGroup(node.id, trimmed);
    } else {
      setInlineTitle(node.title || '');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsInlineEditing(false);
      setInlineTitle(node.title || '');
    }
  };

  const isSelected = tree?.selectedId === node.id;
  const isExpanded = tree ? (tree.expandedIds?.has(node.id) || Boolean(tree.searchQuery?.trim())) : Boolean(node.isExpanded);
  const isBeingDragged = activeDraggedId === node.id;
  
  // Find children from filteredNodes to respect search
  const children = tree?.filteredNodes ? tree.filteredNodes.filter(n => n.parentId === node.id) : (node.children || []);
  
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    tree?.toggleExpand?.(node.id);
  };
  
  const handleSelect = () => {
    tree.select(node.id);
    if (node.type === 'group') {
      tree.toggleExpand(node.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isEditing) return;
    if (onAddGroup || onAddControl || onDeleteNode || onRenameGroup || onWithdrawNode || onRestoreNode || onWithdrawAllInGroup || onRestoreAllInGroup || onExcludeFromBaseline || onIncludeInBaseline || onUnassignControl) {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (!isEditing || !onMoveNode || isVirtualUnassigned) return;
    e.dataTransfer.setData('text/plain', node.id);
    e.dataTransfer.setData('nodeType', node.type);
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStartNode) onDragStartNode(node.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isEditing || !onMoveNode) return;

    const types = e.dataTransfer?.types;
    const hasTypes = Array.isArray(types) || (types && typeof (types as any).includes === 'function');
    const isExternalControl = hasTypes
      ? (types.includes('application/x-oscal-control') || types.includes('application/x-oscal-group-pool') || types.includes('text/plain'))
      : Boolean(e.dataTransfer);
    const isInternalValid = activeDraggedId && activeDraggedId !== node.id;

    if (!isExternalControl && !isInternalValid) return;

    // Block dropping groups onto virtual unassigned node unless it's a pool group being unassigned
    const draggedType = hasTypes && (types.includes('nodetype') || types.includes('nodeType')) && typeof e.dataTransfer?.getData === 'function'
      ? e.dataTransfer.getData('nodeType')
      : null;
    if (isVirtualUnassigned && (draggedType === 'group' || (activeDraggedId && tree?.flatList.find(n => n.id === activeDraggedId)?.type === 'group'))) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }

    if (isVirtualUnassigned) {
      setDropPosition('inside');
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;

    if (node.type === 'group') {
      const isPoolControlDrag = (window as any).__isDraggingFromPool;
      if (isPoolControlDrag) {
        setDropPosition('inside');
      } else if (offsetY < height * 0.25) {
        setDropPosition('before');
      } else if (offsetY > height * 0.75) {
        setDropPosition('after');
      } else {
        setDropPosition('inside');
      }
    } else {
      if (offsetY < height * 0.5) {
        setDropPosition('before');
      } else {
        setDropPosition('after');
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setDropPosition(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isEditing || !onMoveNode) return;
    e.preventDefault();
    e.stopPropagation();

    // Check if an entire group was dragged from the workbench
    const rawGroup = e.dataTransfer.getData('application/x-oscal-group-pool');
    if (rawGroup) {
      try {
        const parsedGroup = JSON.parse(rawGroup);
        if (parsedGroup.group || parsedGroup.id) {
          const payload = JSON.stringify({
            type: 'catalog-group-structure',
            group: parsedGroup.group || { id: parsedGroup.id, title: parsedGroup.title, controlIds: parsedGroup.controlIds }
          });
          if (isVirtualUnassigned) {
            onMoveNode(payload, '__unassigned__');
          } else if (node.type === 'group') {
            onMoveNode(payload, node.id, 0);
          } else if (node.parentId) {
            onMoveNode(payload, node.parentId);
          } else {
            onMoveNode(payload, null);
          }
          setDropPosition(null);
          if (onDragEndNode) onDragEndNode();
          return;
        }
      } catch (err) {
        console.error('Failed to parse group payload on drop', err);
      }
    }

    let draggedId = '';
    const rawOscal = e.dataTransfer.getData('application/x-oscal-control');
    if (rawOscal) {
      try {
        const parsed = JSON.parse(rawOscal);
        if (parsed?.controlIds && Array.isArray(parsed.controlIds) && parsed.controlIds.length > 1) {
          const payload = JSON.stringify({ type: 'batch-controls', controlIds: parsed.controlIds });
          if (isVirtualUnassigned) {
            onMoveNode(payload, '__unassigned__');
          } else if (node.type === 'group') {
            onMoveNode(payload, node.id, 0);
          } else if (node.parentId) {
            onMoveNode(payload, node.parentId);
          }
          setDropPosition(null);
          if (onDragEndNode) onDragEndNode();
          return;
        }
        draggedId = parsed.id;
      } catch {
        draggedId = e.dataTransfer.getData('text/plain');
      }
    } else {
      draggedId = e.dataTransfer.getData('text/plain') || activeDraggedId || '';
    }

    if (!draggedId || draggedId === node.id) {
      setDropPosition(null);
      return;
    }

    if (isVirtualUnassigned) {
      // Dropping onto __unassigned__ node moves control to unassigned pool
      onMoveNode(draggedId, '__unassigned__');
      setDropPosition(null);
      if (onDragEndNode) onDragEndNode();
      return;
    }

    // Determine siblings of this node
    const siblings = tree.flatList.filter(n => n.parentId === node.parentId);
    const nodeIndex = siblings.findIndex(n => n.id === node.id);

    const isControlDrop = Boolean(rawOscal) || !tree.flatList.some(n => n.id === draggedId && n.type === 'group');

    if (node.type === 'group' && isControlDrop) {
      onMoveNode(draggedId, node.id, 0);
    } else if (dropPosition === 'inside' && node.type === 'group') {
      onMoveNode(draggedId, node.id, 0);
    } else if (dropPosition === 'before') {
      onMoveNode(draggedId, node.parentId, Math.max(0, nodeIndex));
    } else if (dropPosition === 'after') {
      onMoveNode(draggedId, node.parentId, nodeIndex + 1);
    }

    setDropPosition(null);
    if (onDragEndNode) onDragEndNode();
  };

  const handleDragEnd = () => {
    setDropPosition(null);
    if (onDragEndNode) onDragEndNode();
  };
  
  // Do not render if not in filtered nodes (when searching/filtering)
  if (tree?.filteredNodes && tree.filteredNodes.length > 0 && !tree.filteredNodes.some(n => n.id === node.id)) {
      return null;
  }
  
  const hasActions = isEditing && (onAddGroup || onAddControl || onDeleteNode || onRenameGroup || onWithdrawNode || onRestoreNode || onWithdrawAllInGroup || onRestoreAllInGroup || onExcludeFromBaseline || onIncludeInBaseline || (onUnassignControl && !isVirtualUnassigned && node.parentId && node.parentId !== '__unassigned__'));

  const isExcluded = Boolean(excludedControlIds?.has(node.id?.toLowerCase()));

  return (
    <div className={styles.nodeWrapper}>
      {dropPosition === 'before' && <div className={styles.dropBar} />}
      
      <div 
        className={`${styles.nodeRow} ${isSelected ? styles.selected : ''} ${node.withdrawn ? styles.withdrawn : ''} ${isExcluded ? styles.excluded : ''} ${dropPosition === 'inside' ? styles.dropInside : ''} ${isBeingDragged ? styles.draggingNode : ''} ${isVirtualUnassigned ? styles.virtualUnassignedNode : ''}`}
        style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
        onClick={handleSelect}
        onContextMenu={handleContextMenu}
        draggable={isDraggable}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        data-testid={`tree-node-${node.id}`}
        data-dnd-id={node.id}
      >
        {isDraggable && (
          <span className={styles.dragHandle} title="Drag to reorder">
            ⋮⋮
          </span>
        )}

        <span className={styles.toggleIcon} onClick={handleToggle}>
           {children.length > 0 ? (isExpanded ? '▼' : '▶') : <span style={{display: 'inline-block', width: '12px'}}></span>}
        </span>
        
        {node.type === 'group' && <span className={styles.typeIcon}>{isVirtualUnassigned ? '📥' : '📁'}</span>}
        
        <div className={styles.nodeContent}>
           <span className={styles.nodeLabel}>{node.label || node.id}</span>
           {isInlineEditing ? (
             <input
               type="text"
               data-testid={`inline-rename-input-${node.id}`}
               className={styles.inlineRenameInput || styles.searchInput}
               style={{
                 flex: 1,
                 fontSize: '13px',
                 fontWeight: 600,
                 color: 'var(--color-text)',
                 background: 'var(--color-surface-2)',
                 border: '1px solid var(--color-accent)',
                 borderRadius: 'var(--radius-sm)',
                 padding: '2px 6px',
                 outline: 'none'
               }}
               value={inlineTitle}
               onChange={(e) => setInlineTitle(e.target.value)}
               onBlur={handleCommitRename}
               onKeyDown={handleKeyDown}
               autoFocus
               onClick={(e) => e.stopPropagation()}
             />
           ) : (
             <span 
               className={styles.nodeTitle}
               onDoubleClick={(e) => {
                 if (isEditing && node.type === 'group' && !isVirtualUnassigned && onRenameGroup) {
                   e.stopPropagation();
                   setIsInlineEditing(true);
                 }
               }}
             >
               {node.title || 'Untitled'}
             </span>
           )}
        </div>
        
        {renderNodeExtra && <div className={styles.nodeExtra}>{renderNodeExtra(node)}</div>}

        {hasActions && (
          <button
            type="button"
            className={styles.contextMenuTrigger}
            title="Node actions"
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setContextMenu({ x: rect.right, y: rect.bottom });
            }}
          >
            •••
          </button>
        )}
      </div>

      {dropPosition === 'after' && <div className={styles.dropBar} />}
      
      {isExpanded && children.length > 0 && (
        <div className={styles.childrenContainer}>
          {children.map(child => (
            <ControlTreeNodeComponent 
              key={child.id} 
              node={child} 
              tree={tree} 
              renderNodeExtra={renderNodeExtra}
              isEditing={isEditing}
              onMoveNode={onMoveNode}
              onAddGroup={onAddGroup}
              onAddControl={onAddControl}
              onDeleteNode={onDeleteNode}
              onRenameGroup={onRenameGroup}
              onWithdrawNode={onWithdrawNode}
              onRestoreNode={onRestoreNode}
              onWithdrawAllInGroup={onWithdrawAllInGroup}
              onRestoreAllInGroup={onRestoreAllInGroup}
              onExcludeFromBaseline={onExcludeFromBaseline}
              onIncludeInBaseline={onIncludeInBaseline}
              excludedControlIds={excludedControlIds}
              onDragStartNode={onDragStartNode}
              onDragEndNode={onDragEndNode}
              activeDraggedId={activeDraggedId}
              onUnassignControl={onUnassignControl}
            />
          ))}
        </div>
      )}

      {contextMenu && (
        <TreeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={node}
          onClose={() => setContextMenu(null)}
          onAddGroup={onAddGroup}
          onAddControl={onAddControl}
          onDeleteNode={onDeleteNode}
          onRenameNode={onRenameGroup ? () => setIsInlineEditing(true) : undefined}
          onWithdrawNode={onWithdrawNode}
          onRestoreNode={onRestoreNode}
          onWithdrawAllInGroup={onWithdrawAllInGroup}
          onRestoreAllInGroup={onRestoreAllInGroup}
          onExcludeFromBaseline={onExcludeFromBaseline}
          onIncludeInBaseline={onIncludeInBaseline}
          isExcludedFromBaseline={excludedControlIds?.has(node.id?.toLowerCase())}
          onUnassignControl={onUnassignControl}
        />
      )}
    </div>
  );
};

