import React, { useEffect, useState } from 'react';
import styles from './DashboardPage.module.css';
import sharedStyles from '@components/shared/SharedComponents.module.css';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import { documentCountsAtom, recentDocsAtom } from '@stores/documentAtoms';
import { fetchRecentDocuments } from '@lib/api';
import { apiClient } from '@lib/api-client';
import { CardListSkeleton } from '@components/shared/ui/LoadingSpinner';

interface WorkflowStep {
  stage: string;
  label: string;
  icon: string;
  desc: string;
  isDev?: boolean;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  { stage: 'catalogs', label: 'Catalog', icon: '📖', desc: 'Control definitions' },
  { stage: 'profiles', label: 'Profile', icon: '⚙️', desc: 'Tailored baselines' },
  { stage: 'component-definitions', label: 'Components', icon: '🧱', desc: 'System parts' },
  { stage: 'ssps', label: 'SSP', icon: '📝', desc: 'Security plans', isDev: true },
  { stage: 'assessment-plans', label: 'AP', icon: '📅', desc: 'Assessment plans', isDev: true },
  { stage: 'assessment-results', label: 'AR', icon: '✅', desc: 'Audit results', isDev: true },
  { stage: 'poams', label: 'POA&M', icon: '⚠️', desc: 'Remediation tracking', isDev: true },
];

const STAGE_ICONS: Record<string, string> = {
  catalogs: '📖',
  profiles: '⚙️',
  ssps: '📝',
  'component-definitions': '🧱',
  'assessment-plans': '📅',
  'assessment-results': '✅',
  poams: '⚠️',
  'control-mappings': '🔗',
};

const STAGE_LABEL_MAP: Record<string, string> = {
  catalogs: 'Catalog', profiles: 'Profile', ssps: 'SSP',
  'component-definitions': 'Component', 'assessment-plans': 'AP',
  'assessment-results': 'AR', poams: 'POA&M', 'control-mappings': 'Mapping'
};

export const DashboardPage = () => {
  const navigate = useNavigate();
  const [counts, setCounts] = useAtom(documentCountsAtom);
  const [recentDocs, setRecentDocs] = useAtom(recentDocsAtom);

  const fetchAllCounts = async () => {
    const stages = [
      'catalogs', 'profiles', 'ssps',
      'component-definitions', 'assessment-plans', 'assessment-results', 'poams',
      'control-mappings',
    ];
    const newCounts: Record<string, number> = {};
    await Promise.all(
      stages.map(async (stage) => {
        try {
          const response = await apiClient(`/documents/${stage}/count`);
          if (response.ok) {
            const data = await response.json();
            newCounts[stage] = data.count ?? 0;
          } else {
            const fallback = await apiClient(`/documents/${stage}`);
            newCounts[stage] = fallback.ok ? (await fallback.json()).length : 0;
          }
        } catch {
          newCounts[stage] = 0;
        }
      })
    );
    return newCounts;
  };

  const { data: countsData, isLoading: countsLoading } = useQuery({
    queryKey: ['document-counts'],
    queryFn: fetchAllCounts,
  });

  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ['recent-documents'],
    queryFn: fetchRecentDocuments,
  });

  useEffect(() => {
    if (countsData) setCounts(countsData as any);
  }, [countsData, setCounts]);

  useEffect(() => {
    if (recentData) setRecentDocs(recentData);
  }, [recentData, setRecentDocs]);

  return (
    <div className="dashboard-view" data-testid="dashboard-view">
      <div className={styles['welcome-banner']}>
        <div className={styles['welcome-icon']}>🛡️</div>
        <div className={styles['welcome-text']}>
          <h2>Welcome to Reposol</h2>
          <p>Your local OSCAL management application. Edit and manage security controls, system plans, and assessments.</p>
        </div>
      </div>

      <div className={styles['section-title']}>OSCAL Lifecycle Pipeline</div>
      <div className={styles['workflow-pipeline']}>
        {WORKFLOW_STEPS.map((step, i) => {
          const count = counts[step.stage as keyof typeof counts] || 0;
          const hasDocs = count > 0;
          
          return (
            <div className={styles['workflow-step-wrapper']} key={step.stage}>
              <div
                className={`${styles['workflow-step']} ${hasDocs ? styles['has-docs'] : ''}`}
                onClick={() => navigate('/' + step.stage)}
                title={`${step.label}: ${count} documents${step.isDev ? ' (Under Active Development)' : ''}`}
              >
                <div className={styles['workflow-step-content']}>
                  <span className={styles['workflow-icon']}>{step.icon}</span>
                  <span className={styles['workflow-label']}>{step.label}</span>
                  <span className={`${styles['workflow-count']} ${hasDocs ? styles['has-count'] : ''}`}>
                    {countsLoading ? '…' : count}
                  </span>
                  <span className={styles['workflow-desc']}>{step.desc}</span>
                </div>
                <div className={styles['workflow-badge-slot']}>
                  {step.isDev && (
                    <span className={styles['workflow-dev-badge']} title="Under Active Development">
                      🚧 In Dev
                    </span>
                  )}
                </div>
              </div>
              {i < WORKFLOW_STEPS.length - 1 && (
                <span className={styles['workflow-arrow']}>→</span>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles['dashboard-two-col']}>
        <div className={styles['dashboard-col']}>
          <div className={styles['section-title']}>Quick Guide: The OSCAL Lifecycle</div>
          <div className="help-card" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px', height: 'calc(100% - 40px)' }}>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '20px', fontSize: '14px', lineHeight: '1.6' }}>
              Welcome to Reposol! Follow the workflow above to construct, customize, and compile your compliance documentation:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px 0', fontSize: '15px' }}>📖 1. Catalogs</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                  Define core control sets (e.g. NIST SP 800-53), categories, prose statements, and default parameter variables.
                </p>
              </div>
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px 0', fontSize: '15px' }}>⚙️ 2. Profiles</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                  Create baseline definitions by importing controls, tailoring prose statements, and defining organizational baseline values.
                </p>
              </div>
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px 0', fontSize: '15px' }}>🧱 3. Components</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                  Inventory physical assets, software, services, and policies including security certifications (e.g., EAL 4+).
                </p>
              </div>
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px 0', fontSize: '15px' }}>📝 4. SSPs</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                  Construct System Security Plans, assign active components to selected profile controls, and tailor parameter overrides inline.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles['dashboard-col']}>
          <div className={styles['section-title']}>Recent Activity</div>
          {recentLoading ? (
            <CardListSkeleton items={4} />
          ) : recentDocs.length === 0 ? (
            <div className={sharedStyles['empty-state']} style={{ padding: '32px' }}>
              <p>No recent documents found. Import or create your first document!</p>
            </div>
          ) : (
            <div className={styles['recent-activity-list']}>
              {recentDocs.map((doc, i) => (
                <div
                  className={styles['recent-activity-item']}
                  key={`${doc.stage}-${doc.uuid || doc.id}-${i}`}
                  onClick={() => {
                    navigate(`/${doc.stage}/${doc.uuid || doc.id}`);
                  }}
                >
                  <span className={styles['recent-icon']}>{STAGE_ICONS[doc.stage]}</span>
                  <div className={styles['recent-info']}>
                    <span className={styles['recent-title']}>{doc.title}</span>
                    <span className={styles['recent-meta']}>
                      <span className={styles['recent-stage-badge']}>{STAGE_LABEL_MAP[doc.stage] || doc.stage}</span>
                      {doc['last-modified'] && (
                        <span className={styles['recent-date']}>{new Date(doc['last-modified']).toLocaleDateString()}</span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
