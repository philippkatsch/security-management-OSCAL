import React from 'react';
import styles from '../ARPage.module.css';
import {
  Risk,
  RiskResponse,
  RiskLogEntry,
  RiskMitigatingFactor,
  RiskThreatID,
  Property,
  Link,
} from '../../../lib/types/oscal';
import { PropsEditor } from '@components/shared/PropsEditor';
import { LinksEditor } from '@components/shared/LinksEditor';
import { CharacterizationsEditor } from '@components/shared/risk-assessment/CharacterizationsEditor';

export interface RiskEditorModalProps {
  risk: Risk | null;
  isEditing: boolean;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: Risk) => void;
}

export const RiskEditorModal: React.FC<RiskEditorModalProps> = ({
  risk,
  isEditing,
  isOpen,
  onClose,
  onUpdate,
}) => {
  if (!isOpen || !risk) return null;

  const handleFieldChange = (field: keyof Risk, value: any) => {
    onUpdate({
      ...risk,
      [field]: value,
    });
  };

  // Remediations handlers
  const handleAddRemediation = () => {
    const newRem: RiskResponse = {
      uuid: crypto.randomUUID(),
      lifecycle: 'planned',
      title: 'New Remediation Response',
      description: 'Remediation implementation plan',
      'required-assets': [],
      tasks: [],
    };
    handleFieldChange('remediations', [...(risk.remediations || []), newRem]);
  };

  const handleUpdateRemediation = (index: number, updates: Partial<RiskResponse>) => {
    const nextRems = [...(risk.remediations || [])];
    nextRems[index] = { ...nextRems[index], ...updates };
    handleFieldChange('remediations', nextRems);
  };

  const handleRemoveRemediation = (index: number) => {
    const nextRems = [...(risk.remediations || [])];
    nextRems.splice(index, 1);
    handleFieldChange('remediations', nextRems);
  };

  const handleAddAsset = (remIndex: number) => {
    const rem = (risk.remediations || [])[remIndex];
    if (!rem) return;
    const nextAssets = [
      ...(rem['required-assets'] || []),
      { uuid: crypto.randomUUID(), description: '' },
    ];
    handleUpdateRemediation(remIndex, { 'required-assets': nextAssets });
  };

  const handleUpdateAsset = (remIndex: number, assetIndex: number, description: string) => {
    const rem = (risk.remediations || [])[remIndex];
    if (!rem) return;
    const nextAssets = [...(rem['required-assets'] || [])];
    nextAssets[assetIndex] = { ...nextAssets[assetIndex], description };
    handleUpdateRemediation(remIndex, { 'required-assets': nextAssets });
  };

  const handleRemoveAsset = (remIndex: number, assetIndex: number) => {
    const rem = (risk.remediations || [])[remIndex];
    if (!rem) return;
    const nextAssets = [...(rem['required-assets'] || [])];
    nextAssets.splice(assetIndex, 1);
    handleUpdateRemediation(remIndex, { 'required-assets': nextAssets });
  };

  const handleAddTask = (remIndex: number) => {
    const rem = (risk.remediations || [])[remIndex];
    if (!rem) return;
    const nextTasks = [
      ...(rem.tasks || []),
      {
        uuid: crypto.randomUUID(),
        type: 'remediation',
        title: '',
        description: '',
      },
    ];
    handleUpdateRemediation(remIndex, { tasks: nextTasks as any });
  };

  const handleUpdateTask = (
    remIndex: number,
    taskIndex: number,
    field: 'title' | 'description',
    val: string
  ) => {
    const rem = (risk.remediations || [])[remIndex];
    if (!rem) return;
    const nextTasks = [...(rem.tasks || [])];
    nextTasks[taskIndex] = { ...nextTasks[taskIndex], [field]: val };
    handleUpdateRemediation(remIndex, { tasks: nextTasks });
  };

  const handleRemoveTask = (remIndex: number, taskIndex: number) => {
    const rem = (risk.remediations || [])[remIndex];
    if (!rem) return;
    const nextTasks = [...(rem.tasks || [])];
    nextTasks.splice(taskIndex, 1);
    handleUpdateRemediation(remIndex, { tasks: nextTasks });
  };

  // Risk Log handlers
  const handleAddLogEntry = () => {
    const currentLog = risk['risk-log'] || { entries: [] };
    const newEntry: RiskLogEntry = {
      uuid: crypto.randomUUID(),
      title: '',
      start: new Date().toISOString(),
      description: '',
      'status-change': 'investigating',
    };
    handleFieldChange('risk-log', {
      ...currentLog,
      entries: [...(currentLog.entries || []), newEntry],
    });
  };

  const handleUpdateLogEntry = (index: number, updates: Partial<RiskLogEntry>) => {
    const currentLog = risk['risk-log'] || { entries: [] };
    const nextEntries = [...(currentLog.entries || [])];
    nextEntries[index] = { ...nextEntries[index], ...updates };
    handleFieldChange('risk-log', {
      ...currentLog,
      entries: nextEntries,
    });
  };

  const handleRemoveLogEntry = (index: number) => {
    const currentLog = risk['risk-log'] || { entries: [] };
    const nextEntries = [...(currentLog.entries || [])];
    nextEntries.splice(index, 1);
    handleFieldChange('risk-log', {
      ...currentLog,
      entries: nextEntries,
    });
  };

  // Mitigating Factors handlers
  const handleAddMitigatingFactor = () => {
    const newFactor: RiskMitigatingFactor = {
      uuid: crypto.randomUUID(),
      description: '',
    };
    handleFieldChange('mitigating-factors', [
      ...(risk['mitigating-factors'] || []),
      newFactor,
    ]);
  };

  const handleUpdateMitigatingFactor = (
    index: number,
    updates: Partial<RiskMitigatingFactor>
  ) => {
    const nextFactors = [...(risk['mitigating-factors'] || [])];
    nextFactors[index] = { ...nextFactors[index], ...updates };
    handleFieldChange('mitigating-factors', nextFactors);
  };

  const handleRemoveMitigatingFactor = (index: number) => {
    const nextFactors = [...(risk['mitigating-factors'] || [])];
    nextFactors.splice(index, 1);
    handleFieldChange('mitigating-factors', nextFactors);
  };

  // Threat IDs handlers
  const handleAddThreatId = () => {
    const newThreat: RiskThreatID = {
      system: 'http://cve.mitre.org',
      id: '',
    };
    handleFieldChange('threat-ids', [...(risk['threat-ids'] || []), newThreat]);
  };

  const handleUpdateThreatId = (index: number, updates: Partial<RiskThreatID>) => {
    const nextThreats = [...(risk['threat-ids'] || [])];
    nextThreats[index] = { ...nextThreats[index], ...updates };
    handleFieldChange('threat-ids', nextThreats);
  };

  const handleRemoveThreatId = (index: number) => {
    const nextThreats = [...(risk['threat-ids'] || [])];
    nextThreats.splice(index, 1);
    handleFieldChange('threat-ids', nextThreats);
  };

  return (
    <div
      className={styles['editor-panel-overlay']}
      role="dialog"
      aria-modal="true"
      aria-label="Risk Details"
    >
      <div className={styles['editor-panel']}>
        <div className={styles['editor-panel-header']}>
          <h3>Risk Details</h3>
          <button
            type="button"
            className={styles['btn-close']}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className={styles['editor-form']}>
          <div className={styles['form-group']}>
            <label htmlFor="risk-title">Title</label>
            <input
              id="risk-title"
              type="text"
              value={risk.title || ''}
              disabled={!isEditing}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder="e.g. Weak Credential Storage"
            />
          </div>

          <div className={styles['form-group']}>
            <label htmlFor="risk-description">Description</label>
            <textarea
              id="risk-description"
              value={risk.description || ''}
              disabled={!isEditing}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              rows={3}
              placeholder="Technical details of observed risk..."
            />
          </div>

          <div className={styles['form-row']}>
            <div className={styles['form-group']}>
              <label htmlFor="risk-status">Status</label>
              <select
                id="risk-status"
                value={risk.status || 'open'}
                disabled={!isEditing}
                onChange={(e) => handleFieldChange('status', e.target.value)}
              >
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="remediating">Remediating</option>
                <option value="deviation-requested">Deviation Requested</option>
                <option value="deviation-approved">Deviation Approved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          <div className={styles['form-group']}>
            <label htmlFor="risk-statement">Statement</label>
            <textarea
              id="risk-statement"
              value={risk.statement || ''}
              disabled={!isEditing}
              onChange={(e) => handleFieldChange('statement', e.target.value)}
              rows={3}
              placeholder="Formal impact statement per NIST OSCAL v1.2.2 requirements..."
            />
          </div>

          <div className={styles['form-section']}>
            <h4>Characterizations & Facets</h4>
            <CharacterizationsEditor
              value={risk.characterizations || []}
              isEditing={isEditing}
              onChange={(newChars: any[]) => handleFieldChange('characterizations', newChars)}
            />
          </div>

          {/* Remediations Section */}
          <div className={styles['form-section']}>
            <div className="flex items-center justify-between mb-3">
              <h4>Remediations</h4>
              {isEditing && (
                <button
                  type="button"
                  className={styles['btn-primary']}
                  onClick={handleAddRemediation}
                >
                  + Add Remediation
                </button>
              )}
            </div>

            {(risk.remediations || []).length === 0 ? (
              <div className={styles['empty-hint']}>No remediation plans defined.</div>
            ) : (
              (risk.remediations || []).map((rem, remIdx) => (
                <div key={rem.uuid || remIdx} className={styles['sub-card']}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm text-slate-200">
                      Remediation #{remIdx + 1}
                    </span>
                    {isEditing && (
                      <button
                        type="button"
                        className={styles['btn-danger-sm']}
                        onClick={() => handleRemoveRemediation(remIdx)}
                      >
                        Remove Remediation
                      </button>
                    )}
                  </div>

                  <div className={styles['form-group']}>
                    <label htmlFor={`remediation-title-${remIdx}`}>Title</label>
                    <input
                      id={`remediation-title-${remIdx}`}
                      type="text"
                      value={rem.title || ''}
                      disabled={!isEditing}
                      onChange={(e) =>
                        handleUpdateRemediation(remIdx, { title: e.target.value })
                      }
                      placeholder="e.g. Upgrade password hashing algorithm"
                    />
                  </div>

                  <div className={styles['form-group']}>
                    <label htmlFor={`remediation-lifecycle-${remIdx}`}>Lifecycle</label>
                    <select
                      id={`remediation-lifecycle-${remIdx}`}
                      value={rem.lifecycle || 'planned'}
                      disabled={!isEditing}
                      onChange={(e) =>
                        handleUpdateRemediation(remIdx, { lifecycle: e.target.value })
                      }
                    >
                      <option value="recommendation">recommendation</option>
                      <option value="planned">planned</option>
                      <option value="completed">completed</option>
                    </select>
                  </div>

                  <div className={styles['form-group']}>
                    <label htmlFor={`remediation-description-${remIdx}`}>Description</label>
                    <textarea
                      id={`remediation-description-${remIdx}`}
                      value={rem.description || ''}
                      disabled={!isEditing}
                      onChange={(e) =>
                        handleUpdateRemediation(remIdx, { description: e.target.value })
                      }
                      rows={2}
                      placeholder="Remediation steps..."
                    />
                  </div>

                  {/* Required Assets */}
                  <div className={styles['inner-section']}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase text-slate-400">
                        Required Assets
                      </span>
                      {isEditing && (
                        <button
                          type="button"
                          className={styles['btn-secondary']}
                          onClick={() => handleAddAsset(remIdx)}
                        >
                          + Add Asset
                        </button>
                      )}
                    </div>

                    {(rem['required-assets'] || []).length === 0 ? (
                      <div className={styles['empty-hint-sm']}>No required assets.</div>
                    ) : (
                      (rem['required-assets'] || []).map((asset, assetIdx) => (
                        <div key={asset.uuid || assetIdx} className="mb-2">
                          <div className={styles['form-row']}>
                            <div style={{ flex: 1 }}>
                              <label
                                htmlFor={`remediation-asset-${remIdx}-${assetIdx}`}
                                className="text-xs font-medium text-slate-300 block mb-1"
                              >
                                Required Assets
                              </label>
                              <input
                                id={`remediation-asset-${remIdx}-${assetIdx}`}
                                type="text"
                                value={asset.description || ''}
                                disabled={!isEditing}
                                onChange={(e) =>
                                  handleUpdateAsset(remIdx, assetIdx, e.target.value)
                                }
                                placeholder="Asset description or name"
                              />
                            </div>
                            {isEditing && (
                              <button
                                type="button"
                                className={styles['btn-danger-sm']}
                                style={{ alignSelf: 'flex-end', marginBottom: '4px' }}
                                onClick={() => handleRemoveAsset(remIdx, assetIdx)}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Remediation Tasks */}
                  <div className={styles['inner-section']}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase text-slate-400">
                        Remediation Tasks
                      </span>
                      {isEditing && (
                        <button
                          type="button"
                          className={styles['btn-secondary']}
                          onClick={() => handleAddTask(remIdx)}
                        >
                          + Add Task
                        </button>
                      )}
                    </div>

                    {(rem.tasks || []).length === 0 ? (
                      <div className={styles['empty-hint-sm']}>No tasks scheduled.</div>
                    ) : (
                      (rem.tasks || []).map((t, taskIdx) => (
                        <div key={t.uuid || taskIdx} className={styles['task-row']}>
                          <div className={styles['form-group']}>
                            <label htmlFor={`remediation-task-title-${remIdx}-${taskIdx}`}>
                              Title
                            </label>
                            <input
                              id={`remediation-task-title-${remIdx}-${taskIdx}`}
                              type="text"
                              value={t.title || ''}
                              disabled={!isEditing}
                              onChange={(e) =>
                                handleUpdateTask(remIdx, taskIdx, 'title', e.target.value)
                              }
                              placeholder="Task Title"
                            />
                          </div>
                          <div className={styles['form-group']}>
                            <label htmlFor={`remediation-task-desc-${remIdx}-${taskIdx}`}>
                              Description
                            </label>
                            <textarea
                              id={`remediation-task-desc-${remIdx}-${taskIdx}`}
                              value={t.description || ''}
                              disabled={!isEditing}
                              onChange={(e) =>
                                handleUpdateTask(remIdx, taskIdx, 'description', e.target.value)
                              }
                              rows={2}
                              placeholder="Task Description"
                            />
                          </div>
                          {isEditing && (
                            <button
                              type="button"
                              className={styles['btn-danger-sm']}
                              onClick={() => handleRemoveTask(remIdx, taskIdx)}
                            >
                              Remove Task
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Risk Log Section */}
          <div className={styles['form-section']}>
            <div className="flex items-center justify-between mb-3">
              <h4>Risk Log & Status Tracking</h4>
              {isEditing && (
                <button
                  type="button"
                  className={styles['btn-primary']}
                  onClick={handleAddLogEntry}
                >
                  + Add Log Entry
                </button>
              )}
            </div>

            {((risk['risk-log']?.entries) || []).length === 0 ? (
              <div className={styles['empty-hint']}>No log entries recorded.</div>
            ) : (
              (risk['risk-log']?.entries || []).map((entry, entryIdx) => (
                <div key={entry.uuid || entryIdx} className={styles['sub-card']}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm text-slate-200">
                      Log Entry #{entryIdx + 1}
                    </span>
                    {isEditing && (
                      <button
                        type="button"
                        className={styles['btn-danger-sm']}
                        onClick={() => handleRemoveLogEntry(entryIdx)}
                      >
                        Remove Entry
                      </button>
                    )}
                  </div>

                  <div className={styles['form-group']}>
                    <label htmlFor={`risk-log-title-${entryIdx}`}>Title</label>
                    <input
                      id={`risk-log-title-${entryIdx}`}
                      type="text"
                      value={entry.title || ''}
                      disabled={!isEditing}
                      onChange={(e) =>
                        handleUpdateLogEntry(entryIdx, { title: e.target.value })
                      }
                      placeholder="e.g. Risk status update"
                    />
                  </div>

                  <div className={styles['form-row']}>
                    <div className={styles['form-group']}>
                      <label htmlFor={`risk-log-status-${entryIdx}`}>Status Change</label>
                      <select
                        id={`risk-log-status-${entryIdx}`}
                        value={entry['status-change'] || ''}
                        disabled={!isEditing}
                        onChange={(e) =>
                          handleUpdateLogEntry(entryIdx, {
                            'status-change': e.target.value as any,
                          })
                        }
                      >
                        <option value="">(No Status Change)</option>
                        <option value="open">open</option>
                        <option value="investigating">investigating</option>
                        <option value="remediating">remediating</option>
                        <option value="deviation-requested">deviation-requested</option>
                        <option value="deviation-approved">deviation-approved</option>
                        <option value="closed">closed</option>
                      </select>
                    </div>

                    <div className={styles['form-group']}>
                      <label htmlFor={`risk-log-start-${entryIdx}`}>Start</label>
                      <input
                        id={`risk-log-start-${entryIdx}`}
                        type="datetime-local"
                        value={(entry.start || '').slice(0, 16)}
                        disabled={!isEditing}
                        onChange={(e) => {
                          const d = new Date(e.target.value);
                          handleUpdateLogEntry(entryIdx, {
                            start: !isNaN(d.getTime()) ? d.toISOString() : e.target.value,
                          });
                        }}
                      />
                    </div>
                  </div>

                  <div className={styles['form-group']}>
                    <label htmlFor={`risk-log-description-${entryIdx}`}>Description</label>
                    <textarea
                      id={`risk-log-description-${entryIdx}`}
                      value={entry.description || ''}
                      disabled={!isEditing}
                      onChange={(e) =>
                        handleUpdateLogEntry(entryIdx, { description: e.target.value })
                      }
                      rows={2}
                      placeholder="Details of the risk status change..."
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Mitigating Factors Section */}
          <div className={styles['form-section']}>
            <div className="flex items-center justify-between mb-3">
              <h4>Mitigating Factors</h4>
              {isEditing && (
                <button
                  type="button"
                  className={styles['btn-secondary']}
                  onClick={handleAddMitigatingFactor}
                >
                  + Add Factor
                </button>
              )}
            </div>

            {(risk['mitigating-factors'] || []).length === 0 ? (
              <div className={styles['empty-hint']}>No mitigating factors recorded.</div>
            ) : (
              (risk['mitigating-factors'] || []).map((mf, mfIdx) => (
                <div key={mf.uuid || mfIdx} className={styles['sub-card']}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-slate-400">{mf.uuid}</span>
                    {isEditing && (
                      <button
                        type="button"
                        className={styles['btn-danger-sm']}
                        onClick={() => handleRemoveMitigatingFactor(mfIdx)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className={styles['form-group']}>
                    <label htmlFor={`mf-desc-${mfIdx}`}>Description</label>
                    <textarea
                      id={`mf-desc-${mfIdx}`}
                      value={mf.description || ''}
                      disabled={!isEditing}
                      onChange={(e) =>
                        handleUpdateMitigatingFactor(mfIdx, { description: e.target.value })
                      }
                      rows={2}
                      placeholder="Mitigating factor description..."
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Threat IDs Section */}
          <div className={styles['form-section']}>
            <div className="flex items-center justify-between mb-3">
              <h4>Threat IDs</h4>
              {isEditing && (
                <button
                  type="button"
                  className={styles['btn-secondary']}
                  onClick={handleAddThreatId}
                >
                  + Add Threat ID
                </button>
              )}
            </div>

            {(risk['threat-ids'] || []).length === 0 ? (
              <div className={styles['empty-hint']}>No threat IDs mapped.</div>
            ) : (
              (risk['threat-ids'] || []).map((t, tIdx) => (
                <div key={tIdx} className={styles['form-row']}>
                  <div style={{ flex: 2 }}>
                    <label htmlFor={`threat-system-${tIdx}`} className="text-xs text-slate-400 block mb-1">
                      System URI
                    </label>
                    <input
                      id={`threat-system-${tIdx}`}
                      type="text"
                      value={t.system || ''}
                      disabled={!isEditing}
                      onChange={(e) =>
                        handleUpdateThreatId(tIdx, { system: e.target.value })
                      }
                      placeholder="http://cve.mitre.org"
                    />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label htmlFor={`threat-id-${tIdx}`} className="text-xs text-slate-400 block mb-1">
                      Threat ID
                    </label>
                    <input
                      id={`threat-id-${tIdx}`}
                      type="text"
                      value={t.id || ''}
                      disabled={!isEditing}
                      onChange={(e) =>
                        handleUpdateThreatId(tIdx, { id: e.target.value })
                      }
                      placeholder="CVE-2026-12345"
                    />
                  </div>
                  {isEditing && (
                    <button
                      type="button"
                      className={styles['btn-danger-sm']}
                      style={{ alignSelf: 'flex-end', marginBottom: '4px' }}
                      onClick={() => handleRemoveThreatId(tIdx)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Properties & Links */}
          <div className={styles['form-section']}>
            <h4>Properties & Links</h4>
            <PropsEditor
              properties={risk.props || []}
              isEditing={isEditing}
              onChange={(newProps: Property[]) => handleFieldChange('props', newProps)}
            />
            <div style={{ marginTop: '12px' }}>
              <LinksEditor
                links={risk.links || []}
                readOnly={!isEditing}
                onChange={(newLinks: Link[]) => handleFieldChange('links', newLinks)}
              />
            </div>
          </div>
        </div>

        <div className={styles['editor-panel-footer']}>
          <button type="button" className={styles['btn-secondary']} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
