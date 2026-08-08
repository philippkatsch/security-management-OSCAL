import React, { useState, useMemo, useEffect } from 'react';
import './EntityTable.css';
import BatchActionToolbar from './BatchActionToolbar';

export default function EntityTable({ columns, data, entities, onRowClick, onSelectionChange, actions, emptyState, addButton, onAdd, addLabel, className = '' }) {
  const rowData = data || entities || [];
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
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
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
      const allIds = new Set(paginatedData.map(row => row.id));
      setSelectedRows(allIds);
      if (onSelectionChange) onSelectionChange(Array.from(allIds));
    } else {
      setSelectedRows(new Set());
      if (onSelectionChange) onSelectionChange([]);
    }
  };

  const handleSelectRow = (row, e) => {
    e.stopPropagation();
    const newSelection = new Set(selectedRows);
    if (newSelection.has(row.id)) {
      newSelection.delete(row.id);
    } else {
      newSelection.add(row.id);
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
      <div className="entity-table-header">
        <div className="entity-table-search">
          <span className="search-icon">🔍</span>
          <input 
            type="text" 
            placeholder="Search..." 
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button className="clear-search" onClick={() => setSearchInput('')}>×</button>
          )}
        </div>
        {finalAddBtn && (
          <button className="btn-primary add-button" onClick={finalAddBtn.onClick}>
            {finalAddBtn.label}
          </button>
        )}
      </div>

      <div className="table-responsive-wrapper">
        <table className="entity-table">
          <thead>
            <tr>
              {onSelectionChange && (
                <th className="checkbox-cell">
                  <input 
                    type="checkbox" 
                    checked={paginatedData.length > 0 && selectedRows.size === paginatedData.length}
                    onChange={handleSelectAll}
                  />
                </th>
              )}
              {columns.map(col => (
                <th key={col.key} style={{ width: col.width }}>
                  <div className="th-content">
                    <span 
                      className={`th-label ${col.sortable ? 'sortable' : ''}`}
                      onClick={() => col.sortable && handleSort(col.key)}
                    >
                      {col.label}
                      {sortConfig.key === col.key && (
                        <span className="sort-indicator">
                          {sortConfig.direction === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </span>
                    {col.filterable && (
                      <select 
                        className="th-filter"
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
                <td colSpan={columns.length + (onSelectionChange ? 1 : 0)}>
                  {emptyState ? (
                    <div className="empty-state">
                      {emptyState.icon && <div className="empty-icon">{emptyState.icon}</div>}
                      <h3>{emptyState.title}</h3>
                      <p>{emptyState.description}</p>
                      {emptyState.actionLabel && (
                        <button className="btn-primary" onClick={emptyState.onAction}>
                          {emptyState.actionLabel}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="empty-state">No data available</div>
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
                    className={selectedRows.has(rowKey) ? 'selected' : ''}
                  >
                    {onSelectionChange && (
                      <td className="checkbox-cell" onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={selectedRows.has(rowKey)}
                          onChange={(e) => handleSelectRow(row, e)}
                        />
                      </td>
                    )}
                    {columns.map(col => {
                      const val = row[col.key];
                      const cellContent = col.render ? col.render(val, row) : val;
                      return (
                        <td key={col.key}>
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
        <div className="pagination">
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

      {selectedRows.size > 0 && actions && (
        <BatchActionToolbar 
          selectedCount={selectedRows.size} 
          actions={actions}
          onDeselectAll={() => {
            setSelectedRows(new Set());
            if (onSelectionChange) onSelectionChange([]);
          }}
          selectedRows={data.filter(d => selectedRows.has(d.id))}
        />
      )}
    </div>
  );
}
