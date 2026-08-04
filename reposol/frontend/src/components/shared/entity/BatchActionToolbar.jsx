import React from 'react';
import './EntityTable.css';

export default function BatchActionToolbar({ selectedCount, actions, onDeselectAll, selectedRows }) {
  return (
    <div className="batch-action-toolbar">
      <div className="batch-info">
        <span>{selectedCount} items selected</span>
        <button className="btn-deselect" onClick={onDeselectAll}>Deselect all</button>
      </div>
      <div className="batch-actions">
        {actions.map((action, idx) => (
          <button 
            key={idx}
            className={`btn-${action.variant || 'secondary'} ${action.destructive ? 'btn-delete' : ''}`}
            onClick={() => action.onClick(selectedRows)}
          >
            {action.icon && <span className="btn-icon">{action.icon}</span>}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
