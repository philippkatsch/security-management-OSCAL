import React from 'react';
import './Dashboard.css';

export default function MetricCardGrid({ children, className = '' }) {
  return (
    <div className={`metric-card-grid ${className}`}>
      {children}
    </div>
  );
}
