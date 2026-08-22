import React from 'react';
import styles from '../../dashboard/DashboardPage.module.css';

export interface StatusBreakdownItem {
  label: string;
  count?: number;
  value?: number;
  color?: string;
  percentage?: number;
}

export interface StatusBreakdownProps {
  title?: string;
  items?: StatusBreakdownItem[];
  data?: StatusBreakdownItem[];
  counts?: Record<string, number> | any;
  category?: string;
  variant?: 'list' | 'bar';
  className?: string;
}

export default function StatusBreakdown({ 
  title, 
  items = [], 
  data = [],
  counts,
  category: _category,
  variant = 'list', 
  className = '' 
}: StatusBreakdownProps) {
  const inputItems = items.length > 0 ? items : data;
  const derivedItems: StatusBreakdownItem[] = inputItems && inputItems.length > 0 
    ? inputItems 
    : counts && typeof counts === 'object'
      ? Object.entries(counts).map(([label, count]) => ({ label, count: Number(count) }))
      : [];
  const safeItems = Array.isArray(derivedItems) ? derivedItems : [];
  const total = safeItems.reduce((sum, item) => sum + (item.count ?? item.value ?? 0), 0);

  const renderBarVariant = () => (
    <div className={styles['status-breakdown-bar-variant']}>
      <div className={styles['status-breakdown-stacked-bar']}>
        {safeItems.map((item, idx) => {
          const itemPercentage = total > 0 ? ((item.count || 0) / total) * 100 : 0;
          const displayPercent = item.percentage !== undefined ? item.percentage : itemPercentage;
          if (displayPercent <= 0) return null;
          
          return (
            <div 
              key={idx}
              className={styles['status-breakdown-segment']}
              style={{ 
                width: `${displayPercent}%`, 
                backgroundColor: item.color || 'var(--color-primary)' 
              }}
              title={`${item.label}: ${item.count} (${displayPercent.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <div className={styles['status-breakdown-legend']}>
        {safeItems.map((item, idx) => (
          <div key={idx} className={styles['status-breakdown-legend-item']}>
            <span className={styles['status-dot']} style={{ backgroundColor: item.color }} />
            <span className={styles['status-label']}>{item.label}</span>
            <span className={styles['status-count']}>{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderListVariant = () => (
    <div className={styles['status-breakdown-list-variant']}>
      {safeItems.map((item, idx) => {
        const itemPercentage = total > 0 ? ((item.count || 0) / total) * 100 : 0;
        const displayPercent = item.percentage !== undefined ? item.percentage : itemPercentage;
        
        return (
          <div key={idx} className={styles['status-breakdown-list-row']}>
            <div className={styles['status-list-header']}>
              <div className={styles['status-list-label-group']}>
                <span className={styles['status-dot']} style={{ backgroundColor: item.color }} />
                <span className={styles['status-label']}>{item.label}</span>
              </div>
              <span className={styles['status-count']}>{item.count}</span>
            </div>
            <div className={styles['status-mini-track']}>
              <div 
                className={styles['status-mini-fill']} 
                style={{ 
                  width: `${displayPercent}%`,
                  backgroundColor: item.color || 'var(--color-primary)'
                }} 
              />
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={`${styles['dashboard-card']} ${styles['status-breakdown']} ${className}`}>
      {title && <h3 className={styles['status-breakdown-title']}>{title}</h3>}
      <div className={styles['status-breakdown-content']}>
        {variant === 'bar' ? renderBarVariant() : renderListVariant()}
      </div>
    </div>
  );
}
