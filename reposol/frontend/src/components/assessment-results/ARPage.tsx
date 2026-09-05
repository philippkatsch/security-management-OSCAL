import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import styles from './ARPage.module.css';
import { useDocumentLifecycle } from '@hooks/useDocumentLifecycle';
import { useDocumentActions } from '@hooks/useDocumentActions';
import { DocumentPageLayout } from '../layout/DocumentPageLayout';
import { LoadingSpinner } from '@components/shared/ui/LoadingSpinner';
import { StandardMetadataTab } from '@components/shared/tabs/StandardMetadataTab';
import { JsonEditor } from '@components/shared/JsonEditor';

import { ResultSetsSidebar } from './components/ResultSetsSidebar';
import { OverviewMetadataTab } from './tabs/OverviewMetadataTab';
import { AssessmentFindingsTab } from './tabs/AssessmentFindingsTab';
import { ObservationsEvidenceTab } from './tabs/ObservationsEvidenceTab';
import { IdentifiedRisksTab } from './tabs/IdentifiedRisksTab';
import { AssessmentLogTab } from './tabs/AssessmentLogTab';

import {
  AssessmentResults,
  Result,
  Observation,
  Finding,
  Risk,
  AssessmentLogEntry,
  Attestation,
  SystemComponent,
  SystemUser,
  Task,
} from '../../lib/types/oscal';

import {
  setImportAP,
  setAssessmentResultsMetadata,
  addResultSet,
  updateResultSet,
  removeResultSet,
  addObservation,
  updateObservation,
  removeObservation,
  addFinding,
  updateFinding,
  removeFinding,
  addRisk,
  updateRisk,
  removeRisk,
  addAssessmentLogEntry,
  updateAssessmentLogEntry,
  removeAssessmentLogEntry,
  addAttestation,
  updateAttestation,
  removeAttestation,
  addResultLocalComponent,
  addResultLocalUser,
  addResultLocalTask,
  replaceAssessmentResults,
} from '../../lib/document-actions/assessment-results-actions';
import { createAction } from '../../lib/document-actions/types';

export interface ARPageProps {
  arId?: string;
  initialEditMode?: boolean;
  onClose?: () => void;
}

export function ARPage({ arId = '', initialEditMode = false, onClose }: ARPageProps) {
  const lifecycle = useDocumentLifecycle('assessment-results', 'assessment-results', arId, initialEditMode);
  const {
    activeDoc,
    doc,
    loading,
    error,
    isEditing,
  } = lifecycle;

  const { dispatch } = useDocumentActions(lifecycle);

  const [activeTab, setActiveTab] = useState('overview');
  const [activeResultSetId, setActiveResultSetId] = useState<string | null>(null);
  const [resultSetTab, setResultSetTab] = useState<
    'details' | 'observations' | 'findings' | 'risks' | 'assessment-log' | 'attestations' | 'local-definitions'
  >('details');

  const jsonEditorRef = useRef<any>(null);

  const rawDoc = activeDoc || doc;
  const ar: AssessmentResults = ((rawDoc as any)?.['assessment-results'] || rawDoc) as AssessmentResults;
  const metadata = ar?.metadata || {};
  const results: Result[] = ar?.results || [];

  // Automatically keep activeResultSetId valid as results change
  useEffect(() => {
    if (results.length > 0) {
      if (!activeResultSetId || !results.some((r) => r.uuid === activeResultSetId)) {
        setActiveResultSetId(results[0].uuid);
      }
    } else {
      setActiveResultSetId(null);
    }
  }, [results, activeResultSetId]);

  const activeResultSetIndex = results.findIndex((r) => r.uuid === activeResultSetId);
  const activeResultSet = activeResultSetIndex >= 0 ? results[activeResultSetIndex] : results[0] || null;

  // Save handler triggered by DocumentToolbar's save-btn
  const handleSave = async () => {
    try {
      const docToSave = (lifecycle.activeDoc || lifecycle.doc) as any;
      if (docToSave) {
        await lifecycle.save(docToSave);
        toast.success('Saved successfully');
      }
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message || err}`);
    }
  };

  const handleAddResultSet = () => {
    const newId = crypto.randomUUID();
    dispatch(
      addResultSet({
        uuid: newId,
        title: 'New Result Set',
        description: 'Assessment execution results and findings',
        start: new Date().toISOString(),
        'reviewed-controls': {
          'control-selections': [
            {
              'include-all': {},
            },
          ],
        },
        observations: [],
        findings: [],
        risks: [],
      })
    );
    setActiveResultSetId(newId);
    setResultSetTab('details');
  };

  const handleUpdateActiveResultSet = (updates: Partial<Result>) => {
    if (activeResultSetIndex >= 0) {
      dispatch(updateResultSet(activeResultSetIndex, updates));
    }
  };

  const handleRemoveActiveResultSet = (id: string) => {
    const idx = results.findIndex((r) => r.uuid === id);
    if (idx >= 0) {
      dispatch(removeResultSet(idx));
      const remaining = results.filter((r) => r.uuid !== id);
      setActiveResultSetId(remaining[0]?.uuid || null);
    }
  };

  // Import AP handler
  const handleUpdateImportAP = (href: string, remarks?: string) => {
    dispatch(setImportAP(href, remarks));
  };

  // Back-matter handler
  const handleUpdateBackMatter = (backMatter: any) => {
    dispatch(
      createAction('assessment-results', 'SET_BACK_MATTER', 'Update back-matter', (draft: any) => {
        const root = draft['assessment-results'] || draft;
        if (root) {
          root['back-matter'] = backMatter;
        }
      })
    );
  };

  // Observations handlers
  const handleAddObservation = (obs?: Partial<Observation>) => {
    if (activeResultSetIndex >= 0) {
      dispatch(addObservation(activeResultSetIndex, obs));
    }
  };

  const handleUpdateObservation = (observationIndex: number, updates: Partial<Observation>) => {
    if (activeResultSetIndex >= 0) {
      dispatch(updateObservation(activeResultSetIndex, observationIndex, updates));
    }
  };

  const handleRemoveObservation = (observationIndex: number) => {
    if (activeResultSetIndex >= 0) {
      dispatch(removeObservation(activeResultSetIndex, observationIndex));
    }
  };

  // Findings handlers
  const handleAddFinding = (finding?: Partial<Finding>) => {
    if (activeResultSetIndex >= 0) {
      dispatch(addFinding(activeResultSetIndex, finding));
    }
  };

  const handleUpdateFinding = (findingIndex: number, updates: Partial<Finding>) => {
    if (activeResultSetIndex >= 0) {
      dispatch(updateFinding(activeResultSetIndex, findingIndex, updates));
    }
  };

  const handleRemoveFinding = (findingIndex: number) => {
    if (activeResultSetIndex >= 0) {
      dispatch(removeFinding(activeResultSetIndex, findingIndex));
    }
  };

  // Risks handlers
  const handleAddRisk = (risk?: Partial<Risk>) => {
    if (activeResultSetIndex >= 0) {
      dispatch(addRisk(activeResultSetIndex, risk));
    }
  };

  const handleUpdateRisk = (riskIndex: number, updates: Partial<Risk>) => {
    if (activeResultSetIndex >= 0) {
      dispatch(updateRisk(activeResultSetIndex, riskIndex, updates));
    }
  };

  const handleRemoveRisk = (riskIndex: number) => {
    if (activeResultSetIndex >= 0) {
      dispatch(removeRisk(activeResultSetIndex, riskIndex));
    }
  };

  // Assessment Log & Attestations handlers
  const handleAddLogEntry = (entry?: Partial<AssessmentLogEntry>) => {
    if (activeResultSetIndex >= 0) {
      dispatch(addAssessmentLogEntry(activeResultSetIndex, entry));
    }
  };

  const handleUpdateLogEntry = (entryIndex: number, updates: Partial<AssessmentLogEntry>) => {
    if (activeResultSetIndex >= 0) {
      dispatch(updateAssessmentLogEntry(activeResultSetIndex, entryIndex, updates));
    }
  };

  const handleRemoveLogEntry = (entryIndex: number) => {
    if (activeResultSetIndex >= 0) {
      dispatch(removeAssessmentLogEntry(activeResultSetIndex, entryIndex));
    }
  };

  const handleAddAttestation = (att?: Partial<Attestation>) => {
    if (activeResultSetIndex >= 0) {
      dispatch(addAttestation(activeResultSetIndex, att));
    }
  };

  const handleUpdateAttestation = (index: number, updates: Partial<Attestation>) => {
    if (activeResultSetIndex >= 0) {
      dispatch(updateAttestation(activeResultSetIndex, index, updates));
    }
  };

  const handleRemoveAttestation = (index: number) => {
    if (activeResultSetIndex >= 0) {
      dispatch(removeAttestation(activeResultSetIndex, index));
    }
  };

  // Local Definitions handlers
  const handleAddLocalComponent = (comp: Partial<SystemComponent>) => {
    if (activeResultSetIndex >= 0) {
      dispatch(addResultLocalComponent(activeResultSetIndex, comp as any));
    }
  };

  const handleAddLocalUser = (u: Partial<SystemUser>) => {
    if (activeResultSetIndex >= 0) {
      dispatch(addResultLocalUser(activeResultSetIndex, u as any));
    }
  };

  const handleAddLocalTask = (t: Partial<Task>) => {
    if (activeResultSetIndex >= 0) {
      dispatch(addResultLocalTask(activeResultSetIndex, t as any));
    }
  };

  if (loading && !rawDoc) {
    return <LoadingSpinner variant="skeleton" message="Loading Assessment Results..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-500 font-medium">
        Error loading assessment results: {typeof error === 'string' ? error : (error as any)?.message || String(error)}
      </div>
    );
  }

  if (!ar) {
    return null;
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'results', label: 'Result Sets' },
    { id: 'metadata', label: 'Metadata' },
    { id: 'json', label: 'JSON Source' },
  ];

  return (
    <DocumentPageLayout
      stage="assessment-results"
      docId={arId}
      lifecycle={lifecycle}
      title={metadata.title || 'Untitled Assessment Result'}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(newTab) => setActiveTab(newTab)}
      onClose={onClose}
      onSave={handleSave}
    >
      <div className={styles['ar-content']}>
        {/* 1. Overview & Metadata Tab */}
        {activeTab === 'overview' && (
          <OverviewMetadataTab
            ar={ar}
            isEditing={isEditing}
            onUpdateImportAP={handleUpdateImportAP}
            onUpdateBackMatter={handleUpdateBackMatter}
          />
        )}

        {/* 2. Result Sets Coordinator Tab */}
        {activeTab === 'results' && (
          <div className={styles['ar-result-sets']}>
            <ResultSetsSidebar
              results={results}
              activeResultSetId={activeResultSetId}
              onSelectResultSet={(id) => {
                setActiveResultSetId(id);
              }}
              onAddResultSet={handleAddResultSet}
              isEditing={isEditing}
            />

            <div className={styles['result-set-content']}>
              {activeResultSet ? (
                <>
                  {/* Result Set Sub-Tabs */}
                  <div className={styles['rs-tabs']}>
                    <button
                      type="button"
                      className={resultSetTab === 'details' ? styles['active'] : ''}
                      onClick={() => setResultSetTab('details')}
                    >
                      Result Set Details
                    </button>
                    <button
                      type="button"
                      className={resultSetTab === 'observations' ? styles['active'] : ''}
                      onClick={() => setResultSetTab('observations')}
                    >
                      Observations ({(activeResultSet.observations || []).length})
                    </button>
                    <button
                      type="button"
                      className={resultSetTab === 'findings' ? styles['active'] : ''}
                      onClick={() => setResultSetTab('findings')}
                    >
                      Findings ({(activeResultSet.findings || []).length})
                    </button>
                    <button
                      type="button"
                      className={resultSetTab === 'risks' ? styles['active'] : ''}
                      onClick={() => setResultSetTab('risks')}
                    >
                      Risks ({(activeResultSet.risks || []).length})
                    </button>
                    <button
                      type="button"
                      className={resultSetTab === 'assessment-log' ? styles['active'] : ''}
                      onClick={() => setResultSetTab('assessment-log')}
                    >
                      Assessment Log
                    </button>
                    <button
                      type="button"
                      className={resultSetTab === 'attestations' ? styles['active'] : ''}
                      onClick={() => setResultSetTab('attestations')}
                    >
                      Attestations
                    </button>
                    <button
                      type="button"
                      className={resultSetTab === 'local-definitions' ? styles['active'] : ''}
                      onClick={() => setResultSetTab('local-definitions')}
                    >
                      Local Definitions
                    </button>
                  </div>

                  {/* Subtab Body */}
                  <div className={styles['rs-tab-content']}>
                    {resultSetTab === 'details' && (
                      <div className={styles['rs-editor-header']}>
                        <div className={styles['form-group']}>
                          <label htmlFor="rs-title">Title</label>
                          <input
                            id="rs-title"
                            type="text"
                            value={activeResultSet.title || ''}
                            disabled={!isEditing}
                            onChange={(e) =>
                              handleUpdateActiveResultSet({ title: e.target.value })
                            }
                            placeholder="Result Set Title"
                          />
                        </div>

                        <div className={styles['form-row']}>
                          <div className={styles['form-group']}>
                            <label htmlFor="rs-start">Start</label>
                            <input
                              id="rs-start"
                              type="datetime-local"
                              value={(activeResultSet.start || '').slice(0, 16)}
                              disabled={!isEditing}
                              onChange={(e) => {
                                const d = new Date(e.target.value);
                                handleUpdateActiveResultSet({
                                  start: !isNaN(d.getTime()) ? d.toISOString() : e.target.value,
                                });
                              }}
                            />
                          </div>

                          <div className={styles['form-group']}>
                            <label htmlFor="rs-end">End</label>
                            <input
                              id="rs-end"
                              type="datetime-local"
                              value={(activeResultSet.end || '').slice(0, 16)}
                              disabled={!isEditing}
                              onChange={(e) => {
                                const d = new Date(e.target.value);
                                handleUpdateActiveResultSet({
                                  end: e.target.value && !isNaN(d.getTime()) ? d.toISOString() : undefined,
                                });
                              }}
                            />
                          </div>
                        </div>

                        <div className={styles['form-group']}>
                          <label htmlFor="rs-desc">Description</label>
                          <textarea
                            id="rs-desc"
                            rows={3}
                            value={activeResultSet.description || ''}
                            disabled={!isEditing}
                            onChange={(e) =>
                              handleUpdateActiveResultSet({ description: e.target.value })
                            }
                            placeholder="Execution scope and parameters description..."
                          />
                        </div>

                        {isEditing && results.length > 0 && (
                          <div>
                            <button
                              type="button"
                              className={styles['btn-danger']}
                              onClick={() => handleRemoveActiveResultSet(activeResultSet.uuid)}
                            >
                              Delete Result Set
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {resultSetTab === 'observations' && (
                      <ObservationsEvidenceTab
                        resultSet={activeResultSet}
                        resultIndex={activeResultSetIndex}
                        isEditing={isEditing}
                        onAddObservation={handleAddObservation}
                        onUpdateObservation={handleUpdateObservation}
                        onRemoveObservation={handleRemoveObservation}
                      />
                    )}

                    {resultSetTab === 'findings' && (
                      <AssessmentFindingsTab
                        resultSet={activeResultSet}
                        resultIndex={activeResultSetIndex}
                        isEditing={isEditing}
                        onAddFinding={handleAddFinding}
                        onUpdateFinding={handleUpdateFinding}
                        onRemoveFinding={handleRemoveFinding}
                      />
                    )}

                    {resultSetTab === 'risks' && (
                      <IdentifiedRisksTab
                        resultSet={activeResultSet}
                        resultIndex={activeResultSetIndex}
                        isEditing={isEditing}
                        onAddRisk={handleAddRisk}
                        onUpdateRisk={handleUpdateRisk}
                        onRemoveRisk={handleRemoveRisk}
                      />
                    )}

                    {(resultSetTab === 'assessment-log' ||
                      resultSetTab === 'attestations' ||
                      resultSetTab === 'local-definitions') && (
                      <AssessmentLogTab
                        resultSet={activeResultSet}
                        resultIndex={activeResultSetIndex}
                        isEditing={isEditing}
                        onAddLogEntry={handleAddLogEntry}
                        onUpdateLogEntry={handleUpdateLogEntry}
                        onRemoveLogEntry={handleRemoveLogEntry}
                        onAddAttestation={handleAddAttestation}
                        onUpdateAttestation={handleUpdateAttestation}
                        onRemoveAttestation={handleRemoveAttestation}
                        onAddLocalComponent={handleAddLocalComponent}
                        onAddLocalUser={handleAddLocalUser}
                        onAddLocalTask={handleAddLocalTask}
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className={styles['empty-hint']}>
                  No Result Sets defined. Click &quot;+ New&quot; in the sidebar to declare an assessment result set.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. Metadata Tab */}
        {activeTab === 'metadata' && (
          <div className={styles['ar-metadata']}>
            <StandardMetadataTab
              document={ar as any}
              isEditing={isEditing}
              onChange={(updated) => {
                if (updated.metadata) {
                  dispatch(setAssessmentResultsMetadata(updated.metadata));
                } else {
                  dispatch(replaceAssessmentResults(updated));
                }
              }}
            />
          </div>
        )}

        {/* 4. JSON Source Tab */}
        {activeTab === 'json' && (
          <JsonEditor
            ref={jsonEditorRef}
            value={rawDoc}
            readOnly={!isEditing}
            onChange={(newDoc) => {
              const newAr = (newDoc as any)?.['assessment-results'] || newDoc;
              dispatch(replaceAssessmentResults(newAr));
            }}
          />
        )}
      </div>
    </DocumentPageLayout>
  );
}

export default ARPage;
