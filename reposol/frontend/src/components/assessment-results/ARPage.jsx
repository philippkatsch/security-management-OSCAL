import React, { useState, useEffect } from 'react';
import './ARPage.css';
import { authFetch } from '../../lib/api';

import { MetadataEditor } from '../shared/MetadataEditor';
import { DocumentToolbar } from '../shared/DocumentToolbar';
import { JsonEditor } from '../shared/JsonEditor';
import { PropsEditor } from '../shared/PropsEditor';
import { BackMatterEditor } from '../shared/BackMatterEditor';
import { LinksEditor } from '../shared/LinksEditor';

import StatusBadge from '../shared/status/StatusBadge';
import EntityTable from '../shared/entity/EntityTable';
import EntityDetailPanel from '../shared/entity/EntityDetailPanel';
import MetricCard from '../shared/dashboard/MetricCard';
import MetricCardGrid from '../shared/dashboard/MetricCardGrid';
import StatusBreakdown from '../shared/dashboard/StatusBreakdown';
import { OriginsEditor } from '../shared/oscal/OriginsEditor';
import { CharacterizationsEditor } from '../shared/oscal/CharacterizationsEditor';
import { RiskLogEditor } from '../shared/oscal/RiskLogEditor';
import { RelevantEvidenceEditor } from '../shared/oscal/RelevantEvidenceEditor';
import { RemediationsEditor } from '../shared/oscal/RemediationsEditor';

export function ARPage({ arId, initialEditMode, onClose }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditMode, setIsEditMode] = useState(initialEditMode || false);
  const [saveStatus, setSaveStatus] = useState('');
  
  const [activeResultSetId, setActiveResultSetId] = useState(null);
  const [resultSetTab, setResultSetTab] = useState('observations');

  const [activeObservation, setActiveObservation] = useState(null);
  const [activeFinding, setActiveFinding] = useState(null);
  const [activeRisk, setActiveRisk] = useState(null);

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

  useEffect(() => {
    fetchDoc();
  }, [arId]);

  const fetchDoc = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`/api/documents/assessment-results/${arId}`);
      if (!res.ok) throw new Error('Failed to fetch Assessment Result');
      const data = await res.json();
      setDoc(data);
      if (data['assessment-results']?.results?.length > 0) {
        setActiveResultSetId(data['assessment-results'].results[0].uuid);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updatedDoc = doc) => {
    setSaveStatus('Saving...');
    try {
      const res = await authFetch(`/api/documents/assessment-results/${arId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDoc),
      });
      if (!res.ok) throw new Error('Failed to save');
      const saved = await res.json();
      setDoc(saved);
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
          {isEditMode ? (
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
            {isEditMode && <button className="btn-primary" onClick={createResultSet}>+ New</button>}
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
              {isEditMode && (
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
              </div>
              <div className="rs-tab-content">
                {resultSetTab === 'observations' && renderObservations(activeResultSet)}
                {resultSetTab === 'findings' && renderFindings(activeResultSet)}
                {resultSetTab === 'risks' && renderRisks(activeResultSet)}
              </div>
            </>
          ) : (
            <div className="empty-state">No Result Sets</div>
          )}
        </div>
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
                <input type="text" value={activeObservation.title || ''} disabled={!isEditMode} onChange={()=>{}} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={activeObservation.description || ''} disabled={!isEditMode} onChange={()=>{}} />
              </div>
              <div className="form-section">
                <h4>Classification</h4>
                <div className="form-group">
                  <label>Methods</label>
                  <div className="checkbox-group">
                    {['EXAMINE', 'INTERVIEW', 'TEST'].map(m => (
                      <label key={m}><input type="checkbox" checked={(activeObservation.methods || []).includes(m)} disabled={!isEditMode} onChange={()=>{}} /> {m}</label>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>Types</label>
                  <input type="text" placeholder="finding, historic, observation..." value={(activeObservation.types || []).join(', ')} disabled={!isEditMode} onChange={()=>{}} />
                </div>
              </div>
              <div className="form-section">
                <h4>Timing</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Collected</label>
                    <input type="datetime-local" value={(activeObservation.collected || '').slice(0, 16)} disabled={!isEditMode} onChange={()=>{}} />
                  </div>
                  <div className="form-group">
                    <label>Expires (Optional)</label>
                    <input type="datetime-local" value={(activeObservation.expires || '').slice(0, 16)} disabled={!isEditMode} onChange={()=>{}} />
                  </div>
                </div>
              </div>
              <div className="form-section">
                <h4>Subjects</h4>
                {(activeObservation.subjects || []).map((sub, i) => (
                  <div key={i} className="form-row">
                    <input type="text" value={sub['subject-uuid'] || ''} placeholder="Subject UUID" disabled={!isEditMode} />
                    <select value={sub.type || ''} disabled={!isEditMode}>
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
                  isEditMode={isEditMode} 
                  onChange={newEv => updateObservationField('relevant-evidence', newEv)} 
                />
              </div>
              <div className="form-section">
                <h4>Origins</h4>
                <OriginsEditor 
                  value={activeObservation.origins || []} 
                  isEditMode={isEditMode} 
                  onChange={newOrigins => updateObservationField('origins', newOrigins)} 
                />
              </div>
              <PropsEditor properties={activeObservation.props || []} isEditMode={isEditMode} onChange={()=>{}} />
              <LinksEditor links={activeObservation.links || []} isEditMode={isEditMode} onChange={()=>{}} />
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
                <input type="text" value={activeFinding.title || ''} disabled={!isEditMode} onChange={()=>{}} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={activeFinding.description || ''} disabled={!isEditMode} onChange={()=>{}} />
              </div>
              <div className="form-section">
                <h4>Target</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Target Type</label>
                    <select value={activeFinding.target?.type || ''} disabled={!isEditMode} onChange={()=>{}}>
                      <option value="objective-id">Objective ID</option>
                      <option value="statement-id">Statement ID</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Target ID</label>
                    <input type="text" value={activeFinding.target?.['target-id'] || ''} disabled={!isEditMode} onChange={()=>{}} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Status State</label>
                    <select value={activeFinding.target?.status?.state || ''} disabled={!isEditMode} onChange={()=>{}}>
                      <option value="satisfied">Satisfied</option>
                      <option value="not-satisfied">Not Satisfied</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Implementation Status</label>
                    <select value={activeFinding.target?.['implementation-status']?.state || ''} disabled={!isEditMode} onChange={()=>{}}>
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
                  <input type="text" value={activeFinding.target?.status?.reason || ''} disabled={!isEditMode} onChange={()=>{}} />
                </div>
              </div>
              <div className="form-section">
                <h4>Relations</h4>
                <div className="form-group">
                  <label>Related Observations</label>
                  <select multiple value={(activeFinding['related-observations'] || []).map(r => r['observation-uuid'])} disabled={!isEditMode} onChange={()=>{}}>
                    {(rs.observations || []).map(obs => (
                      <option key={obs.uuid} value={obs.uuid}>{obs.title || obs.uuid}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Related Risks</label>
                  <select multiple value={(activeFinding['related-risks'] || []).map(r => r['risk-uuid'])} disabled={!isEditMode} onChange={()=>{}}>
                    {(rs.risks || []).map(risk => (
                      <option key={risk.uuid} value={risk.uuid}>{risk.title || risk.uuid}</option>
                    ))}
                  </select>
                </div>
              </div>
              <PropsEditor properties={activeFinding.props || []} isEditMode={isEditMode} onChange={()=>{}} />
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
                <input type="text" value={activeRisk.title || ''} disabled={!isEditMode} onChange={()=>{}} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={activeRisk.description || ''} disabled={!isEditMode} onChange={()=>{}} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select value={activeRisk.status || ''} disabled={!isEditMode} onChange={()=>{}}>
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
                <textarea value={activeRisk.statement || ''} disabled={!isEditMode} onChange={()=>{}} />
              </div>
              <div className="form-section">
                <h4>Characterizations</h4>
                <CharacterizationsEditor 
                  value={activeRisk.characterizations || []} 
                  isEditMode={isEditMode} 
                  onChange={newChars => updateRiskField('characterizations', newChars)} 
                />
              </div>
              <div className="form-section">
                <h4>Mitigating Factors</h4>
                {(activeRisk['mitigating-factors'] || []).map((mf, i) => (
                  <div key={i} className="form-group">
                    <input type="text" value={mf.uuid || ''} placeholder="UUID" disabled={!isEditMode} />
                    <textarea value={mf.description || ''} placeholder="Description" disabled={!isEditMode} />
                    <input type="text" value={mf['implementation-uuid'] || ''} placeholder="Implementation UUID" disabled={!isEditMode} />
                  </div>
                ))}
              </div>
              <div className="form-section">
                <h4>Risk Log</h4>
                <RiskLogEditor 
                  value={activeRisk['risk-log'] || { entries: [] }} 
                  isEditMode={isEditMode} 
                  onChange={newLog => updateRiskField('risk-log', newLog)} 
                />
              </div>
              <div className="form-section">
                <h4>Remediations</h4>
                <RemediationsEditor 
                  value={activeRisk.remediations || []} 
                  isEditMode={isEditMode} 
                  onChange={newRems => updateRiskField('remediations', newRems)} 
                />
              </div>
              <div className="form-section">
                <h4>Threat IDs</h4>
                {(activeRisk['threat-ids'] || []).map((threat, i) => (
                  <div key={i} className="form-row">
                    <input type="text" value={threat.system || ''} placeholder="System URI" disabled={!isEditMode} />
                    <input type="text" value={threat.id || ''} placeholder="ID" disabled={!isEditMode} />
                    <input type="text" value={threat.href || ''} placeholder="HREF" disabled={!isEditMode} />
                  </div>
                ))}
              </div>
              <PropsEditor properties={activeRisk.props || []} isEditMode={isEditMode} onChange={()=>{}} />
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
        isEditing={isEditMode}
        onToggleEdit={() => {
          const next = !isEditMode;
          setIsEditMode(next);
          if (next) {
            if (!window.location.search.includes('edit=true')) window.history.replaceState(null, '', window.location.pathname + '?edit=true');
          } else {
            if (window.location.search.includes('edit=true')) window.history.replaceState(null, '', window.location.pathname);
          }
        }}
        onSave={() => handleSave()}
        saveStatus={saveStatus}
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
            <MetadataEditor metadata={metadata} isEditMode={isEditMode} onChange={(newMeta) => {
              const newDoc = { ...doc };
              newDoc['assessment-results'].metadata = newMeta;
              setDoc(newDoc);
            }} />
            <PropsEditor properties={metadata.props || []} isEditMode={isEditMode} onChange={(newProps) => {
              const newDoc = { ...doc };
              newDoc['assessment-results'].metadata.props = newProps;
              setDoc(newDoc);
            }} />
            <BackMatterEditor backMatter={ar['back-matter']} isEditMode={isEditMode} onChange={(newBm) => {
              const newDoc = { ...doc };
              newDoc['assessment-results']['back-matter'] = newBm;
              setDoc(newDoc);
            }} />
          </div>
        )}
        {activeTab === 'json' && (
          <JsonEditor value={doc} readOnly={!isEditMode} onChange={(newDoc) => setDoc(newDoc)} />
        )}
      </div>
    </div>
  );
}
