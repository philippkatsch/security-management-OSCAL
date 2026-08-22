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
  onWithdrawNode?: (controlId: string) => void;
  onRestoreNode?: (controlId: string) => void;
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
  onWithdrawNode,
  onRestoreNode
}) => {
  const [activeDraggedId, setActiveDraggedId] = useState<string | null>(null);

  // We only render root nodes that are in the filtered list
  const rootNodes = useMemo(() => {
     return tree.filteredNodes.filter(n => n.parentId === null);
  }, [tree.filteredNodes]);
  
  return (
    <ErrorBoundary>
      <div className={`${styles.treeContainer} ${className}`}>
        {headerContent}
        <ControlTreeSearch 
          searchQuery={tree.searchQuery} 
          onSearchChange={tree.setSearchQuery} 
          resultCount={tree.filteredNodes.length}
        />
        <div className={styles.nodesContainer}>
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
              onWithdrawNode={onWithdrawNode}
              onRestoreNode={onRestoreNode}
              onDragStartNode={(id) => setActiveDraggedId(id)}
              onDragEndNode={() => setActiveDraggedId(null)}
              activeDraggedId={activeDraggedId}
            />
          ))}
          {rootNodes.length === 0 && (
            <div className={styles.noResults}>No matches found.</div>
          )}
        </div>

        {isEditing && (onAddGroup || onAddControl) && (
          <div className={styles.treeActionFooter}>
            {onAddGroup && (
              <button
                type="button"
                className={styles.treeActionButton}
                onClick={() => onAddGroup(null)}
                title="Add a new top-level group"
              >
                <span>➕</span>
                <span>Add Group</span>
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
