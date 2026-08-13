import React from 'react';
import StatusBadge from '../shared/status/StatusBadge';
import EntityTable from '../shared/entity/EntityTable';
import DiagramUploader from './DiagramUploader';

export function SystemCharacteristicsTab({ sysChar, isEditing, handleUpdateField, ssp, openDetail }) {
  const infoTypes = sysChar['system-information']?.['information-types'] || [];
  
  const generateUUID = () => crypto.randomUUID();

  return (
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
        <textarea className="w-full border rounded p-2 dark:bg-gray-700" rows={3} disabled={!isEditing}
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
        <div className="form-group">
          <label className="block font-medium mb-1">Authorization Boundary</label>
          <textarea className="w-full border rounded p-2 dark:bg-gray-700" rows={3} disabled={!isEditing}
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
        <div className="form-group">
          <label className="block font-medium mb-1">Network Architecture</label>
          <textarea className="w-full border rounded p-2 dark:bg-gray-700" rows={3} disabled={!isEditing}
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
        <div className="form-group">
          <label className="block font-medium mb-1">Data Flow</label>
          <textarea className="w-full border rounded p-2 dark:bg-gray-700" rows={3} disabled={!isEditing}
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
          } : undefined}
          onDelete={isEditing ? (uuids) => {
             const newTypes = infoTypes.filter(t => !uuids.includes(t.uuid));
             handleUpdateField(['system-characteristics', 'system-information'], { ...sysChar['system-information'], 'information-types': newTypes });
          } : undefined}
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
}
