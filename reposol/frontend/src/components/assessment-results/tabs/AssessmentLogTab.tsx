import React, { useState } from 'react';
import styles from '../ARPage.module.css';
import { Result, AssessmentLogEntry, Attestation, SystemComponent, SystemUser, Task } from '../../../lib/types/oscal';
import EntityTable from '@components/shared/entity/EntityTable';

export interface AssessmentLogTabProps {
  resultSet: Result;
  resultIndex: number;
  isEditing: boolean;
  onAddLogEntry: (entry?: Partial<AssessmentLogEntry>) => void;
  onUpdateLogEntry: (entryIndex: number, updates: Partial<AssessmentLogEntry>) => void;
  onRemoveLogEntry: (entryIndex: number) => void;
  onAddAttestation?: (attestation?: Partial<Attestation>) => void;
  onUpdateAttestation?: (index: number, updates: Partial<Attestation>) => void;
  onRemoveAttestation?: (index: number) => void;
  onAddLocalComponent?: (component: Partial<SystemComponent>) => void;
  onRemoveLocalComponent?: (componentUuid: string) => void;
  onAddLocalUser?: (user: Partial<SystemUser>) => void;
  onRemoveLocalUser?: (userUuid: string) => void;
  onAddLocalTask?: (task: Partial<Task>) => void;
  onRemoveLocalTask?: (taskUuid: string) => void;
}

export const AssessmentLogTab: React.FC<AssessmentLogTabProps> = ({
  resultSet,
  resultIndex,
  isEditing,
  onAddLogEntry,
  onUpdateLogEntry,
  onRemoveLogEntry,
  onAddAttestation,
  onUpdateAttestation,
  onRemoveAttestation,
  onAddLocalComponent,
  onRemoveLocalComponent,
  onAddLocalUser,
  onRemoveLocalUser,
  onAddLocalTask,
  onRemoveLocalTask,
}) => {
  const [activeSubSection, setActiveSubSection] = useState<'log' | 'attestations' | 'local-defs'>('log');
  const [editingEntry, setEditingEntry] = useState<AssessmentLogEntry | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const logEntries: AssessmentLogEntry[] = resultSet['assessment-log']?.entries || [];
  const attestations: Attestation[] = resultSet.attestations || [];
  const localDefs = resultSet['local-definitions'] || {};

  const handleCreateEntry = () => {
    const newEntry: AssessmentLogEntry = {
      uuid: crypto.randomUUID(),
      title: '',
      description: '',
      start: new Date().toISOString(),
      'logged-by': [],
    };
    onAddLogEntry(newEntry);
    setEditingEntry(newEntry);
    setEditingIndex(logEntries.length);
  };

  const handleEditEntry = (idx: number) => {
    setEditingEntry(logEntries[idx] || null);
    setEditingIndex(idx);
  };

  const handleUpdateActiveField = (field: keyof AssessmentLogEntry, val: any) => {
    if (!editingEntry || editingIndex === null) return;
    const updated = { ...editingEntry, [field]: val };
    setEditingEntry(updated);
    onUpdateLogEntry(editingIndex, updated);
  };

  const handleCreateAttestation = () => {
    if (onAddAttestation) {
      onAddAttestation({
        parts: [
          {
            uuid: crypto.randomUUID(),
            name: 'assessment-statement',
            title: 'Lead Assessor Attestation',
            prose: 'Assessor confirms the validity of findings, observations, and risks.',
          },
        ],
        'responsible-parties': [],
      });
    }
  };

  return (
    <div className={styles['entity-section']}>
      {/* Sub-navigation bar */}
      <div className={styles['filter-bar']}>
        <div className="flex gap-2">
          <button
            type="button"
            className={`${styles['btn-tab']} ${activeSubSection === 'log' ? styles['active'] : ''}`}
            onClick={() => setActiveSubSection('log')}
          >
            Assessment Log ({logEntries.length})
          </button>
          <button
            type="button"
            className={`${styles['btn-tab']} ${activeSubSection === 'attestations' ? styles['active'] : ''}`}
            onClick={() => setActiveSubSection('attestations')}
          >
            Attestations ({attestations.length})
          </button>
          <button
            type="button"
            className={`${styles['btn-tab']} ${activeSubSection === 'local-defs' ? styles['active'] : ''}`}
            onClick={() => setActiveSubSection('local-defs')}
          >
            Result Local Definitions
          </button>
        </div>

        {activeSubSection === 'log' && isEditing && (
          <button
            type="button"
            className={styles['btn-primary']}
            onClick={handleCreateEntry}
          >
            + Add Entry
          </button>
        )}
        {activeSubSection === 'attestations' && isEditing && (
          <button
            type="button"
            className={styles['btn-primary']}
            onClick={handleCreateAttestation}
          >
            + Add Attestation
          </button>
        )}
      </div>

      {/* 1. Assessment Log Timeline & Form */}
      {activeSubSection === 'log' && (
        <div className="flex flex-col gap-4">
          {/* Active Entry Editor Form (when editing an entry or immediately after + Add Entry) */}
          {editingEntry && isEditing && (
            <div className={styles['sub-card']} style={{ borderColor: 'var(--color-primary)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-sm text-indigo-300">
                  Editing Log Entry
                </span>
                <button
                  type="button"
                  className={styles['btn-secondary']}
                  onClick={() => {
                    setEditingEntry(null);
                    setEditingIndex(null);
                  }}
                >
                  Close Editor
                </button>
              </div>

              <div className={styles['form-group']}>
                <label htmlFor="log-title">Title</label>
                <input
                  id="log-title"
                  type="text"
                  value={editingEntry.title || ''}
                  onChange={(e) => handleUpdateActiveField('title', e.target.value)}
                  placeholder="e.g. Assessment Execution Started"
                />
              </div>

              <div className={styles['form-row']}>
                <div className={styles['form-group']}>
                  <label htmlFor="log-timestamp">Timestamp</label>
                  <input
                    id="log-timestamp"
                    type="datetime-local"
                    value={(editingEntry.start || '').slice(0, 16)}
                    onChange={(e) => {
                      const d = new Date(e.target.value);
                      handleUpdateActiveField(
                        'start',
                        !isNaN(d.getTime()) ? d.toISOString() : e.target.value
                      );
                    }}
                  />
                </div>
                <div className={styles['form-group']}>
                  <label htmlFor="log-end">End (Optional)</label>
                  <input
                    id="log-end"
                    type="datetime-local"
                    value={(editingEntry.end || '').slice(0, 16)}
                    onChange={(e) => {
                      const d = new Date(e.target.value);
                      handleUpdateActiveField(
                        'end',
                        e.target.value && !isNaN(d.getTime()) ? d.toISOString() : undefined
                      );
                    }}
                  />
                </div>
              </div>

              <div className={styles['form-group']}>
                <label htmlFor="log-description">Description</label>
                <textarea
                  id="log-description"
                  value={editingEntry.description || ''}
                  onChange={(e) => handleUpdateActiveField('description', e.target.value)}
                  rows={3}
                  placeholder="Details of log activity..."
                />
              </div>

              <div className={styles['form-group']}>
                <label htmlFor="log-logged-by">Logged By</label>
                <input
                  id="log-logged-by"
                  type="text"
                  value={(editingEntry['logged-by'] || []).map((l) => l['role-id'] || l['party-uuid']).join(', ')}
                  onChange={(e) => {
                    const roles = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                    handleUpdateActiveField(
                      'logged-by',
                      roles.map((r) => ({ 'role-id': r, 'party-uuid': r }))
                    );
                  }}
                  placeholder="e.g. lead-assessor, sec-evaluator"
                />
              </div>
            </div>
          )}

          {/* Timeline / List View */}
          {logEntries.length === 0 ? (
            <div className={styles['empty-hint']}>No log entries recorded.</div>
          ) : (
            <div className={styles['timeline-list']}>
              {logEntries.map((entry, idx) => (
                <div
                  key={entry.uuid || idx}
                  className={`${styles['timeline-entry']} ${editingIndex === idx ? styles['active-entry'] : ''}`}
                  onClick={() => {
                    if (isEditing) handleEditEntry(idx);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-100">{entry.title || 'Untitled Entry'}</span>
                    <span className="text-xs text-slate-400 font-mono">
                      {entry.start ? new Date(entry.start).toLocaleString() : ''}
                    </span>
                  </div>
                  {entry.description && (
                    <p className="text-sm text-slate-300 mt-1 mb-1">{entry.description}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                    <span>
                      Logged by: {(entry['logged-by'] || []).map((l) => l['role-id'] || l['party-uuid']).join(', ') || 'N/A'}
                    </span>
                    {isEditing && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={styles['btn-secondary']}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditEntry(idx);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={styles['btn-danger-sm']}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveLogEntry(idx);
                            if (editingIndex === idx) {
                              setEditingEntry(null);
                              setEditingIndex(null);
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Attestations View */}
      {activeSubSection === 'attestations' && (
        <div className="flex flex-col gap-4">
          {attestations.length === 0 ? (
            <div className={styles['empty-hint']}>No formal attestations recorded.</div>
          ) : (
            attestations.map((att, attIdx) => (
              <div key={attIdx} className={styles['sub-card']}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="m-0 text-slate-100 font-semibold">Attestation #{attIdx + 1}</h4>
                  {isEditing && onRemoveAttestation && (
                    <button
                      type="button"
                      className={styles['btn-danger-sm']}
                      onClick={() => onRemoveAttestation(attIdx)}
                    >
                      Delete Attestation
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <div className="text-xs text-slate-400 font-semibold uppercase">Parts:</div>
                  {(att.parts || []).map((part, pIdx) => (
                    <div key={part.uuid || pIdx} className={styles['inner-section']}>
                      <div className="font-medium text-sm text-slate-200 mb-1">{part.title || part.name}</div>
                      {isEditing ? (
                        <textarea
                          rows={2}
                          value={part.prose || ''}
                          className={styles['modal-input']}
                          onChange={(e) => {
                            if (onUpdateAttestation) {
                              const nextParts = [...(att.parts || [])];
                              nextParts[pIdx] = { ...part, prose: e.target.value };
                              onUpdateAttestation(attIdx, { parts: nextParts });
                            }
                          }}
                          placeholder="Attestation statement prose..."
                        />
                      ) : (
                        <div className="text-sm text-slate-300">{part.prose}</div>
                      )}
                    </div>
                  ))}

                  <div className="text-xs text-slate-400 font-semibold uppercase mt-2">
                    Responsible Parties:
                  </div>
                  <div className="text-sm text-slate-300">
                    {(att['responsible-parties'] || []).map((rp) => rp['role-id']).join(', ') || '(None)'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 3. Result Local Definitions View */}
      {activeSubSection === 'local-defs' && (
        <div className="flex flex-col gap-6">
          {/* Components */}
          <div className={styles['sub-card']}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="m-0 text-slate-100 font-semibold">Assessment Components</h4>
              {isEditing && onAddLocalComponent && (
                <button
                  type="button"
                  className={styles['btn-secondary']}
                  onClick={() =>
                    onAddLocalComponent({
                      uuid: crypto.randomUUID(),
                      type: 'software',
                      title: 'New Component',
                      description: '',
                      status: { state: 'operational' },
                    })
                  }
                >
                  + Add Component
                </button>
              )}
            </div>
            <EntityTable
              columns={[
                { key: 'title', label: 'Title' },
                { key: 'type', label: 'Type' },
                { key: 'description', label: 'Description' },
                {
                  key: 'status',
                  label: 'Status',
                  render: (_: any, c: any) => c.status?.state || 'operational',
                },
              ]}
              data={(localDefs.components || []).map((c) => ({ ...c, id: c.uuid }))}
              onRowClick={() => {}}
            />
          </div>

          {/* Users */}
          <div className={styles['sub-card']}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="m-0 text-slate-100 font-semibold">Assessment Users</h4>
              {isEditing && onAddLocalUser && (
                <button
                  type="button"
                  className={styles['btn-secondary']}
                  onClick={() =>
                    onAddLocalUser({
                      uuid: crypto.randomUUID(),
                      title: 'New Evaluator',
                      'role-ids': ['assessor'],
                    })
                  }
                >
                  + Add User
                </button>
              )}
            </div>
            <EntityTable
              columns={[
                { key: 'title', label: 'Title' },
                {
                  key: 'rolesStr',
                  label: 'Roles',
                  render: (_: any, u: any) => (u['role-ids'] || []).join(', '),
                },
              ]}
              data={(localDefs.users || []).map((u) => ({ ...u, id: u.uuid }))}
              onRowClick={() => {}}
            />
          </div>

          {/* Tasks */}
          <div className={styles['sub-card']}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="m-0 text-slate-100 font-semibold">Assessment Tasks</h4>
              {isEditing && onAddLocalTask && (
                <button
                  type="button"
                  className={styles['btn-secondary']}
                  onClick={() =>
                    onAddLocalTask({
                      uuid: crypto.randomUUID(),
                      type: 'milestone',
                      title: 'Assessment Milestone Task',
                      description: '',
                    })
                  }
                >
                  + Add Task
                </button>
              )}
            </div>
            <EntityTable
              columns={[
                { key: 'title', label: 'Title' },
                { key: 'type', label: 'Type' },
                { key: 'description', label: 'Description' },
              ]}
              data={(localDefs.tasks || []).map((t) => ({ ...t, id: t.uuid }))}
              onRowClick={() => {}}
            />
          </div>
        </div>
      )}
    </div>
  );
};
