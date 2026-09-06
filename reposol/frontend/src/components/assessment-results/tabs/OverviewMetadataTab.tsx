import React, { useState } from 'react';
import styles from '../ARPage.module.css';
import { AssessmentResults, Result, Resource } from '../../../lib/types/oscal';
import MetricCard from '@components/shared/dashboard/MetricCard';
import MetricCardGrid from '@components/shared/dashboard/MetricCardGrid';
import StatusBreakdown from '@components/shared/dashboard/StatusBreakdown';
import { BackMatterEditor } from '@components/shared/BackMatterEditor';
import { APBrowserModal } from '../modals/APBrowserModal';

export interface OverviewMetadataTabProps {
  ar: AssessmentResults;
  isEditing: boolean;
  onUpdateImportAP: (href: string, remarks?: string) => void;
  onUpdateBackMatter?: (backMatter: any) => void;
}

export const OverviewMetadataTab: React.FC<OverviewMetadataTabProps> = ({
  ar,
  isEditing,
  onUpdateImportAP,
  onUpdateBackMatter,
}) => {
  const [isAPBrowserOpen, setIsAPBrowserOpen] = useState(false);

  const results: Result[] = ar.results || [];
  const importAp = ar['import-ap'] || { href: '' };
  const apHref = importAp.href || '';
  // Clean AP ID for direct text matching (removes leading # if present)
  const apIdClean = apHref.replace(/^#/, '');

  const totalFindings = results.reduce((acc, r) => acc + (r.findings?.length || 0), 0);
  const totalObservations = results.reduce((acc, r) => acc + (r.observations?.length || 0), 0);
  const totalRisks = results.reduce((acc, r) => acc + (r.risks?.length || 0), 0);

  const findingStatuses: Record<string, number> = { satisfied: 0, 'not-satisfied': 0 };
  results.forEach((r) => {
    (r.findings || []).forEach((f) => {
      const state = f.target?.status?.state || 'unknown';
      findingStatuses[state] = (findingStatuses[state] || 0) + 1;
    });
  });

  const riskStatuses: Record<string, number> = {};
  results.forEach((r) => {
    (r.risks || []).forEach((risk) => {
      const status = risk.status || 'unknown';
      riskStatuses[status] = (riskStatuses[status] || 0) + 1;
    });
  });

  const findingBreakdown = Object.keys(findingStatuses).map((k) => ({
    label: k,
    value: findingStatuses[k],
    color: k === 'satisfied' ? 'var(--color-success)' : 'var(--color-danger)',
  }));

  const riskBreakdown = Object.keys(riskStatuses).map((k) => ({
    label: k,
    value: riskStatuses[k],
    color: 'var(--color-warning)',
  }));

  return (
    <div className={styles['ar-overview']}>
      {/* Referenced Assessment Plan Banner */}
      <div className={styles['ar-import-ap']}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h3 className="font-semibold text-slate-100 m-0">Referenced Assessment Plan</h3>
          </div>
          {isEditing && (
            <button
              type="button"
              className={styles['btn-secondary']}
              onClick={() => setIsAPBrowserOpen(true)}
            >
              Browse Assessment Plans
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={apHref}
                onChange={(e) => onUpdateImportAP(e.target.value)}
                placeholder="Enter AP href (e.g. #8f5a2b1c-... or relative path)"
                className={styles['modal-input']}
              />
            </div>
            {apIdClean && (
              <div className="text-xs text-slate-400">
                Resolved Plan ID: <span className="font-mono text-indigo-400 font-semibold">{apIdClean}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {apHref ? (
              <div className="text-sm text-slate-200">
                Linked Plan URI: <span className="font-mono text-indigo-400 font-semibold">{apHref}</span>
                {apIdClean !== apHref && (
                  <span className="ml-2 text-xs text-slate-400">
                    (Plan ID: <span className="font-mono font-semibold text-slate-300">{apIdClean}</span>)
                  </span>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-400 italic">No Assessment Plan imported.</div>
            )}
            {importAp.remarks && (
              <div className="text-xs text-slate-400 mt-1">Remarks: {importAp.remarks}</div>
            )}
          </div>
        )}
      </div>

      {/* Metric Cards Grid */}
      <MetricCardGrid>
        <MetricCard title="Total Findings" value={totalFindings} icon="🎯" />
        <MetricCard title="Total Observations" value={totalObservations} icon="👁️" />
        <MetricCard title="Total Risks" value={totalRisks} icon="⚠️" />
        <MetricCard title="Result Sets" value={results.length} icon="📑" />
      </MetricCardGrid>

      {/* Breakdowns */}
      <div className={styles['ar-breakdowns']}>
        <div className={styles['breakdown-card']}>
          <h3>Finding Posture Statuses</h3>
          <StatusBreakdown items={findingBreakdown} />
        </div>
        <div className={styles['breakdown-card']}>
          <h3>Identified Risk Statuses</h3>
          <StatusBreakdown items={riskBreakdown} />
        </div>
      </div>

      {/* Back-Matter Attachments */}
      <div className={styles['form-section']} style={{ marginTop: '16px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px' }}>
          Back-Matter Attachments & Artifacts
        </h3>
        <BackMatterEditor
          backMatter={ar['back-matter'] || { resources: [] }}
          readOnly={!isEditing}
          onChange={(newBm) => {
            if (onUpdateBackMatter) onUpdateBackMatter(newBm);
          }}
        />
      </div>

      {/* AP Browser Modal */}
      <APBrowserModal
        isOpen={isAPBrowserOpen}
        onClose={() => setIsAPBrowserOpen(false)}
        currentHref={apHref}
        currentRemarks={importAp.remarks}
        onSelectAP={(href, remarks) => {
          onUpdateImportAP(href, remarks);
        }}
      />
    </div>
  );
};
