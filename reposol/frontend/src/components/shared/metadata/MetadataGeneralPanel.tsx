import React from 'react';
import styles from '../SharedComponents.module.css';
import metaStyles from './Metadata.module.css';
import { DebouncedInput } from '../DebouncedInput';
import { PropsEditor } from '../PropsEditor';
import { LinksEditor } from '../LinksEditor';
import { isValidIsoDateTime } from '@lib/oscal-utils';

export function MetadataGeneralPanel({ metadata, readOnly, expandedSections, toggleSection, handleFieldChange, onNavigateToProperties }: any) {
  // --- Document IDs CRUD ---
  const handleAddDocId = () => {
    const docIds = metadata['document-ids'] ? [...metadata['document-ids']] : [];
    handleFieldChange('document-ids', [...docIds, { scheme: '', identifier: '' }]);
  };

  const handleDocIdChange = (idx, field, val) => {
    const docIds = metadata['document-ids'].map((item, i) => i === idx ? { ...item, [field]: val } : item);
    handleFieldChange('document-ids', docIds);
  };

  const handleRemoveDocId = (idx) => {
    handleFieldChange('document-ids', metadata['document-ids'].filter((_, i) => i !== idx));
  };

  return (
    <>
      {/* 1. General Info */}
      <div className={metaStyles['metadata-section']} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-primary)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div
          onClick={() => toggleSection('general')}
          style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '800', fontSize: '14px', color: 'var(--color-text)', borderBottom: expandedSections.general ? '1px solid var(--color-border)' : 'none' }}
        >
          <span>General Metadata</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{expandedSections.general ? '▼' : '▶'}</span>
        </div>
        {expandedSections.general && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Document Title</label>
              <DebouncedInput
                value={metadata.title || ''}
                onChange={(val) => handleFieldChange('title', val)}
                className="form-input"
                aria-label="Document Title"
                data-testid="metadata-title-input"
                style={{ width: '100%', height: '32px' }}
                disabled={readOnly}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Version</label>
                <DebouncedInput
                  value={metadata.version || ''}
                  onChange={(val) => handleFieldChange('version', val)}
                  className="form-input"
                  style={{ width: '100%', height: '32px' }}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>OSCAL Version</label>
                <DebouncedInput
                  value={metadata['oscal-version'] || '1.1.2'}
                  onChange={(val) => handleFieldChange('oscal-version', val)}
                  className="form-input"
                  style={{ width: '100%', height: '32px' }}
                  disabled={readOnly}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Published Date</label>
                {(() => {
                  const isPubValid = isValidIsoDateTime(metadata.published);
                  return (
                    <>
                      <DebouncedInput
                        value={metadata.published || ''}
                        onChange={(val) => handleFieldChange('published', val)}
                        placeholder="YYYY-MM-DDTHH:MM:SSZ"
                        className="form-input"
                        style={{
                          width: '100%',
                          height: '32px',
                          border: !isPubValid ? '1px solid var(--color-danger, #ef4444)' : '1px solid var(--color-border)',
                          boxShadow: !isPubValid ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : 'none'
                        }}
                        disabled={readOnly}
                      />
                      {!isPubValid && (
                        <div style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>⚠️ Must be ISO 8601 format (e.g. 2026-07-22T18:00:00Z)</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Last Modified</label>
                <input
                  type="text"
                  value={metadata['last-modified'] || ''}
                  className="form-input"
                  style={{ width: '100%', height: '32px' }}
                  disabled={true}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Remarks</label>
              <DebouncedInput
                value={metadata.remarks || ''}
                onChange={(val) => handleFieldChange('remarks', val)}
                className="form-input"
                style={{ width: '100%', height: '32px' }}
                disabled={readOnly}
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Document IDs */}
      <div className={metaStyles['metadata-section']} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-accent)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div
          onClick={() => toggleSection('documentIds')}
          style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '800', fontSize: '14px', color: 'var(--color-text)', borderBottom: expandedSections.documentIds ? '1px solid var(--color-border)' : 'none' }}
        >
          <span>Document Identifiers ({metadata['document-ids']?.length || 0})</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{expandedSections.documentIds ? '▼' : '▶'}</span>
        </div>
        {expandedSections.documentIds && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(!metadata['document-ids'] || metadata['document-ids'].length === 0) ? (
              <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>No document IDs defined.</p>
            ) : (
              metadata['document-ids'].map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <DebouncedInput
                    value={item.scheme || ''}
                    onChange={(val) => handleDocIdChange(idx, 'scheme', val)}
                    placeholder="Scheme (e.g. doi)"
                    className="form-input"
                    style={{ flex: 1, height: '30px' }}
                    disabled={readOnly}
                  />
                  <DebouncedInput
                    value={item.identifier || ''}
                    onChange={(val) => handleDocIdChange(idx, 'identifier', val)}
                    placeholder="Identifier"
                    className="form-input"
                    style={{ flex: 2, height: '30px' }}
                    disabled={readOnly}
                  />
                  {!readOnly && (
                    <button type="button" className={styles['btn-delete']} onClick={() => handleRemoveDocId(idx)} style={{ padding: '4px 8px' }}>🗑</button>
                  )}
                </div>
              ))
            )}
            {!readOnly && (
              <button type="button" className={[styles['btn-secondary'], styles['btn-sm']].filter(Boolean).join(' ')} onClick={handleAddDocId} style={{ marginTop: '4px' }}>➕ Add ID</button>
            )}
          </div>
        )}
      </div>

      {/* 8. Global Properties */}
      <div className={metaStyles['metadata-section']} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-accent)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div
          onClick={() => toggleSection('props')}
          style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '800', fontSize: '14px', color: 'var(--color-text)', borderBottom: expandedSections.props ? '1px solid var(--color-border)' : 'none' }}
        >
          <span>Global Document Properties ({metadata.props?.length || 0})</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{expandedSections.props ? '▼' : '▶'}</span>
        </div>
        {expandedSections.props && (
          <div style={{ padding: '20px' }}>
            {onNavigateToProperties ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                  Global document properties are defined at the document header level and are centrally managed in the <strong>Properties</strong> tab.
                </p>
                {metadata.props && metadata.props.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {metadata.props.map((p: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          background: 'var(--color-surface-2)',
                          border: '1px solid var(--color-border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '6px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px'
                        }}
                      >
                        <strong style={{ color: 'var(--color-text)' }}>{p.name || '(unnamed)'}</strong>
                        {p.value !== undefined && (
                          <span className="badge" style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)', fontSize: '11px', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            {p.value}
                          </span>
                        )}
                        {p.class && (
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>class: {p.class}</span>
                        )}
                        {p.ns && (
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>ns: {p.ns}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    No global document properties defined.
                  </div>
                )}
                <div>
                  <button
                    type="button"
                    className={styles['btn-secondary']}
                    onClick={onNavigateToProperties}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '12px' }}
                  >
                    🏷️ Manage in Properties Tab
                  </button>
                </div>
              </div>
            ) : (
              <PropsEditor
                props={metadata.props || []}
                onChange={(props) => handleFieldChange('props', props.length > 0 ? props : undefined)}
                readOnly={readOnly}
              />
            )}
          </div>
        )}
      </div>

      {/* 9. Global Links */}
      <div className={metaStyles['metadata-section']} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-primary)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div
          onClick={() => toggleSection('links')}
          style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '800', fontSize: '14px', color: 'var(--color-text)', borderBottom: expandedSections.links ? '1px solid var(--color-border)' : 'none' }}
        >
          <span>Global Document Links ({metadata.links?.length || 0})</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{expandedSections.links ? '▼' : '▶'}</span>
        </div>
        {expandedSections.links && (
          <div style={{ padding: '20px' }}>
            <LinksEditor
              links={metadata.links || []}
              onChange={(links) => handleFieldChange('links', links.length > 0 ? links : undefined)}
              readOnly={readOnly}
            />
          </div>
        )}
      </div>
    </>
  );
}
