import React, { useState } from 'react';
import { DebouncedInput } from './DebouncedInput';
import { generateUUID } from '../../lib/oscal-utils';

/**
 * Properties CRUD editor.
 */
export function PropsEditor({
  props = [],
  onChange,
  allUsedKeys = [],
  readOnly = false,
  removedPropNames = [],
  onRestoreProp,
  overriddenPropNames = [],
  onRevertProp
}) {
  const [showAdvancedIndex, setShowAdvancedIndex] = useState({});

  const handlePropChange = (index, field, val) => {
    const updated = props.map((p, i) => {
      if (i === index) {
        const item = { ...p, [field]: val };
        // Clean up empty optional fields
        if (field === 'ns' || field === 'class' || field === 'uuid' || field === 'group' || field === 'remarks' || field === 'id') {
          if (!val) delete item[field];
        }
        return item;
      }
      return p;
    });
    onChange(updated);
  };

  const handleAddProp = () => {
    onChange([...props, { name: '', value: '' }]);
  };

  const handleRemoveProp = (index) => {
    onChange(props.filter((_, i) => i !== index));
  };

  const toggleAdvanced = (index) => {
    setShowAdvancedIndex(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const [focusedPropIdx, setFocusedPropIdx] = useState(null);

  // US 1.19: Combine allUsedKeys with keys currently in the props list, and common metadata keys
  const commonDefaultKeys = [
    'framework-identifier',
    'framework-version-identifier',
    'publication-status',
    'generated-by',
    'keywords',
    'label',
    'sort-id',
    'class',
    'ns',
    'uuid',
    'id'
  ];

  const currentKeys = props.map(p => p.name).filter(Boolean);
  const suggestionKeys = Array.from(new Set([
    ...allUsedKeys,
    ...currentKeys,
    ...commonDefaultKeys
  ]))
    .filter(k => k.trim().length > 0)
    .sort((a, b) => a.localeCompare(b));

  return (
    <div className="props-editor-section card-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <h4 style={{ margin: '0', fontSize: '14px', color: 'var(--color-text-muted)', display: 'none' }}>Properties</h4>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        {props.map((p, idx) => {
          /* ── Read-only: static pill badge ── */
          if (readOnly) {
            return (
              <span
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--color-surface-hover, var(--color-surface-2))',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: '16px',
                  padding: '6px 14px',
                  fontSize: '12px'
                }}
              >
                <span style={{ fontSize: '11px', marginRight: '2px', opacity: 0.85 }} title="Property">🏷️</span>
                <span style={{ fontWeight: 'bold', color: 'var(--color-text-muted)' }}>
                  {p.name || '(unnamed)'}
                </span>
                <span style={{ color: 'var(--color-text-muted)' }}>:</span>
                <span style={{ color: 'var(--color-text)' }}>
                  {p.value || '—'}
                </span>
                {p.ns && (
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontStyle: 'italic' }} title={`ns: ${p.ns}`}>
                    (ns: {p.ns})
                  </span>
                )}
                {p.class && (
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }} title={`class: ${p.class}`}>
                    [{p.class}]
                  </span>
                )}
                {p.remarks && (
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    ({p.remarks})
                  </span>
                )}
              </span>
            );
          }

          /* ── Editable mode (existing behaviour) ── */
          const isRemoved = removedPropNames.includes(p.name);
          const isOverridden = overriddenPropNames.includes(p.name);
          const nameWidth = `${Math.max((p.name || '').length, 4) + 2}ch`;
          const valueWidth = `${Math.max((p.value || '').length, 5) + 2}ch`;
          return (
            <div
              key={idx}
              className="prop-badge-container"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: isOverridden ? 'var(--color-warning-subtle, rgba(245, 158, 11, 0.1))' : 'var(--color-surface-2)',
                border: isRemoved
                  ? '1px dashed var(--color-danger)'
                  : (isOverridden ? '1px solid var(--color-warning, #f59e0b)' : '1px solid transparent'),
                borderRadius: '12px',
                padding: '4px 10px',
                position: 'relative',
                opacity: isRemoved ? 0.6 : 1
              }}
            >
              <span style={{ fontSize: '11px', marginRight: '2px', opacity: 0.85, userSelect: 'none' }} title="Property">🏷️</span>
              {/* Name field */}
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                <DebouncedInput
                  value={p.name}
                  onChange={(val) => handlePropChange(idx, 'name', val)}
                  placeholder="name"
                  className="form-input-plain"
                  disabled={readOnly || isRemoved}
                  onFocus={() => setFocusedPropIdx(idx)}
                  onBlur={() => setTimeout(() => setFocusedPropIdx(null), 200)}
                  style={{
                    width: nameWidth,
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: isRemoved ? 'var(--color-text-muted)' : (isOverridden ? '#f59e0b' : '#93c5fd'), // Warning yellow for override
                    padding: '0',
                    border: 'none',
                    background: 'transparent',
                    height: '18px',
                    minHeight: 'auto',
                    textAlign: 'left',
                    textDecoration: isRemoved ? 'line-through' : 'none'
                  }}
                />
                {focusedPropIdx === idx && suggestionKeys.length > 0 && !isRemoved && (
                  <div
                    className="dropdown-menu shadow-lg"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      zIndex: 100,
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      maxHeight: '120px',
                      width: '165px',
                      overflowY: 'auto',
                      boxShadow: 'var(--shadow-lg)',
                      padding: '4px 0'
                    }}
                  >
                    {suggestionKeys.map(k => (
                      <div
                        key={k}
                        onClick={() => {
                          handlePropChange(idx, 'name', k);
                          setFocusedPropIdx(null);
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: '10px',
                          cursor: 'pointer',
                          color: 'var(--color-text)',
                          textAlign: 'left'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'var(--color-surface-3)'}
                        onMouseLeave={(e) => e.target.style.background = 'none'}
                      >
                        {k}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <span style={{ color: isRemoved ? 'var(--color-text-muted)' : (isOverridden ? '#f59e0b' : '#93c5fd'), fontSize: '11px', fontWeight: 'bold' }}>:</span>

              {/* Value field */}
              <DebouncedInput
                value={p.value}
                onChange={(val) => handlePropChange(idx, 'value', val)}
                placeholder="value"
                className="form-input-plain"
                disabled={readOnly || isRemoved}
                style={{
                  width: valueWidth,
                  fontSize: '12px',
                  color: 'var(--color-text)',
                  padding: '0',
                  border: 'none',
                  background: 'transparent',
                  height: '18px',
                  minHeight: 'auto',
                  textDecoration: isRemoved ? 'line-through' : 'none'
                }}
              />

              {isRemoved && (
                <span style={{
                  fontSize: '8px',
                  background: 'var(--color-danger-subtle, rgba(239, 68, 68, 0.15))',
                  color: 'var(--color-danger, #ef4444)',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginLeft: '2px',
                  pointerEvents: 'none'
                }}>
                  Removed
                </span>
              )}

              {!readOnly && (
                <div
                  className="prop-badge-actions"
                  style={{
                    display: 'flex',
                    gap: '4px',
                    alignItems: 'center',
                    opacity: (isRemoved || isOverridden) ? 1 : undefined
                  }}
                >
                  {isRemoved ? (
                    <button
                      type="button"
                      onClick={() => onRestoreProp && onRestoreProp(p.name)}
                      className="btn-soft-success"
                      title="Restore Property"
                      style={{ padding: '2px 6px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                    >
                      ↩ Restore
                    </button>
                  ) : (
                    <>
                      {isOverridden && (
                        <button
                          type="button"
                          onClick={() => onRevertProp && onRevertProp(p.name)}
                          className="btn-soft-warning"
                          title="Revert to default catalog value"
                          style={{ padding: '2px 6px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '2px', marginRight: '2px' }}
                        >
                          ↩ Revert
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleAdvanced(idx)}
                        title="Advanced Settings (ns, class, remarks, uuid)"
                        style={{
                          background: showAdvancedIndex[idx] ? 'var(--color-primary-light, rgba(99, 102, 241, 0.15))' : 'none',
                          border: 'none',
                          padding: '2px 4px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          fontSize: '11px',
                          color: showAdvancedIndex[idx] ? 'var(--color-primary)' : 'inherit',
                          transform: showAdvancedIndex[idx] ? 'rotate(45deg)' : 'none',
                          transition: 'all 0.2s ease-in-out'
                        }}
                      >
                        🔧
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveProp(idx)}
                        title="Delete"
                        style={{ background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer', fontSize: '12px', color: '#ff4d4f' }}
                      >
                        🗑
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Advanced fields modal/popover (absolute positioned below the badge) */}
              {showAdvancedIndex[idx] && !readOnly && (
                <div
                  className="advanced-prop-fields shadow-xl"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 110,
                    marginTop: '6px',
                    padding: '12px',
                    background: 'var(--color-surface-3)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    display: 'grid',
                    gridTemplateColumns: '1fr',
                    gap: '10px',
                    width: '320px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--color-text-muted)' }}>Advanced Settings</span>
                    <button
                      type="button"
                      onClick={() => toggleAdvanced(idx)}
                      style={{ background: 'none', border: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                    >
                      ❌
                    </button>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Property ID (id)</label>
                    <DebouncedInput
                      value={p.id || ''}
                      onChange={(val) => handlePropChange(idx, 'id', val)}
                      placeholder="prop-id"
                      className="form-input form-input-plain"
                      style={{ fontSize: '12px', width: '100%', padding: '4px 6px', border: '1px solid var(--color-border)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Namespace (ns)</label>
                    <DebouncedInput
                      value={p.ns || ''}
                      onChange={(val) => handlePropChange(idx, 'ns', val)}
                      placeholder="ns-uri"
                      className="form-input form-input-plain"
                      style={{ fontSize: '12px', width: '100%', padding: '4px 6px', border: '1px solid var(--color-border)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Class</label>
                    <DebouncedInput
                      value={p.class || ''}
                      onChange={(val) => handlePropChange(idx, 'class', val)}
                      placeholder="class"
                      className="form-input form-input-plain"
                      style={{ fontSize: '12px', width: '100%', padding: '4px 6px', border: '1px solid var(--color-border)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>UUID</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <DebouncedInput
                        value={p.uuid || ''}
                        onChange={(val) => handlePropChange(idx, 'uuid', val)}
                        placeholder="uuid"
                        className="form-input form-input-plain"
                        style={{ fontSize: '12px', flex: 1, padding: '4px 6px', border: '1px solid var(--color-border)' }}
                      />
                      <button
                        type="button"
                        className="btn-soft"
                        onClick={() => handlePropChange(idx, 'uuid', generateUUID())}
                        title="Generate UUID"
                        style={{ padding: '0 4px', fontSize: '10px' }}
                      >
                        ⚡
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Group</label>
                    <DebouncedInput
                      value={p.group || ''}
                      onChange={(val) => handlePropChange(idx, 'group', val)}
                      placeholder="group-id"
                      className="form-input form-input-plain"
                      style={{ fontSize: '12px', width: '100%', padding: '4px 6px', border: '1px solid var(--color-border)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Remarks</label>
                    <DebouncedInput
                      value={p.remarks || ''}
                      onChange={(val) => handlePropChange(idx, 'remarks', val)}
                      placeholder="Remarks / notes..."
                      className="form-input form-input-plain"
                      style={{ fontSize: '12px', width: '100%', padding: '4px 6px', border: '1px solid var(--color-border)' }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {!readOnly && (
          <button
            type="button"
            onClick={handleAddProp}
            style={{
              background: 'var(--color-surface-3)',
              border: '1px dashed var(--color-border)',
              borderRadius: '12px',
              padding: '4px 10px',
              fontSize: '12px',
              color: 'var(--color-accent-hover)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ➕ Add Property
          </button>
        )}
      </div>
    </div>
  );
}
