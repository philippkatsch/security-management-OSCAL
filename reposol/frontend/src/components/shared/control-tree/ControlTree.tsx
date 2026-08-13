import React, { useMemo } from 'react';
import { UseControlTreeReturn, ControlTreeNode } from '../../../hooks/useControlTree';
import { ControlTreeSearch } from './ControlTreeSearch';
import { ControlTreeNodeComponent } from './ControlTreeNode';
import styles from './ControlTree.module.css';

interface ControlTreeProps {
  tree: UseControlTreeReturn;
  renderNodeExtra?: (node: ControlTreeNode) => React.ReactNode;
  className?: string;
  headerContent?: React.ReactNode;
}

export const ControlTree: React.FC<ControlTreeProps> = ({ tree, renderNodeExtra, className = '', headerContent }) => {
  // We only render root nodes that are in the filtered list
  const rootNodes = useMemo(() => {
     return tree.filteredNodes.filter(n => n.parentId === null);
  }, [tree.filteredNodes]);
  
  return (
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
          />
        ))}
        {rootNodes.length === 0 && (
          <div className={styles.noResults}>No matches found.</div>
        )}
      </div>
    </div>
  );
};
