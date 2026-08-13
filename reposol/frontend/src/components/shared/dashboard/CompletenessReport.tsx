import React from 'react';
import styles from '../../dashboard/DashboardPage.module.css';

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
        <div className={styles['completeness-header']}>
          <h3 className={styles['completeness-title']}>{title}</h3>
          <div className={styles['completeness-summary']}>
            {passes > 0 && <span className={[styles['summary-chip'], styles['pass']].filter(Boolean).join(' ')}>{passes} passed</span>}
            {warnings > 0 && <span className={[styles['summary-chip'], styles['warn']].filter(Boolean).join(' ')}>{warnings} warnings</span>}
            {failures > 0 && <span className={[styles['summary-chip'], styles['fail']].filter(Boolean).join(' ')}>{failures} failures</span>}
          </div>
        </div>
      )}
      
      <div className={styles['completeness-list']}>
        {sections.map((section, idx) => (
          <div 
            key={idx} 
            className={`completeness-row ${section.status} ${section.link && onNavigate ? 'clickable' : ''}`}
            onClick={() => handleRowClick(section.link)}
            role={section.link && onNavigate ? 'button' : 'listitem'}
            tabIndex={section.link && onNavigate ? 0 : undefined}
          >
            <div className={styles['completeness-row-icon']}>
              {renderIcon(section.status)}
            </div>
            <div className={styles['completeness-row-content']}>
              <div className={styles['completeness-row-title-group']}>
                <span className={styles['completeness-row-name']}>{section.name}</span>
                {section.count !== undefined && section.count > 0 && (
                  <span className={styles['completeness-row-badge']}>{section.count}</span>
                )}
              </div>
              <p className={styles['completeness-row-message']}>{section.message}</p>
            </div>
            {section.link && onNavigate && (
              <div className={styles['completeness-row-action']}>
                <span className={styles['nav-arrow']}>→</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
