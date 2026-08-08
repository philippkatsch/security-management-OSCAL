import React, { useState, useEffect } from 'react';
import { authFetch } from '../../lib/api';
import { DocumentToolbar } from '../shared/DocumentToolbar';
import { VersionDrawer } from '../shared/VersionDrawer';
import { MetadataEditor } from '../shared/MetadataEditor';
import { PropsEditor } from '../shared/PropsEditor';
import { BackMatterEditor } from '../shared/BackMatterEditor';
import { JsonEditor } from '../shared/JsonEditor';
import { LinksEditor } from '../shared/LinksEditor';
import EntityTable from '../shared/entity/EntityTable';
import MetricCardGrid from '../shared/dashboard/MetricCardGrid';
import ProgressBar from '../shared/dashboard/ProgressBar';
import StatusBreakdown from '../shared/dashboard/StatusBreakdown';
import StatusBadge from '../shared/status/StatusBadge';
import { OriginsEditor } from '../shared/oscal/OriginsEditor';
import { CharacterizationsEditor } from '../shared/oscal/CharacterizationsEditor';
import { RiskLogEditor } from '../shared/oscal/RiskLogEditor';
import { RelevantEvidenceEditor } from '../shared/oscal/RelevantEvidenceEditor';
import { RemediationsEditor } from '../shared/oscal/RemediationsEditor';
import './POAMPage.css';

const PoamItemEditor = ({ item, onSave, onClose, readOnly, doc }) => {
  const [edited, setEdited] = useState(item);
  
  const updateField = (field, value) => {
    setEdited(prev => ({ ...prev, [field]: value }));
  };

  const updateProp = (name, value) => {
    const props = [...(edited.props || [])];
    const idx = props.findIndex(p => p.name === name);
    if (idx >= 0) props[idx].value = value;
    else props.push({ name, value });
    updateField('props', props);
  };

  const getProp = (name) => {
    const p = (edited.props || []).find(p => p.name === name);
    return p ? p.value : '';
  };

  const handleRelatedMultiSelect = (field, entityList, e) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map(o => o.value);
    const updated = selectedOptions.map(uuid => {
      if (field === 'related-findings') return { 'finding-uuid': uuid };
      if (field === 'related-risks') return { 'risk-uuid': uuid };
      if (field === 'related-observations') return { 'observation-uuid': uuid };
      return {};
    });
    updateField(field, updated);
  };

  const getSelected = (field) => {
    const arr = edited[field] || [];
    if (field === 'related-findings') return arr.map(a => a['finding-uuid']);
    if (field === 'related-risks') return arr.map(a => a['risk-uuid']);
    if (field === 'related-observations') return arr.map(a => a['observation-uuid']);
    return [];
  };

  return (
    <div className="bespoke-editor-overlay">
      <div className="bespoke-editor-modal">
        <div className="bespoke-editor-header">
          <h2>POA&M Item Editor</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="bespoke-editor-content">
          <label>Title</label>
          <input type="text" value={edited.title || ''} onChange={e => updateField('title', e.target.value)} disabled={readOnly} />
          
          <label>Description</label>
          <textarea value={edited.description || ''} onChange={e => updateField('description', e.target.value)} disabled={readOnly} />
          
          <label>Priority</label>
          <select value={getProp('priority')} onChange={e => updateProp('priority', e.target.value)} disabled={readOnly}>
            <option value="">Select Priority...</option>
            <option value="1">1 - Critical</option>
            <option value="2">2 - High</option>
            <option value="3">3 - Medium</option>
            <option value="4">4 - Low</option>
          </select>
          <div style={{marginTop: '8px'}}>
             {getProp('priority') && <StatusBadge status={"P"+getProp('priority')} category={getProp('priority') === '1' ? 'critical' : getProp('priority') === '2' ? 'high' : getProp('priority') === '3' ? 'medium' : 'low'} />}
          </div>

          <label>Related Observations</label>
          <select multiple value={getSelected('related-observations')} onChange={e => handleRelatedMultiSelect('related-observations', doc.observations || [], e)} disabled={readOnly} className="multi-select">
            {(doc.observations || []).map(o => <option key={o.uuid} value={o.uuid}>{o.title}</option>)}
          </select>

          <label>Related Risks</label>
          <select multiple value={getSelected('related-risks')} onChange={e => handleRelatedMultiSelect('related-risks', doc.risks || [], e)} disabled={readOnly} className="multi-select">
            {(doc.risks || []).map(r => <option key={r.uuid} value={r.uuid}>{r.title}</option>)}
          </select>

          <label>Related Findings</label>
          <select multiple value={getSelected('related-findings')} onChange={e => handleRelatedMultiSelect('related-findings', doc.findings || [], e)} disabled={readOnly} className="multi-select">
            {(doc.findings || []).map(f => <option key={f.uuid} value={f.uuid}>{f.title}</option>)}
          </select>

          <label>Remarks</label>
          <textarea value={edited.remarks || ''} onChange={e => updateField('remarks', e.target.value)} disabled={readOnly} />

          <div className="inline-editor-section">
            <h3>Properties</h3>
            <PropsEditor props={edited.props || []} onChange={p => updateField('props', p)} readOnly={readOnly} />
          </div>
          
          <div className="inline-editor-section">
             <h3>Origins</h3>
             <OriginsEditor 
               value={edited.origins || []} 
               isEditMode={!readOnly} 
               onChange={newOrigins => updateField('origins', newOrigins)} 
             />
          </div>
        </div>
        {!readOnly && (
          <div className="bespoke-editor-footer">
            <button className="save-btn" onClick={() => onSave(edited)}>Save Changes</button>
          </div>
        )}
      </div>
    </div>
  );
};

const RiskEditor = ({ item, onSave, onClose, readOnly }) => {
  const [edited, setEdited] = useState(item);
  
  const updateField = (field, value) => setEdited(prev => ({ ...prev, [field]: value }));

  return (
    <div className="bespoke-editor-overlay">
      <div className="bespoke-editor-modal">
        <div className="bespoke-editor-header">
          <h2>Risk Editor</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="bespoke-editor-content">
          <label>Title</label>
          <input type="text" value={edited.title || ''} onChange={e => updateField('title', e.target.value)} disabled={readOnly} />
          
          <label>Status</label>
          <select value={edited.status || 'open'} onChange={e => updateField('status', e.target.value)} disabled={readOnly}>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="remediating">Remediating</option>
            <option value="deviation-requested">Deviation Requested</option>
            <option value="deviation-approved">Deviation Approved</option>
            <option value="closed">Closed</option>
          </select>
          <div style={{marginTop: '8px'}}><StatusBadge status={edited.status || 'open'} category="risk-status" /></div>

          <label>Description</label>
          <textarea value={edited.description || ''} onChange={e => updateField('description', e.target.value)} disabled={readOnly} />
          
          <label>Threat IDs (comma separated)</label>
          <input type="text" value={(edited['threat-ids'] || []).join(', ')} onChange={e => updateField('threat-ids', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} disabled={readOnly} />
          
          <div className="inline-editor-section">
             <h3>Characterizations</h3>
             <CharacterizationsEditor 
               value={edited.characterizations || []} 
               isEditMode={!readOnly} 
               onChange={newChars => updateField('characterizations', newChars)} 
             />
          </div>
          
          <div className="inline-editor-section">
             <h3>Risk Log</h3>
             <RiskLogEditor 
               value={edited['risk-log'] || { entries: [] }} 
               isEditMode={!readOnly} 
               onChange={newLog => updateField('risk-log', newLog)} 
             />
          </div>

          <div className="inline-editor-section">
             <h3>Remediations</h3>
             <RemediationsEditor 
               value={edited.remediations || []} 
               isEditMode={!readOnly} 
               onChange={newRems => updateField('remediations', newRems)} 
             />
          </div>

        </div>
        {!readOnly && (
          <div className="bespoke-editor-footer">
            <button className="save-btn" onClick={() => onSave(edited)}>Save Changes</button>
          </div>
        )}
      </div>
    </div>
  );
};

const ObservationEditor = ({ item, onSave, onClose, readOnly }) => {
  const [edited, setEdited] = useState(item);
  const updateField = (field, value) => setEdited(prev => ({ ...prev, [field]: value }));

  const handleMethodsChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map(o => o.value);
    updateField('methods', selectedOptions);
  };

  return (
    <div className="bespoke-editor-overlay">
      <div className="bespoke-editor-modal">
        <div className="bespoke-editor-header">
          <h2>Observation Editor</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="bespoke-editor-content">
          <label>Title</label>
          <input type="text" value={edited.title || ''} onChange={e => updateField('title', e.target.value)} disabled={readOnly} />
          
          <label>Description</label>
          <textarea value={edited.description || ''} onChange={e => updateField('description', e.target.value)} disabled={readOnly} />
          
          <label>Methods</label>
          <select multiple value={edited.methods || []} onChange={handleMethodsChange} disabled={readOnly} className="multi-select">
            <option value="EXAMINE">EXAMINE</option>
            <option value="INTERVIEW">INTERVIEW</option>
            <option value="TEST">TEST</option>
          </select>
          
          <label>Types (comma separated)</label>
          <input type="text" value={(edited.types || []).join(', ')} onChange={e => updateField('types', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} disabled={readOnly} />

          <label>Collected Date</label>
          <input type="datetime-local" value={edited['collected'] || ''} onChange={e => updateField('collected', e.target.value)} disabled={readOnly} />

          <label>Expires Date</label>
          <input type="datetime-local" value={edited['expires'] || ''} onChange={e => updateField('expires', e.target.value)} disabled={readOnly} />

          <div className="inline-editor-section">
             <h3>Subjects</h3>
             <textarea placeholder="JSON representing subjects..." value={JSON.stringify(edited.subjects || [], null, 2)} onChange={e => {
               try { updateField('subjects', JSON.parse(e.target.value)) } catch(e){} 
             }} disabled={readOnly} rows={5}/>
          </div>
          <div className="inline-editor-section">
             <h3>Relevant Evidence</h3>
             <RelevantEvidenceEditor 
               value={edited['relevant-evidence'] || []} 
               isEditMode={!readOnly} 
               onChange={newEv => updateField('relevant-evidence', newEv)} 
             />
          </div>
        </div>
        {!readOnly && (
          <div className="bespoke-editor-footer">
            <button className="save-btn" onClick={() => onSave(edited)}>Save Changes</button>
          </div>
        )}
      </div>
    </div>
  );
};

const FindingEditor = ({ item, onSave, onClose, readOnly }) => {
  const [edited, setEdited] = useState(item);
  const updateField = (field, value) => setEdited(prev => ({ ...prev, [field]: value }));

  const updateTargetField = (field, value) => {
    const target = { ...(edited.target || {}) };
    target[field] = value;
    updateField('target', target);
  };

  return (
    <div className="bespoke-editor-overlay">
      <div className="bespoke-editor-modal">
        <div className="bespoke-editor-header">
          <h2>Finding Editor</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="bespoke-editor-content">
          <label>Title</label>
          <input type="text" value={edited.title || ''} onChange={e => updateField('title', e.target.value)} disabled={readOnly} />
          
          <label>Description</label>
          <textarea value={edited.description || ''} onChange={e => updateField('description', e.target.value)} disabled={readOnly} />
          
          <div className="inline-editor-section">
            <h3>Target</h3>
            <label>Type</label>
            <input type="text" value={edited.target?.type || ''} onChange={e => updateTargetField('type', e.target.value)} disabled={readOnly} />
            <label>Target ID</label>
            <input type="text" value={edited.target?.['target-id'] || ''} onChange={e => updateTargetField('target-id', e.target.value)} disabled={readOnly} />
            <label>Status State</label>
            <select value={edited.target?.status?.state || ''} onChange={e => updateTargetField('status', { state: e.target.value })} disabled={readOnly}>
              <option value="">Select...</option>
              <option value="satisfied">Satisfied</option>
              <option value="not-satisfied">Not Satisfied</option>
            </select>
          </div>

          <label>Implementation Statement UUID</label>
          <input type="text" value={edited['implementation-statement-uuid'] || ''} onChange={e => updateField('implementation-statement-uuid', e.target.value)} disabled={readOnly} />

          <div className="inline-editor-section">
             <h3>Related Observations</h3>
             <textarea placeholder="JSON..." value={JSON.stringify(edited['related-observations'] || [], null, 2)} onChange={e => {
               try { updateField('related-observations', JSON.parse(e.target.value)) } catch(e){} 
             }} disabled={readOnly} rows={3}/>
          </div>
          <div className="inline-editor-section">
             <h3>Related Risks</h3>
             <textarea placeholder="JSON..." value={JSON.stringify(edited['related-risks'] || [], null, 2)} onChange={e => {
               try { updateField('related-risks', JSON.parse(e.target.value)) } catch(e){} 
             }} disabled={readOnly} rows={3}/>
          </div>
        </div>
        {!readOnly && (
          <div className="bespoke-editor-footer">
            <button className="save-btn" onClick={() => onSave(edited)}>Save Changes</button>
          </div>
        )}
      </div>
    </div>
  );
};

const ComponentEditor = ({ item, onSave, onClose, readOnly }) => {
  const [edited, setEdited] = useState(item);
  const updateField = (field, value) => setEdited(prev => ({ ...prev, [field]: value }));

  return (
    <div className="bespoke-editor-overlay">
      <div className="bespoke-editor-modal">
        <div className="bespoke-editor-header">
          <h2>Component Editor</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="bespoke-editor-content">
          <label>Title</label>
          <input type="text" value={edited.title || ''} onChange={e => updateField('title', e.target.value)} disabled={readOnly} />
          
          <label>Type</label>
          <input type="text" value={edited.type || ''} onChange={e => updateField('type', e.target.value)} disabled={readOnly} />
          
          <label>Description</label>
          <textarea value={edited.description || ''} onChange={e => updateField('description', e.target.value)} disabled={readOnly} />
          
          <label>Status (State)</label>
          <select value={edited.status?.state || ''} onChange={e => updateField('status', { state: e.target.value })} disabled={readOnly}>
            <option value="">Select...</option>
            <option value="operational">Operational</option>
            <option value="under-development">Under Development</option>
            <option value="under-major-modification">Under Major Modification</option>
            <option value="disposition">Disposition</option>
            <option value="other">Other</option>
          </select>

          <div className="inline-editor-section">
            <h3>Properties</h3>
            <PropsEditor props={edited.props || []} onChange={p => updateField('props', p)} readOnly={readOnly} />
          </div>
        </div>
        {!readOnly && (
          <div className="bespoke-editor-footer">
            <button className="save-btn" onClick={() => onSave(edited)}>Save Changes</button>
          </div>
        )}
      </div>
    </div>
  );
};

const InventoryItemEditor = ({ item, onSave, onClose, readOnly }) => {
  const [edited, setEdited] = useState(item);
  const updateField = (field, value) => setEdited(prev => ({ ...prev, [field]: value }));

  return (
    <div className="bespoke-editor-overlay">
      <div className="bespoke-editor-modal">
        <div className="bespoke-editor-header">
          <h2>Inventory Item Editor</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="bespoke-editor-content">
          <label>Description</label>
          <textarea value={edited.description || ''} onChange={e => updateField('description', e.target.value)} disabled={readOnly} />
          
          <label>Asset ID</label>
          <input type="text" value={edited['asset-id'] || ''} onChange={e => updateField('asset-id', e.target.value)} disabled={readOnly} />
          
          <div className="inline-editor-section">
            <h3>Properties</h3>
            <PropsEditor props={edited.props || []} onChange={p => updateField('props', p)} readOnly={readOnly} />
          </div>

          <div className="inline-editor-section">
             <h3>Implemented Components (JSON)</h3>
             <textarea placeholder="JSON representing implemented components..." value={JSON.stringify(edited['implemented-components'] || [], null, 2)} onChange={e => {
               try { updateField('implemented-components', JSON.parse(e.target.value)) } catch(e){} 
             }} disabled={readOnly} rows={5}/>
          </div>
        </div>
        {!readOnly && (
          <div className="bespoke-editor-footer">
            <button className="save-btn" onClick={() => onSave(edited)}>Save Changes</button>
          </div>
        )}
      </div>
    </div>
  );
};

const UserEditor = ({ item, onSave, onClose, readOnly }) => {
  const [edited, setEdited] = useState(item);
  const updateField = (field, value) => setEdited(prev => ({ ...prev, [field]: value }));

  return (
    <div className="bespoke-editor-overlay">
      <div className="bespoke-editor-modal">
        <div className="bespoke-editor-header">
          <h2>User Editor</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="bespoke-editor-content">
          <label>Title</label>
          <input type="text" value={edited.title || ''} onChange={e => updateField('title', e.target.value)} disabled={readOnly} />
          
          <label>Role IDs (comma separated)</label>
          <input type="text" value={(edited['role-ids'] || []).join(', ')} onChange={e => updateField('role-ids', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} disabled={readOnly} />
          
          <div className="inline-editor-section">
             <h3>Authorized Privileges (JSON)</h3>
             <textarea placeholder="JSON representing authorized privileges..." value={JSON.stringify(edited['authorized-privileges'] || [], null, 2)} onChange={e => {
               try { updateField('authorized-privileges', JSON.parse(e.target.value)) } catch(e){} 
             }} disabled={readOnly} rows={5}/>
          </div>
        </div>
        {!readOnly && (
          <div className="bespoke-editor-footer">
            <button className="save-btn" onClick={() => onSave(edited)}>Save Changes</button>
          </div>
        )}
      </div>
    </div>
  );
};

const ArImportModal = ({ onClose, onImport }) => {
  const [arDocs, setArDocs] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [findings, setFindings] = useState([]);
  const [risks, setRisks] = useState([]);
  const [observations, setObservations] = useState([]);
  const [selectedFindings, setSelectedFindings] = useState(new Set());
  const [selectedRisks, setSelectedRisks] = useState(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authFetch("/api/documents/assessment-results")
      .then(res => res.json())
      .then(data => {
        const list = (Array.isArray(data) ? data : []).map(item => {
          const ar = item['assessment-results'] || item;
          return {
            id: ar.uuid || item.id || item.uuid,
            title: ar.metadata?.title || ar.title || 'Untitled AR',
            version: ar.metadata?.version || ar.version || '1.0'
          };
        });
        setArDocs(list);
      })
      .catch(console.error);
  }, []);

  const handleDocSelect = async (e) => {
    const id = e.target.value;
    setSelectedDocId(id);
    if (!id) {
      setFindings([]);
      setRisks([]);
      setObservations([]);
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch("/api/documents/assessment-results/" + id);
      const data = await res.json();
      const ar = data['assessment-results'] || data || {};
      const rawFindings = ar.findings || (ar.results || []).flatMap(r => r.findings || []);
      const rawRisks = ar.risks || (ar.results || []).flatMap(r => r.risks || []);
      const rawObservations = ar.observations || (ar.results || []).flatMap(r => r.observations || []);

      const allFindings = rawFindings.filter(f => {
        const st = f.target?.status?.state || f.targets?.[0]?.status?.state;
        return !st || st === 'not-satisfied';
      });
      const allRisks = [...rawRisks];
      const allObservations = [...rawObservations];
      
      setFindings(allFindings);
      setRisks(allRisks);
      setObservations(allObservations);
      setSelectedFindings(new Set(allFindings.map(f => f.uuid)));
      setSelectedRisks(new Set(allRisks.map(r => r.uuid)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFinding = (uuid) => {
    const next = new Set(selectedFindings);
    if (next.has(uuid)) next.delete(uuid);
    else next.add(uuid);
    setSelectedFindings(next);
  };

  const toggleRisk = (uuid) => {
    const next = new Set(selectedRisks);
    if (next.has(uuid)) next.delete(uuid);
    else next.add(uuid);
    setSelectedRisks(next);
  };

  return (
    <div className="bespoke-editor-overlay">
      <div className="bespoke-editor-modal" style={{ maxWidth: '600px' }}>
        <div className="bespoke-editor-header">
          <h2>Import from Assessment Results</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="bespoke-editor-content">
          <label>Select AR Document</label>
          <select value={selectedDocId} onChange={handleDocSelect}>
            <option value="">-- Select --</option>
            {arDocs.map(d => (
              <option key={d.id} value={d.id}>{d.title} (v{d.version})</option>
            ))}
          </select>
          {loading && <div>Loading...</div>}
          {!loading && (findings.length > 0 || risks.length > 0) && (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {findings.length > 0 && (
                <div>
                  <h3>Select Findings to Import</h3>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--color-border)', padding: '8px', borderRadius: '4px' }}>
                    {findings.map(f => (
                      <div key={f.uuid} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input type="checkbox" checked={selectedFindings.has(f.uuid)} onChange={() => toggleFinding(f.uuid)} />
                        <div>
                          <strong>{f.title}</strong>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{f.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {risks.length > 0 && (
                <div>
                  <h3>Select Risks to Import</h3>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--color-border)', padding: '8px', borderRadius: '4px' }}>
                    {risks.map(r => (
                      <div key={r.uuid} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input type="checkbox" checked={selectedRisks.has(r.uuid)} onChange={() => toggleRisk(r.uuid)} />
                        <div>
                          <strong>{r.title}</strong>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{r.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {!loading && selectedDocId && findings.length === 0 && risks.length === 0 && (
            <div style={{ marginTop: '16px', color: 'var(--color-text-muted)' }}>No "not-satisfied" findings or risks found.</div>
          )}
        </div>
        <div className="bespoke-editor-footer">
          <button className="save-btn" disabled={selectedFindings.size === 0 && selectedRisks.size === 0} onClick={() => {
            const toImportFindings = findings.filter(f => selectedFindings.has(f.uuid));
            const toImportRisks = risks.filter(r => selectedRisks.has(r.uuid));
            onImport({
              findings: toImportFindings,
              risks: toImportRisks,
              allRisks: risks,
              allObservations: observations
            });
          }}>Import Selected</button>
        </div>
      </div>
    </div>
  );
};

export function POAMPage({ poamId, initialEditMode, onClose }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(() => {
    if (typeof initialEditMode === 'boolean') return initialEditMode;
    return window.location.search.includes('edit=true');
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [entityType, setEntityType] = useState(null);
  const [showArImport, setShowArImport] = useState(false);

  const draftKey = `reposol_draft_poam_${poamId}`;

  useEffect(() => {
    fetchDoc();
    if (window.location.search.includes('edit=true')) {
      setEditMode(true);
    }
  }, [poamId]);

  const fetchDoc = async () => {
    try {
      setLoading(true);
      
      const draft = localStorage.getItem(draftKey);
      if (draft && window.location.search.includes('edit=true')) {
        try {
          const parsed = JSON.parse(draft);
          if (parsed && parsed['plan-of-action-and-milestones']) {
            setDoc(parsed);
            setLoading(false);
            return;
          }
        } catch {
          localStorage.removeItem(draftKey);
        }
      } else {
        localStorage.removeItem(draftKey);
      }

      const res = await authFetch("/api/documents/poams/" + poamId);
      if (!res.ok) throw new Error('Failed to fetch POA&M');
      const data = await res.json();
      setDoc(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (editMode && doc) {
      localStorage.setItem(draftKey, JSON.stringify(doc));
    }
  }, [doc, editMode]);

  const handleSave = async (updatedDoc = doc) => {
    try {
      const res = await authFetch("/api/documents/poams", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDoc)
      });
      if (!res.ok) throw new Error('Failed to save POA&M');
      const saved = await res.json();
      setDoc(saved);
      localStorage.removeItem(draftKey);
      setEditMode(false);
      const params = new URLSearchParams(window.location.search);
      params.delete('edit');
      const newSearch = params.toString() ? `?${params.toString()}` : '';
      window.history.replaceState(null, '', window.location.pathname + newSearch);
      return saved;
    } catch (err) {
      alert(err.message);
      throw err;
    }
  };

  const handleDiscardChanges = () => {
    if (window.confirm("Do you want to discard all unsaved changes?")) {
      localStorage.removeItem(draftKey);
      setEditMode(false);
      fetchDoc();
    }
  };

  const updateRootField = (field, value) => {
    const newDoc = { ...doc };
    if (!newDoc['plan-of-action-and-milestones']) return;
    newDoc['plan-of-action-and-milestones'][field] = value;
    setDoc(newDoc);
  };

  if (loading) return <div className="poam-loading">Loading POA&M...</div>;
  if (error) return <div className="poam-error">Error: {error}</div>;
  if (!doc || !doc['plan-of-action-and-milestones']) return <div className="poam-error">Invalid document format</div>;

  const poam = doc['plan-of-action-and-milestones'];
  const title = poam.metadata?.title || 'Untitled POA&M';
  const version = poam.metadata?.version || '1.0';

  const items = poam['poam-items'] || [];
  const risks = poam.risks || [];
  const observations = poam.observations || [];
  const findings = poam.findings || [];

  const completedItems = items.filter(item => {
    const statusProp = (item.props || []).find(p => p.name === 'status');
    return statusProp && statusProp.value === 'completed';
  });
  const openRisks = risks.filter(r => r.status !== 'closed');
  const resolvedPercent = items.length ? Math.round((completedItems.length / items.length) * 100) : 0;
  
  const riskStatusCounts = risks.reduce((acc, r) => {
    const s = r.status || 'unknown';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const riskStatusData = Object.entries(riskStatusCounts).map(([status, count]) => ({
    label: status,
    value: count,
    color: status === 'closed' ? '#10b981' : status === 'open' ? '#ef4444' : '#f59e0b'
  }));

  const itemPriorityCounts = items.reduce((acc, item) => {
    const pProp = (item.props || []).find(p => p.name === 'priority');
    const p = pProp ? pProp.value : 'unknown';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});
  const priorityData = Object.entries(itemPriorityCounts).map(([pri, count]) => {
    let color = '#94a3b8';
    let label = `Priority ${pri}`;
    if (pri === '1') { color = '#ef4444'; label = '1 - Critical'; }
    if (pri === '2') { color = '#f97316'; label = '2 - High'; }
    if (pri === '3') { color = '#eab308'; label = '3 - Medium'; }
    if (pri === '4') { color = '#22c55e'; label = '4 - Low'; }
    return { label, value: count, color };
  });

  const dashboardMetrics = [
    { title: "Total Items", value: items.length },
    { title: "Completed Items", value: completedItems.length, color: "var(--color-success)" },
    { title: "Open Risks", value: openRisks.length, color: "var(--color-danger)" },
    { title: "Observations", value: observations.length }
  ];

  const handleEntityEdit = (type, oldEntity, newEntity) => {
    const newDoc = { ...doc };
    const p = newDoc['plan-of-action-and-milestones'];
    
    let isLocalDef = ['components', 'inventory-items', 'users'].includes(type);
    let targetObj = isLocalDef ? (p['local-definitions'] = p['local-definitions'] || {}) : p;
    let list = targetObj[type] ? [...targetObj[type]] : [];
    
    if (oldEntity && oldEntity.uuid) {
      const idx = list.findIndex(e => e.uuid === oldEntity.uuid);
      if (idx >= 0) list[idx] = newEntity;
      else list.push(newEntity);
    } else {
      if (!newEntity.uuid) newEntity.uuid = crypto.randomUUID();
      list.push(newEntity);
    }
    
    targetObj[type] = list;
    setDoc(newDoc);
    setSelectedEntity(newEntity);
  };

  const handleArImport = ({ findings: selectedFindings, risks: selectedRisks, allRisks, allObservations }) => {
    const newDoc = { ...doc };
    const p = newDoc['plan-of-action-and-milestones'];
    let list = p['poam-items'] ? [...p['poam-items']] : [];
    let pFindings = p.findings ? [...p.findings] : [];
    let pRisks = p.risks ? [...p.risks] : [];
    let pObservations = p.observations ? [...p.observations] : [];
    
    // Map to keep track of old UUID -> new UUID
    const idMap = new Map();

    // Helper to get or create a deep copy with a new UUID
    const importEntity = (entity, targetArray) => {
      if (!entity) return null;
      if (idMap.has(entity.uuid)) {
        return idMap.get(entity.uuid);
      }
      const newEntity = JSON.parse(JSON.stringify(entity));
      const newUuid = crypto.randomUUID();
      newEntity.uuid = newUuid;
      idMap.set(entity.uuid, newUuid);
      targetArray.push(newEntity);
      return newUuid;
    };

    // Import explicitly selected risks
    selectedRisks.forEach(r => {
      importEntity(r, pRisks);
    });

    selectedFindings.forEach(f => {
      const newFindingUuid = importEntity(f, pFindings);
      const newFinding = pFindings.find(x => x.uuid === newFindingUuid);

      const newItem = {
        uuid: crypto.randomUUID(),
        title: f.title,
        description: f.description || '',
        props: [{ name: 'priority', value: '3' }],
        'related-findings': [{ 'finding-uuid': newFindingUuid }]
      };
      
      // Copy related risks
      if (f['related-risks']) {
        const mappedRisks = f['related-risks'].map(rr => {
          const originalRisk = allRisks.find(x => x.uuid === rr['risk-uuid']);
          if (originalRisk) {
            const newRiskId = importEntity(originalRisk, pRisks);
            return { 'risk-uuid': newRiskId };
          }
          return rr;
        });
        newItem['related-risks'] = mappedRisks;
        newFinding['related-risks'] = mappedRisks;
      }

      // Copy related observations
      if (f['related-observations']) {
        const mappedObs = f['related-observations'].map(ro => {
          const originalObs = allObservations.find(x => x.uuid === ro['observation-uuid']);
          if (originalObs) {
            const newObsId = importEntity(originalObs, pObservations);
            return { 'observation-uuid': newObsId };
          }
          return ro;
        });
        newItem['related-observations'] = mappedObs;
        newFinding['related-observations'] = mappedObs;
      }
      
      list.push(newItem);
    });
    
    p['poam-items'] = list;
    p.findings = pFindings;
    p.risks = pRisks;
    p.observations = pObservations;
    setDoc(newDoc);
    setShowArImport(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="poam-dashboard">
            <div className="poam-ssp-reference">
              {poam['import-ssp'] ? (
                <div className="widget-card ssp-card">
                  <h3>Referenced SSP</h3>
                  <p><strong>HREF:</strong> {poam['import-ssp'].href}</p>
                  {editMode && (
                    <button className="edit-btn-small" onClick={() => {
                      const newHref = prompt("Enter new SSP href", poam['import-ssp'].href);
                      if (newHref) updateRootField('import-ssp', { href: newHref });
                    }}>Edit SSP Reference</button>
                  )}
                </div>
              ) : (
                <div className="widget-card ssp-card">
                  <h3>System ID</h3>
                  <p>{poam['system-id']?.identifier || 'None specified'}</p>
                  {editMode && (
                    <button className="edit-btn-small" onClick={() => {
                      const newId = prompt("Enter new System ID", poam['system-id']?.identifier || '');
                      if (newId) updateRootField('system-id', { identifier: newId });
                    }}>Edit System ID</button>
                  )}
                </div>
              )}
            </div>
            <MetricCardGrid metrics={dashboardMetrics} />
            <div className="poam-dashboard-widgets">
              <div className="widget-card">
                <h3>Resolution Progress</h3>
                <ProgressBar percent={resolvedPercent} label={`${completedItems.length} of ${items.length} items resolved`} />
              </div>
              <div className="widget-card">
                <h3>Risk Status</h3>
                <StatusBreakdown data={riskStatusData} />
              </div>
              <div className="widget-card">
                <h3>Items by Priority</h3>
                <StatusBreakdown data={priorityData} />
              </div>
            </div>
          </div>
        );
      
      case 'items':
        return (
          <div className="poam-entity-section">
            {editMode && (
              <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                <button className="poam-toolbar-btn" onClick={() => { setSelectedEntity({}); setEntityType('poam-items'); }}>+ Add POA&M Item</button>
                <button className="poam-toolbar-btn" onClick={() => setShowArImport(true)}>Import from Assessment Results</button>
              </div>
            )}
            <EntityTable
              entities={items}
              columns={[
                { key: 'title', label: 'Title', sortable: true, filterable: true },
                { 
                  key: 'priority', 
                  label: 'Priority',
                  sortable: true,
                  filterable: true,
                  render: (val, item) => {
                    const row = item || (typeof val === 'object' ? val : {});
                    const pProp = (row.props || []).find(p => p.name === 'priority');
                    const pVal = pProp ? pProp.value : '';
                    if (!pVal) return '—';
                    let cat = 'info';
                    if (pVal === '1') cat = 'critical';
                    if (pVal === '2') cat = 'high';
                    if (pVal === '3') cat = 'medium';
                    if (pVal === '4') cat = 'low';
                    return <StatusBadge status={`P${pVal}`} category={cat} />;
                  }
                },
                { 
                  key: 'risks', 
                  label: 'Risks',
                  render: (val, item) => {
                    const row = item || (typeof val === 'object' ? val : {});
                    return (row['related-risks'] || []).length;
                  }
                },
                { 
                  key: 'observations', 
                  label: 'Observations',
                  render: (val, item) => {
                    const row = item || (typeof val === 'object' ? val : {});
                    return (row['related-observations'] || []).length;
                  }
                }
              ]}
              onRowClick={(item) => { setSelectedEntity(item); setEntityType('poam-items'); }}
            />
          </div>
        );
        
      case 'observations':
        return (
          <div className="poam-entity-section">
            {editMode && (
              <div style={{ marginBottom: '16px' }}>
                <button className="poam-toolbar-btn" onClick={() => { setSelectedEntity({}); setEntityType('observations'); }}>+ Add Observation</button>
              </div>
            )}
            <EntityTable
              entities={observations}
              columns={[
                { key: 'title', label: 'Title', sortable: true, filterable: true },
                { 
                  key: 'methods', 
                  label: 'Methods',
                  render: (val, item) => {
                    const row = item || (typeof val === 'object' ? val : {});
                    return (row.methods || []).join(', ');
                  }
                },
                { 
                  key: 'date', 
                  label: 'Collected Date',
                  render: (val, item) => {
                    const row = item || (typeof val === 'object' ? val : {});
                    return row['collected-date'] ? new Date(row['collected-date']).toLocaleDateString() : '—';
                  }
                }
              ]}
              onRowClick={(obs) => { setSelectedEntity(obs); setEntityType('observations'); }}
            />
          </div>
        );

      case 'risks':
        return (
          <div className="poam-entity-section">
            {editMode && (
              <div style={{ marginBottom: '16px' }}>
                <button className="poam-toolbar-btn" onClick={() => { setSelectedEntity({}); setEntityType('risks'); }}>+ Add Risk</button>
              </div>
            )}
            <EntityTable
              entities={risks}
              columns={[
                { key: 'title', label: 'Title', sortable: true, filterable: true },
                { 
                  key: 'status', 
                  label: 'Status',
                  render: (val, item) => {
                    const row = item || (typeof val === 'object' ? val : {});
                    return <StatusBadge status={row.status || 'unknown'} category="risk-status" />;
                  }
                },
                { 
                  key: 'remediations', 
                  label: 'Remediations',
                  render: (val, item) => {
                    const row = item || (typeof val === 'object' ? val : {});
                    return (row.remediations || []).length;
                  }
                }
              ]}
              onRowClick={(risk) => { setSelectedEntity(risk); setEntityType('risks'); }}
            />
          </div>
        );

      case 'findings':
        return (
          <div className="poam-entity-section">
            {editMode && (
              <div style={{ marginBottom: '16px' }}>
                <button className="poam-toolbar-btn" onClick={() => { setSelectedEntity({}); setEntityType('findings'); }}>+ Add Finding</button>
              </div>
            )}
            <EntityTable
              entities={findings}
              columns={[
                { key: 'title', label: 'Title', sortable: true, filterable: true },
                { 
                  key: 'description', 
                  label: 'Description', 
                  render: (val, item) => {
                    const row = item || (typeof val === 'object' ? val : {});
                    const desc = row.description || (typeof val === 'string' ? val : '');
                    return desc ? (desc.length > 50 ? desc.substring(0, 50) + '...' : desc) : '—';
                  } 
                }
              ]}
              onRowClick={(finding) => { setSelectedEntity(finding); setEntityType('findings'); }}
            />
          </div>
        );

      case 'metadata':
        return (
          <div className="poam-metadata-section" style={{ padding: '24px' }}>
            <MetadataEditor 
              metadata={poam.metadata || {}} 
              onChange={(newMeta) => updateRootField('metadata', newMeta)} 
              readOnly={!editMode} 
            />
            <div style={{ marginTop: '24px' }}>
              <PropsEditor 
                props={poam.props || []} 
                onChange={(newProps) => updateRootField('props', newProps)} 
                readOnly={!editMode} 
              />
            </div>
            <div style={{ marginTop: '24px' }}>
              <BackMatterEditor 
                backMatter={poam['back-matter'] || {}} 
                onChange={(newBm) => updateRootField('back-matter', newBm)} 
                readOnly={!editMode} 
              />
            </div>
          </div>
        );

      case 'local-definitions':
        const localDefs = poam['local-definitions'] || {};
        const components = localDefs.components || [];
        const inventoryItems = localDefs['inventory-items'] || [];
        const users = localDefs.users || [];
        
        return (
          <div className="poam-entity-section">
            <h2 style={{ marginTop: 0 }}>Components</h2>
            {editMode && (
              <div style={{ marginBottom: '16px' }}>
                <button className="poam-toolbar-btn" onClick={() => { setSelectedEntity({}); setEntityType('components'); }}>+ Add Component</button>
              </div>
            )}
            <EntityTable
              entities={components}
              columns={[
                { key: 'title', label: 'Title', sortable: true, filterable: true },
                { key: 'type', label: 'Type', sortable: true, filterable: true },
                { 
                  key: 'description', 
                  label: 'Description', 
                  render: (val, item) => {
                    const row = item || (typeof val === 'object' ? val : {});
                    const desc = row.description || (typeof val === 'string' ? val : '');
                    return desc ? (desc.length > 50 ? desc.substring(0, 50) + '...' : desc) : '—';
                  } 
                }
              ]}
              onRowClick={(comp) => { setSelectedEntity(comp); setEntityType('components'); }}
            />
            
            <h2 style={{ marginTop: '32px' }}>Inventory Items</h2>
            {editMode && (
              <div style={{ marginBottom: '16px' }}>
                <button className="poam-toolbar-btn" onClick={() => { setSelectedEntity({}); setEntityType('inventory-items'); }}>+ Add Inventory Item</button>
              </div>
            )}
            <EntityTable
              entities={inventoryItems}
              columns={[
                { 
                  key: 'description', 
                  label: 'Description', 
                  render: (val, item) => {
                    const row = item || (typeof val === 'object' ? val : {});
                    const desc = row.description || (typeof val === 'string' ? val : '');
                    return desc ? (desc.length > 50 ? desc.substring(0, 50) + '...' : desc) : '—';
                  } 
                },
                { 
                  key: 'asset-id', 
                  label: 'Asset ID', 
                  render: (val, item) => {
                    const row = item || (typeof val === 'object' ? val : {});
                    return row['asset-id'] || (typeof val === 'string' ? val : '—');
                  } 
                }
              ]}
              onRowClick={(item) => { setSelectedEntity(item); setEntityType('inventory-items'); }}
            />

            <h2 style={{ marginTop: '32px' }}>Users</h2>
            {editMode && (
              <div style={{ marginBottom: '16px' }}>
                <button className="poam-toolbar-btn" onClick={() => { setSelectedEntity({}); setEntityType('users'); }}>+ Add User</button>
              </div>
            )}
            <EntityTable
              entities={users}
              columns={[
                { key: 'title', label: 'Title', sortable: true, filterable: true },
                { key: 'role-ids', label: 'Roles', render: (u) => (u['role-ids'] || []).join(', ') }
              ]}
              onRowClick={(user) => { setSelectedEntity(user); setEntityType('users'); }}
            />
          </div>
        );

      case 'json':
        return (
          <JsonEditor 
            value={doc} 
            onChange={setDoc} 
            readOnly={!editMode} 
          />
        );

      default:
        return null;
    }
  };

  const renderEntityEditor = () => {
    if (!selectedEntity) return null;
    const commonProps = {
      item: selectedEntity,
      onClose: () => setSelectedEntity(null),
      onSave: editMode ? (newEntity) => handleEntityEdit(entityType, selectedEntity, newEntity) : undefined,
      readOnly: !editMode,
      doc: poam
    };
    if (entityType === 'poam-items') return <PoamItemEditor {...commonProps} />;
    if (entityType === 'risks') return <RiskEditor {...commonProps} />;
    if (entityType === 'observations') return <ObservationEditor {...commonProps} />;
    if (entityType === 'findings') return <FindingEditor {...commonProps} />;
    if (entityType === 'components') return <ComponentEditor {...commonProps} />;
    if (entityType === 'inventory-items') return <InventoryItemEditor {...commonProps} />;
    if (entityType === 'users') return <UserEditor {...commonProps} />;
    return null;
  };

  return (
    <div className="poam-page-container">
      <DocumentToolbar
        title={title}
        version={version}
        isEditing={editMode}
        onToggleEdit={() => {
          const next = !editMode;
          setEditMode(next);
          const params = new URLSearchParams(window.location.search);
          if (next) {
            params.set('edit', 'true');
          } else {
            params.delete('edit');
          }
          const newSearch = params.toString() ? `?${params.toString()}` : '';
          window.history.replaceState(null, '', window.location.pathname + newSearch);
        }}
        onSave={() => handleSave()}
        onCancel={handleDiscardChanges}
        onSaveVersion={() => setShowVersionHistory(true)}
        onBack={onClose}
        mode="poam"
      />
      
      <div className="poam-layout">
        <div className="poam-tabs-sidebar">
          <button className={`poam-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            Dashboard
          </button>
          <button className={`poam-tab ${activeTab === 'items' ? 'active' : ''}`} onClick={() => setActiveTab('items')}>
            POA&M Items
          </button>
          <button className={`poam-tab ${activeTab === 'observations' ? 'active' : ''}`} onClick={() => setActiveTab('observations')}>
            Observations
          </button>
          <button className={`poam-tab ${activeTab === 'risks' ? 'active' : ''}`} onClick={() => setActiveTab('risks')}>
            Risks
          </button>
          <button className={`poam-tab ${activeTab === 'findings' ? 'active' : ''}`} onClick={() => setActiveTab('findings')}>
            Findings
          </button>
          <button className={`poam-tab ${activeTab === 'local-definitions' ? 'active' : ''}`} onClick={() => setActiveTab('local-definitions')}>
            Local Definitions
          </button>
          <button className={`poam-tab ${activeTab === 'metadata' ? 'active' : ''}`} onClick={() => setActiveTab('metadata')}>
            Metadata
          </button>
          <button className={`poam-tab ${activeTab === 'json' ? 'active' : ''}`} onClick={() => setActiveTab('json')}>
            JSON View
          </button>
        </div>
        
        <div className="poam-content-area">
          {renderContent()}
        </div>
      </div>
      
      {renderEntityEditor()}
      {showArImport && <ArImportModal onClose={() => setShowArImport(false)} onImport={handleArImport} />}
      
      <VersionDrawer
        isOpen={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        documentId={poamId}
        stage="poams"
        currentDoc={doc}
        onRestore={(restored) => {
          setDoc(restored);
          setShowVersionHistory(false);
          handleSave(restored);
        }}
      />
    </div>
  );
}
