import React from 'react';
import { TreeVisibilityFilter } from '../../../hooks/useControlTree';
import { TreeFilterPopover } from './TreeFilterPopover';
import styles from './ControlTree.module.css';

interface ControlTreeSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  resultCount: number;
  visibilityFilter?: TreeVisibilityFilter;
  onVisibilityFilterChange?: (filter: TreeVisibilityFilter) => void;
  showStatusFilter?: boolean;
  showUnassignedOption?: boolean;
}

export const ControlTreeSearch: React.FC<ControlTreeSearchProps> = ({
  searchQuery,
  onSearchChange,
  resultCount,
  visibilityFilter = { showActive: true, showExcluded: true, showWithdrawn: false },
  onVisibilityFilterChange,
  showStatusFilter = false,
  showUnassignedOption = false
}) => {
  return (
    <div className={styles.searchContainer}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Filter controls..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          data-testid="control-tree-search"
          style={{ flex: 1, minWidth: 0 }}
        />
        {showStatusFilter && onVisibilityFilterChange && (
          <TreeFilterPopover
            filter={visibilityFilter}
            onChange={onVisibilityFilterChange}
            testId="control-tree-filter"
            align="right"
            showUnassignedOption={showUnassignedOption}
          />
        )}
      </div>
      {searchQuery && (
        <span className={styles.searchCount}>
          {resultCount} match{resultCount !== 1 ? 'es' : ''}
        </span>
      )}
    </div>
  );
};
