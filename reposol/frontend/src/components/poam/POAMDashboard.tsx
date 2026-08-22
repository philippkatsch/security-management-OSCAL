import React from 'react';
import MetricCardGrid from '../shared/dashboard/MetricCardGrid';
import MetricCard from '../shared/dashboard/MetricCard';
import ProgressBar from '../shared/dashboard/ProgressBar';
import StatusBreakdown from '../shared/dashboard/StatusBreakdown';
import styles from './POAMPage.module.css';

export interface POAMDashboardProps {
  poam: any;
  isEditing?: boolean;
  updateRootField?: (field: string, value: any) => void;
  dashboardMetrics: Array<{ title: string; value: number | string; icon?: string; accentColor?: string }>;
  resolvedPercent: number;
  completedItems: any[];
  items: any[];
  riskStatusData: any[];
  priorityData: any[];
  onOpenImportWizard?: () => void;
}

export function POAMDashboard({
  poam,
  isEditing,
  updateRootField,
  dashboardMetrics,
  resolvedPercent,
  completedItems,
  items,
  riskStatusData,
  priorityData,
  onOpenImportWizard,
}: POAMDashboardProps) {
  const [editingSspHref, setEditingSspHref] = React.useState(false);
  const [sspHrefVal, setSspHrefVal] = React.useState('');
  const [editingSystemId, setEditingSystemId] = React.useState(false);
  const [systemIdVal, setSystemIdVal] = React.useState('');

  // Calculate overdue items (risk.deadline < today and status !== 'closed') per DD-022
  const todayStr = new Date().toISOString().split('T')[0];
  const overdueRisks = (poam?.risks || []).filter((r: any) =>
    r.deadline && r.deadline.split('T')[0] < todayStr && r.status !== 'closed'
  );

  // Calculate remediation lifecycle progress across all risks (DD-017 & DD-022)
  const allRemediations = (poam?.risks || []).flatMap((r: any) => r.remediations || []);
  const completedRemediations = allRemediations.filter((rem: any) => rem.lifecycle === 'completed');
  const remediationProgress = allRemediations.length > 0
    ? Math.round((completedRemediations.length / allRemediations.length) * 100)
    : 0;

  const combinedMetrics = [
    ...dashboardMetrics,
    ...(overdueRisks.length > 0 ? [{ title: 'Overdue Risks', value: overdueRisks.length, icon: '🚨', accentColor: 'var(--color-danger, #ef4444)' }] : [])
  ];

  return (
    <div className={styles['poam-dashboard']} data-testid="poam-dashboard">
      {/* Import Findings Banner Button */}
      {isEditing && onOpenImportWizard && (
        <div className={styles['import-bridge-banner']} data-testid="import-bridge-banner">
          <div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>AR Findings Import Bridge</h4>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
              Import unsatisfied findings from Assessment Results to auto-generate POA&M items.
            </p>
          </div>
          <button
            type="button"
            className={styles['btn-import-bridge']}
            onClick={onOpenImportWizard}
            data-testid="btn-open-import-wizard"
          >
            📥 Import Findings from AR
          </button>
        </div>
      )}

      {/* Overdue Warning Alert Banner (DD-022) */}
      {overdueRisks.length > 0 && (
        <div className={styles['overdue-alert-banner']} data-testid="overdue-alert-banner">
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <div>
            <strong style={{ fontSize: '14px' }}>{overdueRisks.length} Overdue Risk(s) Detected!</strong>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px' }}>
              Risks with passed deadline dates require immediate remediation triage.
            </p>
          </div>
        </div>
      )}

      <div className="poam-ssp-reference">
        {poam['import-ssp'] ? (
          <div className={[styles['widget-card'], styles['ssp-card']].filter(Boolean).join(' ')}>
            <h3>Referenced SSP</h3>
            <p><strong>HREF:</strong> {poam['import-ssp'].href}</p>
            {isEditing && updateRootField && (
              editingSspHref ? (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={sspHrefVal}
                    onChange={(e) => setSspHrefVal(e.target.value)}
                    style={{ padding: '4px 8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #45475a', background: '#181825', color: '#cdd6f4' }}
                  />
                  <button type="button" className={styles['edit-btn-small']} onClick={() => {
                    if (sspHrefVal.trim()) updateRootField('import-ssp', { href: sspHrefVal.trim() });
                    setEditingSspHref(false);
                  }}>Save</button>
                  <button type="button" onClick={() => setEditingSspHref(false)} style={{ padding: '2px 6px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                </div>
              ) : (
                <button className={styles['edit-btn-small']} onClick={() => {
                  setSspHrefVal(poam['import-ssp'].href || '');
                  setEditingSspHref(true);
                }}>Edit SSP Reference</button>
              )
            )}
          </div>
        ) : (
          <div className={[styles['widget-card'], styles['ssp-card']].filter(Boolean).join(' ')}>
            <h3>System ID</h3>
            <p>{poam['system-id']?.identifier || 'None specified'}</p>
            {isEditing && updateRootField && (
              editingSystemId ? (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={systemIdVal}
                    onChange={(e) => setSystemIdVal(e.target.value)}
                    style={{ padding: '4px 8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #45475a', background: '#181825', color: '#cdd6f4' }}
                  />
                  <button type="button" className={styles['edit-btn-small']} onClick={() => {
                    if (systemIdVal.trim()) updateRootField('system-id', { identifier: systemIdVal.trim() });
                    setEditingSystemId(false);
                  }}>Save</button>
                  <button type="button" onClick={() => setEditingSystemId(false)} style={{ padding: '2px 6px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                </div>
              ) : (
                <button className={styles['edit-btn-small']} onClick={() => {
                  setSystemIdVal(poam['system-id']?.identifier || '');
                  setEditingSystemId(true);
                }}>Edit System ID</button>
              )
            )}
          </div>
        )}
      </div>

      <MetricCardGrid>
        {combinedMetrics.map((m, idx) => (
          <MetricCard
            key={idx}
            title={m.title}
            value={m.value}
            icon={m.icon}
            accentColor={m.accentColor}
          />
        ))}
      </MetricCardGrid>

      <div className={styles['poam-dashboard-widgets']}>
        <div className={styles['widget-card']}>
          <h3>POA&M Item Resolution</h3>
          <ProgressBar percent={resolvedPercent} label={`${completedItems.length} of ${items.length} items resolved`} />
        </div>

        <div className={styles['widget-card']}>
          <h3>Remediation Lifecycle</h3>
          <ProgressBar percent={remediationProgress} label={`${completedRemediations.length} of ${allRemediations.length} remediations completed`} />
        </div>

        <div className={styles['widget-card']}>
          <h3>Risk Status Breakdown</h3>
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
