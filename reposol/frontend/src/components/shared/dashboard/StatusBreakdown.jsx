import React from 'react';
import './Dashboard.css';

export default function StatusBreakdown({ 
  title, 
  items = [], 
  variant = 'list', 
  className = '' 
}) {
  const total = items.reduce((sum, item) => sum + (item.count || 0), 0);

  const renderBarVariant = () => (
    <div className="status-breakdown-bar-variant">
      <div className="status-breakdown-stacked-bar">
        {items.map((item, idx) => {
          const itemPercentage = total > 0 ? ((item.count || 0) / total) * 100 : 0;
          const displayPercent = item.percentage !== undefined ? item.percentage : itemPercentage;
          if (displayPercent <= 0) return null;
          
          return (
            <div 
              key={idx}
              className="status-breakdown-segment"
              style={{ 
                width: `${displayPercent}%`, 
                backgroundColor: item.color || 'var(--color-primary)' 
              }}
              title={`${item.label}: ${item.count} (${displayPercent.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <div className="status-breakdown-legend">
        {items.map((item, idx) => (
          <div key={idx} className="status-breakdown-legend-item">
            <span className="status-dot" style={{ backgroundColor: item.color }} />
            <span className="status-label">{item.label}</span>
            <span className="status-count">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderListVariant = () => (
    <div className="status-breakdown-list-variant">
      {items.map((item, idx) => {
        const itemPercentage = total > 0 ? ((item.count || 0) / total) * 100 : 0;
        const displayPercent = item.percentage !== undefined ? item.percentage : itemPercentage;
        
        return (
          <div key={idx} className="status-breakdown-list-row">
            <div className="status-list-header">
              <div className="status-list-label-group">
                <span className="status-dot" style={{ backgroundColor: item.color }} />
                <span className="status-label">{item.label}</span>
              </div>
              <span className="status-count">{item.count}</span>
            </div>
            <div className="status-mini-track">
              <div 
                className="status-mini-fill" 
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
    <div className={`dashboard-card status-breakdown ${className}`}>
      {title && <h3 className="status-breakdown-title">{title}</h3>}
      <div className="status-breakdown-content">
        {variant === 'bar' ? renderBarVariant() : renderListVariant()}
      </div>
    </div>
  );
}
