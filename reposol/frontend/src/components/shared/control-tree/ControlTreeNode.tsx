import React, { useMemo } from 'react';
import { UseControlTreeReturn, ControlTreeNode } from '../../../hooks/useControlTree';
import styles from './ControlTree.module.css';

interface ControlTreeNodeProps {
  node: ControlTreeNode;
  tree: UseControlTreeReturn;
  renderNodeExtra?: (node: ControlTreeNode) => React.ReactNode;
}

export const ControlTreeNodeComponent: React.FC<ControlTreeNodeProps> = ({ node, tree, renderNodeExtra }) => {
  const isSelected = tree.selectedId === node.id;
  const isExpanded = tree.expandedIds.has(node.id) || tree.searchQuery.trim() !== '';
  
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
  
  // Do not render if not in filtered nodes (when searching)
  if (!tree.filteredNodes.some(n => n.id === node.id)) {
      return null;
  }
  
  return (
    <div className={styles.nodeWrapper}>
      <div 
        className={`${styles.nodeRow} ${isSelected ? styles.selected : ''} ${node.withdrawn ? styles.withdrawn : ''}`}
        style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
        onClick={handleSelect}
        data-testid={`tree-node-${node.id}`}
        data-dnd-id={node.id}
      >
        <span className={styles.toggleIcon} onClick={handleToggle}>
           {children.length > 0 ? (isExpanded ? '▼' : '▶') : <span style={{display: 'inline-block', width: '12px'}}></span>}
        </span>
        
        {node.type === 'group' && <span className={styles.typeIcon}>📁</span>}
        
        <div className={styles.nodeContent}>
           <span className={styles.nodeLabel}>{node.label || node.id}</span>
           <span className={styles.nodeTitle}>{node.title || 'Untitled'}</span>
        </div>
        
        {renderNodeExtra && <div className={styles.nodeExtra}>{renderNodeExtra(node)}</div>}
      </div>
      
      {isExpanded && children.length > 0 && (
        <div className={styles.childrenContainer}>
          {children.map(child => (
            <ControlTreeNodeComponent 
              key={child.id} 
              node={child} 
              tree={tree} 
              renderNodeExtra={renderNodeExtra} 
            />
          ))}
        </div>
      )}
    </div>
  );
};
