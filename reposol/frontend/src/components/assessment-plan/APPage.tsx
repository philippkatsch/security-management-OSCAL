import { TaskEditor } from '@components/shared/entity/TaskEditor';
import React, { useState, useMemo } from 'react';
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
export function APPage({ apId, initialIsEditing, onClose }) {
  const lifecycle = useDocumentLifecycle('assessment-plans', 'assessment-plan', apId, initialIsEditing);
  const {
    activeDoc,
    setDoc,
    isEditing,
    pushUndoRedoState,
  } = lifecycle;

  const [activeTab, setActiveTab] = useState('overview');

  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [selectedInventory, setSelectedInventory] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState(null);

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
    { id: 'overview', label: 'Overview' },
    { id: 'reviewed-controls', label: 'Reviewed Controls' },
    { id: 'activities-tasks', label: 'Activities & Tasks' },
    { id: 'local-definitions', label: 'Local Definitions' },
    { id: 'assessment-subjects', label: 'Assessment Subjects' },
    { id: 'assessment-assets', label: 'Assessment Assets' },
    { id: 'terms-and-conditions', label: 'Terms & Conditions' },
    { id: 'metadata', label: 'Metadata' },
    { id: 'json', label: 'JSON Source' }
  ];

  return (
    <DocumentPageLayout
      stage="assessment-plans"
      docId={apId}
      lifecycle={lifecycle}
      title={ap?.metadata?.title || 'Untitled Assessment Plan'}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClose={onClose}
    >
      {ap?.['import-ssp'] && (
        <div className={styles['ssp-reference-banner']}>
          <div className={styles['ssp-reference-content']}>
            <strong>Referenced SSP:</strong> {ap['import-ssp'].href}
          </div>
          {isEditing && (
            <button className={styles['btn-edit-ssp']} onClick={() => {
              const newHref = window.prompt('Enter new SSP href:', ap['import-ssp'].href);
              if (newHref) {
                handleUpdateAP({ ...ap, 'import-ssp': { ...ap['import-ssp'], href: newHref } });
              }
            }}>Edit Reference</button>
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
                <div key={i} className={styles['control-selection-card']}>
                  <h4>Selection {i + 1}</h4>
                  {selection['include-all'] ? (
                    <p>Includes all controls from SSP</p>
                  ) : (
                    <div className={styles['control-tags']}>
                      {(selection['include-controls'] || []).map((c, j) => (
                        <span key={j} className={styles['control-tag']}>{c['control-id']}</span>
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
                <div key={i} className={styles['control-selection-card']}>
                  <h4>Objective Selection {i + 1}</h4>
                  {selection['include-all'] ? (
                    <p>Includes all control objectives</p>
                  ) : (
                    <div className={styles['control-tags']}>
                      {(selection['include-objectives'] || []).map((o, j) => (
                        <span key={j} className={styles['control-tag']}>{o['objective-id']}</span>
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
                  <div key={obj.uuid || i} className={styles['objective-card']}>
                    <h4>Control: {obj['control-id']}</h4>
                    <p>{obj.description}</p>
                    <div className={styles['objective-parts']}>
                      {(obj.parts || []).map((p, j) => (
                        <div key={j} className={styles['objective-part']}>
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
              onChange={(updated) => {
                const newDoc = { ...activeDoc };
                newDoc['assessment-plan'] = updated;
                handleUpdate(newDoc);
              }} 
            />
          </div>
        )}

        {activeTab === 'json' && (
          <div className={styles['tab-pane']}>
            <JsonEditor
              value={activeDoc}
              onChange={(nextDoc) => { setDoc(nextDoc); pushUndoRedoState(nextDoc); }}
              readOnly={!isEditing}
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
          title="Subject Details"
          entity={selectedSubject}
          onClose={() => setSelectedSubject(null)}
          readOnly={!isEditing}
        />
      )}

      {selectedComponent && (
        <EntityDetailPanel
          title="Component Details"
          entity={selectedComponent}
          onClose={() => setSelectedComponent(null)}
          readOnly={!isEditing}
        />
      )}

      {selectedInventory && (
        <EntityDetailPanel
          title="Inventory Item Details"
          entity={selectedInventory}
          onClose={() => setSelectedInventory(null)}
          readOnly={!isEditing}
        />
      )}

      {selectedUser && (
        <EntityDetailPanel
          title="User Details"
          entity={selectedUser}
          onClose={() => setSelectedUser(null)}
          readOnly={!isEditing}
        />
      )}

      {selectedPlatform && (
        <EntityDetailPanel
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

