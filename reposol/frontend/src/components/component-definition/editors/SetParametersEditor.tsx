import React, { useState } from 'react';
import { SetParameter } from '@lib/types/oscal';
import sharedStyles from '@components/shared/SharedComponents.module.css';

export interface SetParametersEditorProps {
  setParameters?: SetParameter[];
  availableParams?: Array<{ id: string; label?: string; usage?: string }>;
  onChange: (setParameters: SetParameter[]) => void;
  editMode?: boolean;
  level?: 'set' | 'requirement';
}

export const SetParametersEditor: React.FC<SetParametersEditorProps> = ({
  setParameters = [],
  availableParams = [],
  onChange,
  editMode = false,
  level = 'requirement'
}) => {
  const [newValueInputs, setNewValueInputs] = useState<Record<number, string>>({});

  const addParameter = (prefillId?: string) => {
    if (!editMode) return;
    const newParam: SetParameter = {
      'param-id': prefillId || `param-${setParameters.length + 1}`,
      values: ['default_value'],
      remarks: ''
    };
    onChange([...setParameters, newParam]);
  };

  const updateParamField = (idx: number, field: string, val: any) => {
    if (!editMode) return;
    const updated = [...setParameters];
    updated[idx] = { ...updated[idx], [field]: val };
    onChange(updated);
  };

  const removeParam = (idx: number) => {
    if (!editMode) return;
    const updated = setParameters.filter((_, i) => i !== idx);
    onChange(updated);
  };

  // Values array management
  const addValue = (idx: number) => {
    const raw = (newValueInputs[idx] || '').trim();
    if (!raw) return;
    const currentValues = setParameters[idx].values || [];
    updateParamField(idx, 'values', [...currentValues, raw]);
    setNewValueInputs(prev => ({ ...prev, [idx]: '' }));
  };

  const removeValue = (paramIdx: number, valIdx: number) => {
    const currentValues = (setParameters[paramIdx].values || []).filter((_, i) => i !== valIdx);
    updateParamField(paramIdx, 'values', currentValues);
  };

  // Duplication check
  const duplicateIds = React.useMemo(() => {
    const counts: Record<string, number> = {};
    setParameters.forEach(p => {
      const id = (p['param-id'] || '').trim().toLowerCase();
      if (id) counts[id] = (counts[id] || 0) + 1;
    });
    return new Set(Object.keys(counts).filter(k => counts[k] > 1));
  }, [setParameters]);

  const levelTitle = level === 'set' 
    ? 'Baseline Parameter Defaults (Set-Level)' 
    : 'Control Parameter Overrides';

  const levelHint = level === 'set'
    ? 'Define default parameter values across all controls in this implementation set.'
    : 'Override specific parameter values for this control requirement.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h6 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--color-text, #111827)' }}>
            {levelTitle} ({setParameters.length})
          </h6>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted, #6b7280)' }}>
            {levelHint}
          </span>
        </div>

        {editMode && (
          <button
            type="button"
            className={['btn', sharedStyles['btn-secondary'], sharedStyles['btn-sm']].filter(Boolean).join(' ')}
            onClick={() => addParameter()}
          >
            + Add Parameter
          </button>
        )}
      </div>

      {/* Suggested Params */}
      {editMode && availableParams.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '12px' }}>
          <span style={{ color: 'var(--color-text-muted, #6b7280)', fontWeight: 500 }}>Available Params:</span>
          {availableParams.map(p => {
            const isPresent = setParameters.some(sp => sp['param-id'] === p.id);
            if (isPresent) return null;
            return (
              <button
                key={p.id}
                type="button"
                style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border, #d1d5db)',
                  background: 'var(--surface-color, #ffffff)',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
                onClick={() => addParameter(p.id)}
                title={p.usage || p.label}
              >
                + {p.id} {p.label ? `(${p.label})` : ''}
              </button>
            );
          })}
        </div>
      )}

      {setParameters.length === 0 ? (
        <div style={{ padding: '10px', background: 'var(--surface-alt, #f9fafb)', border: '1px dashed var(--color-border, #e5e7eb)', borderRadius: '6px', fontSize: '12px', color: 'var(--color-text-muted, #6b7280)', textAlign: 'center' }}>
          {editMode ? 'No parameter defaults configured.' : 'No parameter values set.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {setParameters.map((param, idx) => {
            const isDup = duplicateIds.has((param['param-id'] || '').trim().toLowerCase());
            const values = param.values || [];
            const hasEmptyValues = values.length === 0;

            return (
              <div
                key={idx}
                style={{
                  padding: '10px 12px',
                  border: isDup || hasEmptyValues ? '1px solid var(--color-danger, #ef4444)' : '1px solid var(--color-border, #e5e7eb)',
                  borderRadius: '6px',
                  background: 'var(--color-surface, #ffffff)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Parameter ID:</label>
                    {editMode ? (
                      <input
                        type="text"
                        className="form-input"
                        style={{ maxWidth: '220px', padding: '2px 8px', fontSize: '12px', fontFamily: 'monospace' }}
                        value={param['param-id'] || ''}
                        onChange={(e) => updateParamField(idx, 'param-id', e.target.value)}
                        placeholder="e.g. ac-7_prm_1"
                      />
                    ) : (
                      <code style={{ fontSize: '12px', fontWeight: 600 }}>{param['param-id']}</code>
                    )}
                    {isDup && <span style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)' }}>⚠️ Duplicate</span>}
                  </div>

                  {editMode && (
                    <button
                      type="button"
                      className={['btn', 'btn-danger', sharedStyles['btn-sm']].filter(Boolean).join(' ')}
                      style={{ padding: '2px 6px', fontSize: '11px' }}
                      onClick={() => removeParam(idx)}
                      title="Remove parameter"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Values Multi-Value Tag Editor */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted, #6b7280)' }}>
                    Assigned Values (min 1 required):
                  </label>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {values.map((val, vIdx) => (
                      <span
                        key={vIdx}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'var(--surface-alt, #f3f4f6)',
                          border: '1px solid var(--color-border, #d1d5db)',
                          borderRadius: '12px',
                          padding: '2px 8px',
                          fontSize: '12px',
                          fontFamily: 'monospace'
                        }}
                      >
                        {val}
                        {editMode && (
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '12px', lineHeight: 1 }}
                            onClick={() => removeValue(idx, vIdx)}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}

                    {editMode && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="text"
                          className="form-input"
                          style={{ width: '120px', padding: '2px 6px', fontSize: '12px' }}
                          placeholder="Add value..."
                          value={newValueInputs[idx] || ''}
                          onChange={(e) => setNewValueInputs(prev => ({ ...prev, [idx]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addValue(idx);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className={['btn', sharedStyles['btn-secondary'], sharedStyles['btn-sm']].filter(Boolean).join(' ')}
                          style={{ padding: '2px 6px', fontSize: '11px' }}
                          onClick={() => addValue(idx)}
                        >
                          + Add
                        </button>
                      </div>
                    )}
                  </div>

                  {hasEmptyValues && (
                    <span style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)' }}>
                      ⚠️ At least one non-empty value is required per OSCAL schema.
                    </span>
                  )}
                </div>

                {/* Optional Remarks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted, #6b7280)' }}>
                    Remarks:
                  </label>
                  {editMode ? (
                    <textarea
                      className="form-textarea"
                      style={{ minHeight: '40px', fontSize: '12px', padding: '4px 8px' }}
                      placeholder="Commentary or rationale for value selection..."
                      value={param.remarks || ''}
                      onChange={(e) => updateParamField(idx, 'remarks', e.target.value)}
                    />
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #6b7280)', fontStyle: 'italic' }}>
                      {param.remarks || 'No remarks provided.'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SetParametersEditor;
