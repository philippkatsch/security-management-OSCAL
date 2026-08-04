import React from 'react';
import './Dashboard.css';

export default function CompletenessReport({ 
  title, 
  sections = [], 
  onNavigate, 
  className = '' 
}) {
  const passes = sections.filter(s => s.status === 'pass').length;
  const warnings = sections.filter(s => s.status === 'warn').length;
  const failures = sections.filter(s => s.status === 'fail').length;

  const renderIcon = (status) => {
    switch (status) {
      case 'pass': return '✅';
      case 'warn': return '⚠️';
      case 'fail': return '❌';
      default: return '❓';
    }
  };

  const handleRowClick = (link) => {
    if (typeof onNavigate === 'function' && link) {
      onNavigate(link);
    }
  };

  return (
    <div className={`dashboard-card completeness-report ${className}`}>
      {title && (
        <div className="completeness-header">
          <h3 className="completeness-title">{title}</h3>
          <div className="completeness-summary">
            {passes > 0 && <span className="summary-chip pass">{passes} passed</span>}
            {warnings > 0 && <span className="summary-chip warn">{warnings} warnings</span>}
            {failures > 0 && <span className="summary-chip fail">{failures} failures</span>}
          </div>
        </div>
      )}
      
      <div className="completeness-list">
        {sections.map((section, idx) => (
          <div 
            key={idx} 
            className={`completeness-row ${section.status} ${section.link && onNavigate ? 'clickable' : ''}`}
            onClick={() => handleRowClick(section.link)}
            role={section.link && onNavigate ? 'button' : 'listitem'}
            tabIndex={section.link && onNavigate ? 0 : undefined}
          >
            <div className="completeness-row-icon">
              {renderIcon(section.status)}
            </div>
            <div className="completeness-row-content">
              <div className="completeness-row-title-group">
                <span className="completeness-row-name">{section.name}</span>
                {section.count !== undefined && section.count > 0 && (
                  <span className="completeness-row-badge">{section.count}</span>
                )}
              </div>
              <p className="completeness-row-message">{section.message}</p>
            </div>
            {section.link && onNavigate && (
              <div className="completeness-row-action">
                <span className="nav-arrow">→</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
