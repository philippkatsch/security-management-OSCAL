import React, { useState } from 'react';
import { DebouncedInput } from './DebouncedInput';

/**
 * Links CRUD editor.
 */
export function LinksEditor({
  links = [],
  onChange,
  resources = [], // Back-matter resources list for rel="reference" autocomplete dropdown
  readOnly = false
}) {
  const [showAdvancedIndex, setShowAdvancedIndex] = useState({});

  const handleLinkChange = (index, field, val) => {
    const updated = links.map((l, i) => {
      if (i === index) {
        const item = { ...l, [field]: val };
        // Clean up empty optional fields
        if (field === 'text' || field === 'rel' || field === 'media-type' || field === 'resource-fragment') {
          if (!val) delete item[field];
        }
        return item;
      }
      return l;
    });
    onChange(updated);
  };

  const handleAddLink = () => {
    onChange([...links, { href: '', rel: 'reference' }]);
  };

  const handleRemoveLink = (index) => {
    onChange(links.filter((_, i) => i !== index));
  };

  const toggleAdvanced = (index) => {
    setShowAdvancedIndex(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <div className="links-editor-section card-body">
      <h4 style={{ margin: '12px 0 12px 0', fontSize: '14px', color: 'var(--color-text-muted)' }}>Links & References</h4>

      {readOnly ? (
        /* ── Read-only pill badges ── */
        links.length === 0 ? (
          <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px', margin: '0 0 8px 0' }}>
            No links defined.
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {links.map((l, idx) => (
              <a
                key={idx}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'var(--color-surface-hover, var(--color-surface-2))',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: '16px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  color: 'var(--color-primary)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>🔗</span>
                {l.text || l.href}
              </a>
            ))}
          </div>
        )
      ) : (
        /* ── Editable mode (unchanged) ── */
        <>
          {links.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px', margin: '0 0 8px 0' }}>
              No links defined.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {links.map((l, idx) => {
                const isReference = l.rel === 'reference';
                return (
                  <div
                    key={idx}
                    className="link-row-container"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '3px 0',
                      borderBottom: '1px solid var(--color-border-subtle)'
                    }}
                  >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {/* Relation Dropdown */}
                        <select
                          value={l.rel || ''}
                          onChange={(e) => handleLinkChange(idx, 'rel', e.target.value)}
                          className="form-input form-input-plain"
                          style={{ flex: '1 1 120px' }}
                        >
                          <option value="">(None)</option>
                          <option value="reference">reference</option>
                          <option value="related">related</option>
                          <option value="mapping">mapping</option>
                          <option value="required">required</option>
                        </select>

                        {/* Href Selector or Input */}
                        {isReference && resources.length > 0 ? (
                          <select
                            value={l.href || ''}
                            onChange={(e) => handleLinkChange(idx, 'href', e.target.value)}
                            className="form-input form-input-plain"
                            style={{ flex: '2 1 200px' }}
                          >
                            <option value="">-- Select Resource --</option>
                            {resources.map((res) => (
                              <option key={res.uuid} value={`#${res.uuid}`}>
                                {res.title || 'Untitled Resource'} (#{res.uuid.substring(0, 8)})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <DebouncedInput
                            value={l.href}
                            onChange={(val) => handleLinkChange(idx, 'href', val)}
                            placeholder="href (e.g. #resource-uuid or http://...)"
                            className="form-input form-input-plain"
                            style={{ flex: '2 1 200px' }}
                          />
                        )}

                        {/* Description Input */}
                        <DebouncedInput
                          value={l.text || ''}
                          onChange={(val) => handleLinkChange(idx, 'text', val)}
                          placeholder="Description (text)"
                          className="form-input form-input-plain"
                          style={{ flex: '2 1 180px' }}
                        />

                        <button
                          type="button"
                          className="btn-soft"
                          onClick={() => toggleAdvanced(idx)}
                          title="Advanced fields"
                          style={{
                            background: showAdvancedIndex[idx] ? 'var(--color-primary-light, rgba(99, 102, 241, 0.15))' : 'none',
                            border: 'none',
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            fontSize: '10px',
                            color: showAdvancedIndex[idx] ? 'var(--color-primary)' : 'inherit',
                            boxShadow: showAdvancedIndex[idx] ? '0 0 8px var(--color-primary)' : 'none',
                            transform: showAdvancedIndex[idx] ? 'rotate(45deg)' : 'none',
                            transition: 'all 0.2s ease-in-out'
                          }}
                        >
                          🔧
                        </button>
                        <button
                          type="button"
                          className="btn-soft-delete"
                          onClick={() => handleRemoveLink(idx)}
                          title="Remove link"
                          style={{ fontSize: '10px', padding: '2px 6px' }}
                        >
                          🗑
                        </button>
                      </div>

                      {/* Advanced Fields collapsible (media-type, resource-fragment) */}
                      {showAdvancedIndex[idx] && (
                        <div
                          className="advanced-link-fields"
                          style={{
                            marginTop: '6px',
                            padding: '8px 12px',
                            background: 'var(--color-surface-3)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm)',
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '12px',
                            maxWidth: '600px'
                          }}
                        >
                          <div>
                            <label style={{ fontSize: '9px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Media Type</label>
                            <DebouncedInput
                              value={l['media-type'] || ''}
                              onChange={(val) => handleLinkChange(idx, 'media-type', val)}
                              placeholder="e.g. application/pdf"
                              className="form-input form-input-plain"
                              style={{ fontSize: '11px', width: '100%' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '9px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Resource Fragment</label>
                            <DebouncedInput
                              value={l['resource-fragment'] || ''}
                              onChange={(val) => handleLinkChange(idx, 'resource-fragment', val)}
                              placeholder="e.g. section-1"
                              className="form-input form-input-plain"
                              style={{ fontSize: '11px', width: '100%' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {!readOnly && (
          <button
            type="button"
            onClick={handleAddLink}
            style={{
              marginTop: '8px',
              background: 'transparent',
              border: 'none',
              color: 'var(--color-accent-hover)',
              fontSize: '12px',
              cursor: 'pointer',
              padding: '4px 0',
              alignSelf: 'flex-start',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ➕ Add Link
          </button>
        )}
    </div>
  );
}
