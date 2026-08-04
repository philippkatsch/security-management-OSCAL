import React from 'react';
import './EntityTable.css';

export default function EntityDetailPanel({ mode = 'slide-out', isOpen, onClose, title, subtitle, badge, actions, children, className = '' }) {
  if (mode === 'slide-out' && !isOpen) return null;

  const renderHeader = () => (
    <div className="entity-panel-header">
      <div className="entity-panel-title-group">
        <h2 className="entity-panel-title">{title}</h2>
        {badge && <div className="entity-panel-badge">{badge}</div>}
        {subtitle && <span className="entity-panel-subtitle">{subtitle}</span>}
      </div>
      <div className="entity-panel-actions">
        {actions && actions.map((action, idx) => (
          <button 
            key={idx} 
            className={`btn-${action.variant || 'secondary'} ${action.destructive ? 'destructive' : ''}`}
            onClick={action.onClick}
          >
            {action.icon && <span className="btn-icon">{action.icon}</span>}
            {action.label}
          </button>
        ))}
        {mode === 'slide-out' && (
          <button className="btn-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
      </div>
    </div>
  );

  if (mode === 'accordion') {
    return (
      <div className={`entity-panel-accordion ${isOpen ? 'open' : ''} ${className}`}>
        <div onClick={onClose} style={{cursor: 'pointer'}}>
          {renderHeader()}
        </div>
        {isOpen && <div className="entity-panel-content">{children}</div>}
      </div>
    );
  }

  if (mode === 'full-page') {
    return (
      <div className={`entity-panel-full-page ${className}`}>
        <div className="breadcrumb-nav">
          <button onClick={onClose} className="btn-back">← Back</button>
        </div>
        {renderHeader()}
        <div className="entity-panel-content">{children}</div>
      </div>
    );
  }

  // Slide-out mode
  return (
    <>
      <div className="entity-panel-backdrop" onClick={onClose} />
      <div className={`entity-panel-slide-out ${isOpen ? 'open' : ''} ${className}`}>
        {renderHeader()}
        <div className="entity-panel-content">{children}</div>
      </div>
    </>
  );
}
