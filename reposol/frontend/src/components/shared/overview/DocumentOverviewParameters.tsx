import React from 'react';
import { ParameterEditor } from '../ParameterEditor';
import styles from '../SharedComponents.module.css';

export interface DocumentOverviewParametersProps {
  mode?: string;
  document?: any;
  paramStats?: any;
  allResolvedCatalogParams?: any;
  isEditingState?: boolean;
  resolvedCatalog?: any;
  onChange?: (updated: any) => void;
}

export function DocumentOverviewParameters({ mode, document, paramStats, allResolvedCatalogParams, isEditingState, resolvedCatalog, onChange = () => {} }: DocumentOverviewParametersProps) {
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
    <div style={{ padding: '20px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
          <span style={{ fontSize: '18px' }}>💡</span>
          <strong style={{ fontSize: '14px' }}>
            {mode === 'catalog' ? 'Parameter Scopes in OSCAL' : 'Profile Parameter Overrides & Scopes'}
          </strong>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--color-text)', margin: 0, lineHeight: '1.5' }}>
          {mode === 'catalog'
            ? 'Parameters are defined across three hierarchical scopes to manage inheritance:'
            : 'All parameter adjustments, custom values, and profile overrides relative to the source catalog are centrally listed below. Parameters originate from three scopes:'}
        </p>
        <ul style={{ fontSize: '12px', color: 'var(--color-text)', margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <li><strong>Global Parameters (Catalog Level):</strong> Catalog-wide defaults available to all groups and controls.</li>
          <li><strong>Group Parameters:</strong> Section-wide defaults available to controls within that group.</li>
          <li><strong>Control Parameters:</strong> Specific parameters declared inside individual controls.</li>
        </ul>
      </div>
      
      <div>
        <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
          📊 Parameter Counts by Baseline Scope
        </h3>
        <div className={styles['overview-metrics-grid']} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          <div className={styles['metric-card']} style={{ ...metricCardStyle, padding: '12px 16px', minWidth: '120px', flex: 1 }}>
            <span className="metric-value" style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-primary)' }}>{paramStats.globalCount}</span>
            <span className="metric-label" style={{ ...metricLabelStyle, fontSize: '10px' }}>Global Parameters</span>
          </div>
          <div className={styles['metric-card']} style={{ ...metricCardStyle, padding: '12px 16px', minWidth: '120px', flex: 1 }}>
            <span className="metric-value" style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-text)' }}>{paramStats.groupCount}</span>
            <span className="metric-label" style={{ ...metricLabelStyle, fontSize: '10px' }}>Group Parameters</span>
          </div>
          <div className={styles['metric-card']} style={{ ...metricCardStyle, padding: '12px 16px', minWidth: '120px', flex: 1 }}>
            <span className="metric-value" style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-accent)' }}>{paramStats.controlCount}</span>
            <span className="metric-label" style={{ ...metricLabelStyle, fontSize: '10px' }}>Control Parameters</span>
          </div>
        </div>
      </div>
      
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {mode === 'catalog' ? '⚙️ Global Catalog Parameters' : '⚙️ Modified & Custom Profile Parameters'}
        </h3>
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px', marginTop: '4px' }}>
          {mode === 'catalog' ? (
            <ParameterEditor
              params={document.params || []}
              onChange={(updatedParams) => onChange({ ...document, params: updatedParams })}
              readOnly={!isEditingState}
              fullDocument={document}
            />
          ) : (
            <ParameterEditor
              mode="profile"
              params={document.modify?.['set-parameters'] || []}
              catalogParams={allResolvedCatalogParams}
              onChange={(updatedSetParams) => {
                const modify = document.modify ? { ...document.modify } : {};
                modify['set-parameters'] = updatedSetParams;
                onChange({ ...document, modify });
              }}
              readOnly={!isEditingState}
              fullDocument={document}
              catalogDocument={resolvedCatalog}
            />
          )}
        </div>
      </div>
    </div>
  );
}
