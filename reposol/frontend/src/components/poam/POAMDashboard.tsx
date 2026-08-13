import React from 'react';
import MetricCardGrid from '../shared/dashboard/MetricCardGrid';
import ProgressBar from '../shared/dashboard/ProgressBar';
import StatusBreakdown from '../shared/dashboard/StatusBreakdown';
import styles from './POAMPage.module.css';

export function POAMDashboard({ poam, isEditing, updateRootField, dashboardMetrics, resolvedPercent, completedItems, items, riskStatusData, priorityData }) {
  return (
    <div className={styles['poam-dashboard']}>
      <div className="poam-ssp-reference">
        {poam['import-ssp'] ? (
          <div className={[styles['widget-card'], styles['ssp-card']].filter(Boolean).join(' ')}>
            <h3>Referenced SSP</h3>
            <p><strong>HREF:</strong> {poam['import-ssp'].href}</p>
            {isEditing && (
              <button className={styles['edit-btn-small']} onClick={() => {
                const newHref = prompt("Enter new SSP href", poam['import-ssp'].href);
                if (newHref) updateRootField('import-ssp', { href: newHref });
              }}>Edit SSP Reference</button>
            )}
          </div>
        ) : (
          <div className={[styles['widget-card'], styles['ssp-card']].filter(Boolean).join(' ')}>
            <h3>System ID</h3>
            <p>{poam['system-id']?.identifier || 'None specified'}</p>
            {isEditing && (
              <button className={styles['edit-btn-small']} onClick={() => {
                const newId = prompt("Enter new System ID", poam['system-id']?.identifier || '');
                if (newId) updateRootField('system-id', { identifier: newId });
              }}>Edit System ID</button>
            )}
          </div>
        )}
      </div>
      <MetricCardGrid metrics={dashboardMetrics} />
      <div className={styles['poam-dashboard-widgets']}>
        <div className={styles['widget-card']}>
          <h3>Resolution Progress</h3>
          <ProgressBar percent={resolvedPercent} label={`${completedItems.length} of ${items.length} items resolved`} />
        </div>
        <div className={styles['widget-card']}>
          <h3>Risk Status</h3>
          <StatusBreakdown data={riskStatusData} />
        </div>
        <div className={styles['widget-card']}>
          <h3>Items by Priority</h3>
          <StatusBreakdown data={priorityData} />
        </div>
      </div>
    </div>
  );
}
