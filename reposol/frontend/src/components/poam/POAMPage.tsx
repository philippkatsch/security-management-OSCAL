import React, { useState, useEffect } from 'react';
import { produce } from 'immer';
import { useDocumentLifecycle } from '../../hooks/useDocumentLifecycle';
import { useDocumentActions } from '../../hooks/useDocumentActions';
import { updatePOAMRoot, updatePOAMList, savePOAMItem, replacePOAM } from '../../lib/document-actions';
import { DocumentPageLayout } from '../layout/DocumentPageLayout';
import EntityTable from '../shared/entity/EntityTable';
import { JsonEditor } from '../shared/JsonEditor';
import { StandardMetadataTab } from '../shared/tabs/StandardMetadataTab';
import { POAMDashboard } from './POAMDashboard';
import { POAMItemsEditor } from './POAMItemsEditor';

const generateUUID = () => crypto.randomUUID();

export function POAMPage({ poamId, initialEditMode = false, onClose }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemType, setItemType] = useState(null);

  const lifecycle = useDocumentLifecycle('poams', 'plan-of-action-and-milestones', poamId, initialEditMode);
  const { doc, setDoc, loading, error, isEditing, pushUndoRedoState } = lifecycle;
  const { dispatch } = useDocumentActions(lifecycle);

  const handleUpdate = (newDoc) => {
    pushUndoRedoState(newDoc);
    setDoc(newDoc);
  };

  const updateRootField = (field, value) => {
    dispatch(updatePOAMRoot(field, value));
  };

  const updateListField = (listName, newList) => {
    dispatch(updatePOAMList(listName, newList));
  };

  const handleSaveItem = (item) => {
    dispatch(savePOAMItem(itemType, item));
    setSelectedItem(null);
    setItemType(null);
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading POA&M...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  if (!doc || !doc['plan-of-action-and-milestones']) return null;

  const poam = doc['plan-of-action-and-milestones'];
  const items = poam['poam-items'] || [];
  const completedItems = items.filter(i => (i.props || []).some(p => p.name === 'status' && p.value === 'completed'));
  const resolvedPercent = items.length > 0 ? Math.round((completedItems.length / items.length) * 100) : 0;
  
  const riskStatusData = {};
  (poam.risks || []).forEach(r => {
    const s = r.status || 'unknown';
    riskStatusData[s] = (riskStatusData[s] || 0) + 1;
  });

  const priorityData = {};
  items.forEach(i => {
    const p = (i.props || []).find(pr => pr.name === 'priority')?.value || 'unassigned';
    priorityData[`P${p}`] = (priorityData[`P${p}`] || 0) + 1;
  });

  const dashboardMetrics = [
    { title: 'Total Items', value: items.length, icon: '📋' },
    { title: 'Open Items', value: items.length - completedItems.length, icon: '🔥' },
    { title: 'Identified Risks', value: (poam.risks || []).length, icon: '⚠️' },
    { title: 'Observations', value: (poam.observations || []).length, icon: '👁️' }
  ];

  const tabs = [
    { id: 'dashboard', label: 'Overview' },
    { id: 'items', label: 'POA&M Items' },
    { id: 'observations', label: 'Observations' },
    { id: 'risks', label: 'Risks' },
    { id: 'metadata', label: 'Metadata' },
    { id: 'json', label: 'JSON Source' }
  ];

  const renderListTab = (listName, title, columns) => (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <EntityTable 
        data={poam[listName] || []}
        columns={columns}
        onRowClick={item => { setItemType(listName); setSelectedItem(item); }}
        onAdd={isEditing ? () => { setItemType(listName); setSelectedItem({ uuid: generateUUID(), title: `New ${title}` }); } : undefined}
        onDelete={isEditing ? uuids => {
          updateListField(listName, (poam[listName] || []).filter(x => !uuids.includes(x.uuid)));
        } : undefined}
      />
    </div>
  );

  return (
    <DocumentPageLayout
      stage="poams"
      docId={poamId}
      lifecycle={lifecycle}
      title={poam.metadata?.title || 'Untitled POA&M'}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClose={onClose}
    >
      {activeTab === 'dashboard' && (
        <POAMDashboard 
          poam={poam} isEditing={isEditing} updateRootField={updateRootField}
          dashboardMetrics={dashboardMetrics} resolvedPercent={resolvedPercent}
          completedItems={completedItems} items={items}
          riskStatusData={riskStatusData} priorityData={priorityData}
        />
      )}
      {activeTab === 'items' && renderListTab('poam-items', 'POA&M Items', [
        { key: 'title', label: 'Title', sortable: true },
        { key: 'description', label: 'Description', render: v => v?.substring(0, 50) + (v?.length > 50 ? '...' : '') }
      ])}
      {activeTab === 'observations' && renderListTab('observations', 'Observations', [
        { key: 'title', label: 'Title', sortable: true },
        { key: 'description', label: 'Description', render: v => v?.substring(0, 50) + (v?.length > 50 ? '...' : '') }
      ])}
      {activeTab === 'risks' && renderListTab('risks', 'Risks', [
        { key: 'title', label: 'Title', sortable: true },
        { key: 'status', label: 'Status' }
      ])}
      {activeTab === 'metadata' && (
        <StandardMetadataTab document={poam} onChange={(newPoam) => dispatch(replacePOAM(newPoam))} isEditing={isEditing} />
      )}
      {activeTab === 'json' && (
        <div className="p-6 h-full"><JsonEditor value={doc} onChange={handleUpdate} readOnly={!isEditing} /></div>
      )}

      {selectedItem && (
        <POAMItemsEditor 
          item={selectedItem} 
          doc={poam}
          readOnly={!isEditing} 
          onSave={handleSaveItem} 
          onClose={() => { setSelectedItem(null); setItemType(null); }} 
        />
      )}
    </DocumentPageLayout>
  );
}
