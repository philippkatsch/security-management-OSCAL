import React, { useState, useEffect, useRef } from 'react';
import { produce } from 'immer';
import { useDocumentLifecycle } from '../../hooks/useDocumentLifecycle';
import { useDocumentActions } from '../../hooks/useDocumentActions';
import { initializeSSPComponents, updateSSPField, updateSSPListItem, replaceSSP } from '../../lib/document-actions';
import { DocumentPageLayout } from '../layout/DocumentPageLayout';
import EntityDetailPanel from '../shared/entity/EntityDetailPanel';
import MetricCard from '../shared/dashboard/MetricCard';
import MetricCardGrid from '../shared/dashboard/MetricCardGrid';
import StatusBadge from '../shared/status/StatusBadge';
import StatusBreakdown from '../shared/dashboard/StatusBreakdown';
import { JsonEditor } from '../shared/JsonEditor';
import { StandardMetadataTab } from '../shared/tabs/StandardMetadataTab';
import { PropsEditor } from '../shared/PropsEditor';

import { UnifiedControlEditor } from '../shared/control-editor/UnifiedControlEditor';
import { SystemCharacteristicsTab } from './SystemCharacteristicsTab';
import { SystemImplementationTab } from './SystemImplementationTab';
import { ControlImplementationTab } from './ControlImplementationTab';
import { useControlTree } from '../../hooks/useControlTree';
import { ControlTree } from '../shared/control-tree';
import { authFetch } from '../../lib/api';

const generateUUID = () => crypto.randomUUID();

export function SSPPage({ sspId, initialEditMode = false, onClose }: any) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemType, setItemType] = useState<any>(null);
  const hasInitializedComponent = useRef(false);
  const [catalog, setCatalog] = useState<any>({ groups: [], controls: [] });

  const lifecycle = useDocumentLifecycle('ssps', 'system-security-plan', sspId, initialEditMode);
  const { doc, setDoc, loading, error, isEditing, pushUndoRedoState } = lifecycle;
  const { dispatch } = useDocumentActions(lifecycle);

  const handleUpdate = (newDoc: any) => {
    pushUndoRedoState(newDoc);
    setDoc(newDoc);
  };

  useEffect(() => {
    if (doc && doc['system-security-plan'] && !hasInitializedComponent.current) {
      const ssp = doc['system-security-plan'];
      const sysImp = ssp['system-implementation'];
      if (!sysImp || !sysImp.components || sysImp.components.length === 0) {
        const sysName = ssp['system-characteristics']?.['system-name'] || 'New System';
        dispatch(initializeSSPComponents(sysName));
      }
      hasInitializedComponent.current = true;
      
      // Attempt to load the referenced profile to get structure
      const href = ssp['import-profile']?.href;
      if (href) {
         // Assuming href is something we can extract an ID from, or we can just ignore groups for now
         // We will just leave it empty if we can't easily resolve.
      }
    }
  }, [doc, dispatch]);

  const ssp = doc ? doc['system-security-plan'] : null;
  const sysChar = ssp ? (ssp['system-characteristics'] || {}) : {};
  const sysImp = ssp ? (ssp['system-implementation'] || {}) : {};
  const ctrlImp = ssp ? (ssp['control-implementation'] || {}) : {};

  const handleUpdateField = (path: any, value: any) => {
    dispatch(updateSSPField(path, value));
  };

  const openDetail = (type: any, item: any) => { setItemType(type); setSelectedItem(item); };

  const totalReqs = (ctrlImp['implemented-requirements'] || []).length;
  let validCount = 0;
  const statusCounts: any = {};
  
  const implementedControls = (ctrlImp['implemented-requirements'] || []).map((req: any) => {
     const state = req['by-components']?.[0]?.['implementation-status']?.state || 'unknown';
     if (['implemented', 'partial'].includes(state)) validCount++;
     statusCounts[state] = (statusCounts[state] || 0) + 1;
     
     return {
        id: req['control-id'],
        title: req.description || req['control-id'],
        props: [{ name: 'status', value: state }]
     };
  });
  
  const coveragePercent = totalReqs > 0 ? Math.round((validCount / totalReqs) * 100) : 0;

  const handleControlSelect = (id: string | null) => {
      if (id) {
          const req = (ctrlImp['implemented-requirements'] || []).find((r: any) => r['control-id'] === id);
          if (req) {
              openDetail('control', req);
          }
      }
  };

  const tree = useControlTree({ 
    groups: catalog.groups,
    controls: implementedControls,
    onSelect: handleControlSelect 
  });

  if (loading) return <div className="p-8 text-center text-gray-500">Loading SSP...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  if (!doc || !ssp) return null;

  const renderOverview = () => (
    <div className="overview-tab p-6">
      <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded shadow border flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase">Referenced Profile</h3>
          <div className="text-lg font-medium">{ssp['import-profile']?.href || 'None'}</div>
        </div>
        {isEditing && (
          <button className="text-blue-600 hover:underline" onClick={() => {
            const href = prompt('Enter Profile URI:', ssp['import-profile']?.href || '');
            if (href !== null) handleUpdateField(['import-profile'], { href });
          }}>Edit</button>
        )}
      </div>
      <h2 className="text-xl font-bold mb-4">SSP Dashboard</h2>
      <MetricCardGrid>
        <MetricCard title="Total Implemented Reqs" value={totalReqs} icon="📋" />
        <MetricCard title="Implementation Coverage" value={`${coveragePercent}%`} icon="✅" />
        <MetricCard title="System Components" value={(sysImp.components || []).length} icon="🧱" />
        <MetricCard title="System Users" value={(sysImp.users || []).length} icon="👥" />
      </MetricCardGrid>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow border">
          <h3 className="text-lg font-semibold mb-4">FIPS Impact Level</h3>
          <div className="flex gap-4">
            <StatusBadge status={sysChar['security-impact-level']?.['security-objective-confidentiality'] || 'unknown'} category="fips-impact" />
            <StatusBadge status={sysChar['security-impact-level']?.['security-objective-integrity'] || 'unknown'} category="fips-impact" />
            <StatusBadge status={sysChar['security-impact-level']?.['security-objective-availability'] || 'unknown'} category="fips-impact" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow border">
          <h3 className="text-lg font-semibold mb-4">Implementation Status Breakdown</h3>
          <StatusBreakdown counts={statusCounts} category="implementation-status" />
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'syschar', label: 'System Characteristics' },
    { id: 'sysimp', label: 'System Implementation' },
    { id: 'ctrlimp', label: 'Control Implementation' },
    { id: 'metadata', label: 'Metadata' },
    { id: 'json', label: 'JSON Source' }
  ];

  const updateListItem = (listPath: any, itemUuid: any, updates: any) => {
    dispatch(updateSSPListItem(listPath, itemUuid, updates));
    setSelectedItem((prev: any) => ({ ...prev, ...updates }));
  };

  const getStatusForNode = (node: any) => {
     return node.props?.find((p: any) => p.name === 'status')?.value || 'unknown';
  };

  return (
    <DocumentPageLayout
      stage="ssps"
      docId={sspId}
      lifecycle={lifecycle}
      title={ssp.metadata?.title || 'Untitled SSP'}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClose={onClose}
      sidebarOpen={activeTab === 'ctrlimp'}
      sidebar={
        activeTab === 'ctrlimp' && (
          <div style={{ width: '300px', height: '100%', background: 'var(--color-surface)' }}>
             <ControlTree 
               tree={tree} 
               renderNodeExtra={(node) => {
                  const req = (ctrlImp['implemented-requirements'] || []).find((r: any) => r['control-id'] === node.id);
                  if (!req) return null;
                  const state = req['by-components']?.[0]?.['implementation-status']?.state || 'unknown';
                  return <StatusBadge status={state} category="implementation-status" />;
               }}
             />
          </div>
        )
      }
    >
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'syschar' && <SystemCharacteristicsTab sysChar={sysChar} isEditing={isEditing} handleUpdateField={handleUpdateField} ssp={ssp} openDetail={openDetail} />}
      {activeTab === 'sysimp' && <SystemImplementationTab sysImp={sysImp} isEditing={isEditing} handleUpdateField={handleUpdateField} openDetail={openDetail} />}
      {activeTab === 'ctrlimp' && <ControlImplementationTab ctrlImp={ctrlImp} isEditing={isEditing} handleUpdateField={handleUpdateField} openDetail={openDetail} coveragePercent={coveragePercent} />}
      {activeTab === 'metadata' && <StandardMetadataTab document={ssp} onChange={(newSsp: any) => dispatch(replaceSSP(newSsp))} isEditing={isEditing} />}
      {activeTab === 'json' && <div className="p-6 h-full"><JsonEditor value={doc} onChange={handleUpdate} readOnly={!isEditing} /></div>}

      <EntityDetailPanel isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} title={"Detail"}>
        <div className="p-4">
          {selectedItem && (
            itemType === 'control' ? (
              <UnifiedControlEditor
                control={implementedControls.find((c: any) => c.id === selectedItem['control-id']) || { id: selectedItem['control-id'], title: selectedItem.title }}
                stage="ssp"
                isEditing={isEditing}
                implementation={selectedItem}
                components={sysImp.components}
              />
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium">Title</label>
                  <input className="mt-1 block w-full rounded border-gray-300 dark:bg-gray-700"
                         value={selectedItem.title || ''} disabled={!isEditing}
                         onChange={e => {
                           let p: any[] = [];
                           if (itemType === 'infotype') p = ['system-characteristics', 'system-information', 'information-types'];
                           if (itemType === 'user') p = ['system-implementation', 'users'];
                           if (itemType === 'component') p = ['system-implementation', 'components'];
                           if (itemType === 'inventory') p = ['system-implementation', 'inventory-items'];
                           if (itemType === 'auth') p = ['system-implementation', 'leveraged-authorizations'];
                           updateListItem(p, selectedItem.uuid, { title: e.target.value });
                         }} />
                </div>
                <div className="pt-2">
                  <PropsEditor props={selectedItem.props || []} isEditing={isEditing}
                               onChange={(p: any) => {
                                 let pth: any[] = [];
                                 if (itemType === 'user') pth = ['system-implementation', 'users'];
                                 if (itemType === 'component') pth = ['system-implementation', 'components'];
                                 if (itemType === 'inventory') pth = ['system-implementation', 'inventory-items'];
                                 updateListItem(pth, selectedItem.uuid, { props: p });
                               }} />
                </div>
              </div>
            )
          )}
        </div>
      </EntityDetailPanel>
    </DocumentPageLayout>
  );
}

export default SSPPage;
