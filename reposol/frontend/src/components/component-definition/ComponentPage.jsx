import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';
import { useDocument } from '../../hooks/useDocument';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { useVersions } from '../../hooks/useVersions';
import EntityTable from '../shared/entity/EntityTable';
import EntityDetailPanel from '../shared/entity/EntityDetailPanel';
import StatusBadge from '../shared/status/StatusBadge';
import MetricCard from '../shared/dashboard/MetricCard';
import MetricCardGrid from '../shared/dashboard/MetricCardGrid';
import StatusBreakdown from '../shared/dashboard/StatusBreakdown';
import { MetadataEditor } from '../shared/MetadataEditor';
import { PropsEditor } from '../shared/PropsEditor';
import { BackMatterEditor } from '../shared/BackMatterEditor';
import { DocumentToolbar } from '../shared/DocumentToolbar';
import { VersionDrawer } from '../shared/VersionDrawer';
import { JsonEditor } from '../shared/JsonEditor';

const generateUUID = () => crypto.randomUUID();

export const ComponentPage = ({ componentDefId, initialEditMode = false, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(initialEditMode);
  
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [selectedCapability, setSelectedCapability] = useState(null);

  const {
    doc,
    setDoc,
    loading,
    error,
    saveDocument,
    isSaving,
    isDirty
  } = useDocument('component-definitions', componentDefId, initialEditMode);

  const {
    state: undoState,
    set: setUndoState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetUndo
  } = useUndoRedo(doc);

  const {
    versions,
    showVersions,
    setShowVersions,
    loadVersions,
    restoreVersion,
    isRestoring
  } = useVersions('component-definitions', componentDefId, setDoc);

  // Sync doc with undo state
  useEffect(() => {
    if (doc && !undoState) {
      resetUndo(doc);
    }
  }, [doc, undoState, resetUndo]);

  const handleUpdate = useCallback((newDoc) => {
    setUndoState(newDoc);
    setDoc(newDoc);
  }, [setDoc, setUndoState]);

  const handleSave = async () => {
    await saveDocument(doc);
  };

  const handleUndo = () => {
    const prevState = undo();
    if (prevState) setDoc(prevState);
  };

  const handleRedo = () => {
    const nextState = redo();
    if (nextState) setDoc(nextState);
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading component definition...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  if (!doc || !doc['component-definition']) return null;

  const compDef = doc['component-definition'];
  const components = compDef.components || [];
  const capabilities = compDef.capabilities || [];

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
    handleUpdate({
      ...doc,
      'component-definition': {
        ...compDef,
        components: [...components, newComp]
      }
    });
    setSelectedComponent(newComp);
  };

  const handleDeleteComponents = (uuids) => {
    if (!window.confirm(`Delete ${uuids.length} component(s)?`)) return;
    handleUpdate({
      ...doc,
      'component-definition': {
        ...compDef,
        components: components.filter(c => !uuids.includes(c.uuid))
      }
    });
    if (selectedComponent && uuids.includes(selectedComponent.uuid)) {
      setSelectedComponent(null);
    }
  };

  const handleUpdateComponent = (uuid, updates) => {
    handleUpdate({
      ...doc,
      'component-definition': {
        ...compDef,
        components: components.map(c => c.uuid === uuid ? { ...c, ...updates } : c)
      }
    });
    if (selectedComponent && selectedComponent.uuid === uuid) {
      setSelectedComponent({ ...selectedComponent, ...updates });
    }
  };

  const handleAddCapability = () => {
    const newCap = {
      uuid: generateUUID(),
      name: 'New Capability',
      description: '',
      'incorporates-components': [],
      'control-implementations': []
    };
    handleUpdate({
      ...doc,
      'component-definition': {
        ...compDef,
        capabilities: [...capabilities, newCap]
      }
    });
    setSelectedCapability(newCap);
  };

  const handleDeleteCapabilities = (uuids) => {
    if (!window.confirm(`Delete ${uuids.length} capability(ies)?`)) return;
    handleUpdate({
      ...doc,
      'component-definition': {
        ...compDef,
        capabilities: capabilities.filter(c => !uuids.includes(c.uuid))
      }
    });
    if (selectedCapability && uuids.includes(selectedCapability.uuid)) {
      setSelectedCapability(null);
    }
  };

  const handleUpdateCapability = (uuid, updates) => {
    handleUpdate({
      ...doc,
      'component-definition': {
        ...compDef,
        capabilities: capabilities.map(c => c.uuid === uuid ? { ...c, ...updates } : c)
      }
    });
    if (selectedCapability && selectedCapability.uuid === uuid) {
      setSelectedCapability({ ...selectedCapability, ...updates });
    }
  };

  const componentColumns = [
    { key: 'title', label: 'Title', sortable: true, searchable: true },
    { key: 'type', label: 'Type', filterable: true },
    { 
      key: 'description', 
      label: 'Description', 
      searchable: true,
      render: (val) => val && val.length > 80 ? val.substring(0, 80) + '...' : val 
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => <StatusBadge status={val?.state || 'unknown'} category="operational-status" />
    }
  ];

  const capabilityColumns = [
    { key: 'name', label: 'Name', sortable: true, searchable: true },
    { 
      key: 'description', 
      label: 'Description', 
      searchable: true,
      render: (val) => val && val.length > 80 ? val.substring(0, 80) + '...' : val 
    },
    {
      key: 'components',
      label: 'Components',
      render: (_, item) => (item['incorporates-components'] || []).length
    }
  ];

  // Stats for Overview
  const totalControls = components.reduce((acc, c) => 
    acc + (c['control-implementations']?.reduce((sum, ci) => sum + (ci['implemented-requirements']?.length || 0), 0) || 0)
  , 0);

  const totalControlImpls = components.reduce((acc, c) => 
    acc + (c['control-implementations']?.length || 0)
  , 0);

  const compTypeCounts = components.reduce((acc, c) => {
    const t = c.type || 'unknown';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="document-page">
      <DocumentToolbar
        title={compDef.metadata?.title || 'Untitled Component Definition'}
        mode="component-definition"
        isEditing={isEditing}
        onToggleEdit={() => {
          const next = !isEditing;
          setIsEditing(next);
          if (next) {
            if (!window.location.search.includes('edit=true')) window.history.replaceState(null, '', window.location.pathname + '?edit=true');
          } else {
            if (window.location.search.includes('edit=true')) window.history.replaceState(null, '', window.location.pathname);
          }
        }}
        onSave={handleSave}
        isDirty={isDirty}
        isSaving={isSaving}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onSaveVersion={() => {
          loadVersions();
          setShowVersions(true);
        }}
        onBack={onClose}
      />

      <div className="document-tabs">
        {['overview', 'components', 'capabilities', 'metadata', 'json'].map(tab => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="document-content">
        {activeTab === 'overview' && (
          <div className="overview-tab p-6">
            <h2 className="text-xl font-bold mb-4">Component Definition Dashboard</h2>
            <MetricCardGrid>
              <MetricCard title="Total Components" value={components.length} icon="🧱" />
              <MetricCard title="Total Capabilities" value={capabilities.length} icon="⚡" />
              <MetricCard title="Control Impls" value={totalControlImpls} icon="🔒" />
              <MetricCard title="Impl Reqs" value={totalControls} icon="✅" />
            </MetricCardGrid>

            <div className="mt-8">
              <StatusBreakdown 
                title="Component Types" 
                variant="bar"
                items={Object.entries(compTypeCounts).map(([type, count], i) => ({
                  label: type,
                  count,
                  color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'][i % 7]
                }))}
              />
            </div>
          </div>
        )}

        {activeTab === 'components' && (
          <div className="components-tab p-6 h-full flex flex-col">
            <EntityTable
              data={components}
              columns={componentColumns}
              onRowClick={setSelectedComponent}
              onAdd={isEditing ? handleAddComponent : null}
              onDelete={isEditing ? handleDeleteComponents : null}
              addLabel="+ Add Component"
            />
          </div>
        )}

        {activeTab === 'capabilities' && (
          <div className="capabilities-tab p-6 h-full flex flex-col">
            <EntityTable
              data={capabilities}
              columns={capabilityColumns}
              onRowClick={setSelectedCapability}
              onAdd={isEditing ? handleAddCapability : null}
              onDelete={isEditing ? handleDeleteCapabilities : null}
              addLabel="+ Add Capability"
            />
          </div>
        )}

        {activeTab === 'metadata' && (
          <div className="metadata-tab p-6 max-w-4xl mx-auto space-y-8">
            <section>
              <h3 className="text-lg font-semibold mb-4">Document Metadata</h3>
              <MetadataEditor
                metadata={compDef.metadata || {}}
                onChange={(md) => handleUpdate({ ...doc, 'component-definition': { ...compDef, metadata: md } })}
                isEditing={isEditing}
              />
            </section>
            
            <section>
              <h3 className="text-lg font-semibold mb-4">Properties</h3>
              <PropsEditor
                props={compDef.metadata?.props || []}
                onChange={(props) => handleUpdate({ 
                  ...doc, 
                  'component-definition': { 
                    ...compDef, 
                    metadata: { ...compDef.metadata, props } 
                  } 
                })}
                isEditing={isEditing}
              />
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-4">Back Matter</h3>
              <BackMatterEditor
                backMatter={compDef['back-matter'] || {}}
                onChange={(bm) => handleUpdate({ ...doc, 'component-definition': { ...compDef, 'back-matter': bm } })}
                isEditing={isEditing}
              />
            </section>
          </div>
        )}

        {activeTab === 'json' && (
          <div className="json-tab h-full">
            <JsonEditor
              value={doc}
              onChange={handleUpdate}
              readOnly={!isEditing}
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
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={selectedComponent.title || ''}
                onChange={(e) => handleUpdateComponent(selectedComponent.uuid, { title: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={selectedComponent.type || 'software'}
                onChange={(e) => handleUpdateComponent(selectedComponent.uuid, { type: e.target.value })}
                disabled={!isEditing}
              >
                <option value="this-system">This System</option>
                <option value="system">System</option>
                <option value="interconnection">Interconnection</option>
                <option value="software">Software</option>
                <option value="hardware">Hardware</option>
                <option value="service">Service</option>
                <option value="policy">Policy</option>
                <option value="physical">Physical</option>
                <option value="process-procedure">Process/Procedure</option>
                <option value="plan">Plan</option>
                <option value="guidance">Guidance</option>
                <option value="standard">Standard</option>
                <option value="validation">Validation</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                rows="3"
                value={selectedComponent.description || ''}
                onChange={(e) => handleUpdateComponent(selectedComponent.uuid, { description: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Purpose</label>
              <textarea
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                rows="2"
                value={selectedComponent.purpose || ''}
                onChange={(e) => handleUpdateComponent(selectedComponent.uuid, { purpose: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <div className="pt-4 border-t">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Properties</h4>
              <PropsEditor
                props={selectedComponent.props || []}
                onChange={(props) => handleUpdateComponent(selectedComponent.uuid, { props })}
                isEditing={isEditing}
              />
            </div>
          </div>
        )}
      </EntityDetailPanel>

      <EntityDetailPanel
        isOpen={!!selectedCapability}
        onClose={() => setSelectedCapability(null)}
        title={selectedCapability?.name || 'Capability Details'}
      >
        {selectedCapability && (
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={selectedCapability.name || ''}
                onChange={(e) => handleUpdateCapability(selectedCapability.uuid, { name: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                rows="3"
                value={selectedCapability.description || ''}
                onChange={(e) => handleUpdateCapability(selectedCapability.uuid, { description: e.target.value })}
                disabled={!isEditing}
              />
            </div>
          </div>
        )}
      </EntityDetailPanel>

      <VersionDrawer
        isOpen={showVersions}
        onClose={() => setShowVersions(false)}
        versions={versions}
        onRestore={restoreVersion}
        isRestoring={isRestoring}
      />
    </div>
  );
};
