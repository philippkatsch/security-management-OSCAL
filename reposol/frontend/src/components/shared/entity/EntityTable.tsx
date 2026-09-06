import React, { useState, useMemo, useEffect } from 'react';
import styles from './EntityTable.module.css';
import sharedStyles from '../SharedComponents.module.css';
import BatchActionToolbar from './BatchActionToolbar';

export interface EntityTableColumn {
  key: string;
  label: string;
  width?: string | number;
  sortable?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
}

export interface EntityTableProps {
  columns: EntityTableColumn[];
  data?: any[];
  onRowClick?: (row: any) => void;
  onSelectionChange?: (selectedRows: any[]) => void;
  actions?: any[];
  emptyState?: {
    icon?: React.ReactNode;
    title?: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
  };
  addButton?: {
    label: string;
    onClick: () => void;
  } | null;
  onAdd?: () => void;
  onDelete?: (ids: string[]) => void;
  addLabel?: string;
  className?: string;
}

export default function EntityTable({ 
  columns = [], 
  data = [], 
  onRowClick, 
  onSelectionChange, 
  actions, 
  emptyState, 
  addButton, 
  onAdd, 
  onDelete,
  addLabel, 
  className = '' 
}: EntityTableProps) {
  const rowData = data || [];
  const hasCheckboxes = Boolean(onSelectionChange || onDelete || (actions && actions.length > 0));
  const finalAddBtn = addButton || (onAdd ? { label: addLabel || '+ Add Item', onClick: onAdd } : null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({});
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      key = null;
    }
    setSortConfig({ key, direction });
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setCurrentPage(1);
  };

  const filteredData = useMemo(() => {
    let result = [...rowData];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const searchableCols = columns.filter(c => c.searchable).map(c => c.key);
      result = result.filter(row => 
        searchableCols.some(col => String(row[col] || '').toLowerCase().includes(searchLower))
      );
    }

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        result = result.filter(row => String(row[key]) === String(value));
      }
    });

    if (sortConfig.key) {
      const sortKey = sortConfig.key;
      result.sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, columns, searchTerm, filters, sortConfig]);

  const paginatedData = useMemo(() => {
    if (filteredData.length <= 50 && currentPage === 1) return filteredData;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredData.slice(startIndex, startIndex + pageSize);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / pageSize);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = new Set(paginatedData.map(row => row.uuid || row.id));
      setSelectedRows(allIds);
      if (onSelectionChange) onSelectionChange(paginatedData);
    } else {
      setSelectedRows(new Set());
      if (onSelectionChange) onSelectionChange([]);
    }
  };

  const handleSelectRow = (row, e) => {
    e.stopPropagation();
    const rowKey = row.uuid || row.id;
    const newSelection = new Set(selectedRows);
    if (newSelection.has(rowKey)) {
      newSelection.delete(rowKey);
    } else {
      newSelection.add(rowKey);
    }
    setSelectedRows(newSelection);
    if (onSelectionChange) {
      const selected = rowData.filter(d => newSelection.has(d.uuid || d.id));
      onSelectionChange(selected);
    }
  };

  const getUniqueValues = (key) => {
    return [...new Set(rowData.map(row => row[key]).filter(Boolean))];
  };

  return (
    <div className={`entity-table-container ${className}`}>
      <div className={styles['entity-table-header']}>
        <div className={styles['entity-table-search']}>
          <span className={styles['search-icon']}>🔍</span>
          <input 
            type="text" 
            placeholder="Search..." 
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button className={styles['clear-search']} onClick={() => setSearchInput('')}>×</button>
          )}
        </div>
        {finalAddBtn && (
          <button className={[sharedStyles['btn-primary'], 'add-button'].filter(Boolean).join(' ')} onClick={finalAddBtn.onClick}>
            {finalAddBtn.label}
          </button>
        )}
      </div>

      <div className={styles['table-responsive-wrapper']}>
        <table className={styles['entity-table']}>
          <thead>
            <tr>
              {hasCheckboxes && (
                <th className={styles['checkbox-cell']}>
                  <input 
                    type="checkbox" 
                    checked={paginatedData.length > 0 && selectedRows.size === paginatedData.length}
                    onChange={handleSelectAll}
                  />
                </th>
              )}
              {columns.map(col => (
                <th key={col.key} style={{ width: col.width }}>
                  <div className={styles['th-content']}>
                    <span 
                      className={`th-label ${col.sortable ? styles['sortable'] : ''}`}
                      onClick={() => col.sortable && handleSort(col.key)}
                    >
                      {col.label}
                      {sortConfig.key === col.key && (
                        <span className={styles['sort-indicator']}>
                          {sortConfig.direction === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </span>
                    {col.filterable && (
                      <select 
                        className={styles['th-filter']}
                        value={filters[col.key] || ''}
                        onChange={(e) => handleFilterChange(col.key, e.target.value)}
                      >
                        <option value="">All</option>
                        {getUniqueValues(col.key).map(val => (
                          <option key={val} value={val}>{val}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (hasCheckboxes ? 1 : 0)}>
                  {emptyState ? (
                    <div className={styles['empty-state']}>
                      {emptyState.icon && <div className={styles['empty-icon']}>{emptyState.icon}</div>}
                      <h3>{emptyState.title}</h3>
                      <p>{emptyState.description}</p>
                      {emptyState.actionLabel && (
                        <button className={sharedStyles['btn-primary']} onClick={emptyState.onAction}>
                          {emptyState.actionLabel}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className={styles['empty-state']}>No data available</div>
                  )}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => {
                const rowKey = row.uuid || row.id || `row-${idx}`;
                return (
                  <tr 
                    key={rowKey} 
                    onClick={() => onRowClick && onRowClick(row)}
                    className={selectedRows.has(rowKey) ? styles['selected'] : ''}
                  >
                    {hasCheckboxes && (
                      <td className={styles['checkbox-cell']} onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          aria-label={`Select row ${row.source || row.title || row.id || ''}`.trim()}
                          checked={selectedRows.has(rowKey)}
                          onChange={(e) => handleSelectRow(row, e)}
                        />
                      </td>
                    )}
                    {columns.map(col => {
                      const val = row[col.key];
                      const cellContent = col.render ? col.render(val, row) : val;
                      return (
                        <td key={col.key} aria-label={typeof val === 'string' ? val : undefined}>
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {filteredData.length > 50 && (
        <div className={styles['pagination']}>
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            Prev
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {selectedRows.size > 0 && (actions || onDelete) && (
        <BatchActionToolbar 
          selectedCount={selectedRows.size} 
          actions={actions || (onDelete ? [{
            label: 'Delete Selected',
            variant: 'danger',
            destructive: true,
            onClick: (rows: any[]) => {
              const ids = Array.isArray(rows) 
                ? rows.map(r => r.uuid || r.id).filter(Boolean)
                : Array.from(selectedRows) as string[];
              onDelete(ids);
              setSelectedRows(new Set());
            }
          }] : [])}
          onDeselectAll={() => {
            setSelectedRows(new Set());
            if (onSelectionChange) onSelectionChange([]);
          }}
          selectedRows={rowData.filter(d => selectedRows.has(d.uuid || d.id))}
        />
      )}
    </div>
  );
}
