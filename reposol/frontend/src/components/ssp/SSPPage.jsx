import { useState, useEffect, useCallback } from 'react';
import { useDocument } from '../../hooks/useDocument';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { useVersions } from '../../hooks/useVersions';
import EntityTable from '../shared/entity/EntityTable';
import EntityDetailPanel from '../shared/entity/EntityDetailPanel';
import StatusBadge from '../shared/status/StatusBadge';
import StatusBreakdown from '../shared/dashboard/StatusBreakdown';
import MetricCard from '../shared/dashboard/MetricCard';
import MetricCardGrid from '../shared/dashboard/MetricCardGrid';
import ProgressBar from '../shared/dashboard/ProgressBar';
import { MetadataEditor } from '../shared/MetadataEditor';
import { PropsEditor } from '../shared/PropsEditor';
import { BackMatterEditor } from '../shared/BackMatterEditor';
import { DocumentToolbar } from '../shared/DocumentToolbar';
import { VersionDrawer } from '../shared/VersionDrawer';
import { JsonEditor } from '../shared/JsonEditor';
import DiagramUploader from './DiagramUploader';

const generateUUID = () => crypto.randomUUID();

export function SSPPage({ sspId, initialEditMode = false, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(initialEditMode);

  const [selectedItem, setSelectedItem] = useState(null); // generic selection
  const [itemType, setItemType] = useState(null); // 'user', 'component', 'inventory', 'auth', 'infotype', 'control'

  const {
    doc,
    setDoc,
    loading,
    error,
    saveDocument,
    isSaving,
    isDirty
  } = useDocument('ssps', sspId, initialEditMode);

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
  } = useVersions('ssps', sspId, setDoc);

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

  if (loading) return <div className="p-8 text-center text-gray-500">Loading SSP...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  if (!doc || !doc['system-security-plan']) return null;

  const ssp = doc['system-security-plan'];
  
  // Safe accessors
  const sysChar = ssp['system-characteristics'] || {};
  const sysImp = ssp['system-implementation'] || {};
  const ctrlImp = ssp['control-implementation'] || {};

  const infoTypes = sysChar['system-information']?.['information-types'] || [];
  const users = sysImp.users || [];
  const components = sysImp.components || [];
  const inventoryItems = sysImp['inventory-items'] || [];
  const auths = sysImp['leveraged-authorizations'] || [];
  const implementedReqs = ctrlImp['implemented-requirements'] || [];

  const handleUpdateField = (path, value) => {
    const newDoc = JSON.parse(JSON.stringify(doc));
    let current = newDoc['system-security-plan'];
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) current[path[i]] = {};
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    handleUpdate(newDoc);
  };

  // Helper to open side panel
  const openDetail = (type, item) => {
    setItemType(type);
    setSelectedItem(item);
  };

  // Stats
  const totalReqs = implementedReqs.length;
  const validStatuses = ['implemented', 'partial'];
  let validCount = 0;
  const statusCounts = {};
  implementedReqs.forEach(req => {
    const byComps = req['by-components'] || [];
    let state = 'unknown';
    if (byComps.length > 0 && byComps[0]['implementation-status']) {
      state = byComps[0]['implementation-status'].state;
    }
    if (validStatuses.includes(state)) validCount++;
    statusCounts[state] = (statusCounts[state] || 0) + 1;
  });
  
  const coveragePercent = totalReqs > 0 ? Math.round((validCount / totalReqs) * 100) : 0;

  // Overview Tab
  const renderOverview = () => (
    <div className="overview-tab p-6">
      <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded shadow border dark:border-gray-700 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase">Referenced Profile</h3>
          <div className="text-lg font-medium">{ssp['import-profile']?.href || 'None'}</div>
        </div>
        {isEditing && (
          <button 
            className="text-blue-600 hover:underline"
            onClick={() => {
              const href = prompt('Enter Profile URI:', ssp['import-profile']?.href || '');
              if (href !== null) handleUpdateField(['import-profile'], { href });
            }}
          >
            Edit
          </button>
        )}
      </div>
      <h2 className="text-xl font-bold mb-4">SSP Dashboard</h2>
      <MetricCardGrid>
        <MetricCard title="Total Implemented Reqs" value={totalReqs} icon="📋" />
        <MetricCard title="Implementation Coverage" value={`${coveragePercent}%`} icon="✅" />
        <MetricCard title="System Components" value={components.length} icon="🧱" />
        <MetricCard title="System Users" value={users.length} icon="👥" />
      </MetricCardGrid>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow border dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4">FIPS Impact Level</h3>
          <div className="flex gap-4">
            <StatusBadge status={sysChar['security-impact-level']?.['security-objective-confidentiality'] || 'unknown'} category="fips-impact" />
            <StatusBadge status={sysChar['security-impact-level']?.['security-objective-integrity'] || 'unknown'} category="fips-impact" />
            <StatusBadge status={sysChar['security-impact-level']?.['security-objective-availability'] || 'unknown'} category="fips-impact" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow border dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Implementation Status Breakdown</h3>
          <StatusBreakdown counts={statusCounts} category="implementation-status" />
        </div>
      </div>
    </div>
  );

  // System Characteristics Tab
  const renderSysChar = () => (
    <div className="sys-char-tab p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block font-medium mb-1">System Name</label>
          <input className="w-full border rounded p-2 dark:bg-gray-700" disabled={!isEditing}
                 value={sysChar['system-name'] || ''}
                 onChange={e => handleUpdateField(['system-characteristics', 'system-name'], e.target.value)} />
        </div>
        <div>
          <label className="block font-medium mb-1">Short Name</label>
          <input className="w-full border rounded p-2 dark:bg-gray-700" disabled={!isEditing}
                 value={sysChar['system-name-short'] || ''}
                 onChange={e => handleUpdateField(['system-characteristics', 'system-name-short'], e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block font-medium mb-1">Description</label>
        <textarea className="w-full border rounded p-2 dark:bg-gray-700" rows="3" disabled={!isEditing}
                  value={sysChar.description || ''}
                  onChange={e => handleUpdateField(['system-characteristics', 'description'], e.target.value)} />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block font-medium mb-1">Security Sensitivity Level</label>
          <select className="w-full border rounded p-2 dark:bg-gray-700" disabled={!isEditing}
                  value={sysChar['security-sensitivity-level'] || ''}
                  onChange={e => handleUpdateField(['system-characteristics', 'security-sensitivity-level'], e.target.value)}>
            <option value="">Select Level...</option>
            <option value="low">Low</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label className="block font-medium mb-1">Operational Status</label>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={sysChar.status?.state || 'unknown'} category="operational-status" />
            {isEditing && (
              <select className="border rounded p-1 dark:bg-gray-700 ml-2"
                      value={sysChar.status?.state || ''}
                      onChange={e => handleUpdateField(['system-characteristics', 'status'], { ...sysChar.status, state: e.target.value })}>
                <option value="operational">Operational</option>
                <option value="under-development">Under Development</option>
                <option value="under-major-modification">Under Major Modification</option>
                <option value="disposition">Disposition</option>
                <option value="other">Other</option>
              </select>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-lg border-b pb-2">Architecture & Boundaries</h3>
        <div>
          <label className="block font-medium mb-1">Authorization Boundary</label>
          <textarea className="w-full border rounded p-2 dark:bg-gray-700" rows="3" disabled={!isEditing}
                    value={sysChar['authorization-boundary']?.description || ''}
                    onChange={e => handleUpdateField(['system-characteristics', 'authorization-boundary'], { ...sysChar['authorization-boundary'], description: e.target.value })} />
          <DiagramUploader 
            diagrams={sysChar['authorization-boundary']?.diagrams || []}
            onDiagramsChange={(newDiagrams) => handleUpdateField(['system-characteristics', 'authorization-boundary'], { ...sysChar['authorization-boundary'], diagrams: newDiagrams })}
            backMatter={ssp['back-matter'] || {}}
            onBackMatterChange={(newBackMatter) => handleUpdateField(['back-matter'], newBackMatter)}
            label="Authorization Boundary"
            editMode={isEditing}
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Network Architecture</label>
          <textarea className="w-full border rounded p-2 dark:bg-gray-700" rows="3" disabled={!isEditing}
                    value={sysChar['network-architecture']?.description || ''}
                    onChange={e => handleUpdateField(['system-characteristics', 'network-architecture'], { ...sysChar['network-architecture'], description: e.target.value })} />
          <DiagramUploader 
            diagrams={sysChar['network-architecture']?.diagrams || []}
            onDiagramsChange={(newDiagrams) => handleUpdateField(['system-characteristics', 'network-architecture'], { ...sysChar['network-architecture'], diagrams: newDiagrams })}
            backMatter={ssp['back-matter'] || {}}
            onBackMatterChange={(newBackMatter) => handleUpdateField(['back-matter'], newBackMatter)}
            label="Network Architecture"
            editMode={isEditing}
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Data Flow</label>
          <textarea className="w-full border rounded p-2 dark:bg-gray-700" rows="3" disabled={!isEditing}
                    value={sysChar['data-flow']?.description || ''}
                    onChange={e => handleUpdateField(['system-characteristics', 'data-flow'], { ...sysChar['data-flow'], description: e.target.value })} />
          <DiagramUploader 
            diagrams={sysChar['data-flow']?.diagrams || []}
            onDiagramsChange={(newDiagrams) => handleUpdateField(['system-characteristics', 'data-flow'], { ...sysChar['data-flow'], diagrams: newDiagrams })}
            backMatter={ssp['back-matter'] || {}}
            onBackMatterChange={(newBackMatter) => handleUpdateField(['back-matter'], newBackMatter)}
            label="Data Flow"
            editMode={isEditing}
          />
        </div>
      </div>
      
      <div className="space-y-4">
        <h3 className="font-semibold text-lg border-b pb-2">Security Impact Level (FIPS-199)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['confidentiality', 'integrity', 'availability'].map(obj => (
            <div key={obj}>
              <label className="block font-medium mb-1 capitalize">{obj}</label>
              <div className="flex items-center gap-2">
                <StatusBadge status={sysChar['security-impact-level']?.[`security-objective-${obj}`] || 'unknown'} category="fips-impact" />
                {isEditing && (
                  <select className="border rounded p-1 dark:bg-gray-700"
                          value={sysChar['security-impact-level']?.[`security-objective-${obj}`] || ''}
                          onChange={e => handleUpdateField(['system-characteristics', 'security-impact-level'], { ...sysChar['security-impact-level'], [`security-objective-${obj}`]: e.target.value })}>
                    <option value="fips-199-low">Low</option>
                    <option value="fips-199-moderate">Moderate</option>
                    <option value="fips-199-high">High</option>
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="space-y-4">
        <h3 className="font-semibold text-lg border-b pb-2">Information Types</h3>
        <EntityTable 
          data={infoTypes}
          columns={[
            { key: 'title', label: 'Title', sortable: true },
            { key: 'description', label: 'Description', render: v => v && v.length > 50 ? v.substring(0, 50)+'...' : v }
          ]}
          onRowClick={item => openDetail('infotype', item)}
          onAdd={isEditing ? () => {
             const newTypes = [...infoTypes, { uuid: generateUUID(), title: 'New Info Type', description: '' }];
             handleUpdateField(['system-characteristics', 'system-information'], { ...sysChar['system-information'], 'information-types': newTypes });
          } : null}
          onDelete={isEditing ? (uuids) => {
             const newTypes = infoTypes.filter(t => !uuids.includes(t.uuid));
             handleUpdateField(['system-characteristics', 'system-information'], { ...sysChar['system-information'], 'information-types': newTypes });
          } : null}
          addLabel="+ Add Information Type"
        />
      </div>

      <div className="space-y-4 mt-6">
        <h3 className="font-semibold text-lg border-b pb-2">Responsible Parties</h3>
        {(sysChar['responsible-parties']||[]).map((rp, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input className="w-1/3 border rounded p-2 dark:bg-gray-700" placeholder="Role ID" value={rp['role-id']||''} disabled={!isEditing} onChange={e => {
              const newRp = [...(sysChar['responsible-parties']||[])];
              newRp[i] = { ...newRp[i], 'role-id': e.target.value };
              handleUpdateField(['system-characteristics', 'responsible-parties'], newRp);
            }} />
            <input className="flex-1 border rounded p-2 dark:bg-gray-700" placeholder="Party UUIDs (comma separated)" value={(rp['party-uuids']||[]).join(', ')} disabled={!isEditing} onChange={e => {
              const newRp = [...(sysChar['responsible-parties']||[])];
              newRp[i] = { ...newRp[i], 'party-uuids': e.target.value.split(',').filter(Boolean).map(s=>s.trim()) };
              handleUpdateField(['system-characteristics', 'responsible-parties'], newRp);
            }} />
            {isEditing && (
              <button className="text-red-500 px-2" onClick={() => {
                const newRp = [...(sysChar['responsible-parties']||[])];
                newRp.splice(i, 1);
                handleUpdateField(['system-characteristics', 'responsible-parties'], newRp);
              }}>X</button>
            )}
          </div>
        ))}
        {isEditing && (
          <button className="text-sm text-blue-600 hover:underline" onClick={() => {
            const newRp = [...(sysChar['responsible-parties']||[]), { 'role-id': '', 'party-uuids': [] }];
            handleUpdateField(['system-characteristics', 'responsible-parties'], newRp);
          }}>+ Add Responsible Party</button>
        )}
      </div>
    </div>
  );

  // System Implementation Tab
  const [impTab, setImpTab] = useState('users');
  const renderSysImp = () => (
    <div className="sys-imp-tab h-full flex flex-col">
      <div className="p-4 border-b flex gap-4 bg-gray-50 dark:bg-gray-800">
        {['users', 'components', 'inventory-items', 'leveraged-authorizations'].map(t => (
          <button key={t} className={`px-4 py-2 font-medium rounded ${impTab === t ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`} onClick={() => setImpTab(t)}>
            {t.split('-').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ')}
          </button>
        ))}
      </div>
      <div className="p-6 flex-1">
        {impTab === 'users' && (
          <EntityTable data={users} columns={[
            { key: 'title', label: 'Title', sortable: true },
            { key: 'role-ids', label: 'Roles', render: v => (v||[]).map(r=><span key={r} className="mr-1 bg-gray-200 dark:bg-gray-700 px-2 rounded text-xs">{r}</span>) },
            { key: 'props', label: 'Props', render: v => (v||[]).length }
          ]}
          onRowClick={item => openDetail('user', item)}
          onAdd={isEditing ? () => {
            handleUpdateField(['system-implementation', 'users'], [...users, { uuid: generateUUID(), title: 'New User' }]);
          } : null}
          onDelete={isEditing ? uuids => handleUpdateField(['system-implementation', 'users'], users.filter(x => !uuids.includes(x.uuid))) : null}
          addLabel="+ Add User" />
        )}
        {impTab === 'components' && (
          <EntityTable data={components} columns={[
            { key: 'title', label: 'Title', sortable: true },
            { key: 'type', label: 'Type' },
            { key: 'status', label: 'Status', render: v => <StatusBadge status={v?.state||'unknown'} category="operational-status" /> },
            { key: 'description', label: 'Description', render: v => v && v.length > 50 ? v.substring(0, 50)+'...' : v }
          ]}
          onRowClick={item => openDetail('component', item)}
          onAdd={isEditing ? () => {
            handleUpdateField(['system-implementation', 'components'], [...components, { uuid: generateUUID(), title: 'New Component', type: 'software' }]);
          } : null}
          onDelete={isEditing ? uuids => handleUpdateField(['system-implementation', 'components'], components.filter(x => !uuids.includes(x.uuid))) : null}
          addLabel="+ Add Component" />
        )}
        {impTab === 'inventory-items' && (
          <EntityTable data={inventoryItems} columns={[
            { key: 'description', label: 'Description', sortable: true },
            { key: 'implemented-components', label: 'Implemented Comps', render: v => (v||[]).length }
          ]}
          onRowClick={item => openDetail('inventory', item)}
          onAdd={isEditing ? () => {
            handleUpdateField(['system-implementation', 'inventory-items'], [...inventoryItems, { uuid: generateUUID(), description: 'New Inventory Item' }]);
          } : null}
          onDelete={isEditing ? uuids => handleUpdateField(['system-implementation', 'inventory-items'], inventoryItems.filter(x => !uuids.includes(x.uuid))) : null}
          addLabel="+ Add Inventory Item" />
        )}
        {impTab === 'leveraged-authorizations' && (
          <EntityTable data={auths} columns={[
            { key: 'title', label: 'Title', sortable: true },
            { key: 'party-uuid', label: 'Party' },
            { key: 'date-authorized', label: 'Date Authorized' }
          ]}
          onRowClick={item => openDetail('auth', item)}
          onAdd={isEditing ? () => {
            handleUpdateField(['system-implementation', 'leveraged-authorizations'], [...auths, { uuid: generateUUID(), title: 'New Auth' }]);
          } : null}
          onDelete={isEditing ? uuids => handleUpdateField(['system-implementation', 'leveraged-authorizations'], auths.filter(x => !uuids.includes(x.uuid))) : null}
          addLabel="+ Add Auth" />
        )}
      </div>
    </div>
  );

  // Control Implementation Tab
  const renderCtrlImp = () => (
    <div className="ctrl-imp-tab p-6 h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Control Implementation Overview</h3>
        <ProgressBar progress={coveragePercent} label={`Implementation Coverage (${coveragePercent}%)`} />
        {isEditing && (
          <div className="mt-4">
            <label className="block font-medium mb-1">Description</label>
            <textarea className="w-full border rounded p-2 dark:bg-gray-700" rows="2"
                      value={ctrlImp.description || ''}
                      onChange={e => handleUpdateField(['control-implementation', 'description'], e.target.value)} />
          </div>
        )}
      </div>
      <div className="flex-1">
        <EntityTable 
          data={implementedReqs} 
          columns={[
            { key: 'control-id', label: 'Control ID', sortable: true, searchable: true },
            { key: 'by-components', label: 'By Components', render: v => (v||[]).length },
            { key: 'by-components', label: 'Status', render: v => {
              const state = (v && v.length > 0 && v[0]['implementation-status']) ? v[0]['implementation-status'].state : 'unknown';
              return <StatusBadge status={state} category="implementation-status" />
            }},
            { key: 'description', label: 'Description', render: v => {
              if (v) return v.length > 50 ? v.substring(0, 50)+'...' : v;
            }}
          ]}
          onRowClick={item => openDetail('control', item)}
          onAdd={isEditing ? () => {
            handleUpdateField(['control-implementation', 'implemented-requirements'], [...implementedReqs, { uuid: generateUUID(), 'control-id': 'new-control' }]);
          } : null}
          onDelete={isEditing ? uuids => handleUpdateField(['control-implementation', 'implemented-requirements'], implementedReqs.filter(x => !uuids.includes(x.uuid))) : null}
          addLabel="+ Add Implemented Requirement" />
      </div>
    </div>
  );

  // Slide-out panel content
  const renderDetailContent = () => {
    if (!selectedItem) return null;
    
    // Quick helper to update current list in state
    const updateListItem = (listPath, itemUuid, updates) => {
      const list = listPath.reduce((obj, key) => obj[key] || [], ssp);
      const idx = list.findIndex(x => x.uuid === itemUuid);
      if (idx > -1) {
        const newList = [...list];
        newList[idx] = { ...newList[idx], ...updates };
        handleUpdateField(listPath, newList);
        setSelectedItem(newList[idx]);
      }
    };

    if (itemType === 'infotype') {
      return (
        <div className="space-y-4">
          <div><label className="block text-sm font-medium">Title</label><input className="mt-1 block w-full rounded border-gray-300 dark:bg-gray-700" value={selectedItem.title||''} disabled={!isEditing} onChange={e=>updateListItem(['system-characteristics', 'system-information', 'information-types'], selectedItem.uuid, {title: e.target.value})} /></div>
          <div><label className="block text-sm font-medium">Description</label><textarea className="mt-1 block w-full rounded border-gray-300 dark:bg-gray-700" value={selectedItem.description||''} disabled={!isEditing} onChange={e=>updateListItem(['system-characteristics', 'system-information', 'information-types'], selectedItem.uuid, {description: e.target.value})} /></div>
          
          <div>
            <h4 className="font-medium border-b pb-1 mb-2">Categorizations</h4>
            {(selectedItem.categorizations||[]).map((cat, i) => (
              <div key={i} className="mb-2">
                 <input className="w-full text-sm border-gray-300 rounded dark:bg-gray-700 mb-1" placeholder="System URI" value={cat.system||''} disabled={!isEditing} onChange={e => {
                   const newCats = [...(selectedItem.categorizations||[])];
                   newCats[i] = { ...newCats[i], system: e.target.value };
                   updateListItem(['system-characteristics', 'system-information', 'information-types'], selectedItem.uuid, {categorizations: newCats});
                 }} />
                 <input className="w-full text-sm border-gray-300 rounded dark:bg-gray-700" placeholder="Info Type IDs (comma separated)" value={(cat['information-type-ids']||[]).join(', ')} disabled={!isEditing} onChange={e => {
                   const newCats = [...(selectedItem.categorizations||[])];
                   newCats[i] = { ...newCats[i], 'information-type-ids': e.target.value.split(',').filter(Boolean).map(s=>s.trim()) };
                   updateListItem(['system-characteristics', 'system-information', 'information-types'], selectedItem.uuid, {categorizations: newCats});
                 }} />
              </div>
            ))}
            {isEditing && (
              <button className="text-xs text-blue-600" onClick={() => {
                const newCats = [...(selectedItem.categorizations||[]), { system: '', 'information-type-ids': [] }];
                updateListItem(['system-characteristics', 'system-information', 'information-types'], selectedItem.uuid, {categorizations: newCats});
              }}>+ Add Categorization</button>
            )}
          </div>

          <div>
            <h4 className="font-medium border-b pb-1 mb-2">Impact Levels</h4>
            {['confidentiality', 'integrity', 'availability'].map(imp => {
              const impactObj = selectedItem[`${imp}-impact`] || {};
              return (
                <div key={imp} className="mb-2 p-2 border rounded bg-gray-50 dark:bg-gray-800">
                  <div className="font-medium capitalize mb-1">{imp}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500">Base</label>
                      <select className="w-full text-sm border-gray-300 rounded dark:bg-gray-700" value={impactObj.base||''} disabled={!isEditing} onChange={e => {
                         updateListItem(['system-characteristics', 'system-information', 'information-types'], selectedItem.uuid, {[`${imp}-impact`]: { ...impactObj, base: e.target.value }});
                      }}>
                         <option value="">Select...</option>
                         <option value="fips-199-low">Low</option>
                         <option value="fips-199-moderate">Moderate</option>
                         <option value="fips-199-high">High</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Selected</label>
                      <select className="w-full text-sm border-gray-300 rounded dark:bg-gray-700" value={impactObj.selected||''} disabled={!isEditing} onChange={e => {
                         updateListItem(['system-characteristics', 'system-information', 'information-types'], selectedItem.uuid, {[`${imp}-impact`]: { ...impactObj, selected: e.target.value }});
                      }}>
                         <option value="">Select...</option>
                         <option value="fips-199-low">Low</option>
                         <option value="fips-199-moderate">Moderate</option>
                         <option value="fips-199-high">High</option>
                      </select>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      );
    }
    
    if (itemType === 'user') {
       return (
        <div className="space-y-4">
          <div><label className="block text-sm font-medium">Title</label><input className="mt-1 block w-full rounded border-gray-300 dark:bg-gray-700" value={selectedItem.title||''} disabled={!isEditing} onChange={e=>updateListItem(['system-implementation', 'users'], selectedItem.uuid, {title: e.target.value})} /></div>
          <div><label className="block text-sm font-medium">Description</label><textarea className="mt-1 block w-full rounded border-gray-300 dark:bg-gray-700" value={selectedItem.description||''} disabled={!isEditing} onChange={e=>updateListItem(['system-implementation', 'users'], selectedItem.uuid, {description: e.target.value})} /></div>
          
          <div>
            <label className="block text-sm font-medium">Role IDs (comma separated)</label>
            <input className="mt-1 block w-full rounded border-gray-300 dark:bg-gray-700" value={(selectedItem['role-ids']||[]).join(', ')} disabled={!isEditing} onChange={e=>updateListItem(['system-implementation', 'users'], selectedItem.uuid, {'role-ids': e.target.value.split(',').filter(Boolean).map(s=>s.trim())})} />
          </div>

          <div>
            <h4 className="font-medium border-b pb-1 mb-2">Authorized Privileges</h4>
            {(selectedItem['authorized-privileges']||[]).map((priv, i) => (
              <div key={i} className="mb-2 p-2 border rounded bg-gray-50 dark:bg-gray-800">
                <input className="w-full text-sm border-gray-300 rounded dark:bg-gray-700 mb-1" placeholder="Title" value={priv.title||''} disabled={!isEditing} onChange={e => {
                  const newPriv = [...(selectedItem['authorized-privileges']||[])];
                  newPriv[i] = { ...newPriv[i], title: e.target.value };
                  updateListItem(['system-implementation', 'users'], selectedItem.uuid, {'authorized-privileges': newPriv});
                }} />
                <textarea className="w-full text-sm border-gray-300 rounded dark:bg-gray-700 mb-1" placeholder="Description" value={priv.description||''} disabled={!isEditing} onChange={e => {
                  const newPriv = [...(selectedItem['authorized-privileges']||[])];
                  newPriv[i] = { ...newPriv[i], description: e.target.value };
                  updateListItem(['system-implementation', 'users'], selectedItem.uuid, {'authorized-privileges': newPriv});
                }} />
                <input className="w-full text-sm border-gray-300 rounded dark:bg-gray-700" placeholder="Functions Performed (comma separated)" value={(priv['functions-performed']||[]).join(', ')} disabled={!isEditing} onChange={e => {
                  const newPriv = [...(selectedItem['authorized-privileges']||[])];
                  newPriv[i] = { ...newPriv[i], 'functions-performed': e.target.value.split(',').filter(Boolean).map(s=>s.trim()) };
                  updateListItem(['system-implementation', 'users'], selectedItem.uuid, {'authorized-privileges': newPriv});
                }} />
              </div>
            ))}
            {isEditing && (
              <button className="text-xs text-blue-600" onClick={() => {
                const newPriv = [...(selectedItem['authorized-privileges']||[]), { title: '', description: '', 'functions-performed': [] }];
                updateListItem(['system-implementation', 'users'], selectedItem.uuid, {'authorized-privileges': newPriv});
              }}>+ Add Privilege</button>
            )}
          </div>
          <div className="pt-2">
            <PropsEditor props={selectedItem.props || []} onChange={(p) => updateListItem(['system-implementation', 'users'], selectedItem.uuid, {props: p})} isEditing={isEditing} />
          </div>
        </div>
       );
    }

    if (itemType === 'auth') {
       return (
        <div className="space-y-4">
          <div><label className="block text-sm font-medium">Title</label><input className="mt-1 block w-full rounded border-gray-300 dark:bg-gray-700" value={selectedItem.title||''} disabled={!isEditing} onChange={e=>updateListItem(['system-implementation', 'leveraged-authorizations'], selectedItem.uuid, {title: e.target.value})} /></div>
          <div><label className="block text-sm font-medium">Party UUID</label><input className="mt-1 block w-full rounded border-gray-300 dark:bg-gray-700" value={selectedItem['party-uuid']||''} disabled={!isEditing} onChange={e=>updateListItem(['system-implementation', 'leveraged-authorizations'], selectedItem.uuid, {'party-uuid': e.target.value})} /></div>
          <div><label className="block text-sm font-medium">Date Authorized</label><input type="date" className="mt-1 block w-full rounded border-gray-300 dark:bg-gray-700" value={selectedItem['date-authorized']||''} disabled={!isEditing} onChange={e=>updateListItem(['system-implementation', 'leveraged-authorizations'], selectedItem.uuid, {'date-authorized': e.target.value})} /></div>
        </div>
       );
    }

    if (itemType === 'component' || itemType === 'inventory') {
      const getListName = (type) => {
        if (type === 'component') return 'components';
        if (type === 'inventory') return 'inventory-items';
      };
      const listName = getListName(itemType);

      return (
        <div className="space-y-4">
          {selectedItem.title !== undefined && (
            <div><label className="block text-sm font-medium">Title</label><input className="mt-1 block w-full rounded border-gray-300 dark:bg-gray-700" value={selectedItem.title||''} disabled={!isEditing} onChange={e=>updateListItem(['system-implementation', listName], selectedItem.uuid, {title: e.target.value})} /></div>
          )}
          {selectedItem.description !== undefined && (
            <div><label className="block text-sm font-medium">Description</label><textarea className="mt-1 block w-full rounded border-gray-300 dark:bg-gray-700" value={selectedItem.description||''} disabled={!isEditing} onChange={e=>updateListItem(['system-implementation', listName], selectedItem.uuid, {description: e.target.value})} /></div>
          )}
          {itemType === 'component' && (
            <div><label className="block text-sm font-medium">Type</label><input className="mt-1 block w-full rounded border-gray-300 dark:bg-gray-700" value={selectedItem.type||''} disabled={!isEditing} onChange={e=>updateListItem(['system-implementation', 'components'], selectedItem.uuid, {type: e.target.value})} /></div>
          )}
        </div>
      );
    }

    if (itemType === 'control') {
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Control ID</label>
            <input className="mt-1 block w-full rounded border-gray-300 dark:bg-gray-700" value={selectedItem['control-id']||''} disabled={!isEditing} 
                   onChange={e=>updateListItem(['control-implementation', 'implemented-requirements'], selectedItem.uuid, {'control-id': e.target.value})} />
          </div>

          <div className="mt-4">
            <h4 className="font-medium border-b pb-1 mb-2">Statements</h4>
            {(selectedItem.statements||[]).map((stmt, i) => (
              <div key={stmt.uuid || i} className="p-3 border rounded mb-3 bg-white dark:bg-gray-900">
                 <div className="font-semibold mb-2">Statement: {stmt['statement-id']}</div>
                 {(stmt['by-components']||[]).map((bc, bci) => {
                    const comp = components.find(c => c.uuid === bc['component-uuid']);
                    return (
                      <div key={bc.uuid} className="p-2 border rounded mb-2 bg-gray-50 dark:bg-gray-800 text-sm">
                         <div className="font-semibold mb-1">{comp ? comp.title : bc['component-uuid']}</div>
                         <div className="mb-1">{bc.description}</div>
                      </div>
                    )
                 })}
                 {isEditing && (
                   <button className="text-xs text-blue-600" onClick={() => {
                     const newStmts = [...selectedItem.statements];
                     if (!newStmts[i]['by-components']) newStmts[i]['by-components'] = [];
                     newStmts[i]['by-components'].push({ uuid: generateUUID(), 'component-uuid': '', description: '' });
                     updateListItem(['control-implementation', 'implemented-requirements'], selectedItem.uuid, {statements: newStmts});
                   }}>+ Add By-Component</button>
                 )}
              </div>
            ))}
            {isEditing && (
              <button className="text-sm text-blue-600 hover:underline" onClick={() => {
                const newStmts = [...(selectedItem.statements||[]), { uuid: generateUUID(), 'statement-id': '', 'by-components': [] }];
                updateListItem(['control-implementation', 'implemented-requirements'], selectedItem.uuid, {statements: newStmts});
              }}>+ Add Statement</button>
            )}
          </div>

          <div className="mt-4">
            <h4 className="font-medium border-b pb-1 mb-2">By Components (Requirement Level)</h4>
            {(selectedItem['by-components']||[]).map((bc, i) => {
               const comp = components.find(c => c.uuid === bc['component-uuid']);
               return (
                 <div key={bc.uuid} className="p-3 border rounded mb-3 bg-gray-50 dark:bg-gray-800">
                   <div className="font-semibold mb-2">{comp ? comp.title : bc['component-uuid']}</div>
                   
                   <div className="flex items-center gap-2 mb-2">
                     <span className="text-sm font-medium">Status:</span>
                     {!isEditing ? (
                       <StatusBadge status={bc['implementation-status']?.state||'unknown'} category="implementation-status" />
                     ) : (
                       <select className="text-sm border-gray-300 rounded dark:bg-gray-700" value={bc['implementation-status']?.state||''} onChange={e => {
                         const newBc = [...selectedItem['by-components']];
                         newBc[i] = { ...newBc[i], 'implementation-status': { state: e.target.value } };
                         updateListItem(['control-implementation', 'implemented-requirements'], selectedItem.uuid, {'by-components': newBc});
                       }}>
                         <option value="">Select...</option>
                         <option value="implemented">Implemented</option>
                         <option value="partial">Partial</option>
                         <option value="planned">Planned</option>
                         <option value="alternative">Alternative</option>
                         <option value="not-applicable">Not Applicable</option>
                       </select>
                     )}
                   </div>

                   <div className="mb-2">
                     <label className="block text-sm font-medium">Responsible Roles</label>
                     {!isEditing ? (
                       <div className="flex gap-1 mt-1">
                         {(bc['responsible-roles']||[]).map(r => <span key={r['role-id']} className="bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">{r['role-id']}</span>)}
                       </div>
                     ) : (
                       <input className="mt-1 block w-full text-sm border-gray-300 rounded dark:bg-gray-700" placeholder="Role IDs (comma separated)" value={(bc['responsible-roles']||[]).map(r=>r['role-id']).join(', ')} onChange={e => {
                         const newBc = [...selectedItem['by-components']];
                         newBc[i] = { ...newBc[i], 'responsible-roles': e.target.value.split(',').filter(Boolean).map(r => ({ 'role-id': r.trim() })) };
                         updateListItem(['control-implementation', 'implemented-requirements'], selectedItem.uuid, {'by-components': newBc});
                       }} />
                     )}
                   </div>

                   <div className="mb-2">
                     <label className="block text-sm font-medium">Set Parameters</label>
                     {(bc['set-parameters']||[]).map((sp, spIdx) => (
                       <div key={spIdx} className="flex gap-2 mt-1">
                         <input className="flex-1 text-sm border-gray-300 rounded dark:bg-gray-700" placeholder="Param ID" value={sp['param-id']||''} disabled={!isEditing} onChange={e => {
                           const newBc = [...selectedItem['by-components']];
                           newBc[i]['set-parameters'][spIdx] = { ...newBc[i]['set-parameters'][spIdx], 'param-id': e.target.value };
                           updateListItem(['control-implementation', 'implemented-requirements'], selectedItem.uuid, {'by-components': newBc});
                         }} />
                         <input className="flex-1 text-sm border-gray-300 rounded dark:bg-gray-700" placeholder="Value (comma separated)" value={(sp.values||[]).join(', ')} disabled={!isEditing} onChange={e => {
                           const newBc = [...selectedItem['by-components']];
                           newBc[i]['set-parameters'][spIdx] = { ...newBc[i]['set-parameters'][spIdx], values: e.target.value.split(',').map(v=>v.trim()) };
                           updateListItem(['control-implementation', 'implemented-requirements'], selectedItem.uuid, {'by-components': newBc});
                         }} />
                         {isEditing && (
                           <button className="text-red-500" onClick={() => {
                             const newBc = [...selectedItem['by-components']];
                             newBc[i]['set-parameters'].splice(spIdx, 1);
                             updateListItem(['control-implementation', 'implemented-requirements'], selectedItem.uuid, {'by-components': newBc});
                           }}>X</button>
                         )}
                       </div>
                     ))}
                     {isEditing && (
                       <button className="text-xs text-blue-600 mt-1" onClick={() => {
                         const newBc = [...selectedItem['by-components']];
                         if (!newBc[i]['set-parameters']) newBc[i]['set-parameters'] = [];
                         newBc[i]['set-parameters'].push({ 'param-id': '', values: [] });
                         updateListItem(['control-implementation', 'implemented-requirements'], selectedItem.uuid, {'by-components': newBc});
                       }}>+ Add Parameter</button>
                     )}
                   </div>

                   <div className="mb-2">
                     <label className="block text-sm font-medium">Description</label>
                     <textarea className="mt-1 block w-full text-sm border-gray-300 rounded dark:bg-gray-700" rows="3" value={bc.description||''} disabled={!isEditing} onChange={e => {
                       const newBc = [...selectedItem['by-components']];
                       newBc[i] = { ...newBc[i], description: e.target.value };
                       updateListItem(['control-implementation', 'implemented-requirements'], selectedItem.uuid, {'by-components': newBc});
                     }} />
                   </div>
                 </div>
               )
            })}
            {isEditing && (
              <button className="text-sm text-blue-600 hover:underline" onClick={() => {
                const newBc = [...(selectedItem['by-components']||[]), { uuid: generateUUID(), 'component-uuid': '' }];
                updateListItem(['control-implementation', 'implemented-requirements'], selectedItem.uuid, {'by-components': newBc});
              }}>+ Add by-component</button>
            )}
          </div>
        </div>
      );
    }
  };

  // Validation function
  const validateSSPCompleteness = () => {
    const sc = ssp['system-characteristics'] || {};
    const meta = ssp.metadata || {};
    const ci = ssp['control-implementation'] || {};
    
    const errors = [];
    const warnings = [];
    const passed = [];

    if (meta.title) passed.push('Metadata: Title is present');
    else errors.push({ text: 'Metadata: Title is missing', tab: 'metadata' });
    
    if (meta.version) passed.push('Metadata: Version is present');
    else errors.push({ text: 'Metadata: Version is missing', tab: 'metadata' });

    if (ssp['import-profile']?.href) passed.push('Profile: Referenced profile is present');
    else errors.push({ text: 'Profile: Referenced profile (import-profile.href) is missing', tab: 'overview' });

    if (sc['system-name']) passed.push('Characteristics: System name is present');
    else errors.push({ text: 'Characteristics: System name is missing', tab: 'characteristics' });

    if (sc['security-sensitivity-level']) passed.push('Characteristics: Security sensitivity level is present');
    else errors.push({ text: 'Characteristics: Security sensitivity level is missing', tab: 'characteristics' });

    if (sc['system-information']?.['information-types']?.length > 0) passed.push('Characteristics: Information types are present');
    else errors.push({ text: 'Characteristics: Information types are missing', tab: 'characteristics' });

    if (sc['authorization-boundary']?.description) passed.push('Characteristics: Authorization boundary description is present');
    else errors.push({ text: 'Characteristics: Authorization boundary description is missing', tab: 'characteristics' });

    const reqs = ci['implemented-requirements'] || [];
    if (reqs.length > 0) passed.push('Implementation: At least one control is implemented');
    else errors.push({ text: 'Implementation: No control implementations found', tab: 'controls' });

    reqs.forEach(req => {
      if (!req.description && (!req['by-components'] || req['by-components'].length === 0)) {
         warnings.push({ text: `Control ${req['control-id']}: Missing description and by-components`, tab: 'controls' });
      }
      (req['by-components'] || []).forEach(bc => {
         if (!bc.description) {
           errors.push({ text: `Control ${req['control-id']}: Component ${bc['component-uuid'] || 'unknown'} implementation missing description`, tab: 'controls' });
         }
         (bc['set-parameters'] || []).forEach(sp => {
           if (!sp.values || sp.values.length === 0 || sp.values.every(v => !v)) {
              errors.push({ text: `Control ${req['control-id']}: Parameter ${sp['param-id']} lacks value`, tab: 'controls' });
           }
         });
      });
    });

    return { errors, warnings, passed };
  };

  const renderValidation = () => {
    const { errors, warnings, passed } = validateSSPCompleteness();
    return (
      <div className="validation-tab p-6 space-y-6">
        <h2 className="text-xl font-bold mb-4">Completeness Report</h2>
        
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded border border-red-200 dark:border-red-800">
          <h3 className="font-semibold text-red-700 dark:text-red-300 mb-2">Errors ({errors.length})</h3>
          {errors.length === 0 ? <p className="text-sm text-red-600">No errors found!</p> : (
            <ul className="list-disc pl-5 space-y-1 text-sm text-red-800 dark:text-red-200">
              {errors.map((e, i) => (
                <li key={i}>
                  <button onClick={() => setActiveTab(e.tab)} className="hover:underline text-left">
                    {e.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded border border-yellow-200 dark:border-yellow-800">
          <h3 className="font-semibold text-yellow-700 dark:text-yellow-300 mb-2">Warnings ({warnings.length})</h3>
          {warnings.length === 0 ? <p className="text-sm text-yellow-600">No warnings found!</p> : (
            <ul className="list-disc pl-5 space-y-1 text-sm text-yellow-800 dark:text-yellow-200">
              {warnings.map((w, i) => (
                <li key={i}>
                  <button onClick={() => setActiveTab(w.tab)} className="hover:underline text-left">
                    {w.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded border border-green-200 dark:border-green-800">
          <h3 className="font-semibold text-green-700 dark:text-green-300 mb-2">Passed Checks ({passed.length})</h3>
          {passed.length === 0 ? <p className="text-sm text-green-600">No passed checks yet.</p> : (
            <ul className="list-disc pl-5 space-y-1 text-sm text-green-800 dark:text-green-200">
              {passed.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="document-page h-full flex flex-col">
      <DocumentToolbar
        title={ssp.metadata?.title || 'Untitled SSP'}
        mode="ssp"
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
        {['overview', 'characteristics', 'implementation', 'controls', 'metadata', 'json', 'validation'].map(tab => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="document-content flex-1 overflow-auto">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'characteristics' && renderSysChar()}
        {activeTab === 'implementation' && renderSysImp()}
        {activeTab === 'controls' && renderCtrlImp()}
        
        {activeTab === 'metadata' && (
          <div className="metadata-tab p-6 max-w-4xl mx-auto space-y-8">
            <section>
              <h3 className="text-lg font-semibold mb-4">Document Metadata</h3>
              <MetadataEditor
                metadata={ssp.metadata || {}}
                onChange={(md) => handleUpdateField(['metadata'], md)}
                isEditing={isEditing}
              />
            </section>
            
            <section>
              <h3 className="text-lg font-semibold mb-4">Properties</h3>
              <PropsEditor
                props={ssp.metadata?.props || []}
                onChange={(props) => handleUpdateField(['metadata', 'props'], props)}
                isEditing={isEditing}
              />
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-4">Back Matter</h3>
              <BackMatterEditor
                backMatter={ssp['back-matter'] || {}}
                onChange={(bm) => handleUpdateField(['back-matter'], bm)}
                isEditing={isEditing}
              />
            </section>
          </div>
        )}

        {activeTab === 'json' && (
          <div className="json-tab h-full">
            <JsonEditor data={doc} onChange={handleUpdate} readOnly={!isEditing} />
          </div>
        )}
        
        {activeTab === 'validation' && renderValidation()}
      </div>

      <EntityDetailPanel
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.title || selectedItem?.['control-id'] || selectedItem?.name || 'Details'}
      >
        <div className="p-4">
          {renderDetailContent()}
        </div>
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
}
