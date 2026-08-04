import React from 'react';
import './Dashboard.css';

export default function MetricCard({ 
  label, 
  value, 
  icon, 
  trend, 
  accentColor = 'var(--color-primary, hsl(220, 70%, 55%))', 
  onClick, 
  className = '' 
}) {
  const isClickable = typeof onClick === 'function';
  
  const renderTrendIcon = (direction) => {
    switch (direction) {
      case 'up': return <span className="trend-icon up">▲</span>;
      case 'down': return <span className="trend-icon down">▼</span>;
      case 'neutral': return <span className="trend-icon neutral">●</span>;
      default: return null;
    }
  };

  return (
    <div 
      className={`dashboard-card metric-card ${isClickable ? 'clickable' : ''} ${className}`}
      onClick={isClickable ? onClick : undefined}
      style={{ borderLeftColor: accentColor }}
      role={isClickable ? 'button' : 'region'}
      tabIndex={isClickable ? 0 : undefined}
    >
      <div className="metric-card-header">
        <span className="metric-card-label">{label}</span>
        {icon && <span className="metric-card-icon">{icon}</span>}
      </div>
      
      <div className="metric-card-body">
        <span className="metric-card-value">{value}</span>
      </div>
      
      {trend && (
        <div className="metric-card-footer">
          <span className={`metric-trend ${trend.direction}`}>
            {renderTrendIcon(trend.direction)} {trend.value}
          </span>
          {trend.period && <span className="metric-period">{trend.period}</span>}
        </div>
      )}
    </div>
  );
}
