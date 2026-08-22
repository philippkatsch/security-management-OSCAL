import React from 'react';
import styles from './DocumentPageLayout.module.css';
import sharedStyles from '@components/shared/SharedComponents.module.css';
import { useNavigate } from 'react-router-dom';
import { DocumentToolbar } from '@components/shared/DocumentToolbar';
import { VersionDrawer } from '@components/shared/VersionDrawer';

import { getWorkspaceId, exportDocument } from '@lib/api';
import { LoadingSpinner } from '@components/shared/ui/LoadingSpinner';

const STAGE_CONFIG: Record<string, { label: string; rootKey: string }> = {
  catalogs: { label: 'Catalog', rootKey: 'catalog' },
  profiles: { label: 'Profile', rootKey: 'profile' },
  'control-mappings': { label: 'Control Mapping', rootKey: 'mapping-collection' },
  'component-definitions': { label: 'Component', rootKey: 'component-definition' },
  ssps: { label: 'SSP', rootKey: 'system-security-plan' },
  poams: { label: 'POA&M', rootKey: 'plan-of-action-and-milestones' },
  'assessment-plans': { label: 'Assessment Plan', rootKey: 'assessment-plan' },
  'assessment-results': { label: 'Assessment Results', rootKey: 'assessment-results' }
};

export interface DocumentPageLayoutProps {
  stage: string;
  docId: string;
  lifecycle: any; // the return value of useDocumentLifecycle
  title?: string;
  children: React.ReactNode;
  tabs?: { id: string; label: string; icon?: string }[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  sidebar?: React.ReactNode;
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
  onClose?: () => void;
  headerActions?: React.ReactNode;
  onExport?: () => void;
}

export const DocumentPageLayout = ({
  stage,
  docId,
  lifecycle,
  title,
  children,
  tabs,
  activeTab,
  onTabChange,
  sidebar,
  sidebarOpen,
  onSidebarToggle,
  onClose,
  headerActions,
  onExport
}: DocumentPageLayoutProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    lifecycle.handleBack(() => {
      if (onClose) onClose();
      else {
        const wsId = getWorkspaceId();
        const target = wsId ? `/${stage}?w=${wsId}` : `/${stage}`;
        navigate(target);
      }
    });
  };

  const config = STAGE_CONFIG[stage] || { label: stage, rootKey: stage };

  const activeDoc = lifecycle.activeDoc || lifecycle.doc;

  return (
    <div className={styles['document-page']}>
      <DocumentToolbar
        stage={stage}
        documentId={docId}
        title={title}
        document={activeDoc}
        version={lifecycle.version || activeDoc?.[config.rootKey]?.metadata?.version}
        versions={lifecycle.versions || []}
        onBack={handleBack}
        isEditing={lifecycle.isEditing}
        onToggleEdit={lifecycle.handleToggleEdit}
        onSave={() => lifecycle.setShowDrawer(true)}
        loading={lifecycle.loading}
        saving={lifecycle.saving}
        validating={lifecycle.validating}
        validationResult={lifecycle.validationResult}
        onValidate={lifecycle.validate}
        hasDraft={lifecycle.hasDraft}
        onDeleteDraft={lifecycle.handleDeleteDraft}
        undo={lifecycle.undo}
        redo={lifecycle.redo}
        canUndo={lifecycle.canUndo}
        canRedo={lifecycle.canRedo}
        onExport={onExport || (() => exportDocument(stage as any, docId, 'json'))}
        onVersionsClick={() => lifecycle.setShowDrawer(true)}
      />

      {lifecycle.error && (
        <div className={styles['error-banner']}>
          Error: {typeof lifecycle.error === 'string' ? lifecycle.error : (lifecycle.error as any)?.message || String(lifecycle.error)}
        </div>
      )}

      {lifecycle.loading && !lifecycle.activeDoc ? (
        <LoadingSpinner variant="skeleton" message="Loading Document..." />
      ) : (
        <div className={styles['document-workspace']}>
          {sidebar && (
            <div className={`${styles['workspace-sidebar']} ${sidebarOpen !== false ? styles['open'] : styles['closed']}`}>
              {sidebarOpen !== false && <div className={styles['sidebar-content']}>{sidebar}</div>}
            </div>
          )}

          <div className={styles['workspace-main']}>
            {tabs && tabs.length > 0 && (
              <div className={styles['document-tabs']}>
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    className={`${styles['doc-tab']} ${activeTab === tab.id ? styles['active'] : ''}`}
                    onClick={() => onTabChange?.(tab.id)}
                  >
                    {tab.icon && <span className={styles['tab-icon']}>{tab.icon}</span>}
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
            
            <div className={styles['document-content']}>
              {children}
            </div>
          </div>
        </div>
      )}

      {lifecycle.showDrawer && (
        <VersionDrawer
          isOpen={true}
          versions={lifecycle.versions}
          currentVersion={lifecycle.currentVersion}
          onSave={lifecycle.handlePublishVersion || lifecycle.handleSave}
          onSwitch={lifecycle.handleSelectVersion}
          onDelete={lifecycle.handleDeleteDraft}
          onClose={() => lifecycle.setShowDrawer(false)}
          isEditing={lifecycle.isEditing}
        />
      )}
    </div>
  );
};
