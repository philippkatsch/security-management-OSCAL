import React from 'react';
import styles from './ControlTree.module.css';

interface ControlTreeSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  resultCount: number;
}

export const ControlTreeSearch: React.FC<ControlTreeSearchProps> = ({ searchQuery, onSearchChange, resultCount }) => {
  return (
    <div className={styles.searchContainer}>
      <input
        type="text"
        className={styles.searchInput}
        placeholder="Filter controls..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        data-testid="control-tree-search"
      />
      {searchQuery && (
        <span className={styles.searchCount}>
          {resultCount} match{resultCount !== 1 ? 'es' : ''}
        </span>
      )}
    </div>
  );
};
