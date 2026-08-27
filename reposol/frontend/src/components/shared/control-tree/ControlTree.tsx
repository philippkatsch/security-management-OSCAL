import React, { useState, useMemo } from 'react';
import { UseControlTreeReturn, ControlTreeNode } from '../../../hooks/useControlTree';
import { ControlTreeSearch } from './ControlTreeSearch';
import { ControlTreeNodeComponent } from './ControlTreeNode';
import { ErrorBoundary } from '@components/shared/ui/ErrorBoundary';
import styles from './ControlTree.module.css';

export interface ControlTreeProps {
  tree: UseControlTreeReturn;
  renderNodeExtra?: (node: ControlTreeNode) => React.ReactNode;
  className?: string;
  headerContent?: React.ReactNode;
  isEditing?: boolean;
  onMoveNode?: (nodeId: string, targetParentId: string | null, targetIndex?: number) => void;
  onAddGroup?: (parentGroupId: string | null) => void;
  onAddControl?: (parentGroupId: string | null) => void;
  onDeleteNode?: (nodeId: string, nodeType: 'group' | 'control') => void;
  onRenameGroup?: (groupId: string, newTitle: string, newId?: string) => void;
  addGroupLabel?: string;
  onWithdrawNode?: (controlId: string) => void;
  onRestoreNode?: (controlId: string) => void;
  onWithdrawAllInGroup?: (groupId: string) => void;
  onRestoreAllInGroup?: (groupId: string) => void;
  // Profile mode: Exclude/Include from baseline
  onExcludeFromBaseline?: (controlId: string) => void;
  onIncludeInBaseline?: (controlId: string) => void;
  excludedControlIds?: Set<string>;
  onUnassignControl?: (controlId: string, sourceGroupId?: string | null) => void;
  showUnassignedOption?: boolean;
}

export const ControlTree: React.FC<ControlTreeProps> = ({
  tree,
  renderNodeExtra,
  className = '',
  headerContent,
  isEditing = false,
  onMoveNode,
  onAddGroup,
  onAddControl,
  onDeleteNode,
  onRenameGroup,
  addGroupLabel,
  onWithdrawNode,
  onRestoreNode,
  onWithdrawAllInGroup,
  onRestoreAllInGroup,
  onExcludeFromBaseline,
  onIncludeInBaseline,
  excludedControlIds,
  onUnassignControl,
  showUnassignedOption = false
}) => {
  const [activeDraggedId, setActiveDraggedId] = useState<string | null>(null);
  const [isDragOverTree, setIsDragOverTree] = useState(false);

  // We only render root nodes that are in the filtered list
  const rootNodes = useMemo(() => {
     return tree.filteredNodes.filter(n => n.parentId === null);
  }, [tree.filteredNodes]);
  
  const handleDragOver = (e: React.DragEvent) => {
    if (!isEditing) return;
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    setIsDragOverTree(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOverTree(false);
    }
  };

  const handleContainerDrop = (e: React.DragEvent) => {
    setIsDragOverTree(false);
    if (!isEditing || !onMoveNode) return;
    
    const rawGroup = e.dataTransfer.getData('application/x-oscal-group-pool');
    if (rawGroup) {
      try {
        const parsedGroup = JSON.parse(rawGroup);
        if (parsedGroup.group || parsedGroup.id) {
          const payload = JSON.stringify({
            type: 'catalog-group-structure',
            group: parsedGroup.group || { id: parsedGroup.id, title: parsedGroup.title, controlIds: parsedGroup.controlIds }
          });
          onMoveNode(payload, null);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      } catch (err) {
        console.error('Failed to drop group on tree root', err);
      }
    }

    const rawControl = e.dataTransfer.getData('application/x-oscal-control');
    if (rawControl) {
      try {
        const parsed = JSON.parse(rawControl);
        if (parsed?.controlIds && Array.isArray(parsed.controlIds) && parsed.controlIds.length > 1) {
          const payload = JSON.stringify({ type: 'batch-controls', controlIds: parsed.controlIds });
          onMoveNode(payload, null);
          e.preventDefault();
          e.stopPropagation();
          return;
        } else if (parsed?.id) {
          onMoveNode(parsed.id, null);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      } catch (err) {
        console.error('Failed to drop control on tree root', err);
      }
    }

    const fallbackId = e.dataTransfer.getData('text/plain') || activeDraggedId;
    if (fallbackId) {
      onMoveNode(fallbackId, null);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  };

  return (
    <ErrorBoundary>
      <div 
        className={`${styles.treeContainer} ${className}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleContainerDrop}
      >
        {headerContent}
        <ControlTreeSearch 
          searchQuery={tree.searchQuery} 
          onSearchChange={tree.setSearchQuery} 
          resultCount={tree.filteredNodes.length}
          visibilityFilter={tree.visibilityFilter}
          onVisibilityFilterChange={tree.setVisibilityFilter}
          showStatusFilter={true}
          showUnassignedOption={showUnassignedOption}
        />
        <div 
          className={styles.nodesContainer}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleContainerDrop}
          style={{
            minHeight: '120px',
            border: isDragOverTree ? '2px dashed var(--color-primary, #3b82f6)' : '2px dashed transparent',
            borderRadius: 'var(--radius-md)',
            background: isDragOverTree ? 'rgba(59, 130, 246, 0.06)' : undefined,
            transition: 'all 0.15s ease-in-out'
          }}
        >
          {isDragOverTree && (
            <div
              data-testid="sidebar-tree-dropzone"
              onDragOver={handleDragOver}
              onDrop={handleContainerDrop}
              style={{
                margin: '8px 4px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--color-primary, #3b82f6)',
                textAlign: 'center',
                fontSize: '12.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <span style={{ fontSize: '16px' }}>📥</span>
              <span>Drop here</span>
            </div>
          )}

          {rootNodes.map(node => (
            <ControlTreeNodeComponent 
              key={node.id} 
              node={node} 
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
              onDragStartNode={(id) => setActiveDraggedId(id)}
              onDragEndNode={() => setActiveDraggedId(null)}
              activeDraggedId={activeDraggedId}
              onUnassignControl={onUnassignControl}
            />
          ))}

          {rootNodes.length === 0 && !isDragOverTree && (
            tree.searchQuery ? (
              <div className={styles.noResults}>No matches found for "{tree.searchQuery}".</div>
            ) : (
              <div
                data-testid="empty-custom-groups-placeholder"
                style={{
                  padding: '24px 14px',
                  margin: '12px 4px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--color-border)',
                  background: 'var(--color-surface-2)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span style={{ fontSize: '28px' }}>📂</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                  No Custom Groups
                </span>
                <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                  Drag groups (e.g. <strong>GOVERN</strong>) or controls from the pool on the right and drop them here.
                </span>
              </div>
            )
          )}
        </div>

        {isEditing && (onAddGroup || onAddControl) && (
          <div className={styles.treeActionFooter}>
            {onAddGroup && (
              <button
                type="button"
                data-testid="add-custom-group-btn"
                className={styles.treeActionButton}
                onClick={() => onAddGroup(null)}
                title="Add a new top-level group"
              >
                <span>➕</span>
                <span>{addGroupLabel || 'Add Group'}</span>
              </button>
            )}
            {onAddControl && (
              <button
                type="button"
                className={styles.treeActionButton}
                onClick={() => onAddControl(null)}
                title="Add a new control"
              >
                <span>➕</span>
                <span>Add Control</span>
              </button>
            )}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};
