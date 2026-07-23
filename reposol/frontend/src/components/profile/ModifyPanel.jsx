import React, { useState } from 'react';
import { DebouncedInput } from '../shared/DebouncedInput';
import { PropsEditor } from '../shared/PropsEditor';
import { LinksEditor } from '../shared/LinksEditor';
import { PartsEditor } from '../shared/PartsEditor';

const REMOVE_SELECTORS = [
  { value: 'by-id', label: 'ID (by-id)' },
  { value: 'by-name', label: 'Name (by-name)' },
  { value: 'by-item-name', label: 'Item type (by-item-name)' },
  { value: 'by-class', label: 'Class (by-class)' },
  { value: 'by-ns', label: 'Namespace (by-ns)' }
];

const ITEM_NAME_ENUM = ['param', 'prop', 'link', 'part', 'mapping', 'map'];
const ADD_POSITIONS = ['before', 'after', 'starting', 'ending'];

/**
 * Advanced profile alterations (set-parameters & alters) configurator.
 */
export function ModifyPanel({
  modify = {},
  onChange,
  isEditing = false
}) {
  const [expandedAlters, setExpandedAlters] = useState({});

  const alters = modify.alters || [];

  const handleAltersChange = (updatedAlters) => {
    onChange({ ...modify, alters: updatedAlters });
  };

  const handleAddAlter = () => {
    const newAlter = {
      'control-id': 'ac-2',
      adds: [],
      removes: []
    };
    handleAltersChange([...alters, newAlter]);
    setExpandedAlters(prev => ({ ...prev, [alters.length]: true }));
  };

  const handleRemoveAlter = (idx) => {
    handleAltersChange(alters.filter((_, i) => i !== idx));
  };

  const handleAlterChange = (idx, field, val) => {
    const updated = alters.map((a, i) => i === idx ? { ...a, [field]: val } : a);
    handleAltersChange(updated);
  };

  const toggleExpand = (idx) => {
    setExpandedAlters(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // --- Add Rules helpers ---
  const handleAddRule = (alterIdx, type) => {
    const alter = alters[alterIdx];
    if (type === 'add') {
      const adds = alter.adds ? [...alter.adds] : [];
      const newAdd = {
        position: 'ending',
        parts: [{ name: 'statement', prose: 'Newly added text.' }]
      };
      handleAlterChange(alterIdx, 'adds', [...adds, newAdd]);
    } else {
      const removes = alter.removes ? [...alter.removes] : [];
      const newRemove = { 'by-id': '' };
      handleAlterChange(alterIdx, 'removes', [...removes, newRemove]);
    }
  };

  const handleRemoveRule = (alterIdx, type, ruleIdx) => {
    const alter = alters[alterIdx];
    if (type === 'add') {
      const adds = alter.adds.filter((_, i) => i !== ruleIdx);
      handleAlterChange(alterIdx, 'adds', adds);
    } else {
      const removes = alter.removes.filter((_, i) => i !== ruleIdx);
      handleAlterChange(alterIdx, 'removes', removes);
    }
  };

  const handleRuleFieldChange = (alterIdx, type, ruleIdx, field, val) => {
    const alter = alters[alterIdx];
    if (type === 'add') {
      const adds = alter.adds.map((a, i) => i === ruleIdx ? { ...a, [field]: val } : a);
      handleAlterChange(alterIdx, 'adds', adds);
    } else {
      const removes = alter.removes.map((r, i) => {
        if (i === ruleIdx) {
          // Remove old criteria keys when switching selector types
          const newRemove = { [field]: val };
          if (r.remarks) newRemove.remarks = r.remarks;
          return newRemove;
        }
        return r;
      });
      handleAlterChange(alterIdx, 'removes', removes);
    }
  };

  return (
    <div className="modify-panel card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '15px' }}>Prose alteration rules (modify.alters)</h3>
        {isEditing && (
          <button
            type="button"
            className="btn-secondary"
            onClick={handleAddAlter}
            style={{ padding: '4px 10px', fontSize: '12px' }}
          >
            ➕ Add alteration rule
          </button>
        )}
      </div>

      {alters.length === 0 ? (
        <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          No alteration rules (alters) defined.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {alters.map((alter, idx) => {
            const isExpanded = expandedAlters[idx];
            const adds = alter.adds || [];
            const removes = alter.removes || [];

            return (
              <div
                key={idx}
                className="alter-card"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden'
                }}
              >
                {/* Header row */}
                <div
                  onClick={() => toggleExpand(idx)}
                  style={{
                    padding: '10px 14px',
                    background: 'var(--color-surface-2)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {isExpanded ? '▼' : '▶'}
                    </span>
                    <span className="badge" style={{ background: 'var(--color-success-subtle)', color: 'var(--color-success)', fontSize: '10px' }}>
                      Alteration Rule #{idx + 1}
                    </span>
                    <strong style={{ fontSize: '13px' }}>Control: {alter['control-id']}</strong>
                  </div>
                  {isEditing && (
                    <button
                      type="button"
                      className="btn-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveAlter(idx);
                      }}
                      style={{ padding: '2px 6px', fontSize: '11px' }}
                    >
                      🗑
                    </button>
                  )}
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Control target ID */}
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Target Control (control-id)</label>
                      <DebouncedInput
                        value={alter['control-id'] || ''}
                        onChange={(val) => handleAlterChange(idx, 'control-id', val)}
                        placeholder="e.g. ac-2"
                        className="form-input"
                        style={{ width: '180px', height: '28px', fontSize: '12px' }}
                        disabled={!isEditing}
                      />
                    </div>

                    {/* Removes Rules list */}
                    <div style={{ border: '1px solid var(--color-border-subtle)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Deletion rules (removes)</span>
                        {isEditing && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleAddRule(idx, 'remove')}
                            style={{ padding: '2px 6px', fontSize: '10px' }}
                          >
                            ➕ Deletion criterion
                          </button>
                        )}
                      </div>
                      {removes.length === 0 ? (
                        <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '11px', margin: 0 }}>No deletion rules defined.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {removes.map((rule, ruleIdx) => {
                            // Find active criteria field key in the rule object
                            const activeField = Object.keys(rule).find(k => k.startsWith('by-')) || 'by-id';
                            const activeVal = rule[activeField] || '';

                            return (
                              <div key={ruleIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--color-surface-2)', padding: '6px', borderRadius: '4px', border: '1px solid var(--color-border-subtle)' }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <select
                                    value={activeField}
                                    onChange={(e) => handleRuleFieldChange(idx, 'remove', ruleIdx, e.target.value, '')}
                                    className="form-input"
                                    style={{ width: '150px', height: '26px', fontSize: '11px' }}
                                    disabled={!isEditing}
                                  >
                                    {REMOVE_SELECTORS.map(s => (
                                      <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                  </select>

                                  {activeField === 'by-item-name' ? (
                                    <select
                                      value={activeVal}
                                      onChange={(e) => handleRuleFieldChange(idx, 'remove', ruleIdx, activeField, e.target.value)}
                                      className="form-input"
                                      style={{ flex: 1, height: '26px', fontSize: '11px' }}
                                      disabled={!isEditing}
                                    >
                                      <option value="">-- Select item type --</option>
                                      {ITEM_NAME_ENUM.map(item => (
                                        <option key={item} value={item}>{item}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <DebouncedInput
                                      value={activeVal}
                                      onChange={(val) => handleRuleFieldChange(idx, 'remove', ruleIdx, activeField, val)}
                                      placeholder="Value (e.g. ac-2_smt)"
                                      className="form-input"
                                      style={{ flex: 1, height: '26px', fontSize: '11px' }}
                                      disabled={!isEditing}
                                    />
                                  )}

                                  {isEditing && (
                                    <button
                                      type="button"
                                      className="btn-delete"
                                      onClick={() => handleRemoveRule(idx, 'remove', ruleIdx)}
                                      style={{ padding: '0 6px', height: '26px', fontSize: '10px' }}
                                    >
                                      🗑
                                    </button>
                                  )}
                                </div>
                                <div>
                                  <DebouncedInput
                                    value={rule.remarks || ''}
                                    onChange={(val) => {
                                      const updatedRemoves = alters[idx].removes.map((r, rI) => {
                                        if (rI === ruleIdx) {
                                          const copy = { ...r };
                                          if (!val) delete copy.remarks;
                                          else copy.remarks = val;
                                          return copy;
                                        }
                                        return r;
                                      });
                                      handleAlterChange(idx, 'removes', updatedRemoves);
                                    }}
                                    placeholder="Removal remarks / justification (optional)..."
                                    className="form-input"
                                    style={{ width: '100%', height: '22px', fontSize: '10px' }}
                                    disabled={!isEditing}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Adds Rules list */}
                    <div style={{ border: '1px solid var(--color-border-subtle)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Insertion rules (adds)</span>
                        {isEditing && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleAddRule(idx, 'add')}
                            style={{ padding: '2px 6px', fontSize: '10px' }}
                          >
                            ➕ Insertion rule
                          </button>
                        )}
                      </div>
                      {adds.length === 0 ? (
                        <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '11px', margin: 0 }}>No insertion rules defined.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {adds.map((rule, ruleIdx) => (
                            <div key={ruleIdx} style={{ padding: '8px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                                <select
                                  value={rule.position || 'ending'}
                                  onChange={(e) => handleRuleFieldChange(idx, 'add', ruleIdx, 'position', e.target.value)}
                                  className="form-input"
                                  style={{ width: '100px', height: '24px', fontSize: '11px' }}
                                  disabled={!isEditing}
                                >
                                  {ADD_POSITIONS.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                  ))}
                                </select>
                                <DebouncedInput
                                  value={rule['by-id'] || ''}
                                  onChange={(val) => handleRuleFieldChange(idx, 'add', ruleIdx, 'by-id', val)}
                                  placeholder="Target Element ID (by-id)"
                                  className="form-input"
                                  style={{ flex: 1, height: '24px', fontSize: '11px' }}
                                  disabled={!isEditing}
                                />
                                {isEditing && (
                                  <button
                                    type="button"
                                    className="btn-delete"
                                    onClick={() => handleRemoveRule(idx, 'add', ruleIdx)}
                                    style={{ padding: '0 6px', height: '24px', fontSize: '10px' }}
                                  >
                                    🗑
                                  </button>
                                )}
                              </div>

                              <PartsEditor
                                parts={rule.parts || []}
                                onChange={(parts) => handleRuleFieldChange(idx, 'add', ruleIdx, 'parts', parts)}
                                readOnly={!isEditing}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
