import React from 'react';
import styles from './DocumentPageLayout.module.css';
import sharedStyles from '@components/shared/SharedComponents.module.css';
import { useNavigate } from 'react-router-dom';
import { DocumentToolbar } from '@components/shared/DocumentToolbar';
import { VersionDrawer } from '@components/shared/VersionDrawer';
import { ROOT_KEYS, STAGE_LABELS } from '@lib/constants'; // Let's just hardcode if missing

import StatusBadge from '@components/shared/status/StatusBadge';
import LifecycleSelector from '@components/shared/status/LifecycleSelector';
import LifecycleBanner from '@components/shared/status/LifecycleBanner';
import { getDocumentStatus, setDocumentStatus } from '@lib/status-machine';
import { getWorkspaceId, exportDocument } from '@lib/api';

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
  onClose
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
  const docStatus = getDocumentStatus(activeDoc);

  const handleStatusChange = (newStatus: string, successorUuid?: string) => {
    if (activeDoc && lifecycle.setDoc) {
      const updated = setDocumentStatus(activeDoc, newStatus as any, successorUuid);
      lifecycle.setDoc(updated);
      if (lifecycle.pushUndoRedoState) {
        lifecycle.pushUndoRedoState(updated);
      }
      if (lifecycle.save) {
        lifecycle.save(updated);
      }
    }
  };

  return (
    <div className="document-page">
      <DocumentToolbar
        stage={stage}
        documentId={docId}
        title={title}
        document={activeDoc}
        status={docStatus}
        onStatusChange={handleStatusChange}
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
        onExport={() => exportDocument(stage as any, docId, 'json')}
        onVersionsClick={() => lifecycle.setShowDrawer(true)}
      />

      <LifecycleBanner
        status={docStatus}
        documentId={docId}
        onReactivate={() => handleStatusChange('active')}
      />

      {lifecycle.error && (
        <div className="error-banner">
          Error: {lifecycle.error.message || String(lifecycle.error)}
        </div>
      )}

      {lifecycle.loading && !lifecycle.activeDoc ? (
        <div className="loading-state">
          <span className={sharedStyles['spinner']} /> Loading Document...
        </div>
      ) : (
        <div className="document-workspace">
          {sidebar && (
            <div className={`workspace-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
              <div className="sidebar-toggle" onClick={onSidebarToggle}>
                {sidebarOpen ? '◀' : '▶'}
              </div>
              {sidebarOpen && <div className="sidebar-content">{sidebar}</div>}
            </div>
          )}

          <div className="workspace-main">
            {tabs && tabs.length > 0 && (
              <div className="document-tabs">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    className={`doc-tab ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => onTabChange?.(tab.id)}
                  >
                    {tab.icon && <span className="tab-icon">{tab.icon}</span>}
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
            
            <div className="document-content">
              {children}
            </div>
          </div>
        </div>
      )}

      {lifecycle.showDrawer && (
        <VersionDrawer
          versions={lifecycle.versions}
          currentVersion={lifecycle.currentVersion}
          inspectedVersion={lifecycle.inspectedVersion}
          onSelectVersion={lifecycle.handleSelectVersion}
          onClose={() => lifecycle.setShowDrawer(false)}
          onPublish={lifecycle.handlePublishVersion}
          isEditing={lifecycle.isEditing}
        />
      )}
    </div>
  );
};
