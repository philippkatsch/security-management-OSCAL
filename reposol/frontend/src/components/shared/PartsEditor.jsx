import React, { useState, useRef } from 'react';
import { DebouncedInput } from './DebouncedInput';
import { ProseWithParams } from './ProseWithParams';
import { PropsEditor } from './PropsEditor';
import { LinksEditor } from './LinksEditor';
import { getAutoLabel } from './ReadOnlyParts';

const PART_NAMES = [
  'statement',
  'guidance',
  'discussion',
  'information',
  'overview',
  'item',
  'objective',
  'assessment-objective',
  'assessment-method',
  'example',
  'custom'
];

/**
 * Recursive parts/prose editor matching high-fidelity read-only layout.
 */
export function PartsEditor({
  parts = [],
  onChange,
  params = [],
  readOnly = false,
  depth = 0,
  onDefineNewParam = null
}) {
  const [showAdvancedIndex, setShowAdvancedIndex] = useState({});
  const [activeTextInputs, setActiveTextInputs] = useState({});
  const proseRefs = useRef({});

  const handlePartChange = (index, field, val) => {
    const updated = parts.map((p, i) => {
      if (i === index) {
        const item = { ...p };
        if (val === undefined) {
          delete item[field];
        } else {
          item[field] = val;
        }
        // Clean up empty optional fields
        if (field === 'ns' || field === 'class' || field === 'title') {
          if (!val) delete item[field];
        }
        return item;
      }
      return p;
    });
    onChange(updated);
  };

  const handleAddPart = () => {
    onChange([...parts, { name: 'statement', prose: '' }]);
  };

  const handleAddSubPart = (index) => {
    const updated = parts.map((p, i) => {
      if (i === index) {
        const subparts = p.parts ? [...p.parts] : [];
        return {
          ...p,
          parts: [...subparts, { name: 'item', prose: '' }]
        };
      }
      return p;
    });
    onChange(updated);
  };

  const handleRemovePart = (index) => {
    onChange(parts.filter((_, i) => i !== index));
  };

  const toggleAdvanced = (index) => {
    setShowAdvancedIndex(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const isTopLevel = depth === 0;

  // Filter out assessment method and objective parts in catalog edit view,
  // matching what ReadOnlyParts does to preserve layout consistency.
  const displayParts = isTopLevel 
    ? parts.filter(p => {
        const name = p.name?.toLowerCase();
        return name !== 'objective' && name !== 'assessment-method' && name !== 'examine' && name !== 'interview' && name !== 'test';
      })
    : parts;

  return (
    <div className="parts-editor-section" style={{ display: 'flex', flexDirection: 'column', gap: isTopLevel ? '4px' : '0px' }}>
      {isTopLevel && displayParts.length === 0 && (
        <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px', margin: '0 0 8px 0' }}>
          No prose parts defined.
        </p>
      )}

      {displayParts.map((p, idx) => {
        const subparts = p.parts || [];
        const labelProp = p.props?.find(x => x.name?.toLowerCase() === 'label')?.value || '';

        const handleLabelChange = (newVal) => {
          const otherProps = (p.props || []).filter(x => x.name?.toLowerCase() !== 'label');
          const updatedProps = newVal ? [...otherProps, { name: 'label', value: newVal }] : otherProps;
          handlePartChange(idx, 'props', updatedProps);
        };

        // Top-Level Card Rendering
        if (isTopLevel) {
          const cardStyle = {
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderLeft: `4px solid ${p.name?.toLowerCase() === 'statement' ? 'var(--color-primary)' : 'var(--color-accent, var(--color-primary))'}`,
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          };

          return (
            <div key={idx} style={cardStyle}>
              {/* Header Row: Icons, badge selector, ID, actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px', color: 'var(--color-primary)' }}>
                    {p.name?.toLowerCase() === 'statement' ? '☵' : '📖'}
                  </span>
                  
                  {/* Category Type selector */}
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', background: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: '4px', padding: '2px 8px' }}>
                    {!readOnly && (
                      <select
                        value={p.name || 'statement'}
                        onChange={(e) => handlePartChange(idx, 'name', e.target.value)}
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          width: '100%',
                          height: '100%',
                          opacity: 0,
                          cursor: 'pointer',
                          zIndex: 2
                        }}
                      >
                        {PART_NAMES.map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    )}
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-primary)', textTransform: 'uppercase' }}>
                      {p.name || 'statement'} {!readOnly && '▼'}
                    </span>
                  </div>

                  {/* Part ID Field */}
                  {!readOnly ? (
                    <DebouncedInput
                      value={p.id || ''}
                      onChange={(val) => handlePartChange(idx, 'id', val)}
                      placeholder="id"
                      className="form-input-plain"
                      style={{
                        width: '120px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: 'var(--color-text-muted)',
                        padding: '2px 6px',
                        border: '1px dashed var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-surface-3)',
                        height: '24px'
                      }}
                    />
                  ) : (
                    p.id && (
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--color-text-muted)', background: 'var(--color-surface-3)', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--color-border-subtle)' }}>
                        {p.id}
                      </span>
                    )
                  )}
                </div>

                {/* Top-Level actions */}
                {!readOnly && (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {p.prose === undefined || p.prose === null ? (
                      <button
                        type="button"
                        onClick={() => handlePartChange(idx, 'prose', '')}
                        className="btn-soft"
                        style={{ padding: '2px 6px', fontSize: '10px', color: 'var(--color-accent-hover)' }}
                      >
                        📝 Add Text
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePartChange(idx, 'prose', undefined)}
                        className="btn-soft"
                        style={{ padding: '2px 6px', fontSize: '10px', color: 'var(--color-danger)' }}
                      >
                        🗑️ Remove Text
                      </button>
                    )}
                    {p.prose !== undefined && p.prose !== null && (
                      <button
                        type="button"
                        onClick={() => proseRefs.current[idx]?.insertParamPlaceholder()}
                        className="btn-soft"
                        style={{ padding: '2px 6px', fontSize: '10px', color: 'var(--color-primary)' }}
                      >
                        ⚙️ Add Parameter
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAddSubPart(idx)}
                      className="btn-soft"
                      style={{ padding: '2px 6px', fontSize: '10px' }}
                    >
                      ➕ Sub-part
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleAdvanced(idx)}
                      className="btn-soft"
                      title="Advanced Settings"
                      style={{
                        padding: '2px 6px',
                        background: showAdvancedIndex[idx] ? 'var(--color-primary-light, rgba(99, 102, 241, 0.15))' : undefined,
                        color: showAdvancedIndex[idx] ? 'var(--color-primary)' : undefined,
                        fontSize: '10px'
                      }}
                    >
                      🔧
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemovePart(idx)}
                      className="btn-soft-delete"
                      style={{ padding: '2px 6px', fontSize: '10px' }}
                    >
                      🗑
                    </button>
                  </div>
                )}
              </div>

              {/* Prose text editor */}
              {p.prose !== undefined && p.prose !== null && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <ProseWithParams
                    ref={(el) => { if (el) proseRefs.current[idx] = el; }}
                    value={p.prose || ''}
                    onChange={(val) => handlePartChange(idx, 'prose', val)}
                    params={params}
                    disabled={readOnly}
                    rows={2}
                    placeholder="Enter prose text..."
                    className="form-textarea"
                    style={{ fontSize: '14px', width: '100%' }}
                    onDefineNewParam={onDefineNewParam}
                  />
                </div>
              )}

              {/* Advanced collapsibles */}
              {showAdvancedIndex[idx] && !readOnly && (
                <div
                  style={{
                    padding: '12px',
                    background: 'var(--color-surface-3)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '12px'
                  }}
                >
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Namespace (ns)</label>
                    <DebouncedInput
                      value={p.ns || ''}
                      onChange={(val) => handlePartChange(idx, 'ns', val)}
                      placeholder="ns-uri"
                      className="form-input form-input-plain"
                      style={{ fontSize: '12px', width: '100%', padding: '4px 6px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Class</label>
                    <DebouncedInput
                      value={p.class || ''}
                      onChange={(val) => handlePartChange(idx, 'class', val)}
                      placeholder="class"
                      className="form-input form-input-plain"
                      style={{ fontSize: '12px', width: '100%', padding: '4px 6px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Title</label>
                    <DebouncedInput
                      value={p.title || ''}
                      onChange={(val) => handlePartChange(idx, 'title', val)}
                      placeholder="Title"
                      className="form-input form-input-plain"
                      style={{ fontSize: '12px', width: '100%', padding: '4px 6px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <PropsEditor
                      props={p.props || []}
                      onChange={(val) => handlePartChange(idx, 'props', val)}
                      readOnly={readOnly}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <LinksEditor
                      links={p.links || []}
                      onChange={(val) => handlePartChange(idx, 'links', val)}
                      readOnly={readOnly}
                    />
                  </div>
                </div>
              )}

              {/* Recursive child list items */}
              {subparts.length > 0 && (
                <div style={{ marginTop: '4px' }}>
                  <PartsEditor
                    parts={subparts}
                    onChange={(updatedSub) => handlePartChange(idx, 'parts', updatedSub)}
                    params={params}
                    readOnly={readOnly}
                    depth={depth + 1}
                    onDefineNewParam={onDefineNewParam}
                  />
                </div>
              )}
            </div>
          );
        }

        // Nested List Item Rendering (depth > 0)
        const itemStyle = {
          display: 'flex',
          gap: '12px',
          marginBottom: '12px',
          marginLeft: depth > 1 ? '16px' : '0',
          position: 'relative'
        };

        const verticalLineStyle = {
          borderLeft: '2px solid var(--color-primary-light, var(--color-primary))',
          opacity: 0.5,
          marginRight: '2px',
          flexShrink: 0
        };

        return (
          <div key={idx} style={itemStyle}>
            {/* Left vertical border line */}
            <div style={verticalLineStyle}></div>

            {/* Automatic numbering label */}
            <span style={{ fontWeight: '800', color: 'var(--color-primary)', minWidth: '24px', flexShrink: 0, textAlign: 'center' }}>
              {getAutoLabel(idx, depth)}
            </span>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                {/* Prose Text Area */}
                {p.prose !== undefined && p.prose !== null ? (
                  <ProseWithParams
                    ref={(el) => { if (el) proseRefs.current[idx] = el; }}
                    value={p.prose || ''}
                    onChange={(val) => handlePartChange(idx, 'prose', val)}
                    params={params}
                    disabled={readOnly}
                    rows={1}
                    placeholder="Item prose text..."
                    className="form-textarea-plain"
                    style={{ fontSize: '14px', flex: 1, padding: '2px 4px', minHeight: '22px' }}
                    onDefineNewParam={onDefineNewParam}
                  />
                ) : (
                  <span style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--color-text-muted)', flex: 1, alignSelf: 'center' }}>
                    No prose text
                  </span>
                )}

                {/* Inline Action Buttons */}
                {!readOnly && (
                  <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                    {p.prose !== undefined && p.prose !== null && (
                      <button
                        type="button"
                        onClick={() => proseRefs.current[idx]?.insertParamPlaceholder()}
                        className="btn-soft"
                        style={{ padding: '1px 4px', fontSize: '9px', color: 'var(--color-primary)' }}
                        title="Add Parameter"
                      >
                        ⚙️
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAddSubPart(idx)}
                      className="btn-soft"
                      style={{ padding: '1px 4px', fontSize: '9px' }}
                      title="Add sub-part"
                    >
                      ➕
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleAdvanced(idx)}
                      className="btn-soft"
                      style={{ padding: '1px 4px', fontSize: '9px' }}
                      title="Settings"
                    >
                      🔧
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemovePart(idx)}
                      className="btn-soft-delete"
                      style={{ padding: '1px 4px', fontSize: '9px' }}
                      title="Remove"
                    >
                      🗑
                    </button>
                  </div>
                )}
              </div>

              {/* Advanced settings collapsible for items */}
              {showAdvancedIndex[idx] && !readOnly && (
                <div
                  style={{
                    padding: '8px',
                    background: 'var(--color-surface-3)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px'
                  }}
                >
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Part ID</label>
                    <DebouncedInput
                      value={p.id || ''}
                      onChange={(val) => handlePartChange(idx, 'id', val)}
                      placeholder="part id"
                      className="form-input form-input-plain"
                      style={{ fontSize: '11px', width: '100%', padding: '2px 4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Name/Type</label>
                    <select
                      value={p.name || 'item'}
                      onChange={(e) => handlePartChange(idx, 'name', e.target.value)}
                      style={{ width: '100%', fontSize: '11px', padding: '2px 4px', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                    >
                      {PART_NAMES.map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Recursive child list items */}
              {subparts.length > 0 && (
                <div style={{ marginTop: '4px' }}>
                  <PartsEditor
                    parts={subparts}
                    onChange={(updatedSub) => handlePartChange(idx, 'parts', updatedSub)}
                    params={params}
                    readOnly={readOnly}
                    depth={depth + 1}
                    onDefineNewParam={onDefineNewParam}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {!readOnly && depth === 0 && (
        <button
          type="button"
          onClick={handleAddPart}
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
          ➕ Add Part
        </button>
      )}
    </div>
  );
}
