import React from 'react';

export default function MetricCardGrid({ children, className = '' }) {
  return (
    <div className={`metric-card-grid ${className}`}>
      {children}
    </div>
  );
}
