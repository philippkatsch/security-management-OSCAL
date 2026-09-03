import React, { useState, useEffect } from 'react';
import { ComponentControlImplementation, ComponentImplementedRequirement } from '@lib/types/oscal';
import { generateUUID } from '@lib/oscal-utils';
import { ProseWithParams } from '@components/shared/ProseWithParams';
import SourceDocumentPicker from '../pickers/SourceDocumentPicker';
import ControlTreePicker from '../pickers/ControlTreePicker';
import StatementsEditor from './StatementsEditor';
import SetParametersEditor from './SetParametersEditor';
import sharedStyles from '@components/shared/SharedComponents.module.css';
import styles from '../ComponentPage.module.css';

export interface ControlImplementationsEditorProps {
  controlImplementations?: ComponentControlImplementation[];
  onChange: (impls: ComponentControlImplementation[]) => void;
  editMode?: boolean;
}

export const ControlImplementationsEditor: React.FC<ControlImplementationsEditorProps> = ({
  controlImplementations = [],
  onChange,
  editMode = false
}) => {
  const [activeTreePickerIdx, setActiveTreePickerIdx] = useState<number | null>(null);
  const [expandedReqs, setExpandedReqs] = useState<Record<string, boolean>>({});
  const [reqSearchQueries, setReqSearchQueries] = useState<Record<number, string>>({});
  const implsRef = React.useRef(controlImplementations);
  React.useEffect(() => {
    implsRef.current = controlImplementations;
  }, [controlImplementations]);

  // 1. Implementation Set Actions
  const addImplementationSet = () => {
    if (!editMode) return;
    const newImpl: ComponentControlImplementation = {
      uuid: generateUUID(),
      source: 'https://oscal.nist.gov/catalogs/sp800-53',
      description: 'Control implementation set description',
      props: [],
      links: [],
      'set-parameters': [],
      'implemented-requirements': []
    };
    const next = [...implsRef.current, newImpl];
    implsRef.current = next;
    onChange(next);
  };

  const updateImplementationSet = (idx: number, patch: Partial<ComponentControlImplementation>) => {
    if (!editMode) return;
    const updated = [...implsRef.current];
    updated[idx] = { ...updated[idx], ...patch };
    implsRef.current = updated;
    onChange(updated);
  };

  const removeImplementationSet = (idx: number) => {
    if (!editMode) return;
    const updated = implsRef.current.filter((_, i) => i !== idx);
    implsRef.current = updated;
    onChange(updated);
  };

  // 2. Implemented Requirements Actions
  const addSingleRequirement = (implIdx: number) => {
    if (!editMode) return;
    const currentImpl = implsRef.current[implIdx];
    if (!currentImpl) return;
    const newReq: ComponentImplementedRequirement = {
      uuid: generateUUID(),
      'control-id': 'new-control',
      description: 'Control implementation description.',
      props: [],
      links: [],
      'set-parameters': [],
      statements: [],
      'responsible-roles': []
    };
    const updatedReqs = [...(currentImpl['implemented-requirements'] || []), newReq];
    updateImplementationSet(implIdx, { 'implemented-requirements': updatedReqs });
    setExpandedReqs(prev => ({ ...prev, [`${implIdx}-${newReq.uuid}`]: true }));
  };

  const handleBulkAddControls = (implIdx: number, selectedControls: Array<{ controlId: string; title?: string }>) => {
    if (!editMode) return;
    const currentImpl = implsRef.current[implIdx];
    if (!currentImpl) return;
    const existingReqs = currentImpl['implemented-requirements'] || [];
    const existingIds = new Set(existingReqs.map(r => r['control-id'].toLowerCase()));

    const newReqs: ComponentImplementedRequirement[] = [];
    selectedControls.forEach(c => {
      if (!existingIds.has(c.controlId.toLowerCase())) {
        newReqs.push({
          uuid: generateUUID(),
          'control-id': c.controlId,
          description: `Implementation narrative for ${c.controlId.toUpperCase()}${c.title ? ` (${c.title})` : ''}.`,
          props: [],
          links: [],
          'set-parameters': [],
          statements: [],
          'responsible-roles': []
        });
      }
    });

    updateImplementationSet(implIdx, {
      'implemented-requirements': [...existingReqs, ...newReqs]
    });
  };

  const updateRequirement = (implIdx: number, reqIdx: number, patch: Partial<ComponentImplementedRequirement>) => {
    if (!editMode) return;
    const currentImpl = implsRef.current[implIdx];
    if (!currentImpl) return;
    const updatedReqs = [...(currentImpl['implemented-requirements'] || [])];
    updatedReqs[reqIdx] = { ...updatedReqs[reqIdx], ...patch };
    updateImplementationSet(implIdx, { 'implemented-requirements': updatedReqs });
  };

  const removeRequirement = (implIdx: number, reqIdx: number) => {
    if (!editMode) return;
    const currentImpl = implsRef.current[implIdx];
    if (!currentImpl) return;
    const updatedReqs = (currentImpl['implemented-requirements'] || []).filter((_, i) => i !== reqIdx);
    updateImplementationSet(implIdx, { 'implemented-requirements': updatedReqs });
  };

  return (
    <div className={styles['control-impl-list']} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {controlImplementations.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', background: 'var(--surface-alt, #f9fafb)', borderRadius: '6px', border: '1px dashed var(--color-border, #e5e7eb)' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--color-text-muted, #6b7280)' }}>
            No control implementation sets declared. Connect this component to compliance frameworks (NIST SP 800-53, BSI IT-Grundschutz, etc.).
          </p>
          {editMode && (
            <button
              type="button"
              className={['btn', sharedStyles['btn-primary'], sharedStyles['btn-sm']].filter(Boolean).join(' ')}
              onClick={addImplementationSet}
            >
              + Add Control Implementation Set
            </button>
          )}
        </div>
      ) : (
        controlImplementations.map((impl, iIdx) => {
          const reqs = impl['implemented-requirements'] || [];
          const searchQ = (reqSearchQueries[iIdx] || '').trim().toLowerCase();
          const filteredReqs = searchQ
            ? reqs.filter(r => r['control-id'].toLowerCase().includes(searchQ) || (r.description && r.description.toLowerCase().includes(searchQ)))
            : reqs;

          return (
            <div
              key={impl.uuid || iIdx}
              className={styles['impl-item']}
              style={{
                padding: '1.25rem',
                border: '1px solid var(--color-border, #e5e7eb)',
                borderRadius: '8px',
                background: 'var(--color-surface, #ffffff)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              {/* Implementation Set Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border, #f3f4f6)', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '16px' }}>🛡️</span>
                  <div>
                    <h5 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--color-text, #111827)' }}>
                      Implementation Set #{iIdx + 1}
                    </h5>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted, #6b7280)' }}>
                      UUID: <code>{impl.uuid}</code>
                    </span>
                  </div>
                </div>

                {editMode && (
                  <button
                    type="button"
                    className={['btn', 'btn-danger', sharedStyles['btn-sm']].filter(Boolean).join(' ')}
                    onClick={() => removeImplementationSet(iIdx)}
                  >
                    Delete Set
                  </button>
                )}
              </div>

              {/* 1. Source Document Picker */}
              <div className={styles['form-group']}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Source Framework (Catalog / Profile) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <SourceDocumentPicker
                  value={impl.source || ''}
                  onChange={(source) => updateImplementationSet(iIdx, { source })}
                  disabled={!editMode}
                />
              </div>

              {/* 2. Set Description */}
              <div className={styles['form-group']}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Implementation Set Description <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {editMode ? (
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={impl.description || ''}
                    onChange={(e) => updateImplementationSet(iIdx, { description: e.target.value })}
                    placeholder="Describe how the component generally fulfills controls in this framework..."
                  />
                ) : (
                  <div className={styles['prose-readonly']}>
                    <ProseWithParams value={impl.description} disabled />
                  </div>
                )}
              </div>

              {/* 3. Baseline Set-Parameters (Set Level) */}
              <SetParametersEditor
                setParameters={impl['set-parameters'] || []}
                onChange={(params) => updateImplementationSet(iIdx, { 'set-parameters': params })}
                editMode={editMode}
                level="set"
              />

              {/* 4. Implemented Requirements Section */}
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h5 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--color-text, #111827)' }}>
                      Implemented Requirements ({reqs.length})
                    </h5>
                  </div>

                  {editMode && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className={['btn', sharedStyles['btn-secondary'], sharedStyles['btn-sm']].filter(Boolean).join(' ')}
                        onClick={() => setActiveTreePickerIdx(iIdx)}
                        title="Browse and bulk select controls from referenced source"
                      >
                        🌲 Browse &amp; Bulk Add Controls...
                      </button>
                      <button
                        type="button"
                        className={['btn', sharedStyles['btn-primary'], sharedStyles['btn-sm']].filter(Boolean).join(' ')}
                        onClick={() => addSingleRequirement(iIdx)}
                      >
                        + Add Single
                      </button>
                    </div>
                  )}
                </div>

                {/* Search Bar for Requirements */}
                {reqs.length > 5 && (
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Filter requirements by Control ID..."
                    value={reqSearchQueries[iIdx] || ''}
                    onChange={(e) => setReqSearchQueries(prev => ({ ...prev, [iIdx]: e.target.value }))}
                    style={{ fontSize: '12px' }}
                  />
                )}

                {/* Requirements List */}
                {filteredReqs.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', background: 'var(--surface-alt, #f9fafb)', borderRadius: '6px', fontSize: '12px', color: 'var(--color-text-muted, #6b7280)' }}>
                    No requirements implemented for this set yet. Click "Browse & Bulk Add Controls" to load from source.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filteredReqs.map((req) => {
                      const origIdx = reqs.findIndex(r => r.uuid === req.uuid);
                      const rIdx = origIdx !== -1 ? origIdx : reqs.indexOf(req);
                      const reqKey = `${iIdx}-${req.uuid || rIdx}`;
                      const isExpanded = expandedReqs[reqKey] ?? true;

                      return (
                        <div
                          key={req.uuid || rIdx}
                          style={{
                            border: '1px solid var(--color-border, #e5e7eb)',
                            borderRadius: '6px',
                            background: 'var(--color-surface, #ffffff)',
                            overflow: 'hidden'
                          }}
                        >
                          {/* Requirement Header */}
                          <div
                            style={{
                              padding: '8px 12px',
                              background: 'var(--surface-alt, #f9fafb)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              cursor: 'pointer',
                              borderBottom: isExpanded ? '1px solid var(--color-border, #e5e7eb)' : 'none'
                            }}
                            onClick={() => setExpandedReqs(prev => ({ ...prev, [reqKey]: !isExpanded }))}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '10px', color: '#6b7280' }}>{isExpanded ? '▼' : '▶'}</span>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', color: 'var(--color-accent, #2563eb)' }}>
                                {req['control-id']?.toUpperCase() || 'UNTITLED'}
                              </span>
                              <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #6b7280)' }}>
                                {req.description ? (req.description.length > 60 ? `${req.description.substring(0, 60)}...` : req.description) : 'No narrative'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                              {(req.statements || []).length > 0 && (
                                <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '4px' }}>
                                  {req.statements.length} smt(s)
                                </span>
                              )}
                              {(req['set-parameters'] || []).length > 0 && (
                                <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: '4px' }}>
                                  {req['set-parameters'].length} param(s)
                                </span>
                              )}
                              {editMode && (
                                <button
                                  type="button"
                                  className={['btn', 'btn-danger', sharedStyles['btn-sm']].filter(Boolean).join(' ')}
                                  style={{ padding: '2px 6px', fontSize: '11px' }}
                                  onClick={() => removeRequirement(iIdx, rIdx)}
                                  title="Remove requirement"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Expanded Requirement Body */}
                          {isExpanded && (
                            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {/* Control ID & Narrative */}
                              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <div style={{ flex: '0 0 200px' }}>
                                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>
                                    Control ID <span style={{ color: '#ef4444' }}>*</span>
                                  </label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    style={{ fontFamily: 'monospace', fontSize: '12px' }}
                                    value={req['control-id'] || ''}
                                    onChange={(e) => updateRequirement(iIdx, rIdx, { 'control-id': e.target.value })}
                                    disabled={!editMode}
                                  />
                                </div>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>
                                  Implementation Narrative <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                {editMode ? (
                                  <ProseWithParams
                                    value={req.description || ''}
                                    onChange={(val) => updateRequirement(iIdx, rIdx, { description: val })}
                                    placeholder="Describe how the component implements this control..."
                                    rows={2}
                                  />
                                ) : (
                                  <div className={styles['prose-readonly']}>
                                    <ProseWithParams value={req.description} disabled />
                                  </div>
                                )}
                              </div>

                              {/* Requirement-Level Set-Parameters */}
                              <SetParametersEditor
                                setParameters={req['set-parameters'] || []}
                                onChange={(params) => updateRequirement(iIdx, rIdx, { 'set-parameters': params })}
                                editMode={editMode}
                                level="requirement"
                              />

                              {/* Structured Statements Editor */}
                              <StatementsEditor
                                statements={req.statements || []}
                                controlId={req['control-id']}
                                onChange={(statements) => updateRequirement(iIdx, rIdx, { statements })}
                                editMode={editMode}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Control Tree Picker Modal */}
              {activeTreePickerIdx === iIdx && (
                <ControlTreePicker
                  source={impl.source || ''}
                  existingControlIds={(impl['implemented-requirements'] || []).map(r => r['control-id'])}
                  onAddControls={(controls) => handleBulkAddControls(iIdx, controls)}
                  isOpen={true}
                  onClose={() => setActiveTreePickerIdx(null)}
                />
              )}
            </div>
          );
        })
      )}

      {editMode && controlImplementations.length > 0 && (
        <button
          type="button"
          className={['btn', sharedStyles['btn-primary'], sharedStyles['btn-sm']].filter(Boolean).join(' ')}
          style={{ alignSelf: 'flex-start' }}
          onClick={addImplementationSet}
        >
          + Add Another Implementation Set
        </button>
      )}
    </div>
  );
};

export default ControlImplementationsEditor;
