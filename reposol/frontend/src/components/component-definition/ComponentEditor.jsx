import React, { useState } from 'react';
import { PropsEditor } from '../shared/PropsEditor';
import { LinksEditor } from '../shared/LinksEditor';
import StatusBadge from '../shared/status/StatusBadge';
import { ProseWithParams } from '../shared/ProseWithParams';
import EntityTable from '../shared/entity/EntityTable';
import './ComponentEditor.css';

const Accordion = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="component-editor__section">
      <div 
        className="component-editor__section-header" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <h4 className="section-title">{title}</h4>
        <span className={`chevron ${isOpen ? 'open' : ''}`}>▼</span>
      </div>
      {isOpen && <div className="component-editor__section-content">{children}</div>}
    </div>
  );
};

const ProtocolsEditor = ({ component, onChange, editMode }) => {
  const protocols = component.protocols || [];
  const [expandedIndex, setExpandedIndex] = useState(null);

  const addProtocol = () => { if (editMode) onChange('protocols', [...protocols, { name: '', title: '', 'port-ranges': [] }]); };
  const removeProtocol = (idx) => { if (editMode) { const newP = [...protocols]; newP.splice(idx, 1); onChange('protocols', newP); } };
  const updateProtocol = (idx, field, val) => { if (editMode) { const newP = [...protocols]; newP[idx] = { ...newP[idx], [field]: val }; onChange('protocols', newP); } };

  return (
    <div className="protocols-editor">
      <EntityTable
        columns={[
          { key: 'name', label: 'Name', sortable: true },
          { key: 'title', label: 'Title', sortable: true },
          { key: 'portsCount', label: 'Port Ranges', render: (_, row) => (row['port-ranges'] || []).length }
        ]}
        data={protocols.map((p, i) => ({ ...p, id: i.toString(), portsCount: (p['port-ranges'] || []).length }))}
        onRowClick={(row) => setExpandedIndex(prev => prev === parseInt(row.id, 10) ? null : parseInt(row.id, 10))}
        emptyState={{ title: 'No protocols', description: 'Add a protocol.' }}
      />
      {editMode && <button className="btn btn-primary btn-sm mt-4" onClick={addProtocol}>+ Add Protocol</button>}

      {expandedIndex !== null && expandedIndex < protocols.length && (
        <div className="mt-4 p-4 border rounded bg-gray-50 dark:bg-gray-800">
          <h6 className="font-bold mb-2">Edit Protocol</h6>
          <div className="form-group">
            <label>Name</label>
            <input type="text" className="form-input" value={protocols[expandedIndex].name || ''} onChange={(e) => updateProtocol(expandedIndex, 'name', e.target.value)} disabled={!editMode} />
          </div>
          <div className="form-group">
            <label>Title</label>
            <input type="text" className="form-input" value={protocols[expandedIndex].title || ''} onChange={(e) => updateProtocol(expandedIndex, 'title', e.target.value)} disabled={!editMode} />
          </div>
          
          <div className="form-group mt-4">
            <label className="font-semibold block mb-2">Port Ranges</label>
            {(protocols[expandedIndex]['port-ranges'] || []).map((range, rIdx) => (
              <div key={rIdx} className="port-range-row flex gap-2 mb-2 items-center">
                <input type="number" className="form-input w-24" value={range.start || 0} onChange={(e) => {
                  const newRanges = [...(protocols[expandedIndex]['port-ranges'] || [])];
                  newRanges[rIdx] = { ...newRanges[rIdx], start: parseInt(e.target.value) || 0 };
                  updateProtocol(expandedIndex, 'port-ranges', newRanges);
                }} disabled={!editMode} />
                <span>to</span>
                <input type="number" className="form-input w-24" value={range.end || 0} onChange={(e) => {
                  const newRanges = [...(protocols[expandedIndex]['port-ranges'] || [])];
                  newRanges[rIdx] = { ...newRanges[rIdx], end: parseInt(e.target.value) || 0 };
                  updateProtocol(expandedIndex, 'port-ranges', newRanges);
                }} disabled={!editMode} />
                <select className="form-input w-24" value={range.transport || 'TCP'} onChange={(e) => {
                  const newRanges = [...(protocols[expandedIndex]['port-ranges'] || [])];
                  newRanges[rIdx] = { ...newRanges[rIdx], transport: e.target.value };
                  updateProtocol(expandedIndex, 'port-ranges', newRanges);
                }} disabled={!editMode}>
                  <option value="TCP">TCP</option>
                  <option value="UDP">UDP</option>
                </select>
                {editMode && <button className="btn btn-danger btn-sm" onClick={() => {
                  const newRanges = [...(protocols[expandedIndex]['port-ranges'] || [])];
                  newRanges.splice(rIdx, 1);
                  updateProtocol(expandedIndex, 'port-ranges', newRanges);
                }}>×</button>}
              </div>
            ))}
            {editMode && <button className="btn btn-secondary btn-sm" onClick={() => {
              const newRanges = [...(protocols[expandedIndex]['port-ranges'] || []), { start: 0, end: 0, transport: 'TCP' }];
              updateProtocol(expandedIndex, 'port-ranges', newRanges);
            }}>+ Add Port Range</button>}
          </div>

          {editMode && <button className="btn btn-danger btn-sm mt-4" onClick={() => { removeProtocol(expandedIndex); setExpandedIndex(null); }}>Remove Protocol</button>}
        </div>
      )}
    </div>
  );
};

const ControlImplementationsEditor = ({ component, onChange, editMode }) => {
  const impls = component['control-implementations'] || [];
  const [expandedReqs, setExpandedReqs] = useState({});

  const addImpl = () => {
    if (!editMode) return;
    onChange('control-implementations', [...impls, { source: '', description: '', 'implemented-requirements': [] }]);
  };

  const removeImpl = (idx) => {
    if (!editMode) return;
    const newImpls = [...impls];
    newImpls.splice(idx, 1);
    onChange('control-implementations', newImpls);
  };

  const updateImpl = (idx, field, value) => {
    if (!editMode) return;
    const newImpls = [...impls];
    newImpls[idx] = { ...newImpls[idx], [field]: value };
    onChange('control-implementations', newImpls);
  };

  const addReq = (implIdx) => {
    if (!editMode) return;
    const newImpls = [...impls];
    const newReqs = [...(newImpls[implIdx]['implemented-requirements'] || []), { 'control-id': 'new-control', description: '' }];
    newImpls[implIdx]['implemented-requirements'] = newReqs;
    onChange('control-implementations', newImpls);
  };

  const removeReq = (implIdx, reqIdx) => {
    if (!editMode) return;
    const newImpls = [...impls];
    newImpls[implIdx]['implemented-requirements'].splice(reqIdx, 1);
    onChange('control-implementations', newImpls);
  };

  const updateReq = (implIdx, reqIdx, field, value) => {
    if (!editMode) return;
    const newImpls = [...impls];
    newImpls[implIdx]['implemented-requirements'][reqIdx] = { ...newImpls[implIdx]['implemented-requirements'][reqIdx], [field]: value };
    onChange('control-implementations', newImpls);
  };

  return (
    <div className="control-impl-list">
      {impls.map((impl, iIdx) => (
        <div key={iIdx} className="impl-item">
          <div className="form-group">
            <label>Source (Catalog/Profile URI)</label>
            <input type="text" className="form-input" value={impl.source || ''} onChange={(e) => updateImpl(iIdx, 'source', e.target.value)} disabled={!editMode} />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea className="form-textarea" value={impl.description || ''} onChange={(e) => updateImpl(iIdx, 'description', e.target.value)} disabled={!editMode} />
          </div>
          {editMode && <button className="btn btn-danger btn-sm mb-4" onClick={() => removeImpl(iIdx)}>Remove Implementation</button>}
          
          <div className="reqs-header">
            <h5>Implemented Requirements</h5>
          </div>
          <EntityTable
            columns={[
              { key: 'control-id', label: 'Control ID', sortable: true },
              { key: 'description', label: 'Description', render: (val) => val ? val.substring(0, 50) + '...' : '' },
              { key: 'propsCount', label: 'Props', render: (_, row) => (row.props || []).length }
            ]}
            data={(impl['implemented-requirements'] || []).map((req, rIdx) => ({ ...req, id: rIdx.toString(), propsCount: (req.props || []).length }))}
            onRowClick={(row) => {
              setExpandedReqs(prev => ({
                ...prev,
                [iIdx]: prev[iIdx] === parseInt(row.id, 10) ? null : parseInt(row.id, 10)
              }));
            }}
            emptyState={{ title: 'No requirements', description: 'Add a requirement.' }}
          />
          {editMode && <button className="btn btn-secondary btn-sm mt-2" onClick={() => addReq(iIdx)}>+ Add Requirement</button>}

          {expandedReqs[iIdx] !== undefined && expandedReqs[iIdx] !== null && (
            <div className="mt-4 p-4 border rounded bg-gray-50 dark:bg-gray-800">
              <h6 className="font-bold mb-2">Edit Requirement (Row {expandedReqs[iIdx] + 1})</h6>
              <div className="form-group">
                <label>Control ID</label>
                <input type="text" className="form-input" value={impl['implemented-requirements'][expandedReqs[iIdx]]['control-id'] || ''} onChange={(e) => updateReq(iIdx, expandedReqs[iIdx], 'control-id', e.target.value)} disabled={!editMode} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea className="form-textarea" value={impl['implemented-requirements'][expandedReqs[iIdx]].description || ''} onChange={(e) => updateReq(iIdx, expandedReqs[iIdx], 'description', e.target.value)} disabled={!editMode} />
              </div>
              <div className="form-group">
                <label>Responsible Roles (comma-separated IDs)</label>
                <input type="text" className="form-input" value={(impl['implemented-requirements'][expandedReqs[iIdx]]['responsible-roles'] || []).map(r => r['role-id']).join(', ')} onChange={(e) => {
                  const roles = e.target.value.split(',').map(s => ({ 'role-id': s.trim() })).filter(r => r['role-id']);
                  updateReq(iIdx, expandedReqs[iIdx], 'responsible-roles', roles);
                }} disabled={!editMode} />
              </div>
              <div className="form-group">
                <label>Set Parameters (JSON array)</label>
                <textarea className="form-textarea" value={JSON.stringify(impl['implemented-requirements'][expandedReqs[iIdx]]['set-parameters'] || [], null, 2)} onChange={(e) => {
                  try { const val = JSON.parse(e.target.value); updateReq(iIdx, expandedReqs[iIdx], 'set-parameters', val); } catch(err) {}
                }} disabled={!editMode} />
              </div>
              <div className="form-group">
                <label>Statements (JSON object)</label>
                <textarea className="form-textarea" value={JSON.stringify(impl['implemented-requirements'][expandedReqs[iIdx]].statements || {}, null, 2)} onChange={(e) => {
                  try { const val = JSON.parse(e.target.value); updateReq(iIdx, expandedReqs[iIdx], 'statements', val); } catch(err) {}
                }} disabled={!editMode} />
              </div>
              {editMode && <button className="btn btn-danger btn-sm mt-2" onClick={() => { removeReq(iIdx, expandedReqs[iIdx]); setExpandedReqs(p => ({...p, [iIdx]: null})); }}>Remove This Requirement</button>}
            </div>
          )}
        </div>
      ))}
      {editMode && <button className="btn btn-primary btn-sm" onClick={addImpl}>+ Add Control Implementation</button>}
    </div>
  );
};

export default function ComponentEditor({ component, onUpdate, onClose, editMode }) {
  if (!component) return null;

  const handleChange = (field, value) => {
    if (!editMode) return;
    onUpdate({ ...component, [field]: value });
  };

  const handleStatusChange = (field, value) => {
    if (!editMode) return;
    onUpdate({
      ...component,
      status: { ...component.status, [field]: value }
    });
  };

  const handleRoleUpdate = (index, field, value) => {
    if (!editMode) return;
    const newRoles = [...(component['responsible-roles'] || [])];
    newRoles[index] = { ...newRoles[index], [field]: value };
    handleChange('responsible-roles', newRoles);
  };

  const addRole = () => {
    if (!editMode) return;
    const newRoles = [...(component['responsible-roles'] || []), { 'role-id': '', 'party-uuids': [] }];
    handleChange('responsible-roles', newRoles);
  };

  const removeRole = (index) => {
    if (!editMode) return;
    const newRoles = [...(component['responsible-roles'] || [])];
    newRoles.splice(index, 1);
    handleChange('responsible-roles', newRoles);
  };

  const handlePartyUuidsChange = (index, value) => {
    if (!editMode) return;
    const uuids = value.split(',').map(s => s.trim()).filter(s => s);
    handleRoleUpdate(index, 'party-uuids', uuids);
  };

  // Removed inline protocol and control impl methods here since they are inside the sub-components

  return (
    <div className="component-editor panel slide-out">
      <div className="panel-header">
        <h3>Component Editor</h3>
        <button className="btn btn-close" onClick={onClose}>×</button>
      </div>
      <div className="panel-body">
        
        {/* 1. Basic Info */}
        <Accordion title="Basic Info" defaultOpen={true}>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input 
              type="text" 
              className="form-input" 
              value={component.title || ''} 
              onChange={(e) => handleChange('title', e.target.value)}
              disabled={!editMode}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select 
              className="form-input" 
              value={component.type || 'software'} 
              onChange={(e) => handleChange('type', e.target.value)}
              disabled={!editMode}
              >
                {['this-system', 'system', 'interconnection', 'software', 'hardware', 'service', 'policy', 'physical', 'process-procedure', 'plan', 'guidance', 'standard', 'validation'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            {editMode ? (
              <textarea 
                className="form-textarea" 
                value={component.description || ''} 
                onChange={(e) => handleChange('description', e.target.value)}
              />
            ) : (
              <div className="prose-readonly">
                <ProseWithParams text={component.description} />
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Purpose</label>
            <textarea 
              className="form-textarea" 
              value={component.purpose || ''} 
              onChange={(e) => handleChange('purpose', e.target.value)}
              disabled={!editMode}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <div className="status-row">
              <select 
                className="form-input status-select" 
                value={component.status?.state || 'operational'} 
                onChange={(e) => handleStatusChange('state', e.target.value)}
                disabled={!editMode}
              >
                {['operational', 'under-development', 'under-major-modification', 'disposition', 'other'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <StatusBadge status={component.status?.state || 'operational'} />
            </div>
          </div>
          {component.status?.state !== 'operational' && (
            <div className="form-group">
              <label className="form-label">Status Remarks</label>
              <textarea 
                className="form-textarea" 
                value={component.status?.remarks || ''} 
                onChange={(e) => handleStatusChange('remarks', e.target.value)}
                disabled={!editMode}
              />
            </div>
          )}
        </Accordion>

        {/* 2. Properties & Links */}
        <Accordion title="Properties & Links">
          <PropsEditor 
            properties={component.props || []} 
            onChange={(props) => handleChange('props', props)}
            editMode={editMode}
          />
          <LinksEditor 
            links={component.links || []} 
            onChange={(links) => handleChange('links', links)}
            editMode={editMode}
          />
        </Accordion>

        {/* 3. Responsible Roles */}
        <Accordion title="Responsible Roles">
          <div className="roles-list">
            {(component['responsible-roles'] || []).map((role, idx) => (
              <div key={idx} className="role-item">
                <div className="form-group inline">
                  <label>Role ID</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={role['role-id'] || ''} 
                    onChange={(e) => handleRoleUpdate(idx, 'role-id', e.target.value)}
                    disabled={!editMode}
                  />
                </div>
                <div className="form-group inline">
                  <label>Party UUIDs (comma-separated)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={(role['party-uuids'] || []).join(', ')} 
                    onChange={(e) => handlePartyUuidsChange(idx, e.target.value)}
                    disabled={!editMode}
                  />
                </div>
                {editMode && (
                  <button className="btn btn-danger btn-sm" onClick={() => removeRole(idx)}>Remove</button>
                )}
              </div>
            ))}
            {editMode && (
              <button className="btn btn-primary btn-sm" onClick={addRole}>+ Add Role</button>
            )}
          </div>
        </Accordion>

        {/* 4. Protocols */}
        <Accordion title="Protocols">
          <ProtocolsEditor component={component} onChange={handleChange} editMode={editMode} />
        </Accordion>

        {/* 5. Control Implementations */}
        <Accordion title="Control Implementations">
          <ControlImplementationsEditor component={component} onChange={handleChange} editMode={editMode} />
        </Accordion>
      </div>
    </div>
  );
}
