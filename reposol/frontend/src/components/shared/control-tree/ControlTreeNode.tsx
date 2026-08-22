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
  onWithdrawNode?: (controlId: string) => void;
  onRestoreNode?: (controlId: string) => void;
  isDraggingNode?: boolean;
  onDragStartNode?: (nodeId: string) => void;
  onDragEndNode?: () => void;
  activeDraggedId?: string | null;
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
  onWithdrawNode,
  onRestoreNode,
  onDragStartNode,
  onDragEndNode,
  activeDraggedId
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'inside' | 'after' | null>(null);

  const isSelected = tree.selectedId === node.id;
  const isExpanded = tree.expandedIds.has(node.id) || tree.searchQuery.trim() !== '';
  const isBeingDragged = activeDraggedId === node.id;
  
  // Find children from filteredNodes to respect search
  const children = tree.filteredNodes.filter(n => n.parentId === node.id);
  
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    tree.toggleExpand(node.id);
  };
  
  const handleSelect = () => {
    tree.select(node.id);
    if (node.type === 'group') {
      tree.toggleExpand(node.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isEditing) return;
    if (onAddGroup || onAddControl || onDeleteNode || onWithdrawNode || onRestoreNode) {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (!isEditing || !onMoveNode) return;
    e.dataTransfer.setData('text/plain', node.id);
    e.dataTransfer.setData('nodeType', node.type);
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStartNode) onDragStartNode(node.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isEditing || !onMoveNode || !activeDraggedId || activeDraggedId === node.id) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;

    if (node.type === 'group') {
      if (offsetY < height * 0.25) {
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

    const draggedId = e.dataTransfer.getData('text/plain') || activeDraggedId;
    if (!draggedId || draggedId === node.id) {
      setDropPosition(null);
      return;
    }

    // Determine siblings of this node
    const siblings = tree.flatList.filter(n => n.parentId === node.parentId);
    const nodeIndex = siblings.findIndex(n => n.id === node.id);

    if (dropPosition === 'inside' && node.type === 'group') {
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
  
  // Do not render if not in filtered nodes (when searching)
  if (!tree.filteredNodes.some(n => n.id === node.id)) {
      return null;
  }
  
  const hasActions = isEditing && (onAddGroup || onAddControl || onDeleteNode || onWithdrawNode || onRestoreNode);

  return (
    <div className={styles.nodeWrapper}>
      {dropPosition === 'before' && <div className={styles.dropBar} />}
      
      <div 
        className={`${styles.nodeRow} ${isSelected ? styles.selected : ''} ${node.withdrawn ? styles.withdrawn : ''} ${dropPosition === 'inside' ? styles.dropInside : ''} ${isBeingDragged ? styles.draggingNode : ''}`}
        style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
        onClick={handleSelect}
        onContextMenu={handleContextMenu}
        draggable={isEditing && !!onMoveNode}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        data-testid={`tree-node-${node.id}`}
        data-dnd-id={node.id}
      >
        {isEditing && onMoveNode && (
          <span className={styles.dragHandle} title="Drag to reorder">
            ⋮⋮
          </span>
        )}

        <span className={styles.toggleIcon} onClick={handleToggle}>
           {children.length > 0 ? (isExpanded ? '▼' : '▶') : <span style={{display: 'inline-block', width: '12px'}}></span>}
        </span>
        
        {node.type === 'group' && <span className={styles.typeIcon}>📁</span>}
        
        <div className={styles.nodeContent}>
           <span className={styles.nodeLabel}>{node.label || node.id}</span>
           <span className={styles.nodeTitle}>{node.title || 'Untitled'}</span>
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
              onWithdrawNode={onWithdrawNode}
              onRestoreNode={onRestoreNode}
              onDragStartNode={onDragStartNode}
              onDragEndNode={onDragEndNode}
              activeDraggedId={activeDraggedId}
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
          onWithdrawNode={onWithdrawNode}
          onRestoreNode={onRestoreNode}
        />
      )}
    </div>
  );
};
