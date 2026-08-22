import React from 'react';
import { DebouncedInput } from '../DebouncedInput';
import styles from '../SharedComponents.module.css';
import { useConfirm } from '@hooks/useConfirm';

export interface DocumentOverviewPropertiesProps {
  properties?: Record<string, any>;
  globalProps?: any[];
  isEditingState?: boolean;
  onGlobalPropertyRename?: (oldName: string, newName: string) => void;
  onGlobalPropertyDelete?: (name: string) => void;
  onAddProperty?: () => void;
  onUpdateMetaProp?: (propName: string, index: number, field: string, value: any) => void;
}

export function DocumentOverviewProperties({ 
  properties = {}, 
  globalProps = [], 
  isEditingState, 
  onGlobalPropertyRename, 
  onGlobalPropertyDelete, 
  onAddProperty, 
  onUpdateMetaProp = () => {} 
}: DocumentOverviewPropertiesProps) {
  const { confirm } = useConfirm();
  const propertyStats = (() => {
    const uniqueKeys = Object.keys(properties).length;
    let declaredCount = globalProps.length;
    let elementCount = 0;
    let totalAssignments = 0;
    Object.values(properties).forEach((p: any) => {
      if (p.isUsed) {
        elementCount++;
        totalAssignments += p.totalCount;
      }
    });
    return { uniqueKeys, declaredCount, elementCount, totalAssignments };
  })();

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
    <div style={{ padding: '20px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
          <span style={{ fontSize: '18px' }}>💡</span>
          <strong style={{ fontSize: '14px' }}>Central Property Hub</strong>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0, lineHeight: '1.5' }}>
          This dashboard displays all unique properties defined across the entire OSCAL document.
        </p>
      </div>
      
      <div className={styles['overview-metrics-grid']} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        <div className={styles['metric-card']} style={{ ...metricCardStyle, padding: '12px 16px', minWidth: '120px', flex: 1 }}>
          <span className="metric-value" style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-primary)' }}>{propertyStats.declaredCount}</span>
          <span className="metric-label" style={{ ...metricLabelStyle, fontSize: '10px' }}>Global Header Properties</span>
        </div>
        <div className={styles['metric-card']} style={{ ...metricCardStyle, padding: '12px 16px', minWidth: '120px', flex: 1 }}>
          <span className="metric-value" style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-text)' }}>{propertyStats.elementCount}</span>
          <span className="metric-label" style={{ ...metricLabelStyle, fontSize: '10px' }}>Element Properties</span>
        </div>
        <div className={styles['metric-card']} style={{ ...metricCardStyle, padding: '12px 16px', minWidth: '120px', flex: 1 }}>
          <span className="metric-value" style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-text-muted)' }}>{propertyStats.uniqueKeys}</span>
          <span className="metric-label" style={{ ...metricLabelStyle, fontSize: '10px' }}>Unique Keys</span>
        </div>
        <div className={styles['metric-card']} style={{ ...metricCardStyle, padding: '12px 16px', minWidth: '120px', flex: 1 }}>
          <span className="metric-value" style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-accent)' }}>{propertyStats.totalAssignments}</span>
          <span className="metric-label" style={{ ...metricLabelStyle, fontSize: '10px' }}>Total Assignments</span>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Document-Wide Property Directory</span>
        
        {Object.keys(properties).length === 0 ? (
          <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '12px' }}>No properties found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.entries(properties).map(([propName, propData]: [string, any]) => (
              <div key={propName} className="card" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    {isEditingState ? (
                      <DebouncedInput value={propName} onChange={(newName) => { if (newName && newName !== propName) onGlobalPropertyRename?.(propName, newName); }} placeholder="Property name" className={['form-input', styles['form-input-plain']].filter(Boolean).join(' ')} style={{ fontWeight: 'bold', fontSize: '14px', width: '200px', borderBottom: '1px dashed var(--color-border)' }} />
                    ) : (
                      <strong style={{ fontSize: '14px', color: 'var(--color-text)' }}>{propName}</strong>
                    )}
                    {propData.isMetadata ? (
                      <span className="badge" style={{ background: 'var(--color-primary-subtle, rgba(99,102,241,0.15))', color: 'var(--color-primary)', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: '500' }}>🏷️ Header Property</span>
                    ) : (
                      <span className="badge" style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-border-subtle)', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', color: 'var(--color-text-muted)' }}>🏷️ Property</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {propData.totalCount > 0 ? (
                      <span className="badge" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', color: 'var(--color-text)' }}>{propData.totalCount}x in tree</span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-warning)', fontSize: '11px', padding: '2px 8px', borderRadius: '10px' }}>⚠️ unused</span>
                    )}
                    {isEditingState && (
                      <button type="button" className={styles['btn-soft']} onClick={async () => {
                        const confirmed = await confirm({
                          title: 'Delete Property',
                          message: 'Delete this property globally?',
                          confirmLabel: 'Delete',
                          variant: 'danger',
                        });
                        if (confirmed) onGlobalPropertyDelete?.(propName);
                      }} style={{ padding: '4px 8px', fontSize: '11px', color: '#ff4d4f', borderColor: 'rgba(255, 77, 79, 0.2)' }}>🗑 Delete</button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {propData.isMetadata && propData.metaDetails && propData.metaDetails.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {propData.metaDetails.map((detail, idx) => (
                        <div key={idx} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>Header Value:</span>
                          {isEditingState ? (
                            <>
                              <DebouncedInput value={detail.value || ''} onChange={(newVal) => onUpdateMetaProp(propName, idx, 'value', newVal)} placeholder="Value" style={{ fontWeight: 'bold', fontSize: '13px', width: '220px', borderBottom: '1px dashed var(--color-border)' }} />
                              <DebouncedInput value={detail.ns || ''} onChange={(newNs) => onUpdateMetaProp(propName, idx, 'ns', newNs)} placeholder="ns" style={{ fontSize: '11px', width: '220px', fontStyle: 'italic', borderBottom: '1px dashed var(--color-border)' }} />
                              <DebouncedInput value={detail.class || ''} onChange={(newClass) => onUpdateMetaProp(propName, idx, 'class', newClass)} placeholder="class" style={{ fontSize: '11px', width: '120px', borderBottom: '1px dashed var(--color-border)' }} />
                              <DebouncedInput value={detail.remarks || ''} onChange={(newRemarks) => onUpdateMetaProp(propName, idx, 'remarks', newRemarks)} placeholder="remarks" style={{ fontSize: '11px', flex: 1, minWidth: '150px', borderBottom: '1px dashed var(--color-border)' }} />
                            </>
                          ) : (
                            <>
                              <span className="badge" style={{ background: 'var(--color-primary-subtle)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '2px 10px', fontSize: '11px', color: 'var(--color-primary)', fontWeight: '600' }}>{detail.value || '(empty)'}</span>
                              {detail.ns && <span className="badge">ns: {detail.ns}</span>}
                              {detail.class && <span className="badge">class: {detail.class}</span>}
                              {detail.group && <span className="badge">group: {detail.group}</span>}
                              {detail.uuid && <span className="badge">uuid: {detail.uuid}</span>}
                              {detail.remarks && <span style={{ fontSize: '11px', fontStyle: 'italic' }}>({detail.remarks})</span>}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {Object.keys(propData.values).length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{propData.isMetadata ? 'Tree Values:' : 'Values:'}</span>
                      {Object.entries(propData.values).map(([val, count]) => (
                        <span key={val} className="badge" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: '12px', padding: '2px 10px', fontSize: '11px' }}>
                          <span style={{ color: 'var(--color-text)' }}>{val}</span>
                          <span style={{ color: 'var(--color-text-muted)', marginLeft: '4px', fontSize: '9px' }}>({count as React.ReactNode}x)</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Not used in any control/group yet.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {isEditingState && (
        <button type="button" className={styles['btn-primary']} onClick={onAddProperty} title="Add a document-level header property saved in metadata.props" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}>
          ➕ Add Header Property
        </button>
      )}
    </div>
  );
}
