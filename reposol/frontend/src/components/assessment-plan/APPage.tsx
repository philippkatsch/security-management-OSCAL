import { TaskEditor } from '@components/shared/entity/TaskEditor';
import React, { useState, useMemo, useRef } from 'react';
import { toast } from 'react-hot-toast';
import styles from './APPage.module.css';
import sharedStyles from '@components/shared/SharedComponents.module.css';

import { useDocumentLifecycle } from '@hooks/useDocumentLifecycle';
import { DocumentPageLayout } from '../layout/DocumentPageLayout';
import { MetadataEditor } from '@components/shared/MetadataEditor';
import { StandardMetadataTab } from '@components/shared/tabs/StandardMetadataTab';
import { JsonEditor } from '@components/shared/JsonEditor';
import { PropsEditor } from '@components/shared/PropsEditor';
import { BackMatterEditor } from '@components/shared/BackMatterEditor';
import { LinksEditor } from '@components/shared/LinksEditor';

import EntityTable from '@components/shared/entity/EntityTable';
import EntityDetailPanel from '@components/shared/entity/EntityDetailPanel';
import MetricCard from '@components/shared/dashboard/MetricCard';
import MetricCardGrid from '@components/shared/dashboard/MetricCardGrid';
import CompletenessReport from '@components/shared/dashboard/CompletenessReport';

const generateUUID = () => {
  return typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : 'uuid-' + Math.random().toString(36).substr(2, 9);
};

import { TermsAndConditionsEditor } from '@components/shared/assessment/TermsAndConditionsEditor';
import { ActivityEditor } from '@components/shared/assessment/ActivityEditor';
export interface APPageProps {
  apId?: string;
  initialIsEditing?: boolean;
  initialEditMode?: boolean;
  onClose?: () => void;
}

export function APPage({ apId = '', initialIsEditing = false, initialEditMode, onClose }: APPageProps) {
  const isEdit = initialIsEditing || initialEditMode || false;
  const lifecycle = useDocumentLifecycle('assessment-plans', 'assessment-plan', apId, isEdit);
  const {
    activeDoc,
    setDoc,
    isEditing,
    pushUndoRedoState,
  } = lifecycle;

  const [activeTab, setActiveTab] = useState('overview');

  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [selectedComponent, setSelectedComponent] = useState<any>(null);
  const [selectedInventory, setSelectedInventory] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<any>(null);
  const jsonEditorRef = useRef<any>(null);

  const [editingSspHref, setEditingSspHref] = useState(false);
  const [sspHrefValue, setSspHrefValue] = useState('');

  const ap = activeDoc?.['assessment-plan'];

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

  const componentsData = useMemo(() => {
    return (ap?.['local-definitions']?.components || []).map(c => ({
      ...c,
      id: c.uuid,
    }));
  }, [ap?.['local-definitions']?.components]);

  const inventoryData = useMemo(() => {
    return (ap?.['local-definitions']?.['inventory-items'] || []).map(i => ({
      ...i,
      id: i.uuid,
    }));
  }, [ap?.['local-definitions']?.['inventory-items']]);

  const usersData = useMemo(() => {
    return (ap?.['local-definitions']?.users || []).map(u => ({
      ...u,
      id: u.uuid,
      rolesStr: (u['role-ids'] || []).join(', ')
    }));
  }, [ap?.['local-definitions']?.users]);

  const platformsData = useMemo(() => {
    return (ap?.['assessment-assets']?.['assessment-platforms'] || []).map(p => ({
      ...p,
      id: p.uuid,
      usesStr: (p['uses-components'] || []).length
    }));
  }, [ap?.['assessment-assets']?.['assessment-platforms']]);

  const teamData = useMemo(() => {
    return (ap?.['assessment-assets']?.['assessment-team'] || []).map(p => ({
      ...p,
      id: p.uuid || generateUUID(),
      rolesStr: (p['role-ids'] || []).join(', ')
    }));
  }, [ap?.['assessment-assets']?.['assessment-team']]);

  const reviewedControls = ap?.['reviewed-controls']?.['control-selections'] || [];
  const objectiveSelections = ap?.['reviewed-controls']?.['control-objective-selections'] || [];

  const handleUpdateAP = (updatedAP) => {
    const nextDoc = { ...activeDoc, 'assessment-plan': updatedAP };
    setDoc(nextDoc);
    pushUndoRedoState(nextDoc);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'reviewed-controls', label: 'Reviewed Controls', icon: '🛡️' },
    { id: 'activities-tasks', label: 'Activity Tasks', icon: '📋' },
    { id: 'local-definitions', label: 'Local Definitions', icon: '📦' },
    { id: 'assessment-subjects', label: 'Subjects Scope', icon: '🎯' },
    { id: 'assessment-assets', label: 'Assessment Assets', icon: '🏷️' },
    { id: 'terms-and-conditions', label: 'Terms & Conditions', icon: '📜' },
    { id: 'metadata', label: 'Metadata', icon: 'ℹ️' },
    { id: 'json', label: 'JSON Editor', icon: '⚡' },
  ];

  return (
    <DocumentPageLayout
      stage="assessment-plans"
      docId={apId}
      lifecycle={lifecycle}
      title={ap?.metadata?.title || 'Untitled Assessment Plan'}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(newTab) => {
        if (activeTab === 'json' && newTab !== 'json' && ap) {
          const entityId = jsonEditorRef.current?.getCursorEntityId?.();
          if (entityId) {
            const task = (ap.tasks || []).find((t: any) => t.uuid === entityId);
            if (task) setSelectedTask(task);
            else {
              const activity = (ap?.['local-definitions']?.activities || []).find((a: any) => a.uuid === entityId);
              if (activity) setSelectedActivity(activity);
            }
          }
        }
        setActiveTab(newTab);
      }}
      onClose={onClose}
    >
      {ap?.['import-ssp'] && (
        <div className={styles['ssp-reference-banner']}>
          <div className={styles['ssp-reference-content']}>
            <strong>Referenced SSP:</strong> {ap['import-ssp'].href}
          </div>
          {isEditing && (
            editingSspHref ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={sspHrefValue}
                  onChange={(e) => setSspHrefValue(e.target.value)}
                  style={{ padding: '4px 8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #45475a', background: '#181825', color: '#cdd6f4' }}
                />
                <button className={styles['btn-edit-ssp']} onClick={() => {
                  if (sspHrefValue.trim()) {
                    handleUpdateAP({ ...ap, 'import-ssp': { ...ap['import-ssp'], href: sspHrefValue.trim() } });
                    toast.success('SSP reference updated');
                  }
                  setEditingSspHref(false);
                }}>Save</button>
                <button type="button" onClick={() => setEditingSspHref(false)} style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
              </div>
            ) : (
              <button className={styles['btn-edit-ssp']} onClick={() => {
                setSspHrefValue(ap['import-ssp'].href || '');
                setEditingSspHref(true);
              }}>Edit Reference</button>
            )
          )}
        </div>
      )}

      <div className={styles['ap-content']}>
        {activeTab === 'overview' && (
          <div className={styles['tab-pane']}>
            <h2 className={styles['ap-section-title']}>Assessment Plan Overview</h2>
            <MetricCardGrid>
              <MetricCard title="Tasks" value={(ap?.tasks || []).length} icon="📋" />
              <MetricCard title="Activities" value={(ap?.['local-definitions']?.activities || []).length} icon="⚡" />
              <MetricCard title="Subjects" value={(ap?.['assessment-subjects'] || []).length} icon="🎯" />
              <MetricCard title="Objectives" value={(ap?.['local-definitions']?.['objectives-and-methods'] || []).length} icon="🎯" />
            </MetricCardGrid>

            <div style={{ marginTop: '24px' }}>
              <CompletenessReport sections={completenessSections} title="Plan Completeness" />
            </div>
          </div>
        )}

        {activeTab === 'reviewed-controls' && (
          <div className={styles['tab-pane']}>
            <h2 className={styles['ap-section-title']}>Reviewed Controls</h2>
            {reviewedControls.length === 0 ? (
              <div className={sharedStyles['empty-state']}>No controls selected for review.</div>
            ) : (
              reviewedControls.map((selection, i) => (
                <div key={selection.uuid || selection['control-id'] || `rev-${i}`} className={styles['control-selection-card']}>
                  <h4>Selection {i + 1}</h4>
                  {selection['include-all'] ? (
                    <p>Includes all controls from SSP</p>
                  ) : (
                    <div className={styles['control-tags']}>
                      {(selection['include-controls'] || []).map((c, j) => (
                        <span key={c['control-id'] || c.uuid || `ctrl-${j}`} className={styles['control-tag']}>{c['control-id']}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}

            <h2 className={styles['ap-section-title']} style={{ marginTop: '32px' }}>Control Objective Selections</h2>
            {objectiveSelections.length === 0 ? (
              <div className={sharedStyles['empty-state']}>No objective selections defined.</div>
            ) : (
              objectiveSelections.map((selection, i) => (
                <div key={selection.uuid || `obj-sel-${i}`} className={styles['control-selection-card']}>
                  <h4>Objective Selection {i + 1}</h4>
                  {selection['include-all'] ? (
                    <p>Includes all control objectives</p>
                  ) : (
                    <div className={styles['control-tags']}>
                      {(selection['include-objectives'] || []).map((o, j) => (
                        <span key={o['objective-id'] || o.uuid || `obj-${j}`} className={styles['control-tag']}>{o['objective-id']}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}

            <h2 className={styles['ap-section-title']} style={{ marginTop: '32px' }}>Objectives & Methods</h2>
            <div className={styles['objectives-list']}>
              {(ap?.['local-definitions']?.['objectives-and-methods'] || []).length === 0 ? (
                <div className={sharedStyles['empty-state']}>No objectives and methods defined.</div>
              ) : (
                (ap['local-definitions']['objectives-and-methods']).map((obj, i) => (
                  <div key={obj.uuid || obj['control-id'] || `om-${i}`} className={styles['objective-card']}>
                    <h4>Control: {obj['control-id']}</h4>
                    <p>{obj.description}</p>
                    <div className={styles['objective-parts']}>
                      {(obj.parts || []).map((p, j) => (
                        <div key={p.uuid || p.name || `part-${j}`} className={styles['objective-part']}>
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
          <div className={styles['tab-pane']}>
            <h2 className={styles['ap-section-title']}>Tasks</h2>
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

            <h2 className={styles['ap-section-title']} style={{ marginTop: '32px' }}>Activities</h2>
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

        {activeTab === 'local-definitions' && (
          <div className={styles['tab-pane']}>
            <h2 className={styles['ap-section-title']}>Components</h2>
            <EntityTable
              data={componentsData}
              columns={[
                { key: 'title', label: 'Title' },
                { key: 'type', label: 'Type' },
                { key: 'description', label: 'Description' },
                { key: 'status', label: 'Status', render: (_, c) => c.status?.state }
              ]}
              onRowClick={setSelectedComponent}
            />
            <h2 className={styles['ap-section-title']} style={{ marginTop: '32px' }}>Inventory Items</h2>
            <EntityTable
              data={inventoryData}
              columns={[
                { key: 'description', label: 'Description' },
                { key: 'implemented-components', label: 'Implemented Components', render: (_, i) => (i['implemented-components'] || []).length }
              ]}
              onRowClick={setSelectedInventory}
            />
            <h2 className={styles['ap-section-title']} style={{ marginTop: '32px' }}>Users</h2>
            <EntityTable
              data={usersData}
              columns={[
                { key: 'title', label: 'Title' },
                { key: 'rolesStr', label: 'Roles' }
              ]}
              onRowClick={setSelectedUser}
            />
          </div>
        )}

        {activeTab === 'assessment-subjects' && (
          <div className={styles['tab-pane']}>
            <h2 className={styles['ap-section-title']}>Assessment Subjects</h2>
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

        {activeTab === 'assessment-assets' && (
          <div className={styles['tab-pane']}>
            <h2 className={styles['ap-section-title']}>Assessment Platforms</h2>
            <EntityTable
              data={platformsData}
              columns={[
                { key: 'title', label: 'Title' },
                { key: 'usesStr', label: 'Uses Components' }
              ]}
              onRowClick={setSelectedPlatform}
            />
            <h2 className={styles['ap-section-title']} style={{ marginTop: '32px' }}>Assessment Team</h2>
            <EntityTable
              data={teamData}
              columns={[
                { key: 'title', label: 'Title' },
                { key: 'rolesStr', label: 'Roles' }
              ]}
              onRowClick={() => {}}
            />
          </div>
        )}

        {activeTab === 'terms-and-conditions' && (
          <div className={styles['tab-pane']}>
            <h2 className={styles['ap-section-title']}>Terms & Conditions</h2>
            <TermsAndConditionsEditor 
              terms={ap?.['terms-and-conditions'] || { parts: [] }} 
              onChange={(tc) => handleUpdateAP({ ...ap, 'terms-and-conditions': tc })}
              readOnly={!isEditing}
            />
          </div>
        )}

        {activeTab === 'metadata' && (
          <div className={styles['tab-pane']}>
            <h2 className={styles['ap-section-title']}>Metadata</h2>
            <StandardMetadataTab 
              document={activeDoc['assessment-plan']} 
              onChange={handleUpdateAP} 
            />
          </div>
        )}

        {activeTab === 'json' && (
          <div className={styles['tab-pane']}>
            <JsonEditor
              ref={jsonEditorRef}
              value={activeDoc}
              onChange={(nextDoc) => { setDoc(nextDoc); pushUndoRedoState(nextDoc); }}
              readOnly={!isEditing}
              highlightId={selectedTask?.uuid || selectedActivity?.uuid || selectedSubject?.uuid || selectedComponent?.uuid || null}
            />
          </div>
        )}
      </div>

      {selectedTask && (
        <TaskEditor
          task={selectedTask}
          onChange={(updatedTask) => {
            const newTasks = (ap.tasks || []).map(t => t.uuid === updatedTask.uuid ? updatedTask : t);
            handleUpdateAP({ ...ap, tasks: newTasks });
            setSelectedTask(updatedTask);
          }}
          onClose={() => setSelectedTask(null)}
          readOnly={!isEditing}
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
          readOnly={!isEditing}
        />
      )}

      {selectedSubject && (
        <EntityDetailPanel
          isOpen={Boolean(selectedSubject)}
          title="Subject Details"
          entity={selectedSubject}
          onClose={() => setSelectedSubject(null)}
          readOnly={!isEditing}
        />
      )}

      {selectedComponent && (
        <EntityDetailPanel
          isOpen={Boolean(selectedComponent)}
          title="Component Details"
          entity={selectedComponent}
          onClose={() => setSelectedComponent(null)}
          readOnly={!isEditing}
        />
      )}

      {selectedInventory && (
        <EntityDetailPanel
          isOpen={Boolean(selectedInventory)}
          title="Inventory Item Details"
          entity={selectedInventory}
          onClose={() => setSelectedInventory(null)}
          readOnly={!isEditing}
        />
      )}

      {selectedUser && (
        <EntityDetailPanel
          isOpen={Boolean(selectedUser)}
          title="User Details"
          entity={selectedUser}
          onClose={() => setSelectedUser(null)}
          readOnly={!isEditing}
        />
      )}

      {selectedPlatform && (
        <EntityDetailPanel
          isOpen={Boolean(selectedPlatform)}
          title="Assessment Platform Details"
          entity={selectedPlatform}
          onClose={() => setSelectedPlatform(null)}
          readOnly={!isEditing}
        />
      )}
    </DocumentPageLayout>
  );
}

export default APPage;

