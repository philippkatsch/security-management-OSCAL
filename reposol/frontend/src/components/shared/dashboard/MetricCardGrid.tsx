import React from 'react';
import styles from '../../dashboard/DashboardPage.module.css';

export default function MetricCardGrid({ children, className = '' }: any) {
  return (
    <div className={`${styles['metric-card-grid']} ${className}`}>
      {children}
    </div>
  );
}
