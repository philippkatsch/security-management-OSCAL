import React, { useState } from 'react';
import { DebouncedInput } from './DebouncedInput';
import { generateUUID } from '../../lib/oscal-utils';
import { PropsEditor } from './PropsEditor';
import { LinksEditor } from './LinksEditor';

/**
 * Back Matter & Resources CRUD editor.
 */
export function BackMatterEditor({
  backMatter = {},
  onChange,
  readOnly = false
}) {
  const [expandedIndices, setExpandedIndices] = useState({});

  const resources = backMatter.resources || [];

  const handleResourcesChange = (updatedResources) => {
    if (updatedResources.length === 0) {
      const { resources: _, ...rest } = backMatter;
      onChange(rest);
    } else {
      onChange({ ...backMatter, resources: updatedResources });
    }
  };

  const handleResourceChange = (idx, field, val) => {
    const updated = resources.map((r, i) => {
      if (i === idx) {
        return { ...r, [field]: val };
      }
      return r;
    });
    handleResourcesChange(updated);
  };

  const handleAddResource = () => {
    const updated = [...resources, {
      uuid: generateUUID(),
      title: 'New Resource',
      description: ''
    }];
    handleResourcesChange(updated);
    setExpandedIndices(prev => ({ ...prev, [resources.length]: true }));
  };

  const handleRemoveResource = (idx) => {
    handleResourcesChange(resources.filter((_, i) => i !== idx));
  };

  const toggleExpand = (idx) => {
    setExpandedIndices(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Base64 File Attachment Helper
  const handleFileUpload = (idx, e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result.split(',')[1];
      const base64Data = {
        filename: file.name,
        'media-type': file.type,
        value: base64String
      };
      handleResourceChange(idx, 'base64', base64Data);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = (idx) => {
    const p = resources[idx];
    const { base64: _, ...rest } = p;
    handleResourcesChange(resources.map((item, i) => i === idx ? rest : item));
  };

  // Citation helpers
  const handleCitationChange = (idx, field, val) => {
    const r = resources[idx];
    const cit = r.citation ? { ...r.citation } : { text: '' };
    if (val === undefined) delete cit[field];
    else cit[field] = val;
    handleResourceChange(idx, 'citation', cit);
  };

  // Resource Document IDs helpers
  const handleAddResourceDocId = (idx) => {
    const r = resources[idx];
    const docIds = r['document-ids'] ? [...r['document-ids']] : [];
    handleResourceChange(idx, 'document-ids', [...docIds, { scheme: '', identifier: '' }]);
  };

  const handleResourceDocIdChange = (rIdx, docIdIdx, field, val) => {
    const r = resources[rIdx];
    const docIds = (r['document-ids'] || []).map((d, i) => i === docIdIdx ? { ...d, [field]: val } : d);
    handleResourceChange(rIdx, 'document-ids', docIds);
  };

  const handleRemoveResourceDocId = (rIdx, docIdIdx) => {
    const r = resources[rIdx];
    const docIds = (r['document-ids'] || []).filter((_, i) => i !== docIdIdx);
    handleResourceChange(rIdx, 'document-ids', docIds.length > 0 ? docIds : undefined);
  };

  // Rlinks helpers
  const handleRlinksChange = (idx, rlinks) => {
    handleResourceChange(idx, 'rlinks', rlinks);
  };

  const handleAddRlink = (idx) => {
    const r = resources[idx];
    const rlinks = r.rlinks ? [...r.rlinks] : [];
    handleRlinksChange(idx, [...rlinks, { href: '', 'media-type': '' }]);
  };

  const handleRemoveRlink = (idx, rlinkIdx) => {
    const r = resources[idx];
    const rlinks = r.rlinks ? r.rlinks.filter((_, i) => i !== rlinkIdx) : [];
    handleRlinksChange(idx, rlinks);
  };

  const handleRlinkChange = (idx, rlinkIdx, field, val) => {
    const r = resources[idx];
    const rlinks = r.rlinks.map((rl, i) => {
      if (i === rlinkIdx) {
        if (field === 'hashes') {
          // values input is comma-separated algorithm:value
          const arr = val.split(',').map(s => {
            const parts = s.trim().split(':');
            if (parts.length === 2) {
              return { algorithm: parts[0].trim(), value: parts[1].trim() };
            }
            return null;
          }).filter(h => h !== null);
          return { ...rl, hashes: arr };
        }
        return { ...rl, [field]: val };
      }
      return rl;
    });
    handleRlinksChange(idx, rlinks);
  };

  return (
    <div className="back-matter-editor card-body">
      <h4 style={{ margin: '12px 0 12px 0', fontSize: '14px', color: 'var(--color-text-muted)' }}>Back Matter / Resources</h4>

      {resources.length === 0 ? (
        <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px', margin: '0 0 8px 0' }}>
          No resources defined in back matter.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {resources.map((r, idx) => {
            const isExpanded = expandedIndices[idx];
            const citation = r.citation || { text: '' };
            const rlinks = r.rlinks || [];
            const base64 = r.base64 || null;

            return (
              <div
                key={r.uuid || idx}
                className="resource-card"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderLeft: '4px solid var(--color-accent)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-sm)',
                  overflow: 'hidden',
                  marginBottom: '12px'
                }}
              >
                {/* Header Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: isExpanded ? '1px solid var(--color-border)' : 'none',
                    cursor: 'pointer'
                  }}
                  onClick={() => toggleExpand(idx)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {isExpanded ? '▼' : '▶'}
                    </span>
                    <strong style={{ fontSize: '13px', color: 'var(--color-text)' }}>{r.title || 'Untitled Resource'}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>#{r.uuid.substring(0, 8)}</span>
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      className="btn-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveResource(idx);
                      }}
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      🗑
                    </button>
                  )}
                </div>

                {/* Expanded Fields */}
                {isExpanded && (
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Resource Title</label>
                        <DebouncedInput
                          value={r.title || ''}
                          onChange={(val) => handleResourceChange(idx, 'title', val)}
                          className="form-input"
                          style={{ width: '100%', height: '30px', fontSize: '12px' }}
                          disabled={readOnly}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Resource UUID</label>
                        <input
                          type="text"
                          value={r.uuid}
                          className="form-input"
                          style={{ width: '100%', height: '30px', fontSize: '11px' }}
                          disabled={true}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Description</label>
                      <DebouncedInput
                        value={r.description || ''}
                        onChange={(val) => handleResourceChange(idx, 'description', val)}
                        className="form-input"
                        style={{ width: '100%', height: '30px', fontSize: '12px' }}
                        disabled={readOnly}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Remarks / Notes</label>
                      <DebouncedInput
                        value={r.remarks || ''}
                        onChange={(val) => handleResourceChange(idx, 'remarks', val || undefined)}
                        placeholder="Resource remarks / notes..."
                        className="form-input"
                        style={{ width: '100%', height: '30px', fontSize: '12px' }}
                        disabled={readOnly}
                      />
                    </div>

                    {/* Properties editor */}
                    <PropsEditor
                      props={r.props || []}
                      onChange={(props) => handleResourceChange(idx, 'props', props.length > 0 ? props : undefined)}
                      readOnly={readOnly}
                    />

                    {/* Resource Links editor */}
                    <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>Resource Links</span>
                      <LinksEditor
                        links={r.links || []}
                        onChange={(links) => handleResourceChange(idx, 'links', links.length > 0 ? links : undefined)}
                        readOnly={readOnly}
                      />
                    </div>

                    {/* Citation section */}
                    <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-muted)', display: 'block' }}>Citation</span>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block' }}>Citation Text</label>
                        <DebouncedInput
                          value={citation.text || ''}
                          onChange={(val) => handleCitationChange(idx, 'text', val)}
                          placeholder="e.g. NIST SP 800-53 Rev. 5, September 2020"
                          className="form-input"
                          style={{ width: '100%', height: '28px', fontSize: '12px' }}
                          disabled={readOnly}
                        />
                      </div>
                      <PropsEditor
                        props={citation.props || []}
                        onChange={(cProps) => handleCitationChange(idx, 'props', cProps.length > 0 ? cProps : undefined)}
                        readOnly={readOnly}
                      />
                    </div>

                    {/* Rlinks section */}
                    <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-muted)' }}>Resource Links (Rlinks)</span>
                        {!readOnly && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleAddRlink(idx)}
                            style={{ padding: '2px 6px', fontSize: '10px' }}
                          >
                            ➕ Add Link
                          </button>
                        )}
                      </div>
                      {rlinks.map((rl, rlIdx) => (
                        <div
                          key={rlIdx}
                          style={{
                            padding: '8px',
                            background: 'var(--color-surface-2)',
                            borderRadius: 'var(--radius-sm)',
                            marginBottom: '6px',
                            border: '1px solid var(--color-border-subtle)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}
                        >
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <DebouncedInput
                              value={rl.href || ''}
                              onChange={(val) => handleRlinkChange(idx, rlIdx, 'href', val)}
                              placeholder="href URL"
                              className="form-input"
                              style={{ flex: 2, height: '26px', fontSize: '11px' }}
                              disabled={readOnly}
                            />
                            <DebouncedInput
                              value={rl['media-type'] || ''}
                              onChange={(val) => handleRlinkChange(idx, rlIdx, 'media-type', val)}
                              placeholder="media-type"
                              className="form-input"
                              style={{ flex: 1, height: '26px', fontSize: '11px' }}
                              disabled={readOnly}
                            />
                            {!readOnly && (
                              <button
                                type="button"
                                className="btn-delete"
                                onClick={() => handleRemoveRlink(idx, rlIdx)}
                                style={{ height: '26px', padding: '0 6px' }}
                              >
                                🗑
                              </button>
                            )}
                          </div>
                          <div>
                            <label style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>Hashes (comma-separated sha256:value)</label>
                            <DebouncedInput
                              value={rl.hashes ? rl.hashes.map(h => `${h.algorithm}:${h.value}`).join(', ') : ''}
                              onChange={(val) => handleRlinkChange(idx, rlIdx, 'hashes', val)}
                              placeholder="sha256:abcd..."
                              className="form-input"
                              style={{ width: '100%', height: '24px', fontSize: '11px' }}
                              disabled={readOnly}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Base64 embedded attachments */}
                    <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>Embedded Attachment</span>
                      {base64 ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface-2)', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>📎 {base64.filename}</span>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginLeft: '8px' }}>({base64['media-type']})</span>
                          </div>
                          {!readOnly && (
                            <button
                              type="button"
                              className="btn-delete"
                              onClick={() => handleRemoveFile(idx)}
                              style={{ padding: '2px 6px', fontSize: '11px' }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ) : (
                        !readOnly && (
                          <input
                            type="file"
                            onChange={(e) => handleFileUpload(idx, e)}
                            style={{ fontSize: '12px' }}
                          />
                        )
                      )}
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!readOnly && (
        <button
          type="button"
          className="btn-secondary"
          onClick={handleAddResource}
          style={{ marginTop: '8px', width: '100%', padding: '6px', fontSize: '12px' }}
        >
          ➕ Add Resource
        </button>
      )}
    </div>
  );
}
