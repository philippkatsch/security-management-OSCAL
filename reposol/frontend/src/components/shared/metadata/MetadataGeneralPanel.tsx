import React from 'react';
import styles from '../SharedComponents.module.css';
import metaStyles from './Metadata.module.css';
import { DebouncedInput } from '../DebouncedInput';
import { PropsEditor } from '../PropsEditor';
import { LinksEditor } from '../LinksEditor';
import { isValidIsoDateTime } from '@lib/oscal-utils';

export function MetadataGeneralPanel({ metadata, readOnly, expandedSections, toggleSection, handleFieldChange }) {
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
            <PropsEditor
              props={metadata.props || []}
              onChange={(props) => handleFieldChange('props', props.length > 0 ? props : undefined)}
              readOnly={readOnly}
            />
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
