import React, { useState } from 'react';
import StatusBadge from '../shared/status/StatusBadge';
import EntityTable from '../shared/entity/EntityTable';
import ProgressBar from '../shared/dashboard/ProgressBar';
import StatusBreakdown from '../shared/dashboard/StatusBreakdown';
import './SSPEditor.css';

function getImplementationStatus(requirement) {
  if (!requirement?.['by-components'] || requirement['by-components'].length === 0) return 'planned';
  
  const statuses = requirement['by-components'].map(bc => bc?.['implementation-status']?.state || 'planned');
  
  if (statuses.includes('partial')) return 'partial';
  if (statuses.every(s => s === 'implemented')) return 'implemented';
  if (statuses.every(s => s === 'planned')) return 'planned';
  if (statuses.every(s => s === 'not-applicable')) return 'not-applicable';
  if (statuses.every(s => s === 'alternative')) return 'alternative';
  
  return 'partial';
}

function calculateCoverage(requirements) {
  const counts = { implemented: 0, partial: 0, planned: 0, alternative: 0, 'not-applicable': 0 };
  const total = requirements?.length || 0;

  if (total === 0) {
    return { total, implemented: 0, partial: 0, planned: 0, alternative: 0, notApplicable: 0, percentage: 0 };
  }

  requirements.forEach(req => {
    const status = getImplementationStatus(req);
    if (counts[status] !== undefined) {
      counts[status]++;
    }
  });

  return {
    total,
    implemented: counts.implemented,
    partial: counts.partial,
    planned: counts.planned,
    alternative: counts.alternative,
    notApplicable: counts['not-applicable'],
    percentage: Math.round(((counts.implemented + counts.alternative + counts['not-applicable']) / total) * 100)
  };
}

export default function ImplementationEditor({ controlImpl, systemComponents, onUpdate, editMode }) {
  const requirements = controlImpl?.['implemented-requirements'] || [];
  const coverage = calculateCoverage(requirements);
  const [expandedRow, setExpandedRow] = useState(null);

  const columns = [
    { id: 'control-id', label: 'Control ID', sortable: true, searchable: true },
    { id: 'status', label: 'Status', filterable: true, render: (req) => <StatusBadge category="implementation-status" status={getImplementationStatus(req)} /> },
    { id: 'components', label: 'Components', render: (req) => req?.['by-components']?.length || 0 },
    { id: 'description', label: 'Description', searchable: true, render: (req) => (req?.description || '').substring(0, 60) + ((req?.description?.length > 60) ? '...' : '') }
  ];

  return (
    <div className="ssp-editor implementation-editor">
      <div className="impl-progress-summary">
        <ProgressBar value={coverage.percentage} max={100} label={`${coverage.percentage}% Coverage`} />
        <StatusBreakdown counts={{
          Implemented: coverage.implemented,
          Partial: coverage.partial,
          Planned: coverage.planned,
          Alternative: coverage.alternative,
          'N/A': coverage.notApplicable
        }} />
      </div>

      <div className="form-group" style={{ marginTop: '20px' }}>
        <label className="form-label">Control Implementation Description</label>
        <textarea 
          className="form-input"
          value={controlImpl?.description || ''}
          onChange={(e) => onUpdate && onUpdate({ ...controlImpl, description: e.target.value })}
          readOnly={!editMode}
          rows={3}
        />
      </div>

      <EntityTable 
        data={requirements}
        columns={columns}
        onRowClick={(req) => setExpandedRow(expandedRow === req['control-id'] ? null : req['control-id'])}
        rowExpandable={true}
        expandedRowContent={(req) => (
          <div className="impl-req-expanded">
            <h4>By-Components</h4>
            {req['by-components']?.map((bc, idx) => (
              <div key={idx} className="by-component-entry">
                <div className="form-group">
                  <label className="form-label">Component</label>
                  {editMode ? (
                    <select className="form-input" value={bc['component-uuid'] || ''} readOnly>
                       <option value={bc['component-uuid']}>{systemComponents?.find(c => c.uuid === bc['component-uuid'])?.title || bc['component-uuid']}</option>
                    </select>
                  ) : (
                    <div className="read-only-text">{systemComponents?.find(c => c.uuid === bc['component-uuid'])?.title || bc['component-uuid']}</div>
                  )}
                </div>
                <div className="form-group">
                   <label className="form-label">Description</label>
                   <textarea className="form-input" value={bc.description || ''} readOnly={!editMode} rows={2} />
                </div>
                <div className="form-group">
                   <label className="form-label">Status</label>
                   {editMode ? (
                     <select className="form-input" value={bc['implementation-status']?.state || ''} readOnly>
                        <option value={bc['implementation-status']?.state}>{bc['implementation-status']?.state}</option>
                     </select>
                   ) : (
                      <StatusBadge category="implementation-status" status={bc['implementation-status']?.state || 'planned'} />
                   )}
                </div>
              </div>
            ))}
          </div>
        )}
      />
    </div>
  );
}
