import React, { useState, useEffect } from 'react';
import './ARPage.css';
import { useDocument } from '../../hooks/useDocument';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { useVersions } from '../../hooks/useVersions';

import { MetadataEditor } from '../shared/MetadataEditor';
import { DocumentToolbar } from '../shared/DocumentToolbar';
import { JsonEditor } from '../shared/JsonEditor';
import { PropsEditor } from '../shared/PropsEditor';
import { BackMatterEditor } from '../shared/BackMatterEditor';
import { LinksEditor } from '../shared/LinksEditor';

import StatusBadge from '../shared/status/StatusBadge';
import EntityTable from '../shared/entity/EntityTable';
import EntityDetailPanel from '../shared/entity/EntityDetailPanel';
import { VersionDrawer } from '../shared/VersionDrawer';
import MetricCard from '../shared/dashboard/MetricCard';
import MetricCardGrid from '../shared/dashboard/MetricCardGrid';
import StatusBreakdown from '../shared/dashboard/StatusBreakdown';
import { OriginsEditor } from '../shared/risk-assessment/OriginsEditor';
import { CharacterizationsEditor } from '../shared/risk-assessment/CharacterizationsEditor';
import { RiskLogEditor } from '../shared/risk-assessment/RiskLogEditor';
import { RelevantEvidenceEditor } from '../shared/risk-assessment/RelevantEvidenceEditor';
import { RemediationsEditor } from '../shared/risk-assessment/RemediationsEditor';

export function ARPage({ arId, initialEditMode, onClose }) {
  const { doc, setDoc, loading, error, save: saveDocument } = useDocument('assessment-results', arId);
  const { state: undoState, setUndoState, undo, redo, canUndo, canRedo } = useUndoRedo(doc);
  const { versions, showVersions, setShowVersions, saveVersion, restoreVersion, isRestoring } = useVersions('assessment-results', arId, setDoc);

  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(initialEditMode || false);
  const [saveStatus, setSaveStatus] = useState('');
  
  const [activeResultSetId, setActiveResultSetId] = useState(null);
  const [resultSetTab, setResultSetTab] = useState('observations');

  const [activeObservation, setActiveObservation] = useState(null);
  const [activeFinding, setActiveFinding] = useState(null);
  const [activeRisk, setActiveRisk] = useState(null);

  // Set initial active result set when doc loads
  useEffect(() => {
    if (doc && doc['assessment-results']?.results?.length > 0 && !activeResultSetId) {
      setActiveResultSetId(doc['assessment-results'].results[0].uuid);
    }
  }, [doc]);

  const updateObservationField = (field, value) => {
    if (!activeObservation) return;
    const next = { ...activeObservation, [field]: value };
    setActiveObservation(next);
    const newDoc = { ...doc };
    const rs = newDoc['assessment-results'].results.find(res => res.uuid === activeResultSetId);
    if (rs) {
      const idx = (rs.observations || []).findIndex(o => o.uuid === activeObservation.uuid);
      if (idx >= 0) rs.observations[idx] = next;
    }
    setDoc(newDoc);
  };

  const updateRiskField = (field, value) => {
    if (!activeRisk) return;
    const next = { ...activeRisk, [field]: value };
    setActiveRisk(next);
    const newDoc = { ...doc };
    const rs = newDoc['assessment-results'].results.find(res => res.uuid === activeResultSetId);
    if (rs) {
      const idx = (rs.risks || []).findIndex(r => r.uuid === activeRisk.uuid);
      if (idx >= 0) rs.risks[idx] = next;
    }
    setDoc(newDoc);
  };

  const handleSave = async (updatedDoc = doc) => {
    setSaveStatus('Saving...');
    try {
      await saveDocument(updatedDoc);
      setSaveStatus('Saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      setSaveStatus('Error saving');
    }
  };

  if (loading) return <div className="ar-page loading">Loading Assessment Results...</div>;
  if (error) return <div className="ar-page error">{error}</div>;
  if (!doc || !doc['assessment-results']) return <div className="ar-page error">Invalid Assessment Results document</div>;

  const ar = doc['assessment-results'];
  const metadata = ar.metadata || {};
  const results = ar.results || [];
  
  const activeResultSet = results.find(r => r.uuid === activeResultSetId) || results[0];

  const totalFindings = results.reduce((acc, r) => acc + (r.findings?.length || 0), 0);
  const totalObservations = results.reduce((acc, r) => acc + (r.observations?.length || 0), 0);
  const totalRisks = results.reduce((acc, r) => acc + (r.risks?.length || 0), 0);

  const createResultSet = () => {
    const newDoc = { ...doc };
    const newRs = {
      uuid: crypto.randomUUID(),
      title: 'New Result Set',
      description: '',
      start: new Date().toISOString(),
      'reviewed-controls': { 'control-selections': [] }
    };
    newDoc['assessment-results'].results = [...(newDoc['assessment-results'].results || []), newRs];
    setDoc(newDoc);
    setActiveResultSetId(newRs.uuid);
  };

  const deleteResultSet = (id) => {
    const newDoc = { ...doc };
    newDoc['assessment-results'].results = newDoc['assessment-results'].results.filter(r => r.uuid !== id);
    if (activeResultSetId === id) {
      setActiveResultSetId(newDoc['assessment-results'].results[0]?.uuid || null);
    }
    setDoc(newDoc);
  };

  const renderOverview = () => {
    const findingStatuses = { 'satisfied': 0, 'not-satisfied': 0 };
    results.forEach(r => {
      (r.findings || []).forEach(f => {
        const state = f.target?.status?.state || 'unknown';
        findingStatuses[state] = (findingStatuses[state] || 0) + 1;
      });
    });

    const riskStatuses = {};
    results.forEach(r => {
      (r.risks || []).forEach(risk => {
        const status = risk.status || 'unknown';
        riskStatuses[status] = (riskStatuses[status] || 0) + 1;
      });
    });

    const findingBreakdown = Object.keys(findingStatuses).map(k => ({
      label: k,
      value: findingStatuses[k],
      color: k === 'satisfied' ? 'var(--color-success)' : 'var(--color-danger)'
    }));

    const riskBreakdown = Object.keys(riskStatuses).map(k => ({
      label: k,
      value: riskStatuses[k],
      color: 'var(--color-warning)'
    }));

    return (
      <div className="ar-overview">
        <div className="ar-import-ap">
          <h3>Referenced Assessment Plan</h3>
          {isEditing ? (
            <input 
              type="text" 
              value={ar['import-ap']?.href || ''} 
              onChange={e => {
                const newDoc = { ...doc };
                newDoc['assessment-results']['import-ap'] = { ...(newDoc['assessment-results']['import-ap'] || {}), href: e.target.value };
                setDoc(newDoc);
              }} 
              placeholder="Enter AP href..." 
            />
          ) : (
            <div>{ar['import-ap']?.href || 'No Assessment Plan imported'}</div>
          )}
        </div>
        <MetricCardGrid>
          <MetricCard title="Total Findings" value={totalFindings} icon="🎯" />
          <MetricCard title="Total Observations" value={totalObservations} icon="👁️" />
          <MetricCard title="Total Risks" value={totalRisks} icon="⚠️" />
          <MetricCard title="Result Sets" value={results.length} icon="📑" />
        </MetricCardGrid>
        <div className="ar-breakdowns">
          <div className="breakdown-card">
            <h3>Finding Statuses</h3>
            <StatusBreakdown items={findingBreakdown} total={totalFindings} />
          </div>
          <div className="breakdown-card">
            <h3>Risk Statuses</h3>
            <StatusBreakdown items={riskBreakdown} total={totalRisks} />
          </div>
        </div>
      </div>
    );
  };

  const renderResultSets = () => {
    return (
      <div className="ar-result-sets">
        <div className="result-sets-sidebar">
          <div className="rs-header-actions">
            <h3>Result Sets</h3>
            {isEditing && <button className="btn-primary" onClick={createResultSet}>+ New</button>}
          </div>
          <ul className="result-set-list">
            {results.map(r => (
              <li 
                key={r.uuid} 
                className={r.uuid === activeResultSetId ? 'active' : ''}
                onClick={() => setActiveResultSetId(r.uuid)}
              >
                <div className="rs-title">{r.title || 'Untitled'}</div>
                <div className="rs-dates">
                  {r.start ? new Date(r.start).toLocaleDateString() : 'N/A'} - {r.end ? new Date(r.end).toLocaleDateString() : 'Ongoing'}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="result-set-content">
          {activeResultSet ? (
            <>
              {isEditing && (
                <div className="rs-editor-header">
                  <div className="form-group">
                    <label>Title</label>
                    <input type="text" value={activeResultSet.title || ''} onChange={(e) => {
                      const newDoc = { ...doc };
                      const rs = newDoc['assessment-results'].results.find(res => res.uuid === activeResultSet.uuid);
                      rs.title = e.target.value;
                      setDoc(newDoc);
                    }} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Start Date</label>
                      <input type="datetime-local" value={(activeResultSet.start || '').slice(0, 16)} onChange={(e) => {
                        const newDoc = { ...doc };
                        const rs = newDoc['assessment-results'].results.find(res => res.uuid === activeResultSet.uuid);
                        rs.start = new Date(e.target.value).toISOString();
                        setDoc(newDoc);
                      }} />
                    </div>
                    <div className="form-group">
                      <label>End Date</label>
                      <input type="datetime-local" value={(activeResultSet.end || '').slice(0, 16)} onChange={(e) => {
                        const newDoc = { ...doc };
                        const rs = newDoc['assessment-results'].results.find(res => res.uuid === activeResultSet.uuid);
                        rs.end = new Date(e.target.value).toISOString();
                        setDoc(newDoc);
                      }} />
                    </div>
                  </div>
                  <button className="btn-danger" onClick={() => deleteResultSet(activeResultSet.uuid)}>Delete Result Set</button>
                </div>
              )}
              <div className="rs-tabs">
                <button className={resultSetTab === 'observations' ? 'active' : ''} onClick={() => setResultSetTab('observations')}>Observations ({(activeResultSet.observations || []).length})</button>
                <button className={resultSetTab === 'findings' ? 'active' : ''} onClick={() => setResultSetTab('findings')}>Findings ({(activeResultSet.findings || []).length})</button>
                <button className={resultSetTab === 'risks' ? 'active' : ''} onClick={() => setResultSetTab('risks')}>Risks ({(activeResultSet.risks || []).length})</button>
                <button className={resultSetTab === 'local-definitions' ? 'active' : ''} onClick={() => setResultSetTab('local-definitions')}>Local Definitions</button>
                <button className={resultSetTab === 'assessment-log' ? 'active' : ''} onClick={() => setResultSetTab('assessment-log')}>Assessment Log</button>
                <button className={resultSetTab === 'attestations' ? 'active' : ''} onClick={() => setResultSetTab('attestations')}>Attestations</button>
              </div>
              <div className="rs-tab-content">
                {resultSetTab === 'observations' && renderObservations(activeResultSet)}
                {resultSetTab === 'findings' && renderFindings(activeResultSet)}
                {resultSetTab === 'risks' && renderRisks(activeResultSet)}
                {resultSetTab === 'local-definitions' && renderLocalDefinitions(activeResultSet)}
                {resultSetTab === 'assessment-log' && renderAssessmentLog(activeResultSet)}
                {resultSetTab === 'attestations' && renderAttestations(activeResultSet)}
              </div>
            </>
          ) : (
            <div className="empty-state">No Result Sets</div>
          )}
        </div>
      </div>
    );
  };

  const renderLocalDefinitions = (rs) => {
    const componentsData = (rs['local-definitions']?.components || []).map(c => ({...c, id: c.uuid}));
    const usersData = (rs['local-definitions']?.users || []).map(u => ({...u, id: u.uuid, rolesStr: (u['role-ids']||[]).join(', ')}));
    const tasksData = (rs['local-definitions']?.tasks || []).map(t => ({...t, id: t.uuid}));

    return (
      <div className="entity-section">
        <h3 style={{marginTop: '20px'}}>Components</h3>
        <EntityTable 
          columns={[{key:'title', label:'Title'}, {key:'type', label:'Type'}, {key:'description', label:'Description'}, {key:'status', label:'Status', render: (_,c) => c.status?.state}]} 
          data={componentsData} 
          onRowClick={() => {}} 
        />
        
        <h3 style={{marginTop: '20px'}}>Users</h3>
        <EntityTable 
          columns={[{key:'title', label:'Title'}, {key:'rolesStr', label:'Roles'}]} 
          data={usersData} 
          onRowClick={() => {}} 
        />
        
        <h3 style={{marginTop: '20px'}}>Tasks</h3>
        <EntityTable 
          columns={[{key:'title', label:'Title'}, {key:'type', label:'Type'}, {key:'description', label:'Description'}]} 
          data={tasksData} 
          onRowClick={() => {}} 
        />
      </div>
    );
  };

  const renderAssessmentLog = (rs) => {
    const entriesData = (rs['assessment-log']?.entries || []).map(e => ({
      ...e,
      id: e.uuid,
      startStr: e.start ? new Date(e.start).toLocaleString() : '',
      endStr: e.end ? new Date(e.end).toLocaleString() : '',
      loggedByStr: (e['logged-by'] || []).map(l => l['role-id'] || l['party-uuid']).join(', ')
    }));

    return (
      <div className="entity-section">
        <EntityTable 
          columns={[
            {key:'title', label:'Title'},
            {key:'startStr', label:'Start'},
            {key:'endStr', label:'End'},
            {key:'loggedByStr', label:'Logged By'}
          ]}
          data={entriesData}
          onRowClick={() => {}}
        />
      </div>
    );
  };

  const renderAttestations = (rs) => {
    const attestationsData = (rs.attestations || []).map((a, i) => ({
      ...a,
      id: a.uuid || `attestation-${i}`,
      partiesStr: (a['responsible-parties'] || []).map(p => p['role-id']).join(', '),
      partsStr: (a.parts || []).map(p => p.name).join(', ')
    }));

    return (
      <div className="entity-section">
        <EntityTable 
          columns={[
            {key:'partiesStr', label:'Responsible Parties'},
            {key:'partsStr', label:'Parts'}
          ]}
          data={attestationsData}
          onRowClick={() => {}}
        />
      </div>
    );
  };

  const renderObservations = (rs) => {
    const columns = [
      { key: 'title', label: 'Title' },
      { key: 'methods', label: 'Methods', render: (val) => (val || []).map(m => <StatusBadge key={m} status={m} category="generic" />) },
      { key: 'types', label: 'Types', render: (val) => (val || []).join(', ') },
      { key: 'collected', label: 'Collected', render: (val) => val ? new Date(val).toLocaleDateString() : '' },
      { key: 'subjects', label: 'Subjects', render: (_, obs) => (obs.subjects || []).length }
    ];

    return (
      <div className="entity-section">
        <EntityTable 
          columns={columns} 
          data={rs.observations || []} 
          onRowClick={(obs) => setActiveObservation(obs)} 
        />
        <EntityDetailPanel 
          isOpen={!!activeObservation} 
          onClose={() => setActiveObservation(null)} 
          title="Observation Details"
        >
          {activeObservation && (
            <div className="editor-form">
              <div className="form-group">
                <label>Title</label>
                <input type="text" value={activeObservation.title || ''} disabled={!isEditing} onChange={()=>{}} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={activeObservation.description || ''} disabled={!isEditing} onChange={()=>{}} />
              </div>
              <div className="form-section">
                <h4>Classification</h4>
                <div className="form-group">
                  <label>Methods</label>
                  <div className="checkbox-group">
                    {['EXAMINE', 'INTERVIEW', 'TEST'].map(m => (
                      <label key={m}><input type="checkbox" checked={(activeObservation.methods || []).includes(m)} disabled={!isEditing} onChange={()=>{}} /> {m}</label>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>Types</label>
                  <input type="text" placeholder="finding, historic, observation..." value={(activeObservation.types || []).join(', ')} disabled={!isEditing} onChange={()=>{}} />
                </div>
              </div>
              <div className="form-section">
                <h4>Timing</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Collected</label>
                    <input type="datetime-local" value={(activeObservation.collected || '').slice(0, 16)} disabled={!isEditing} onChange={()=>{}} />
                  </div>
                  <div className="form-group">
                    <label>Expires (Optional)</label>
                    <input type="datetime-local" value={(activeObservation.expires || '').slice(0, 16)} disabled={!isEditing} onChange={()=>{}} />
                  </div>
                </div>
              </div>
              <div className="form-section">
                <h4>Subjects</h4>
                {(activeObservation.subjects || []).map((sub, i) => (
                  <div key={i} className="form-row">
                    <input type="text" value={sub['subject-uuid'] || ''} placeholder="Subject UUID" disabled={!isEditing} />
                    <select value={sub.type || ''} disabled={!isEditing}>
                      <option value="component">Component</option>
                      <option value="inventory-item">Inventory Item</option>
                      <option value="location">Location</option>
                      <option value="party">Party</option>
                      <option value="user">User</option>
                    </select>
                  </div>
                ))}
              </div>
              <div className="form-section">
                <h4>Relevant Evidence</h4>
                <RelevantEvidenceEditor 
                  value={activeObservation['relevant-evidence'] || []} 
                  isEditing={isEditing} 
                  onChange={newEv => updateObservationField('relevant-evidence', newEv)} 
                />
              </div>
              <div className="form-section">
                <h4>Origins</h4>
                <OriginsEditor 
                  value={activeObservation.origins || []} 
                  isEditing={isEditing} 
                  onChange={newOrigins => updateObservationField('origins', newOrigins)} 
                />
              </div>
              <PropsEditor properties={activeObservation.props || []} isEditing={isEditing} onChange={()=>{}} />
              <LinksEditor links={activeObservation.links || []} isEditing={isEditing} onChange={()=>{}} />
            </div>
          )}
        </EntityDetailPanel>
      </div>
    );
  };

  const renderFindings = (rs) => {
    const columns = [
      { key: 'title', label: 'Title' },
      { key: 'target', label: 'Target', render: (_, f) => f.target?.['target-id'] },
      { key: 'status', label: 'Status', render: (_, f) => <StatusBadge status={f.target?.status?.state} category="finding-status" /> },
      { key: 'relations', label: 'Relations', render: (_, f) => `Obs: ${(f['related-observations'] || []).length} / Risks: ${(f['related-risks'] || []).length}` }
    ];

    return (
      <div className="entity-section">
        <EntityTable 
          columns={columns} 
          data={rs.findings || []} 
          onRowClick={(f) => setActiveFinding(f)} 
        />
        <EntityDetailPanel 
          isOpen={!!activeFinding} 
          onClose={() => setActiveFinding(null)} 
          title="Finding Details"
        >
          {activeFinding && (
            <div className="editor-form">
              <div className="form-group">
                <label>Title</label>
                <input type="text" value={activeFinding.title || ''} disabled={!isEditing} onChange={()=>{}} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={activeFinding.description || ''} disabled={!isEditing} onChange={()=>{}} />
              </div>
              <div className="form-section">
                <h4>Target</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Target Type</label>
                    <select value={activeFinding.target?.type || ''} disabled={!isEditing} onChange={()=>{}}>
                      <option value="objective-id">Objective ID</option>
                      <option value="statement-id">Statement ID</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Target ID</label>
                    <input type="text" value={activeFinding.target?.['target-id'] || ''} disabled={!isEditing} onChange={()=>{}} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Status State</label>
                    <select value={activeFinding.target?.status?.state || ''} disabled={!isEditing} onChange={()=>{}}>
                      <option value="satisfied">Satisfied</option>
                      <option value="not-satisfied">Not Satisfied</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Implementation Status</label>
                    <select value={activeFinding.target?.['implementation-status']?.state || ''} disabled={!isEditing} onChange={()=>{}}>
                      <option value="implemented">Implemented</option>
                      <option value="partial">Partial</option>
                      <option value="planned">Planned</option>
                      <option value="alternative">Alternative</option>
                      <option value="not-applicable">Not Applicable</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Status Reason (Optional)</label>
                  <input type="text" value={activeFinding.target?.status?.reason || ''} disabled={!isEditing} onChange={()=>{}} />
                </div>
              </div>
              <div className="form-section">
                <h4>Relations</h4>
                <div className="form-group">
                  <label>Related Observations</label>
                  <select multiple value={(activeFinding['related-observations'] || []).map(r => r['observation-uuid'])} disabled={!isEditing} onChange={()=>{}}>
                    {(rs.observations || []).map(obs => (
                      <option key={obs.uuid} value={obs.uuid}>{obs.title || obs.uuid}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Related Risks</label>
                  <select multiple value={(activeFinding['related-risks'] || []).map(r => r['risk-uuid'])} disabled={!isEditing} onChange={()=>{}}>
                    {(rs.risks || []).map(risk => (
                      <option key={risk.uuid} value={risk.uuid}>{risk.title || risk.uuid}</option>
                    ))}
                  </select>
                </div>
              </div>
              <PropsEditor properties={activeFinding.props || []} isEditing={isEditing} onChange={()=>{}} />
            </div>
          )}
        </EntityDetailPanel>
      </div>
    );
  };

  const renderRisks = (rs) => {
    const columns = [
      { key: 'title', label: 'Title' },
      { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} category="risk-status" /> },
      { key: 'severity', label: 'Severity', render: (_, r) => {
          const char = (r.characterizations || [])[0];
          const facet = (char?.facets || []).find(f => f.name === 'likelihood' || f.name === 'impact');
          return facet?.value || 'N/A';
      }},
      { key: 'remediations', label: 'Remediations', render: (_, r) => (r.remediations || []).length }
    ];

    return (
      <div className="entity-section">
        <EntityTable 
          columns={columns} 
          data={rs.risks || []} 
          onRowClick={(r) => setActiveRisk(r)} 
        />
        <EntityDetailPanel 
          isOpen={!!activeRisk} 
          onClose={() => setActiveRisk(null)} 
          title="Risk Details"
        >
          {activeRisk && (
            <div className="editor-form">
              <div className="form-group">
                <label>Title</label>
                <input type="text" value={activeRisk.title || ''} disabled={!isEditing} onChange={()=>{}} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={activeRisk.description || ''} disabled={!isEditing} onChange={()=>{}} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select value={activeRisk.status || ''} disabled={!isEditing} onChange={()=>{}}>
                    <option value="open">Open</option>
                    <option value="investigating">Investigating</option>
                    <option value="remediating">Remediating</option>
                    <option value="deviation-requested">Deviation Requested</option>
                    <option value="deviation-approved">Deviation Approved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Statement</label>
                <textarea value={activeRisk.statement || ''} disabled={!isEditing} onChange={()=>{}} />
              </div>
              <div className="form-section">
                <h4>Characterizations</h4>
                <CharacterizationsEditor 
                  value={activeRisk.characterizations || []} 
                  isEditing={isEditing} 
                  onChange={newChars => updateRiskField('characterizations', newChars)} 
                />
              </div>
              <div className="form-section">
                <h4>Mitigating Factors</h4>
                {(activeRisk['mitigating-factors'] || []).map((mf, i) => (
                  <div key={i} className="form-group">
                    <input type="text" value={mf.uuid || ''} placeholder="UUID" disabled={!isEditing} />
                    <textarea value={mf.description || ''} placeholder="Description" disabled={!isEditing} />
                    <input type="text" value={mf['implementation-uuid'] || ''} placeholder="Implementation UUID" disabled={!isEditing} />
                  </div>
                ))}
              </div>
              <div className="form-section">
                <h4>Risk Log</h4>
                <RiskLogEditor 
                  value={activeRisk['risk-log'] || { entries: [] }} 
                  isEditing={isEditing} 
                  onChange={newLog => updateRiskField('risk-log', newLog)} 
                />
              </div>
              <div className="form-section">
                <h4>Remediations</h4>
                <RemediationsEditor 
                  value={activeRisk.remediations || []} 
                  isEditing={isEditing} 
                  onChange={newRems => updateRiskField('remediations', newRems)} 
                />
              </div>
              <div className="form-section">
                <h4>Threat IDs</h4>
                {(activeRisk['threat-ids'] || []).map((threat, i) => (
                  <div key={i} className="form-row">
                    <input type="text" value={threat.system || ''} placeholder="System URI" disabled={!isEditing} />
                    <input type="text" value={threat.id || ''} placeholder="ID" disabled={!isEditing} />
                    <input type="text" value={threat.href || ''} placeholder="HREF" disabled={!isEditing} />
                  </div>
                ))}
              </div>
              <PropsEditor properties={activeRisk.props || []} isEditing={isEditing} onChange={()=>{}} />
            </div>
          )}
        </EntityDetailPanel>
      </div>
    );
  };

  return (
    <div className="ar-page">
      <DocumentToolbar
        title={metadata.title || 'Untitled Assessment Result'}
        version={metadata.version}
        oscalVersion={metadata['oscal-version']}
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
        onSave={() => handleSave()}
        saveStatus={saveStatus}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onShowVersions={() => setShowVersions(true)}
        onBack={onClose}
        mode="assessment-results"
      />
      <div className="ar-tabs">
        <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={activeTab === 'results' ? 'active' : ''} onClick={() => setActiveTab('results')}>Result Sets</button>
        <button className={activeTab === 'metadata' ? 'active' : ''} onClick={() => setActiveTab('metadata')}>Metadata</button>
        <button className={activeTab === 'json' ? 'active' : ''} onClick={() => setActiveTab('json')}>JSON</button>
      </div>
      <div className="ar-content">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'results' && renderResultSets()}
        {activeTab === 'metadata' && (
          <div className="ar-metadata">
            <MetadataEditor metadata={metadata} isEditing={isEditing} onChange={(newMeta) => {
              const newDoc = { ...doc };
              newDoc['assessment-results'].metadata = newMeta;
              setDoc(newDoc);
            }} />
            <PropsEditor properties={metadata.props || []} isEditing={isEditing} onChange={(newProps) => {
              const newDoc = { ...doc };
              newDoc['assessment-results'].metadata.props = newProps;
              setDoc(newDoc);
            }} />
            <BackMatterEditor backMatter={ar['back-matter']} isEditing={isEditing} onChange={(newBm) => {
              const newDoc = { ...doc };
              newDoc['assessment-results']['back-matter'] = newBm;
              setDoc(newDoc);
            }} />
          </div>
        )}
        {activeTab === 'json' && (
          <JsonEditor value={doc} readOnly={!isEditing} onChange={(newDoc) => setDoc(newDoc)} />
        )}
      </div>
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
