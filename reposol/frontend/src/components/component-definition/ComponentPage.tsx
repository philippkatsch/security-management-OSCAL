import React, { useState, useRef } from 'react';
import { useDocumentLifecycle } from '@hooks/useDocumentLifecycle';
import { useConfirm } from '@hooks/useConfirm';
import { updateDocumentWith } from '@lib/document-updater';
import { DocumentPageLayout } from '../layout/DocumentPageLayout';
import EntityTable from '@components/shared/entity/EntityTable';
import EntityDetailPanel from '@components/shared/entity/EntityDetailPanel';
import StatusBadge from '@components/shared/status/StatusBadge';
import MetricCard from '@components/shared/dashboard/MetricCard';
import MetricCardGrid from '@components/shared/dashboard/MetricCardGrid';
import StatusBreakdown from '@components/shared/dashboard/StatusBreakdown';
import { MetadataEditor } from '@components/shared/MetadataEditor';
import { PropsEditor } from '@components/shared/PropsEditor';
import { BackMatterEditor } from '@components/shared/BackMatterEditor';
import { JsonEditor } from '@components/shared/JsonEditor';
import ComponentEditor from './ComponentEditor';
import CapabilityEditor from './CapabilityEditor';
import styles from './ComponentPage.module.css';

const generateUUID = () => crypto.randomUUID();

export interface ComponentPageProps {
  componentDefId?: string;
  compId?: string;
  initialEditMode?: boolean;
  onClose?: () => void;
}

export const ComponentPage: React.FC<ComponentPageProps> = ({ 
  componentDefId, 
  compId,
  initialEditMode, 
  onClose 
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedComponent, setSelectedComponent] = useState<any>(null);
  const [selectedCapability, setSelectedCapability] = useState<any>(null);
  const jsonEditorRef = useRef<any>(null);
  const { confirm } = useConfirm();

  const effectiveId = componentDefId || compId || '';
  const lifecycle = useDocumentLifecycle(
    'component-definitions', 
    'component-definition', 
    effectiveId, 
    initialEditMode
  );

  const { activeDoc, isEditing, setDoc, pushUndoRedoState } = lifecycle;
  const doc = activeDoc;
  const compDef: any = doc?.['component-definition'] || {};
  const components = compDef.components || [];
  const capabilities = compDef.capabilities || [];

  const handleUpdate = (updater: (draft: any) => void) => {
    const nextDoc = updateDocumentWith(doc, updater);
    setDoc(nextDoc);
    pushUndoRedoState(nextDoc);
  };

  const handleAddComponent = () => {
    const newComp = {
      uuid: generateUUID(),
      type: 'software',
      title: 'New Component',
      description: '',
      purpose: '',
      props: [],
      links: [],
      'responsible-roles': [],
      protocols: [],
      'control-implementations': []
    };
    handleUpdate(draft => {
      if (!draft['component-definition'].components) {
        draft['component-definition'].components = [];
      }
      draft['component-definition'].components.push(newComp);
    });
    setSelectedComponent(newComp);
  };

  const handleDeleteComponents = async (uuids: string[]) => {
    const confirmed = await confirm({
      title: 'Delete Component',
      message: `Delete ${uuids.length} component(s)?`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    handleUpdate(draft => {
      if (draft['component-definition'].components) {
        draft['component-definition'].components = draft['component-definition'].components.filter(
          (c: any) => !uuids.includes(c.uuid)
        );
      }
    });
    if (selectedComponent && uuids.includes(selectedComponent.uuid)) {
      setSelectedComponent(null);
    }
  };

  const handleUpdateComponent = (uuid: string, updates: any) => {
    handleUpdate(draft => {
      const comps = draft['component-definition'].components || [];
      const index = comps.findIndex((c: any) => c.uuid === uuid);
      if (index !== -1) {
        comps[index] = { ...comps[index], ...updates };
      }
    });
    if (selectedComponent && selectedComponent.uuid === uuid) {
      setSelectedComponent((prev: any) => ({ ...prev, ...updates }));
    }
  };

  const handleAddCapability = () => {
    const newCap = {
      uuid: generateUUID(),
      name: 'New Capability',
      description: 'New Capability Description'
    };
    handleUpdate(draft => {
      if (!draft['component-definition'].capabilities) {
        draft['component-definition'].capabilities = [];
      }
      draft['component-definition'].capabilities.push(newCap);
    });
    setSelectedCapability(newCap);
  };

  const handleDeleteCapabilities = async (uuids: string[]) => {
    const confirmed = await confirm({
      title: 'Delete Capability',
      message: `Delete ${uuids.length} capability(ies)?`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    handleUpdate(draft => {
      if (draft['component-definition'].capabilities) {
        draft['component-definition'].capabilities = draft['component-definition'].capabilities.filter(
          (c: any) => !uuids.includes(c.uuid)
        );
      }
    });
    if (selectedCapability && uuids.includes(selectedCapability.uuid)) {
      setSelectedCapability(null);
    }
  };

  const handleUpdateCapability = (uuid: string, updates: any) => {
    handleUpdate(draft => {
      const caps = draft['component-definition'].capabilities || [];
      const index = caps.findIndex((c: any) => c.uuid === uuid);
      if (index !== -1) {
        caps[index] = { ...caps[index], ...updates };
      }
    });
    if (selectedCapability && selectedCapability.uuid === uuid) {
      setSelectedCapability((prev: any) => ({ ...prev, ...updates }));
    }
  };

  const componentColumns = [
    { key: 'title', label: 'Title', sortable: true, searchable: true },
    { key: 'type', label: 'Type', filterable: true },
    { 
      key: 'description', 
      label: 'Description', 
      searchable: true,
      render: (val: string) => val && val.length > 80 ? val.substring(0, 80) + '...' : val 
    },
    {
      key: 'status',
      label: 'Status',
      render: (val: any) => <StatusBadge status={val?.state || 'unknown'} category="operational-status" />
    }
  ];

  const capabilityColumns = [
    { key: 'name', label: 'Name', sortable: true, searchable: true },
    { 
      key: 'description', 
      label: 'Description', 
      searchable: true,
      render: (val: string) => val && val.length > 80 ? val.substring(0, 80) + '...' : val 
    },
    {
      key: 'components',
      label: 'Components',
      render: (_: any, item: any) => (item['incorporates-components'] || []).length
    }
  ];

  const totalControls = components.reduce((acc: number, c: any) => 
    acc + (c['control-implementations']?.reduce((sum: number, ci: any) => sum + (ci['implemented-requirements']?.length || 0), 0) || 0)
  , 0);

  const totalControlImpls = components.reduce((acc: number, c: any) => 
    acc + (c['control-implementations']?.length || 0)
  , 0);

  const compTypeCounts = components.reduce((acc: Record<string, number>, c: any) => {
    const t = c.type || 'unknown';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  const tabsConfig = [
    { id: 'overview', label: 'Overview' },
    { id: 'components', label: 'Components' },
    { id: 'capabilities', label: 'Capabilities' },
    { id: 'metadata', label: 'Metadata' },
    { id: 'json', label: 'JSON Source' }
  ];

  return (
    <DocumentPageLayout
      stage="component-definitions"
      docId={componentDefId}
      lifecycle={lifecycle}
      title={compDef.metadata?.title || 'Untitled Component Definition'}
      tabs={tabsConfig}
      activeTab={activeTab}
      onTabChange={(newTab) => {
        if (activeTab === 'json' && newTab !== 'json') {
          const entityId = jsonEditorRef.current?.getCursorEntityId?.();
          if (entityId) {
            const comp = components.find((c: any) => c.uuid === entityId);
            if (comp) setSelectedComponent(comp);
            else {
              const cap = capabilities.find((c: any) => c.uuid === entityId);
              if (cap) setSelectedCapability(cap);
            }
          }
        }
        setActiveTab(newTab);
      }}
      onClose={onClose}
    >
      <div className={styles['panel-body']} style={{ height: '100%', overflowY: 'auto', padding: '24px' }}>
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--color-text)' }}>Component Definition Dashboard</h2>
            <MetricCardGrid>
              <MetricCard title="Total Components" value={components.length} icon="🧱" accentColor="var(--color-primary)" />
              <MetricCard title="Total Capabilities" value={capabilities.length} icon="⚡" accentColor="var(--color-warning)" />
              <MetricCard title="Control Impls" value={totalControlImpls} icon="🔒" accentColor="var(--color-info)" />
              <MetricCard title="Impl Reqs" value={totalControls} icon="✅" accentColor="var(--color-success)" />
            </MetricCardGrid>

            <div>
              <StatusBreakdown 
                title="Component Types" 
                variant="bar"
                items={Object.entries(compTypeCounts).map(([type, count], i) => ({
                  label: type,
                  count: count as number,
                  color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'][i % 7]
                }))}
              />
            </div>
          </div>
        )}

        {activeTab === 'components' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
            <EntityTable
              data={components}
              columns={componentColumns}
              onRowClick={setSelectedComponent}
              onAdd={isEditing ? handleAddComponent : undefined}
              onDelete={isEditing ? handleDeleteComponents : undefined}
              addLabel="+ Add Component"
            />
          </div>
        )}

        {activeTab === 'capabilities' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
            <EntityTable
              data={capabilities}
              columns={capabilityColumns}
              onRowClick={setSelectedCapability}
              onAdd={isEditing ? handleAddCapability : undefined}
              onDelete={isEditing ? handleDeleteCapabilities : undefined}
              addLabel="+ Add Capability"
            />
          </div>
        )}

        {activeTab === 'metadata' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
            <section>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>Document Metadata</h3>
              <MetadataEditor
                metadata={compDef.metadata || {}}
                onChange={(md: any) => handleUpdate(draft => {
                  draft['component-definition'].metadata = md;
                })}
                isEditing={isEditing}
              />
            </section>
            
            <section>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>Properties</h3>
              <PropsEditor
                props={compDef.metadata?.props || []}
                onChange={(props: any) => handleUpdate(draft => {
                  if (!draft['component-definition'].metadata) draft['component-definition'].metadata = {};
                  draft['component-definition'].metadata.props = props;
                })}
                isEditing={isEditing}
              />
            </section>

            <section>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>Back Matter</h3>
              <BackMatterEditor
                backMatter={compDef['back-matter'] || {}}
                onChange={(bm: any) => handleUpdate(draft => {
                  draft['component-definition']['back-matter'] = bm;
                })}
                isEditing={isEditing}
              />
            </section>
          </div>
        )}

        {activeTab === 'json' && (
          <div style={{ height: '100%' }}>
            <JsonEditor
              ref={jsonEditorRef}
              value={doc}
              onChange={(newDoc: any) => {
                setDoc(newDoc);
                pushUndoRedoState(newDoc);
              }}
              readOnly={!isEditing}
              highlightId={selectedComponent?.uuid || selectedCapability?.uuid || null}
            />
          </div>
        )}
      </div>

      <EntityDetailPanel
        isOpen={!!selectedComponent}
        onClose={() => setSelectedComponent(null)}
        title={selectedComponent?.title || 'Component Details'}
      >
        {selectedComponent && (
          <ComponentEditor
            component={selectedComponent}
            onUpdate={(updatedComponent: any) => handleUpdateComponent(selectedComponent.uuid, updatedComponent)}
            editMode={isEditing}
          />
        )}
      </EntityDetailPanel>

      <EntityDetailPanel
        isOpen={!!selectedCapability}
        onClose={() => setSelectedCapability(null)}
        title={selectedCapability?.name || 'Capability Details'}
      >
        {selectedCapability && (
          <CapabilityEditor
            capability={selectedCapability}
            components={components}
            onUpdate={(updatedCapability: any) => handleUpdateCapability(selectedCapability.uuid, updatedCapability)}
            editMode={isEditing}
          />
        )}
      </EntityDetailPanel>
    </DocumentPageLayout>
  );
};

export default ComponentPage;
