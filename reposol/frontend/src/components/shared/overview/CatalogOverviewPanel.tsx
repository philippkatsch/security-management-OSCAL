import React from 'react';
import styles from '../SharedComponents.module.css';
import { countControlsInGroup } from '../DocumentOverview';

export interface CatalogOverviewPanelProps {
  document?: any;
  stats?: any;
  onSelectGroup?: (groupId: string) => void;
}

export function CatalogOverviewPanel({ document, stats = { total: 0, active: 0, withdrawn: 0 }, onSelectGroup }: CatalogOverviewPanelProps) {
  const doc = document || {};
  const metricCardStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '24px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: '8px',
    boxShadow: 'var(--shadow-sm)',
    flex: '1',
    minWidth: '150px'
  };

  const metricLabelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  };

  return (
    <div style={{ padding: '24px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Title & Metadata row */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-text)', marginBottom: '8px', lineHeight: '1.2' }}>
          {doc.metadata?.title || 'Untitled Document'}
        </h1>
        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {doc.metadata?.version && (
            <span><strong>Version:</strong> {doc.metadata.version}</span>
          )}
          <span><strong>OSCAL Version:</strong> {doc.metadata?.['oscal-version'] || 'v1.2.2'}</span>
          {doc.metadata?.published && (
            <span><strong>Published:</strong> {new Date(doc.metadata.published).toLocaleDateString()}</span>
          )}
          {doc.metadata?.['last-modified'] && (
            <span><strong>Last Modified:</strong> {new Date(doc.metadata['last-modified']).toLocaleDateString()}</span>
          )}
        </div>
      </div>

      {/* Metrics cards row */}
      <div className={styles['overview-metrics-grid']} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        <div className={styles['metric-card']} style={metricCardStyle}>
          <span className="metric-value" style={{ fontSize: '32px', fontWeight: '800', color: 'var(--color-primary)' }}>
            {doc.groups?.length || 0}
          </span>
          <span className="metric-label" style={metricLabelStyle}>Control Families</span>
        </div>
        <div className={styles['metric-card']} style={metricCardStyle}>
          <span className="metric-value" style={{ fontSize: '32px', fontWeight: '800', color: 'var(--color-text)' }}>
            {stats.total}
          </span>
          <span className="metric-label" style={metricLabelStyle}>Total Controls</span>
        </div>
        <div className={styles['metric-card']} style={metricCardStyle}>
          <span className="metric-value" style={{ fontSize: '32px', fontWeight: '800', color: 'var(--color-accent)' }}>
            {stats.active}
          </span>
          <span className="metric-label" style={metricLabelStyle}>Active Controls</span>
        </div>
        <div className={styles['metric-card']} style={metricCardStyle}>
          <span className="metric-value" style={{ fontSize: '32px', fontWeight: '800', color: 'var(--color-text-muted)' }}>
            {stats.withdrawn}
          </span>
          <span className="metric-label" style={metricLabelStyle}>Withdrawn</span>
        </div>
        <div className={styles['metric-card']} style={metricCardStyle}>
          <span className="metric-value" style={{ fontSize: '32px', fontWeight: '800', color: 'var(--color-text)' }}>
            {doc['back-matter']?.resources?.length || 0}
          </span>
          <span className="metric-label" style={metricLabelStyle}>Back Matter Resources</span>
        </div>
      </div>

      {/* Control families list */}
      <div style={{ marginTop: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
          Control Families
        </h3>
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', overflow: 'hidden' }}>
          {(document.groups || []).length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '13px' }}>
              No control families defined.
            </div>
          ) : (
            (document.groups || []).map((group, idx) => {
              const count = countControlsInGroup(group);
              return (
                <div 
                  key={group.id} 
                  onClick={() => onSelectGroup?.(group.id)}
                  className="sidebar-item-like"
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '16px 20px', 
                    cursor: onSelectGroup ? 'pointer' : 'default',
                    borderBottom: idx < (document.groups || []).length - 1 ? '1px solid var(--color-border)' : 'none',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>📁</span>
                    <strong style={{ fontSize: '14px', color: 'var(--color-text)' }}>
                      {group.title || group.id}
                    </strong>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    {count} {count === 1 ? 'control' : 'controls'}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
