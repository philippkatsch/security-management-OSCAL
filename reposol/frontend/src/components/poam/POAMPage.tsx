import React, { useState, useRef } from 'react';
import { useDocumentLifecycle } from '../../hooks/useDocumentLifecycle';
import { useDocumentActions } from '../../hooks/useDocumentActions';
import {
  updatePOAMRoot,
  updatePOAMList,
  savePOAMItem,
  replacePOAM,
  deletePOAMItems,
  deletePOAMFindings,
  deletePOAMObservations,
  deletePOAMRisks,
  addPOAMLocalComponent,
  removePOAMLocalComponent,
  addPOAMLocalUser,
  removePOAMLocalUser,
  importARFindingsAction,
} from '../../lib/document-actions/poam-actions';
import { DocumentPageLayout } from '../layout/DocumentPageLayout';
import EntityTable from '../shared/entity/EntityTable';
import { JsonEditor } from '../shared/JsonEditor';
import { StandardMetadataTab } from '../shared/tabs/StandardMetadataTab';
import { POAMDashboard } from './POAMDashboard';
import { POAMItemsEditor } from './POAMItemsEditor';
import { ARFindingsImportModal } from './ARFindingsImportModal';
import { FindingEditorModal } from '../assessment-results/modals/FindingEditorModal';
import { ObservationEditorModal } from '../assessment-results/modals/ObservationEditorModal';
import { RiskEditorModal } from '../assessment-results/modals/RiskEditorModal';
import { StatusBadge } from '../shared/status';
import { LoadingSpinner } from '../shared/ui/LoadingSpinner';
import { generateUUID } from '../../lib/oscal-utils';
import styles from './POAMPage.module.css';

export interface POAMPageProps {
  poamId?: string;
  initialEditMode?: boolean;
  onClose?: () => void;
}

export function POAMPage({ poamId = '', initialEditMode = false, onClose }: POAMPageProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemType, setItemType] = useState<string | null>(null);
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
  const jsonEditorRef = useRef<any>(null);

  const lifecycle = useDocumentLifecycle('poams', 'plan-of-action-and-milestones', poamId, initialEditMode);
  const { doc, setDoc, loading, error, isEditing, pushUndoRedoState } = lifecycle;
  const { dispatch } = useDocumentActions(lifecycle);

  const handleUpdate = (newDoc: any) => {
    pushUndoRedoState(newDoc);
    setDoc(newDoc);
  };

  const updateRootField = (field: string, value: any) => {
    dispatch(updatePOAMRoot(field, value));
  };

  const updateListField = (listName: string, newList: any[]) => {
    dispatch(updatePOAMList(listName, newList));
  };

  const handleSaveItem = (item: any) => {
    dispatch(savePOAMItem(itemType || 'poam-items', item));
    setSelectedItem(null);
    setItemType(null);
  };

  const handleImportFindings = (newItems: any[], newObs: any[], newRisks: any[]) => {
    dispatch(importARFindingsAction(newItems, newObs, newRisks));
  };

  if (loading && !doc) return <LoadingSpinner variant="skeleton" message="Loading POA&M..." />;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  if (!doc || !doc['plan-of-action-and-milestones']) return null;

  const poam: any = doc['plan-of-action-and-milestones'];
  const items = poam['poam-items'] || [];
  const completedItems = items.filter((i: any) => (i.props || []).some((p: any) => p.name === 'status' && p.value === 'completed'));
  const resolvedPercent = items.length > 0 ? Math.round((completedItems.length / items.length) * 100) : 0;

  const riskStatusData: Record<string, number> = {};
  (poam.risks || []).forEach((r: any) => {
    const s = r.status || 'unknown';
    riskStatusData[s] = (riskStatusData[s] || 0) + 1;
  });

  const priorityData: Record<string, number> = {};
  items.forEach((i: any) => {
    const p = (i.props || []).find((pr: any) => pr.name === 'priority')?.value;
    const label = p ? (/^\d+$/.test(p) ? `P${p}` : p) : 'Unassigned';
    priorityData[label] = (priorityData[label] || 0) + 1;
  });

  const dashboardMetrics = [
    { title: 'Total Items', value: items.length, icon: '📋' },
    { title: 'Open Items', value: items.length - completedItems.length, icon: '🔥' },
    { title: 'Findings', value: (poam.findings || []).length, icon: '🎯' },
    { title: 'Identified Risks', value: (poam.risks || []).length, icon: '⚠️' },
    { title: 'Observations', value: (poam.observations || []).length, icon: '👁️' }
  ];

  const tabs = [
    { id: 'dashboard', label: 'Overview' },
    { id: 'items', label: 'POA&M Items' },
    { id: 'findings', label: 'Findings' },
    { id: 'observations', label: 'Observations' },
    { id: 'risks', label: 'Risks' },
    { id: 'local-definitions', label: 'Local Definitions' },
    { id: 'metadata', label: 'Metadata' },
    { id: 'json', label: 'JSON Source' }
  ];

  const renderListTab = (listName: string, title: string, columns: any[], entityTypeKey = listName) => (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <EntityTable
        data={poam[listName] || []}
        columns={columns}
        onRowClick={item => { setItemType(entityTypeKey); setSelectedItem(item); }}
        onAdd={isEditing ? () => {
          let newItem: any;
          if (entityTypeKey === 'findings') {
            newItem = {
              uuid: generateUUID(),
              title: 'New Finding',
              description: '',
              target: { type: 'statement-id', 'target-id': '', status: { state: 'not-satisfied' } }
            };
          } else if (entityTypeKey === 'observations') {
            newItem = {
              uuid: generateUUID(),
              title: 'New Observation',
              description: '',
              methods: ['EXAMINE'],
              collected: new Date().toISOString()
            };
          } else if (entityTypeKey === 'risks') {
            newItem = {
              uuid: generateUUID(),
              title: 'New Risk',
              statement: 'Identified risk',
              status: 'open'
            };
          } else {
            newItem = {
              uuid: generateUUID(),
              title: `New ${title.replace(/s$/, '')}`,
              description: '',
              props: [{ name: 'status', value: 'open' }]
            };
          }
          setItemType(entityTypeKey);
          setSelectedItem(newItem);
        } : undefined}
        onDelete={isEditing ? uuids => {
          if (entityTypeKey === 'poam-items') {
            dispatch(deletePOAMItems(uuids));
          } else if (entityTypeKey === 'findings') {
            dispatch(deletePOAMFindings(uuids));
          } else if (entityTypeKey === 'observations') {
            dispatch(deletePOAMObservations(uuids));
          } else if (entityTypeKey === 'risks') {
            dispatch(deletePOAMRisks(uuids));
          } else {
            updateListField(listName, (poam[listName] || []).filter(x => !uuids.includes(x.uuid)));
          }
        } : undefined}
      />
    </div>
  );

  const headerActions = isEditing ? (
    <button
      type="button"
      className={styles['poam-toolbar-btn']}
      onClick={() => setIsImportWizardOpen(true)}
      data-testid="btn-toolbar-import-ar"
    >
      📥 Import AR Findings
    </button>
  ) : undefined;

  return (
    <DocumentPageLayout
      stage="poams"
      docId={poamId}
      lifecycle={lifecycle}
      title={poam.metadata?.title || 'Untitled POA&M'}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(newTab) => {
        if (activeTab === 'json' && newTab !== 'json') {
          const entityId = jsonEditorRef.current?.getCursorEntityId?.();
          if (entityId) {
            const item = items.find((i: any) => i.uuid === entityId);
            if (item) { setSelectedItem(item); setItemType('poam-items'); }
            const finding = (poam.findings || []).find((f: any) => f.uuid === entityId);
            if (finding) { setSelectedItem(finding); setItemType('findings'); }
            const obs = (poam.observations || []).find((o: any) => o.uuid === entityId);
            if (obs) { setSelectedItem(obs); setItemType('observations'); }
            const risk = (poam.risks || []).find((r: any) => r.uuid === entityId);
            if (risk) { setSelectedItem(risk); setItemType('risks'); }
          }
        }
        setActiveTab(newTab);
      }}
      onClose={onClose}
      headerActions={headerActions}
    >
      {activeTab === 'dashboard' && (
        <POAMDashboard
          poam={poam} isEditing={isEditing} updateRootField={updateRootField}
          dashboardMetrics={dashboardMetrics} resolvedPercent={resolvedPercent}
          completedItems={completedItems} items={items}
          riskStatusData={riskStatusData} priorityData={priorityData}
          onOpenImportWizard={() => setIsImportWizardOpen(true)}
        />
      )}
      {activeTab === 'items' && renderListTab('poam-items', 'POA&M Items', [
        { key: 'title', label: 'Title', sortable: true },
        { key: 'description', label: 'Description', render: v => v?.substring(0, 50) + (v?.length > 50 ? '...' : '') }
      ], 'poam-items')}
      {activeTab === 'findings' && renderListTab('findings', 'Findings', [
        { key: 'title', label: 'Title', sortable: true },
        { key: 'target', label: 'Target ID', render: t => t?.['target-id'] || 'N/A', sortable: true },
        { key: 'status', label: 'Status', render: (_, r: any) => {
          const state = typeof r.target?.status === 'string' ? r.target.status : r.target?.status?.state;
          return <StatusBadge category="finding-status" value={state || 'not-satisfied'} />;
        } },
        { key: 'description', label: 'Description', render: v => v?.substring(0, 50) + (v?.length > 50 ? '...' : '') }
      ], 'findings')}
      {activeTab === 'observations' && renderListTab('observations', 'Observations', [
        { key: 'title', label: 'Title', sortable: true },
        { key: 'description', label: 'Description', render: v => v?.substring(0, 50) + (v?.length > 50 ? '...' : '') }
      ], 'observations')}
      {activeTab === 'risks' && renderListTab('risks', 'Risks', [
        { key: 'title', label: 'Title', sortable: true },
        { key: 'status', label: 'Status', render: (status: any) => <StatusBadge category="risk-status" value={status || 'open'} /> },
        { key: 'statement', label: 'Statement', render: v => v?.substring(0, 50) + (v?.length > 50 ? '...' : '') }
      ], 'risks')}
      {activeTab === 'local-definitions' && (
        <div className="p-6" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h2 className="text-xl font-bold mb-4">Local Remediation Components</h2>
            <EntityTable
              data={poam['local-definitions']?.components || []}
              columns={[
                { key: 'title', label: 'Component Title', sortable: true },
                { key: 'type', label: 'Type', sortable: true },
                { key: 'description', label: 'Description', render: v => v?.substring(0, 60) + (v?.length > 60 ? '...' : '') }
              ]}
              onAdd={isEditing ? () => {
                dispatch(addPOAMLocalComponent({
                  title: 'New Remediation Component',
                  type: 'software',
                  description: 'Component defined locally to support POA&M remediation.'
                }));
              } : undefined}
              onDelete={isEditing ? uuids => {
                uuids.forEach(u => dispatch(removePOAMLocalComponent(u)));
              } : undefined}
            />
          </div>
          <div>
            <h2 className="text-xl font-bold mb-4">Local Remediation Users / Assignees</h2>
            <EntityTable
              data={poam['local-definitions']?.users || []}
              columns={[
                { key: 'title', label: 'User / Assignee Name', sortable: true },
                { key: 'short-name', label: 'Short Name' },
                { key: 'role-ids', label: 'Roles', render: (roles: any) => Array.isArray(roles) ? roles.join(', ') : (roles || 'N/A') }
              ]}
              onAdd={isEditing ? () => {
                dispatch(addPOAMLocalUser({
                  title: 'New Assignee',
                  'short-name': 'assignee',
                  'role-ids': ['remediation-lead']
                }));
              } : undefined}
              onDelete={isEditing ? uuids => {
                uuids.forEach(u => dispatch(removePOAMLocalUser(u)));
              } : undefined}
            />
          </div>
        </div>
      )}
      {activeTab === 'metadata' && (
        <StandardMetadataTab document={poam} onChange={(newPoam) => dispatch(replacePOAM(newPoam))} isEditing={isEditing} />
      )}
      {activeTab === 'json' && (
        <div className="p-6 h-full"><JsonEditor ref={jsonEditorRef} value={doc} onChange={handleUpdate} readOnly={!isEditing} highlightId={selectedItem?.uuid || null} /></div>
      )}

      {selectedItem && itemType === 'poam-items' && (
        <POAMItemsEditor
          item={selectedItem}
          doc={poam}
          readOnly={!isEditing}
          onSave={handleSaveItem}
          onClose={() => { setSelectedItem(null); setItemType(null); }}
        />
      )}

      {itemType === 'findings' && (
        <FindingEditorModal
          isOpen={Boolean(selectedItem)}
          finding={selectedItem}
          observations={poam.observations || []}
          risks={poam.risks || []}
          isEditing={isEditing}
          onClose={() => { setSelectedItem(null); setItemType(null); }}
          onUpdate={(updated) => {
            dispatch(savePOAMItem('findings', updated));
            setSelectedItem(updated);
          }}
        />
      )}

      {itemType === 'observations' && (
        <ObservationEditorModal
          isOpen={Boolean(selectedItem)}
          observation={selectedItem}
          isEditing={isEditing}
          onClose={() => { setSelectedItem(null); setItemType(null); }}
          onUpdate={(updated) => {
            dispatch(savePOAMItem('observations', updated));
            setSelectedItem(updated);
          }}
        />
      )}

      {itemType === 'risks' && (
        <RiskEditorModal
          isOpen={Boolean(selectedItem)}
          risk={selectedItem}
          isEditing={isEditing}
          onClose={() => { setSelectedItem(null); setItemType(null); }}
          onUpdate={(updated) => {
            dispatch(savePOAMItem('risks', updated));
            setSelectedItem(updated);
          }}
        />
      )}

      <ARFindingsImportModal
        isOpen={isImportWizardOpen}
        onClose={() => setIsImportWizardOpen(false)}
        onImport={handleImportFindings}
      />
    </DocumentPageLayout>
  );
}

