import React from 'react';
import styles from '../../dashboard/DashboardPage.module.css';

export default function MetricCard({ 
  label, 
  title,
  value, 
  icon, 
  trend, 
  accentColor = 'var(--color-primary, hsl(220, 70%, 55%))', 
  onClick, 
  className = '' 
}) {
  const isClickable = typeof onClick === 'function';
  const displayLabel = label || title;
  
  const renderTrendIcon = (direction) => {
    switch (direction) {
      case 'up': return <span className={[styles['trend-icon'], styles['up']].filter(Boolean).join(' ')}>▲</span>;
      case 'down': return <span className={[styles['trend-icon'], styles['down']].filter(Boolean).join(' ')}>▼</span>;
      case 'neutral': return <span className={[styles['trend-icon'], styles['neutral']].filter(Boolean).join(' ')}>●</span>;
      default: return null;
    }
  };

  return (
    <div 
      className={`dashboard-card metric-card ${isClickable ? styles['clickable'] : ''} ${className}`}
      onClick={isClickable ? onClick : undefined}
      style={{ borderLeftColor: accentColor }}
      role={isClickable ? 'button' : 'region'}
      tabIndex={isClickable ? 0 : undefined}
    >
      <div className={styles['metric-card-header']}>
        <span className={styles['metric-card-label']}>{displayLabel}</span>
        {icon && <span className={styles['metric-card-icon']}>{icon}</span>}
      </div>
      
      <div className={styles['metric-card-body']}>
        <span className={styles['metric-card-value']}>{value}</span>
      </div>
      
      {trend && (
        <div className={styles['metric-card-footer']}>
          <span className={`metric-trend ${trend.direction}`}>
            {renderTrendIcon(trend.direction)} {trend.value}
          </span>
          {trend.period && <span className={styles['metric-period']}>{trend.period}</span>}
        </div>
      )}
    </div>
  );
}
