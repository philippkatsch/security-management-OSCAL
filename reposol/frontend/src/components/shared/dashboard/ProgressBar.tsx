import React from 'react';
import styles from '../../dashboard/DashboardPage.module.css';

export default function ProgressBar({ 
  value = 0, 
  label, 
  showPercentage = false, 
  thresholds, 
  segments, 
  className = '' 
}) {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  
  // Determine fill color based on thresholds if segments aren't used
  let fillColor = 'var(--color-primary, hsl(220, 70%, 55%))';
  if (thresholds && thresholds.length > 0) {
    const sortedThresholds = [...thresholds].sort((a, b) => a.max - b.max);
    for (const threshold of sortedThresholds) {
      if (clampedValue <= threshold.max) {
        fillColor = threshold.color;
        break;
      }
    }
  }

  const renderSegments = () => {
    if (!segments || segments.length === 0) return null;
    
    return segments.map((seg, idx) => (
      <div 
        key={idx}
        className={styles['progress-bar-segment']}
        style={{ 
          width: `${Math.min(Math.max(seg.value, 0), 100)}%`, 
          backgroundColor: seg.color 
        }}
        title={`${seg.label}: ${seg.value}%`}
      />
    ));
  };

  const isPercentageInside = clampedValue > 30;

  return (
    <div className={`progress-bar-wrapper ${className}`}>
      {label && (
        <div className={styles['progress-bar-header']}>
          <span className={styles['progress-bar-label']}>{label}</span>
          {showPercentage && !isPercentageInside && !segments && (
            <span className={styles['progress-bar-percentage-outside']}>{clampedValue}%</span>
          )}
        </div>
      )}
      
      <div className={styles['progress-bar-track']}>
        {segments && segments.length > 0 ? (
          renderSegments()
        ) : (
          <div 
            className={styles['progress-bar-fill']}
            style={{ 
              width: `${clampedValue}%`,
              backgroundColor: fillColor
            }}
          >
            {showPercentage && isPercentageInside && (
              <span className={styles['progress-bar-percentage-inside']}>{clampedValue}%</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
