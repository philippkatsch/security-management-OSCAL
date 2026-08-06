import React, { useState, useMemo, useEffect } from 'react';
import './APPage.css';

import { DocumentToolbar } from '../shared/DocumentToolbar';
import { VersionDrawer } from '../shared/VersionDrawer';
import { MetadataEditor } from '../shared/MetadataEditor';
import { JsonEditor } from '../shared/JsonEditor';
import { PropsEditor } from '../shared/PropsEditor';
import { BackMatterEditor } from '../shared/BackMatterEditor';
import { LinksEditor } from '../shared/LinksEditor';

import StatusBadge from '../shared/status/StatusBadge';
import EntityTable from '../shared/entity/EntityTable';
import EntityDetailPanel from '../shared/entity/EntityDetailPanel';
import MetricCard from '../shared/dashboard/MetricCard';
import MetricCardGrid from '../shared/dashboard/MetricCardGrid';
import ProgressBar from '../shared/dashboard/ProgressBar';
import StatusBreakdown from '../shared/dashboard/StatusBreakdown';
import CompletenessReport from '../shared/dashboard/CompletenessReport';

import { useDocument } from '../../hooks/useDocument';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { useVersions } from '../../hooks/useVersions';

const generateUUID = () => {
  return typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : 'uuid-' + Math.random().toString(36).substr(2, 9);
};

function PartNode({ part, onChange, onRemove, readOnly }) {
  const COMMON_PART_NAMES = ['rules-of-engagement', 'assumptions', 'methodology', 'disclosures', 'assessment-inclusions', 'assessment-exclusions'];
  const handleChildChange = (idx, newChild) => {
    const newParts = [...(part.parts || [])];
    newParts[idx] = newChild;
    onChange({ ...part, parts: newParts });
  };
  const handleAddChild = () => {
    const newParts = [...(part.parts || []), { id: generateUUID(), name: 'item', title: 'New Sub-part', prose: '' }];
    onChange({ ...part, parts: newParts });
  };
  const handleRemoveChild = (idx) => {
    const newParts = [...(part.parts || [])];
    newParts.splice(idx, 1);
    onChange({ ...part, parts: newParts });
  };

  return (
    <div className="tc-part">
      <div className="tc-part-header">
        <input 
          className="tc-input"
          value={part.title || ''} 
          onChange={e => onChange({ ...part, title: e.target.value })}
          readOnly={readOnly}
          placeholder="Part Title"
        />
        <select 
          className="tc-select"
          value={part.name || ''} 
          onChange={e => onChange({ ...part, name: e.target.value })}
          disabled={readOnly}
        >
          <option value="item">item</option>
          {COMMON_PART_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {!readOnly && <button className="btn-remove" onClick={onRemove}>Remove</button>}
      </div>
      <textarea 
        className="tc-textarea"
        value={part.prose || ''} 
        onChange={e => onChange({ ...part, prose: e.target.value })}
        readOnly={readOnly}
        placeholder="Prose (Markdown supported)..."
      />
      <div className="tc-part-children">
        {(part.parts || []).map((child, i) => (
          <PartNode 
            key={child.id || i} 
            part={child} 
            onChange={(c) => handleChildChange(i, c)} 
            onRemove={() => handleRemoveChild(i)}
            readOnly={readOnly}
          />
        ))}
        {!readOnly && <button onClick={handleAddChild} className="btn-add-child">+ Add Sub-part</button>}
      </div>
    </div>
  );
}

function TermsAndConditionsEditor({ terms, onChange, readOnly }) {
  const parts = terms?.parts || [];
  
  const handlePartChange = (idx, newPart) => {
    const newParts = [...parts];
    newParts[idx] = newPart;
    onChange({ ...terms, parts: newParts });
  };
  
  const handleAddPart = () => {
    const newParts = [...parts, { id: generateUUID(), name: 'rules-of-engagement', title: 'New Rules', prose: '' }];
    onChange({ ...terms, parts: newParts });
  };

  const handleRemovePart = (idx) => {
    const newParts = [...parts];
    newParts.splice(idx, 1);
    onChange({ ...terms, parts: newParts });
  };

  return (
    <div className="tc-editor">
      {parts.map((p, i) => (
        <PartNode 
          key={p.id || i} 
          part={p} 
          onChange={(newP) => handlePartChange(i, newP)} 
          onRemove={() => handleRemovePart(i)}
          readOnly={readOnly}
        />
      ))}
      {!readOnly && <button onClick={handleAddPart} className="btn-add-part">+ Add Terms Part</button>}
    </div>
  );
}

function TaskEditor({ task, onChange, readOnly, onClose }) {
  const update = (changes) => onChange({ ...task, ...changes });
  const timingType = task.timing?.['within-date-range'] ? 'range' :
                     task.timing?.['on-date'] ? 'date' :
                     task.timing?.['at-frequency'] ? 'frequency' : 'none';

  return (
    <div className="custom-detail-panel">
      <div className="panel-header">
        <h3>Task Details</h3>
        <button className="btn-close" onClick={onClose}>&times;</button>
      </div>
      <div className="panel-content">
        <div className="form-group">
          <label>Title</label>
          <input className="form-control" value={task.title || ''} onChange={e => update({ title: e.target.value })} disabled={readOnly} />
        </div>
        <div className="form-group">
          <label>Type</label>
          <select className="form-control" value={task.type || ''} onChange={e => update({ type: e.target.value })} disabled={readOnly}>
            <option value="milestone">Milestone</option>
            <option value="action">Action</option>
          </select>
        </div>
        <div className="form-group">
          <label>Timing</label>
          <select className="form-control" value={timingType} onChange={e => {
            const t = e.target.value;
            let newTiming = undefined;
            if (t === 'range') newTiming = { 'within-date-range': { start: '', end: '' } };
            if (t === 'date') newTiming = { 'on-date': { date: '' } };
            if (t === 'frequency') newTiming = { 'at-frequency': { period: 1, unit: 'days' } };
            update({ timing: newTiming });
          }} disabled={readOnly}>
            <option value="none">None</option>
            <option value="range">Date Range</option>
            <option value="date">Specific Date</option>
            <option value="frequency">Frequency</option>
          </select>
        </div>
        {timingType === 'range' && (
          <div className="timing-inputs">
            <input type="date" className="form-control mb-2" value={task.timing['within-date-range'].start || ''} onChange={e => update({ timing: { ...task.timing, 'within-date-range': { ...task.timing['within-date-range'], start: e.target.value } } })} disabled={readOnly} />
            <input type="date" className="form-control" value={task.timing['within-date-range'].end || ''} onChange={e => update({ timing: { ...task.timing, 'within-date-range': { ...task.timing['within-date-range'], end: e.target.value } } })} disabled={readOnly} />
          </div>
        )}
        {timingType === 'date' && (
          <input type="date" className="form-control" value={task.timing['on-date'].date || ''} onChange={e => update({ timing: { 'on-date': { date: e.target.value } } })} disabled={readOnly} />
        )}
        {timingType === 'frequency' && (
          <div className="timing-inputs">
            <input type="number" className="form-control mb-2" value={task.timing['at-frequency'].period || 1} onChange={e => update({ timing: { 'at-frequency': { ...task.timing['at-frequency'], period: parseInt(e.target.value, 10) } } })} disabled={readOnly} />
            <select className="form-control" value={task.timing['at-frequency'].unit || 'days'} onChange={e => update({ timing: { 'at-frequency': { ...task.timing['at-frequency'], unit: e.target.value } } })} disabled={readOnly}>
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
              <option value="months">Months</option>
              <option value="years">Years</option>
            </select>
          </div>
        )}
        <div className="form-group">
          <label>Dependencies (Task UUIDs)</label>
          <input className="form-control" placeholder="Comma separated UUIDs" value={(task.dependencies || []).map(d => d['task-uuid']).join(', ')} onChange={e => {
            const uuids = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
            update({ dependencies: uuids.map(u => ({ 'task-uuid': u })) });
          }} disabled={readOnly} />
        </div>
        <div className="form-group">
          <label>Responsible Roles</label>
          <input className="form-control" placeholder="Comma separated role IDs" value={(task['responsible-roles'] || []).map(r => r['role-id']).join(', ')} onChange={e => {
            const roles = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
            update({ 'responsible-roles': roles.map(r => ({ 'role-id': r })) });
          }} disabled={readOnly} />
        </div>
      </div>
    </div>
  );
}

function ActivityEditor({ activity, onChange, readOnly, onClose }) {
  const update = (changes) => onChange({ ...activity, ...changes });
  const methodProps = (activity.props || []).filter(p => p.name === 'method');
  const method = methodProps.length > 0 ? methodProps[0].value : '';

  const handleMethodChange = (newMethod) => {
    const otherProps = (activity.props || []).filter(p => p.name !== 'method');
    const newProps = newMethod ? [...otherProps, { name: 'method', value: newMethod }] : otherProps;
    update({ props: newProps });
  };

  const handleStepChange = (idx, newStep) => {
    const newSteps = [...(activity.steps || [])];
    newSteps[idx] = newStep;
    update({ steps: newSteps });
  };
  const handleAddStep = () => {
    const newSteps = [...(activity.steps || []), { uuid: generateUUID(), title: 'New Step', description: '' }];
    update({ steps: newSteps });
  };
  const handleRemoveStep = (idx) => {
    const newSteps = [...(activity.steps || [])];
    newSteps.splice(idx, 1);
    update({ steps: newSteps });
  };

  return (
    <div className="custom-detail-panel">
      <div className="panel-header">
        <h3>Activity Details</h3>
        <button className="btn-close" onClick={onClose}>&times;</button>
      </div>
      <div className="panel-content">
        <div className="form-group">
          <label>Title</label>
          <input className="form-control" value={activity.title || ''} onChange={e => update({ title: e.target.value })} disabled={readOnly} />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea className="form-control" value={activity.description || ''} onChange={e => update({ description: e.target.value })} disabled={readOnly} />
        </div>
        <div className="form-group">
          <label>Method</label>
          <select className="form-control" value={method} onChange={e => handleMethodChange(e.target.value)} disabled={readOnly}>
            <option value="">None</option>
            <option value="INTERVIEW">INTERVIEW</option>
            <option value="EXAMINE">EXAMINE</option>
            <option value="TEST">TEST</option>
          </select>
        </div>
        <div className="form-group">
          <label>Responsible Roles</label>
          <input className="form-control" placeholder="Comma separated role IDs" value={(activity['responsible-roles'] || []).map(r => r['role-id']).join(', ')} onChange={e => {
            const roles = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
            update({ 'responsible-roles': roles.map(r => ({ 'role-id': r })) });
          }} disabled={readOnly} />
        </div>
        <div className="form-group">
          <label>Steps</label>
          <div className="steps-list">
            {(activity.steps || []).map((step, i) => (
              <div key={step.uuid || i} className="step-item">
                <input className="form-control mb-2" value={step.title || ''} onChange={e => handleStepChange(i, { ...step, title: e.target.value })} placeholder="Step Title" disabled={readOnly} />
                <textarea className="form-control mb-2" value={step.description || ''} onChange={e => handleStepChange(i, { ...step, description: e.target.value })} placeholder="Step Description" disabled={readOnly} />
                {!readOnly && <button className="btn-remove" onClick={() => handleRemoveStep(i)}>Remove Step</button>}
              </div>
            ))}
            {!readOnly && <button className="btn-add-part" onClick={handleAddStep}>+ Add Step</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function APPage({ apId, initialEditMode, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [showVersions, setShowVersions] = useState(false);
  const [editMode, setEditMode] = useState(initialEditMode || false);

  const { doc, loading, error, saveDoc } = useDocument('assessment-plan', apId);
  const { current: state, pushState: set, undo, redo, canUndo, canRedo, reset } = useUndoRedo(doc);
  const { versions, fetchVersions, restoreVersion } = useVersions('assessment-plan', apId);

  useEffect(() => {
    if (doc && !state) {
      reset(doc);
    }
  }, [doc, state, reset]);

  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);

  const ap = state?.['assessment-plan'];

  const completenessSections = useMemo(() => {
    if (!ap) return [];
    return [
      { id: 'metadata', label: 'Metadata', required: true, isComplete: !!ap.metadata },
      { id: 'import-ssp', label: 'Imported SSP', required: true, isComplete: !!ap['import-ssp'] },
      { id: 'reviewed-controls', label: 'Reviewed Controls', required: true, isComplete: !!ap['reviewed-controls'] },
      { id: 'assessment-subjects', label: 'Assessment Subjects', required: true, isComplete: (ap['assessment-subjects'] || []).length > 0 },
      { id: 'tasks', label: 'Tasks', required: false, isComplete: (ap.tasks || []).length > 0 },
    ];
  }, [ap]);

  const tasksData = useMemo(() => {
    return (ap?.tasks || []).map(t => {
      let timingStr = 'No timing';
      if (t.timing?.['within-date-range']) {
        timingStr = `${t.timing['within-date-range'].start || '?'} - ${t.timing['within-date-range'].end || '?'}`;
      } else if (t.timing?.['on-date']) {
        timingStr = t.timing['on-date'].date || '?';
      } else if (t.timing?.['at-frequency']) {
        timingStr = `Every ${t.timing['at-frequency'].period} ${t.timing['at-frequency'].unit}`;
      }
      return {
        ...t,
        id: t.uuid,
        timingDisplay: timingStr,
        activitiesCount: (t['associated-activities'] || []).length
      };
    });
  }, [ap?.tasks]);

  const activitiesData = useMemo(() => {
    return (ap?.['local-definitions']?.activities || []).map(a => {
      const methods = (a.props || []).filter(p => p.name === 'method').map(p => p.value).join(', ');
      return {
        ...a,
        id: a.uuid,
        method: methods || 'None',
        stepCount: (a.steps || []).length
      };
    });
  }, [ap?.['local-definitions']?.activities]);

  const subjectsData = useMemo(() => {
    return (ap?.['assessment-subjects'] || []).map((s, idx) => ({
      ...s,
      id: s.uuid || `subject-${idx}`,
      scope: s['include-all'] ? 'All' : `${(s['include-subjects'] || []).length} specific subjects`
    }));
  }, [ap?.['assessment-subjects']]);

  const reviewedControls = ap?.['reviewed-controls']?.['control-selections'] || [];

  const handleUpdateAP = (updatedAP) => {
    set({ ...state, 'assessment-plan': updatedAP });
  };

  const handleSave = async () => {
    if (state) {
      await saveDoc(state);
      setEditMode(false);
    }
  };

  if (loading) return <div className="ap-page">Loading...</div>;
  if (error) return <div className="ap-page">Error: {error}</div>;
  if (!ap) return <div className="ap-page">No Assessment Plan found</div>;

  return (
    <div className="ap-page">
      <div className="ap-header">
        <h1>📅 {ap.metadata?.title || 'Untitled Assessment Plan'}</h1>
        <DocumentToolbar
          mode="assessment-plan"
          isEditing={editMode}
          onToggleEdit={() => {
            const next = !editMode;
            setEditMode(next);
            if (next) {
              if (!window.location.search.includes('edit=true')) window.history.replaceState(null, '', window.location.pathname + '?edit=true');
            } else {
              if (window.location.search.includes('edit=true')) window.history.replaceState(null, '', window.location.pathname);
            }
          }}
          onSave={handleSave}
          onCancel={() => { set(doc); setEditMode(false); }}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onSaveVersion={() => { setShowVersions(true); fetchVersions(); }}
          onBack={onClose}
        />
      </div>

      {ap['import-ssp'] && (
        <div className="ssp-reference-banner">
          <div className="ssp-reference-content">
            <strong>Referenced SSP:</strong> {ap['import-ssp'].href}
          </div>
          {editMode && (
            <button className="btn-edit-ssp" onClick={() => {
              const newHref = window.prompt('Enter new SSP href:', ap['import-ssp'].href);
              if (newHref) {
                handleUpdateAP({ ...ap, 'import-ssp': { ...ap['import-ssp'], href: newHref } });
              }
            }}>Edit Reference</button>
          )}
        </div>
      )}

      <div className="ap-body">
        <div className="ap-sidebar">
          <ul className="ap-sidebar-nav">
            <li className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>Overview</li>
            <li className={activeTab === 'reviewed-controls' ? 'active' : ''} onClick={() => setActiveTab('reviewed-controls')}>Reviewed Controls</li>
            <li className={activeTab === 'activities-tasks' ? 'active' : ''} onClick={() => setActiveTab('activities-tasks')}>Activities & Tasks</li>
            <li className={activeTab === 'assessment-subjects' ? 'active' : ''} onClick={() => setActiveTab('assessment-subjects')}>Assessment Subjects</li>
            <li className={activeTab === 'terms-and-conditions' ? 'active' : ''} onClick={() => setActiveTab('terms-and-conditions')}>Terms & Conditions</li>
            <li className={activeTab === 'metadata' ? 'active' : ''} onClick={() => setActiveTab('metadata')}>Metadata</li>
            <li className={activeTab === 'json' ? 'active' : ''} onClick={() => setActiveTab('json')}>JSON Editor</li>
          </ul>
        </div>

        <div className="ap-content">
          {activeTab === 'overview' && (
            <div className="tab-pane">
              <h2 className="ap-section-title">Assessment Plan Overview</h2>
              <MetricCardGrid>
                <MetricCard title="Tasks" value={(ap.tasks || []).length} icon="📋" />
                <MetricCard title="Activities" value={(ap['local-definitions']?.activities || []).length} icon="⚡" />
                <MetricCard title="Subjects" value={(ap['assessment-subjects'] || []).length} icon="🎯" />
                <MetricCard title="Objectives" value={(ap['local-definitions']?.['objectives-and-methods'] || []).length} icon="🎯" />
              </MetricCardGrid>

              <div style={{ marginTop: '24px' }}>
                <CompletenessReport sections={completenessSections} title="Plan Completeness" />
              </div>
            </div>
          )}

          {activeTab === 'reviewed-controls' && (
            <div className="tab-pane">
              <h2 className="ap-section-title">Reviewed Controls</h2>
              {reviewedControls.length === 0 ? (
                <div className="empty-state">No controls selected for review.</div>
              ) : (
                reviewedControls.map((selection, i) => (
                  <div key={i} className="control-selection-card">
                    <h4>Selection {i + 1}</h4>
                    {selection['include-all'] ? (
                      <p>Includes all controls from SSP</p>
                    ) : (
                      <div className="control-tags">
                        {(selection['include-controls'] || []).map((c, j) => (
                          <span key={j} className="control-tag">{c['control-id']}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}

              <h2 className="ap-section-title" style={{ marginTop: '32px' }}>Objectives & Methods</h2>
              <div className="objectives-list">
                {(ap?.['local-definitions']?.['objectives-and-methods'] || []).length === 0 ? (
                  <div className="empty-state">No objectives and methods defined.</div>
                ) : (
                  (ap['local-definitions']['objectives-and-methods']).map((obj, i) => (
                    <div key={obj.uuid || i} className="objective-card">
                      <h4>Control: {obj['control-id']}</h4>
                      <p>{obj.description}</p>
                      <div className="objective-parts">
                        {(obj.parts || []).map((p, j) => (
                          <div key={j} className="objective-part">
                            <strong>{p.name}:</strong> {p.prose || (p.parts && p.parts.length > 0 ? 'Has sub-parts' : '')}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'activities-tasks' && (
            <div className="tab-pane">
              <h2 className="ap-section-title">Tasks</h2>
              <EntityTable
                data={tasksData}
                columns={[
                  { key: 'title', label: 'Title' },
                  { key: 'type', label: 'Type' },
                  { key: 'timingDisplay', label: 'Timing' },
                  { key: 'activitiesCount', label: 'Associated Activities' }
                ]}
                onRowClick={setSelectedTask}
              />

              <h2 className="ap-section-title" style={{ marginTop: '32px' }}>Activities</h2>
              <EntityTable
                data={activitiesData}
                columns={[
                  { key: 'title', label: 'Title' },
                  { key: 'description', label: 'Description' },
                  { key: 'method', label: 'Method' },
                  { key: 'stepCount', label: 'Steps' }
                ]}
                onRowClick={setSelectedActivity}
              />
            </div>
          )}

          {activeTab === 'assessment-subjects' && (
            <div className="tab-pane">
              <h2 className="ap-section-title">Assessment Subjects</h2>
              <EntityTable
                data={subjectsData}
                columns={[
                  { key: 'type', label: 'Type' },
                  { key: 'description', label: 'Description' },
                  { key: 'scope', label: 'Scope' }
                ]}
                onRowClick={setSelectedSubject}
              />
            </div>
          )}

          {activeTab === 'terms-and-conditions' && (
            <div className="tab-pane">
              <h2 className="ap-section-title">Terms & Conditions</h2>
              <TermsAndConditionsEditor 
                terms={ap['terms-and-conditions'] || { parts: [] }} 
                onChange={(tc) => handleUpdateAP({ ...ap, 'terms-and-conditions': tc })}
                readOnly={!editMode}
              />
            </div>
          )}

          {activeTab === 'metadata' && (
            <div className="tab-pane">
              <h2 className="ap-section-title">Metadata</h2>
              <MetadataEditor
                metadata={ap.metadata || {}}
                onChange={(md) => handleUpdateAP({ ...ap, metadata: md })}
                readOnly={!editMode}
              />
              <PropsEditor
                propsList={ap.metadata?.props || []}
                onChange={(p) => handleUpdateAP({ ...ap, metadata: { ...ap.metadata, props: p } })}
                readOnly={!editMode}
              />
              <LinksEditor
                links={ap.metadata?.links || []}
                onChange={(l) => handleUpdateAP({ ...ap, metadata: { ...ap.metadata, links: l } })}
                readOnly={!editMode}
              />

              <h2 className="ap-section-title" style={{ marginTop: '32px' }}>Back Matter</h2>
              <BackMatterEditor
                backMatter={ap['back-matter']}
                onChange={(bm) => handleUpdateAP({ ...ap, 'back-matter': bm })}
                readOnly={!editMode}
              />
            </div>
          )}

          {activeTab === 'json' && (
            <div className="tab-pane">
              <JsonEditor
                data={state}
                onChange={set}
                readOnly={!editMode}
              />
            </div>
          )}
        </div>
      </div>

      {showVersions && (
        <VersionDrawer
          versions={versions}
          onClose={() => setShowVersions(false)}
          onRestore={async (v) => {
            await restoreVersion(v.version);
            setShowVersions(false);
          }}
        />
      )}
      
      {selectedTask && (
        <TaskEditor
          task={selectedTask}
          onChange={(updatedTask) => {
            const newTasks = (ap.tasks || []).map(t => t.uuid === updatedTask.uuid ? updatedTask : t);
            handleUpdateAP({ ...ap, tasks: newTasks });
            setSelectedTask(updatedTask);
          }}
          onClose={() => setSelectedTask(null)}
          readOnly={!editMode}
        />
      )}

      {selectedActivity && (
        <ActivityEditor
          activity={selectedActivity}
          onChange={(updatedAct) => {
            const newActs = (ap['local-definitions']?.activities || []).map(a => a.uuid === updatedAct.uuid ? updatedAct : a);
            handleUpdateAP({ ...ap, 'local-definitions': { ...ap['local-definitions'], activities: newActs } });
            setSelectedActivity(updatedAct);
          }}
          onClose={() => setSelectedActivity(null)}
          readOnly={!editMode}
        />
      )}

      {selectedSubject && (
        <EntityDetailPanel
          title="Subject Details"
          entity={selectedSubject}
          onClose={() => setSelectedSubject(null)}
          readOnly={!editMode}
        />
      )}
    </div>
  );
}
