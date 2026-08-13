import React from 'react';
import styles from '../SharedComponents.module.css';
import metaStyles from './Metadata.module.css';
import { DebouncedInput } from '../DebouncedInput';
import { PropsEditor } from '../PropsEditor';
import { LinksEditor } from '../LinksEditor';
import { generateUUID } from '@lib/oscal-utils';

export function MetadataRevisionsPanel({ metadata, readOnly, expandedSections, toggleSection, handleFieldChange }) {
  // --- Revisions CRUD ---
  const handleAddRevision = () => {
    const revisions = metadata.revisions ? [...metadata.revisions] : [];
    handleFieldChange('revisions', [...revisions, {
      title: 'Revision',
      version: metadata.version || '1.0.0',
      published: new Date().toISOString(),
      'oscal-version': metadata['oscal-version'] || '1.1.2'
    }]);
  };

  const handleRevisionChange = (idx, field, val) => {
    const revisions = (metadata.revisions || []).map((item, i) => i === idx ? { ...item, [field]: val } : item);
    handleFieldChange('revisions', revisions);
  };

  const handleRemoveRevision = (idx) => {
    handleFieldChange('revisions', (metadata.revisions || []).filter((_, i) => i !== idx));
  };

  // --- Actions CRUD ---
  const handleAddAction = () => {
    const actions = metadata.actions ? [...metadata.actions] : [];
    handleFieldChange('actions', [...actions, {
      uuid: generateUUID(),
      type: 'review',
      date: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      system: ''
    }]);
  };

  const handleActionChange = (idx, field, val) => {
    const actions = (metadata.actions || []).map((item, i) => i === idx ? { ...item, [field]: val } : item);
    handleFieldChange('actions', actions);
  };

  const handleRemoveAction = (idx) => {
    handleFieldChange('actions', (metadata.actions || []).filter((_, i) => i !== idx));
  };

  return (
    <>
      {/* 7. Revision History */}
      <div className={metaStyles['metadata-section']} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-primary)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div
          onClick={() => toggleSection('revisions')}
          style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '800', fontSize: '14px', color: 'var(--color-text)', borderBottom: expandedSections.revisions ? '1px solid var(--color-border)' : 'none' }}
        >
          <span>Revision History ({metadata.revisions?.length || 0})</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{expandedSections.revisions ? '▼' : '▶'}</span>
        </div>
        {expandedSections.revisions && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(!metadata.revisions || metadata.revisions.length === 0) ? (
              <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>No formal revision entries defined.</p>
            ) : (
              metadata.revisions.map((rev, idx) => (
                <div key={idx} style={{ padding: '10px', background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <DebouncedInput
                      value={rev.title || ''}
                      onChange={(val) => handleRevisionChange(idx, 'title', val)}
                      placeholder="Revision Title"
                      className="form-input"
                      style={{ flex: 2, height: '28px', fontSize: '12px' }}
                      disabled={readOnly}
                    />
                    <DebouncedInput
                      value={rev.version || ''}
                      onChange={(val) => handleRevisionChange(idx, 'version', val)}
                      placeholder="Version"
                      className="form-input"
                      style={{ flex: 1, height: '28px', fontSize: '12px' }}
                      disabled={readOnly}
                    />
                    {!readOnly && (
                      <button type="button" className={styles['btn-delete']} onClick={() => handleRemoveRevision(idx)} style={{ padding: '2px 6px' }}>🗑</button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Published Date</label>
                      <DebouncedInput
                        value={rev.published || ''}
                        onChange={(val) => handleRevisionChange(idx, 'published', val)}
                        placeholder="ISO Date"
                        className="form-input"
                        style={{ width: '100%', height: '26px', fontSize: '11px' }}
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>OSCAL Version</label>
                      <DebouncedInput
                        value={rev['oscal-version'] || ''}
                        onChange={(val) => handleRevisionChange(idx, 'oscal-version', val)}
                        placeholder="1.1.2"
                        className="form-input"
                        style={{ width: '100%', height: '26px', fontSize: '11px' }}
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                  <DebouncedInput
                    value={rev.remarks || ''}
                    onChange={(val) => handleRevisionChange(idx, 'remarks', val)}
                    placeholder="Revision remarks / change notes..."
                    className="form-input"
                    style={{ width: '100%', height: '26px', fontSize: '11px' }}
                    disabled={readOnly}
                  />
                </div>
              ))
            )}
            {!readOnly && (
              <button type="button" className={[styles['btn-secondary'], styles['btn-sm']].filter(Boolean).join(' ')} onClick={handleAddRevision}>➕ Add Revision Entry</button>
            )}
          </div>
        )}
      </div>

      {/* 7b. Audit Actions */}
      <div className={metaStyles['metadata-section']} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-warning)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div
          onClick={() => toggleSection('actions')}
          style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '800', fontSize: '14px', color: 'var(--color-text)', borderBottom: expandedSections.actions ? '1px solid var(--color-border)' : 'none' }}
        >
          <span>Audit Actions ({metadata.actions?.length || 0})</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{expandedSections.actions ? '▼' : '▶'}</span>
        </div>
        {expandedSections.actions && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {(!metadata.actions || metadata.actions.length === 0) ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', margin: 0 }}>No audit actions defined.</p>
            ) : (
              metadata.actions.map((act, idx) => (
                <div key={act.uuid || idx} style={{ padding: '12px', border: '1px solid var(--color-border-subtle)', borderRadius: '6px', background: 'var(--color-bg-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>{act.uuid}</span>
                    {!readOnly && (
                      <button type="button" className="btn-danger btn-xs" onClick={() => handleRemoveAction(idx)}>🗑 Delete Action</button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Action Type</label>
                      <DebouncedInput
                        value={act.type || ''}
                        onChange={(val) => handleActionChange(idx, 'type', val)}
                        placeholder="e.g. review, approval"
                        className="form-input"
                        style={{ width: '100%', height: '26px', fontSize: '11px' }}
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Date</label>
                      <DebouncedInput
                        value={act.date || ''}
                        onChange={(val) => handleActionChange(idx, 'date', val)}
                        placeholder="YYYY-MM-DDTHH:MM:SSZ"
                        className="form-input"
                        style={{ width: '100%', height: '26px', fontSize: '11px' }}
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>System URI</label>
                      <DebouncedInput
                        value={act.system || ''}
                        onChange={(val) => handleActionChange(idx, 'system', val)}
                        placeholder="https://..."
                        className="form-input"
                        style={{ width: '100%', height: '26px', fontSize: '11px' }}
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Remarks</label>
                    <DebouncedInput
                      value={act.remarks || ''}
                      onChange={(val) => handleActionChange(idx, 'remarks', val)}
                      placeholder="Action remarks / review details..."
                      className="form-input"
                      style={{ width: '100%', height: '26px', fontSize: '11px' }}
                      disabled={readOnly}
                    />
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Action Properties</span>
                    <PropsEditor
                      props={act.props || []}
                      onChange={(props) => handleActionChange(idx, 'props', props.length > 0 ? props : undefined)}
                      readOnly={readOnly}
                    />
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Action Links</span>
                    <LinksEditor
                      links={act.links || []}
                      onChange={(links) => handleActionChange(idx, 'links', links.length > 0 ? links : undefined)}
                      readOnly={readOnly}
                    />
                  </div>
                </div>
              ))
            )}
            {!readOnly && (
              <button type="button" className={[styles['btn-secondary'], styles['btn-sm']].filter(Boolean).join(' ')} onClick={handleAddAction}>➕ Add Audit Action</button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
