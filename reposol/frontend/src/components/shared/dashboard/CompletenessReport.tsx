import React from 'react';
import styles from '../../dashboard/DashboardPage.module.css';

export default function CompletenessReport({ 
  title, 
  sections = [], 
  onNavigate, 
  className = '' 
}: any) {
  const normalizedSections = sections.map((s: any) => {
    const name = s.name || s.label || s.title || s.id || 'Section';
    const status = s.status || (s.isComplete ? 'pass' : (s.required ? 'fail' : 'warn'));
    return { ...s, name, status };
  });

  const passes = normalizedSections.filter((s: any) => s.status === 'pass').length;
  const warnings = normalizedSections.filter((s: any) => s.status === 'warn').length;
  const failures = normalizedSections.filter((s: any) => s.status === 'fail').length;

  const renderIcon = (status: string) => {
    switch (status) {
      case 'pass': return '✅';
      case 'warn': return '⚠️';
      case 'fail': return '❌';
      default: return '❓';
    }
  };

  const handleRowClick = (link: string) => {
    if (typeof onNavigate === 'function' && link) {
      onNavigate(link);
    }
  };

  return (
    <div className={`${styles['dashboard-card']} ${styles['completeness-report']} ${className}`}>
      {title && (
        <div className={styles['completeness-header']}>
          <h3 className={styles['completeness-title']}>{title}</h3>
          <div className={styles['completeness-summary']}>
            {passes > 0 && <span className={`${styles['summary-chip']} ${styles['pass']}`}>{passes} passed</span>}
            {warnings > 0 && <span className={`${styles['summary-chip']} ${styles['warn']}`}>{warnings} warnings</span>}
            {failures > 0 && <span className={`${styles['summary-chip']} ${styles['fail']}`}>{failures} failures</span>}
          </div>
        </div>
      )}
      
      <div className={styles['completeness-list']}>
        {normalizedSections.map((section: any, idx: number) => (
          <div 
            key={idx} 
            className={`${styles['completeness-row']} ${styles[section.status] || ''} ${section.link && onNavigate ? styles['clickable'] : ''}`}
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
