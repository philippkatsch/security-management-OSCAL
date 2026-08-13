import React from 'react';
import EntityTable from '../shared/entity/EntityTable';
import ProgressBar from '../shared/dashboard/ProgressBar';
import StatusBadge from '../shared/status/StatusBadge';

export function ControlImplementationTab({ ctrlImp, isEditing, handleUpdateField, openDetail, coveragePercent }) {
  const implementedReqs = ctrlImp['implemented-requirements'] || [];
  const generateUUID = () => crypto.randomUUID();

  return (
    <div className="ctrl-imp-tab p-6 h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Control Implementation Overview</h3>
        <ProgressBar progress={coveragePercent} label={`Implementation Coverage (${coveragePercent}%)`} />
        {isEditing && (
          <div className="mt-4">
            <label className="block font-medium mb-1">Description</label>
            <textarea className="w-full border rounded p-2 dark:bg-gray-700" rows={2}
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
            { key: 'by-components-count', label: 'By Components', render: (_, row) => (row['by-components']||[]).length },
            { key: 'by-components-status', label: 'Status', render: (_, row) => {
              const byComps = row['by-components'];
              const state = (byComps && byComps.length > 0 && byComps[0]['implementation-status']) ? byComps[0]['implementation-status'].state : 'unknown';
              return <StatusBadge status={state} category="implementation-status" />;
            }},
            { key: 'description', label: 'Description', render: v => {
              if (v) return v.length > 50 ? v.substring(0, 50)+'...' : v;
            }}
          ]}
          onRowClick={item => openDetail('control', item)}
          onAdd={isEditing ? () => {
            handleUpdateField(['control-implementation', 'implemented-requirements'], [...implementedReqs, { uuid: generateUUID(), 'control-id': 'new-control' }]);
          } : undefined}
          onDelete={isEditing ? uuids => handleUpdateField(['control-implementation', 'implemented-requirements'], implementedReqs.filter(x => !uuids.includes(x.uuid))) : undefined}
          addLabel="+ Add Implemented Requirement" />
      </div>
    </div>
  );
}
