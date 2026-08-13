import React from 'react';
import styles from './EntityTable.module.css';
import sharedStyles from '../SharedComponents.module.css';

export default function BatchActionToolbar({ selectedCount, actions, onDeselectAll, selectedRows }) {
  return (
    <div className={styles['batch-action-toolbar']}>
      <div className={styles['batch-info']}>
        <span>{selectedCount} items selected</span>
        <button className={styles['btn-deselect']} onClick={onDeselectAll}>Deselect all</button>
      </div>
      <div className={styles['batch-actions']}>
        {actions.map((action, idx) => (
          <button 
            key={idx}
            className={`btn-${action.variant || 'secondary'} ${action.destructive ? 'btn-delete' : ''}`}
            onClick={() => action.onClick(selectedRows)}
          >
            {action.icon && <span className={sharedStyles['btn-icon']}>{action.icon}</span>}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
