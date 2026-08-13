import React from 'react';
import styles from './EntityTable.module.css';
import sharedStyles from '../SharedComponents.module.css';

export default function EntityDetailPanel({ mode = 'slide-out', isOpen, onClose, title, subtitle, badge, actions, children, className = '' }) {
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (mode === 'slide-out' && !isOpen) return null;

  const renderHeader = () => (
    <div className={styles['entity-panel-header']}>
      <div className={styles['entity-panel-title-group']}>
        <h2 className={styles['entity-panel-title']}>{title}</h2>
        {badge && <div className="entity-panel-badge">{badge}</div>}
        {subtitle && <span className={styles['entity-panel-subtitle']}>{subtitle}</span>}
      </div>
      <div className={styles['entity-panel-actions']}>
        {actions && actions.map((action, idx) => (
          <button 
            key={idx} 
            className={`btn-${action.variant || 'secondary'} ${action.destructive ? 'destructive' : ''}`}
            onClick={action.onClick}
          >
            {action.icon && <span className={sharedStyles['btn-icon']}>{action.icon}</span>}
            {action.label}
          </button>
        ))}
        {mode === 'slide-out' && (
          <button className={styles['btn-close']} onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
      </div>
    </div>
  );

  if (mode === 'accordion') {
    return (
      <div className={`entity-panel-accordion ${isOpen ? styles['open'] : ''} ${className}`}>
        <div onClick={onClose} style={{cursor: 'pointer'}}>
          {renderHeader()}
        </div>
        {isOpen && <div className={styles['entity-panel-content']}>{children}</div>}
      </div>
    );
  }

  if (mode === 'full-page') {
    return (
      <div className={`entity-panel-full-page ${className}`}>
        <div className={styles['breadcrumb-nav']}>
          <button onClick={onClose} className={styles['btn-back']}>← Back</button>
        </div>
        {renderHeader()}
        <div className={styles['entity-panel-content']}>{children}</div>
      </div>
    );
  }

  // Slide-out mode
  return (
    <>
      <div className={styles['entity-panel-backdrop']} onClick={onClose} />
      <div className={`entity-panel-slide-out ${isOpen ? styles['open'] : ''} ${className}`}>
        {renderHeader()}
        <div className={styles['entity-panel-content']}>{children}</div>
      </div>
    </>
  );
}
