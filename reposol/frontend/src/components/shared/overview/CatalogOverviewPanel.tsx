import React from 'react';
import styles from '../SharedComponents.module.css';
import { countControlsInGroup } from '../DocumentOverview';

export interface CatalogOverviewPanelProps {
  document?: any;
  stats?: any;
  onSelectGroup?: (groupId: string) => void;
  onSelectControl?: (controlId: string) => void;
  onLoadTemplate?: () => void;
  isEditing?: boolean;
  onAddGroup?: () => void;
  onAddControl?: () => void;
}

export function CatalogOverviewPanel({
  document,
  stats = { total: 0, active: 0, withdrawn: 0 },
  onSelectGroup,
  onSelectControl,
  onLoadTemplate,
  isEditing = false,
  onAddGroup,
  onAddControl,
}: CatalogOverviewPanelProps) {
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-text-muted)', margin: 0 }}>
            Control Families
          </h3>
          {isEditing && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {onAddGroup && (
                <button
                  type="button"
                  data-testid="overview-add-family-btn"
                  onClick={onAddGroup}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    borderRadius: 'var(--radius-sm, 4px)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-2)',
                    color: 'var(--color-primary)',
                  }}
                  title="Add a new Control Family / Group"
                >
                  <span>➕</span>
                  <span>Add Family</span>
                </button>
              )}
              {onAddControl && (
                <button
                  type="button"
                  data-testid="overview-add-control-btn"
                  onClick={onAddControl}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    borderRadius: 'var(--radius-sm, 4px)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-2)',
                    color: 'var(--color-text)',
                  }}
                  title="Add a top-level Control"
                >
                  <span>➕</span>
                  <span>Add Control</span>
                </button>
              )}
            </div>
          )}
        </div>
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', overflow: 'hidden' }}>
          {(document.groups || []).length === 0 ? (
            <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <span>No control families defined.</span>
              {isEditing && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {onAddGroup && (
                    <button
                      type="button"
                      data-testid="empty-catalog-add-family-btn"
                      onClick={onAddGroup}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-primary, #3b82f6)',
                        color: '#fff',
                        border: 'none',
                      }}
                    >
                      <span>➕</span>
                      <span>Add Family</span>
                    </button>
                  )}
                  {onAddControl && (
                    <button
                      type="button"
                      data-testid="empty-catalog-add-control-btn"
                      onClick={onAddControl}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-surface-2)',
                        color: 'var(--color-text)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <span>➕</span>
                      <span>Add Control</span>
                    </button>
                  )}
                  {onLoadTemplate && (
                    <button
                      type="button"
                      data-testid="empty-catalog-load-template-btn"
                      onClick={onLoadTemplate}
                      className="btn-secondary"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      <span>📥</span>
                      <span>Load Template / Content</span>
                    </button>
                  )}
                </div>
              )}
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

      {/* Top-Level Controls list (if any exist) */}
      {(document.controls || []).length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-text-muted)', margin: 0 }}>
              Top-Level Controls ({(document.controls || []).length})
            </h3>
            {isEditing && onAddControl && (
              <button
                type="button"
                data-testid="overview-add-top-control-btn"
                onClick={onAddControl}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm, 4px)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-2)',
                  color: 'var(--color-primary)',
                }}
                title="Add a top-level Control"
              >
                <span>➕</span>
                <span>Add Control</span>
              </button>
            )}
          </div>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', overflow: 'hidden' }}>
            {(document.controls || []).map((ctrl: any, idx: number) => {
              const isWithdrawn = ctrl.status === 'withdrawn' || ctrl.props?.some((p: any) => (p.name === 'status' || p.name === 'state') && p.value === 'withdrawn');
              return (
                <div
                  key={ctrl.id || idx}
                  data-testid={`overview-control-item-${ctrl.id}`}
                  onClick={() => onSelectControl?.(ctrl.id)}
                  className="sidebar-item-like"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 20px',
                    cursor: onSelectControl ? 'pointer' : 'default',
                    borderBottom: idx < (document.controls || []).length - 1 ? '1px solid var(--color-border)' : 'none',
                    transition: 'background-color 0.15s ease',
                    opacity: isWithdrawn ? 0.65 : 1
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: isWithdrawn ? 'var(--color-text-muted)' : 'var(--color-primary)', fontSize: '16px' }}>⬡</span>
                    <strong style={{ fontSize: '14px', color: 'var(--color-text)', textDecoration: isWithdrawn ? 'line-through' : 'none' }}>
                      <span style={{ color: 'var(--color-text-muted)', marginRight: '8px', fontWeight: '500' }}>{ctrl.id}</span>
                      {ctrl.title || 'Untitled Control'}
                    </strong>
                    {isWithdrawn && (
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                        fontWeight: '600'
                      }}>
                        Withdrawn
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    ➔
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
