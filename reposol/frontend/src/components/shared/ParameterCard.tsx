import React, { useState, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { editModeAtom } from '@stores/uiAtoms';
import styles from './SharedComponents.module.css';
import { DebouncedInput, DebouncedTextarea } from './DebouncedInput';
import { PropsEditor } from './PropsEditor';
import { LinksEditor } from './LinksEditor';
import { ProseWithParams } from './ProseWithParams';
import { ParameterConstraints } from './ParameterConstraints';
import { ParameterFieldInputs } from './ParameterFieldInputs';

/**
 * A standalone Rich Card component for viewing and editing a single OSCAL Parameter.
 * Supports 'catalog' mode (full definition) and 'profile' mode (overrides).
 */
export function ParameterCard({
  param = {},
  onChange = () => {},
  onRemove = () => {},
  isExpanded = false,
  onToggleExpand = () => {},
  mode = 'catalog',
  catalogDefaultParam = null,
  allParams = [], // For autocomplete of 'depends-on'
  isRemoved = false,
  onRestore = null,
  readOnly = undefined
}: any) {
  const globalEditMode = useAtomValue(editModeAtom);
  const isEditing = readOnly !== undefined ? !readOnly : globalEditMode;
  const isReadOnlyState = !isEditing;
  const [showCustomInput, setShowCustomInput] = useState(false);
  const usageRef = useRef<any>(null);
  const guidelinesRef = useRef<any>(null);
  const showViewMode = isReadOnlyState || !isExpanded || isRemoved;
  const showEditMode = !isReadOnlyState && isExpanded && !isRemoved;

  // In profile mode, we display catalog defaults where applicable.
  const displayParam = mode === 'profile' && catalogDefaultParam 
    ? { ...catalogDefaultParam, ...param } 
    : param;

  // Derive keys to handle param-id vs id
  const paramIdKey = mode === 'profile' ? 'param-id' : 'id';
  const currentId = param[paramIdKey] || param.id || catalogDefaultParam?.id || 'New Parameter';

  const select = displayParam.select || {};
  const choices = select.choice || [];
  const howMany = select['how-many'] || 'one';
  const constraints = displayParam.constraints || [];
  const guidelineProse = displayParam.guidelines?.[0]?.prose || '';

  // Calculate overridden state in profile mode
  const nonIdKeys = Object.keys(param).filter(k => k !== 'param-id' && k !== 'id');
  const isOverridden = mode === 'profile' && nonIdKeys.length > 0;

  // Helpers to mutate the param and trigger onChange
  const handleFieldChange = (field, val) => {
    if (val === undefined || val === '') {
      const { [field]: _, ...rest } = param;
      // Ensure key is preserved if profile mode
      const updated = mode === 'profile' ? { 'param-id': currentId, ...rest } : rest;
      onChange(updated);
    } else {
      const updated = mode === 'profile' ? { 'param-id': currentId, ...param, [field]: val } : { ...param, [field]: val };
      onChange(updated);
    }
  };

  const handleValuesChange = (valueString) => {
    const valueArray = valueString
      .split(',')
      .map(v => v.trim())
      .filter(v => v.length > 0);
    handleFieldChange('values', valueArray.length > 0 ? valueArray : undefined);
  };

  const handleSelectChange = (field, val) => {
    const currentSelect = param.select || catalogDefaultParam?.select || {};
    const updatedSelect = { ...currentSelect };
    if (!val) {
      delete updatedSelect[field];
    } else {
      updatedSelect[field] = val;
    }
    if (Object.keys(updatedSelect).length === 0) {
      handleFieldChange('select', undefined);
    } else {
      handleFieldChange('select', updatedSelect);
    }
  };

  const handleChoiceChange = (choicesString) => {
    const choicesArray = choicesString
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);
    handleSelectChange('choice', choicesArray.length > 0 ? choicesArray : undefined);
  };

  const handleGuidelineChange = (val) => {
    if (!val) {
      handleFieldChange('guidelines', undefined);
    } else {
      handleFieldChange('guidelines', [{ prose: val }]);
    }
  };

  const addConstraint = () => {
    const currentConstraints = param.constraints || catalogDefaultParam?.constraints || [];
    handleFieldChange('constraints', [
      ...currentConstraints,
      { description: 'New Constraint', tests: [{ expression: '.*', remarks: 'Value must match constraint regex' }] }
    ]);
  };

  const updateConstraint = (cIdx, field, val) => {
    const currentConstraints = [...(param.constraints || catalogDefaultParam?.constraints || [])];
    if (field === 'expression' || field === 'remarks') {
      const existingTest = currentConstraints[cIdx]?.tests?.[0] || {};
      currentConstraints[cIdx] = {
        ...currentConstraints[cIdx],
        tests: [{ ...existingTest, [field]: val }]
      };
    } else {
      currentConstraints[cIdx] = { ...currentConstraints[cIdx], [field]: val };
    }
    handleFieldChange('constraints', currentConstraints);
  };

  const removeConstraint = (cIdx) => {
    const currentConstraints = (param.constraints || catalogDefaultParam?.constraints || []).filter((_, i) => i !== cIdx);
    if (currentConstraints.length === 0) {
      handleFieldChange('constraints', undefined);
    } else {
      handleFieldChange('constraints', currentConstraints);
    }
  };

  const handleRevertToDefault = () => {
    onChange({ 'param-id': currentId });
  };

  // Determine active values for display & editing
  const activeValues = param.values !== undefined 
    ? param.values 
    : (mode === 'profile' ? catalogDefaultParam?.values : displayParam.values) || [];

  const activeValStr = activeValues[0] || '';

  // Validate regex constraints against active value
  const constraintViolations: string[] = [];
  if (activeValStr && constraints.length > 0) {
    constraints.forEach(c => {
      (c.tests || []).forEach(t => {
        if (t.expression) {
          try {
            const reg = new RegExp(t.expression);
            if (!reg.test(activeValStr)) {
              constraintViolations.push(t.remarks || c.description || `Value must match regex: ${t.expression}`);
            }
          } catch (e) {
            // Ignore invalid regex patterns
          }
        }
      });
    });
  }

  // Multi-choice selection toggle helper
  const handleToggleMultiChoice = (choiceItem) => {
    const currentSet = new Set(param.values || (mode === 'profile' ? catalogDefaultParam?.values : displayParam.values) || []);
    if (currentSet.has(choiceItem)) {
      currentSet.delete(choiceItem);
    } else {
      currentSet.add(choiceItem);
    }
    const newValuesArray = Array.from(currentSet);
    handleFieldChange('values', newValuesArray.length > 0 ? newValuesArray : undefined);
  };

  // Advanced metadata fields check
  const hasAdvancedData = Boolean(
    param.class || 
    param['depends-on'] || 
    param.remarks || 
    (param.select?.choice && param.select.choice.length > 0) || 
    (param.select?.['how-many']) ||
    (param.constraints && param.constraints.length > 0) || 
    (param.guidelines && param.guidelines.length > 0) || 
    (param.links && param.links.length > 0) || 
    (param.props && param.props.length > 0)
  );

  const [showAdvanced, setShowAdvanced] = useState<boolean>(hasAdvancedData);

  const toggleAdvanced = () => {
    setShowAdvanced(prev => !prev);
  };

  const advancedCount = [
    param.class,
    param['depends-on'],
    param.remarks,
    param.select?.choice?.length ? `${param.select.choice.length} choices` : null,
    param.constraints?.length ? `${param.constraints.length} constraints` : null,
    param.guidelines?.[0]?.prose ? 'guidelines' : null,
    param.links?.length ? `${param.links.length} links` : null,
    param.props?.length ? `${param.props.length} props` : null,
  ].filter(Boolean).length;

  return (
    <div
      id={`param-card-${(currentId || '').toLowerCase()}`}
      data-param-id={(currentId || '').toLowerCase()}
      className={styles['param-row-container']}
      style={{
        background: isRemoved ? 'var(--color-surface-3, #0f172a)' : 'var(--color-surface)',
        border: isRemoved ? '1px dashed var(--color-danger-subtle, rgba(239, 68, 68, 0.4))' : '1px solid var(--color-border)',
        borderLeft: `4px solid ${isRemoved ? 'var(--color-danger, #ef4444)' : 'var(--color-accent, #3b82f6)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: 'var(--shadow-sm)',
        opacity: isRemoved ? 0.65 : 1,
        marginBottom: '12px'
      }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '16px', color: 'var(--color-accent, var(--color-primary))' }}>
            ⚙️
          </span>

          {/* Category Type Badge */}
          <div style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '4px',
            padding: '2px 8px'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-accent-hover, var(--color-primary))', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              PARAMETER
            </span>
          </div>

          <span 
            style={{ 
              background: isRemoved ? 'var(--color-surface-4, rgba(239, 68, 68, 0.08))' : 'var(--color-accent-bg, rgba(56, 139, 253, 0.12))', 
              padding: '2px 8px', 
              borderRadius: '4px', 
              fontSize: '11px', 
              fontFamily: 'monospace',
              fontWeight: '700',
              color: isRemoved ? 'var(--color-danger, #ef4444)' : 'var(--color-accent-hover, #2563eb)',
              border: isRemoved ? '1px dashed var(--color-danger-subtle, rgba(239, 68, 68, 0.3))' : '1px solid rgba(56, 139, 253, 0.4)',
              textDecoration: isRemoved ? 'line-through' : 'none'
            }}
          >
            {currentId}
          </span>
          {isRemoved && (
            <span style={{ 
              fontSize: '9px', 
              background: 'var(--color-danger-subtle, rgba(239, 68, 68, 0.15))', 
              color: 'var(--color-danger, #ef4444)', 
              padding: '1px 6px', 
              borderRadius: '3px', 
              border: '1px solid rgba(239, 68, 68, 0.3)',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Removed
            </span>
          )}
          {(!showEditMode) && (
            <span style={{ 
              fontSize: '13px', 
              fontWeight: '600', 
              color: isRemoved ? 'var(--color-text-muted)' : 'var(--color-text)',
              textDecoration: isRemoved ? 'line-through' : 'none'
            }}>
              {displayParam.label || ''}
            </span>
          )}
          {(!showEditMode) && activeValues && activeValues.length > 0 && (
            <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px', marginLeft: '4px' }}>
              {activeValues.map((v, vIdx) => (
                <span
                  key={`v-${vIdx}`}
                  style={{
                    background: 'var(--color-success-subtle, rgba(16, 185, 129, 0.15))',
                    color: 'var(--color-success, #059669)',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: '700',
                    border: '1px solid var(--color-success, #059669)'
                  }}
                >
                  {v}
                </span>
              ))}
            </div>
          )}
          {(!showEditMode) && choices && choices.length > 0 && (
            <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px', marginLeft: '4px' }}>
              {choices.map((c, cIdx) => (
                <span
                  key={`c-${cIdx}`}
                  style={{
                    background: 'var(--color-accent-subtle, rgba(16,185,129,0.15))',
                    color: 'var(--color-accent)',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '11px',
                    fontWeight: '500',
                    border: '1px dashed var(--color-accent)'
                  }}
                >
                  Choice: {c}
                </span>
              ))}
            </div>
          )}
        </div>
        
        {!isReadOnlyState && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {isRemoved ? (
              onRestore && (
                <button
                  type="button"
                  className={styles['btn-soft-success']}
                  onClick={(e) => { e.stopPropagation(); onRestore(); }}
                  style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}
                >
                  ↩ Restore
                </button>
              )
            ) : (
              <>
                {mode === 'profile' && isOverridden && (
                  <button
                    type="button"
                    className={styles['btn-soft-warning']}
                    onClick={(e) => { e.stopPropagation(); handleRevertToDefault(); }}
                    style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}
                    title="Clear override and revert to catalog default"
                  >
                    ↩ Revert to Default
                  </button>
                )}
                {showEditMode && (
                  <button
                    type="button"
                    onClick={toggleAdvanced}
                    className={styles['btn-soft']}
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      color: showAdvanced ? 'var(--color-accent-hover)' : 'var(--color-text-muted)',
                      borderColor: showAdvanced ? 'var(--color-accent)' : undefined
                    }}
                    title="Toggle optional/advanced parameter metadata"
                  >
                    ⚙️ Advanced {advancedCount > 0 ? `(${advancedCount})` : ''} {showAdvanced ? '▲' : '▼'}
                  </button>
                )}
                <button
                  type="button"
                  className={isExpanded ? styles['btn-soft-primary'] : styles['btn-soft']}
                  onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
                  style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}
                >
                  {isExpanded ? 'Done' : '✏️ Edit'}
                </button>
                {onRemove && (
                  <button
                    type="button"
                    className={styles['btn-soft-delete']}
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}
                  >
                    🗑
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* View Mode Content */}
      {showViewMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
          {/* Usage / Guidelines */}
          {(displayParam.usage || displayParam.guidelines?.[0]?.prose) && (
            <div style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: '1.5' }}>
              {displayParam.usage || displayParam.guidelines?.[0]?.prose}
            </div>
          )}
          
          {/* Select Constraint hint */}
          {select['how-many'] && choices.length > 0 && (
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              Selection rule: {select['how-many']}
            </div>
          )}
          
          {/* Constraint Validation warning in view mode */}
          {constraintViolations.length > 0 && (
            <div style={{ fontSize: '11px', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>⚠️</span> {constraintViolations.join('; ')}
            </div>
          )}
        </div>
      )}

      {/* Expanded Edit Fields */}
      {showEditMode && (
        <div style={{ 
          paddingTop: '12px', 
          marginTop: '4px',
          borderTop: '1px solid var(--color-border-subtle)',
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px' 
        }}>

          {/* ── CORE ESSENTIAL ROW (TOP ROW: ID TOP-LEFT, VALUE TOP-RIGHT) ── */}
          <div 
            style={{ 
              background: 'var(--color-surface-2)', 
              padding: '14px', 
              borderRadius: 'var(--radius-md, 6px)', 
              border: constraintViolations.length > 0 
                ? '2px solid var(--color-danger)' 
                : '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* TOP LEFT: PARAMETER ID */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-accent-hover, #2563eb)' }}>
                    🏷️ Parameter ID <span style={{ fontSize: '9px', background: 'var(--color-accent-bg, rgba(56, 139, 253, 0.15))', color: 'var(--color-accent-hover, #2563eb)', padding: '1px 4px', borderRadius: '3px', border: '1px solid rgba(56, 139, 253, 0.3)' }}>Core Field</span>
                  </label>
                </div>
                <div 
                  title={mode === 'profile' && catalogDefaultParam !== null ? "Catalog default parameter IDs cannot be modified inside a Profile." : ""}
                  style={{ width: '100%' }}
                >
                  <DebouncedInput
                    value={currentId}
                    onChange={(val) => handleFieldChange(paramIdKey, val)}
                    className={['form-input', styles['form-input-plain']].filter(Boolean).join(' ')}
                    style={{
                      width: '100%',
                      fontWeight: 'bold',
                      color: 'var(--color-accent-hover, #2563eb)',
                      background: 'var(--color-accent-bg, rgba(56, 139, 253, 0.08))',
                      border: '1px solid rgba(56, 139, 253, 0.4)',
                      cursor: mode === 'profile' && catalogDefaultParam !== null ? 'not-allowed' : 'text'
                    }}
                    disabled={mode === 'profile' && catalogDefaultParam !== null}
                  />
                  {mode === 'profile' && catalogDefaultParam !== null && (
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontStyle: 'italic', display: 'block', marginTop: '4px' }}>
                      ℹ️ Catalog parameter IDs are locked inside profiles
                    </span>
                  )}
                </div>
              </div>

              {/* TOP RIGHT: ASSIGNED VALUE */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: activeValues?.length > 0 ? 'var(--color-success, #059669)' : 'var(--color-text-muted)' }}>
                    🎯 Assigned Value <span style={{ fontSize: '9px', background: activeValues?.length > 0 ? 'var(--color-success-subtle, rgba(16, 185, 129, 0.15))' : 'var(--color-surface)', color: activeValues?.length > 0 ? 'var(--color-success, #059669)' : 'var(--color-text-muted)', padding: '1px 4px', borderRadius: '3px', border: activeValues?.length > 0 ? '1px solid var(--color-success, #059669)' : '1px solid var(--color-border)' }}>Core Field</span>
                  </label>
                  {mode === 'profile' && catalogDefaultParam?.values && (
                    <span style={{ fontSize: '10px', background: 'var(--color-surface)', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                      Default: <strong>{catalogDefaultParam.values.join(', ') || 'none'}</strong>
                    </span>
                  )}
                </div>

                <ParameterFieldInputs
                  displayParam={displayParam}
                  isEditing={isEditing}
                  mode={mode}
                  howMany={howMany}
                  choices={choices}
                  activeValues={activeValues}
                  constraintViolations={constraintViolations}
                  handleValuesChange={handleValuesChange}
                  handleSelectChange={handleSelectChange}
                  handleChoiceChange={handleChoiceChange}
                  handleToggleMultiChoice={handleToggleMultiChoice}
                  handleFieldChange={handleFieldChange}
                />
              </div>
            </div>

            {/* SECOND ROW: LABEL & USAGE */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '8px', borderTop: '1px dashed var(--color-border-subtle)' }}>
              <div>
                <label style={{ fontSize: '10px', fontWeight: '600', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>
                  Label / Title {mode === 'profile' && catalogDefaultParam?.label ? `(Default: ${catalogDefaultParam.label})` : ''}
                </label>
                <DebouncedInput
                  value={param.label || ''}
                  onChange={(val) => handleFieldChange('label', val || undefined)}
                  placeholder={catalogDefaultParam?.label || ''}
                  className={['form-input', styles['form-input-plain']].filter(Boolean).join(' ')}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <label style={{ fontSize: '10px', fontWeight: '600', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0px' }}>Usage Description</label>
                  <button
                    type="button"
                    className={styles['btn-soft']}
                    style={{ padding: '2px 6px', fontSize: '10px', color: 'var(--color-primary)' }}
                    onClick={() => usageRef.current?.insertParamPlaceholder()}
                  >
                    ⚙️ Add Parameter
                  </button>
                </div>
                <ProseWithParams
                  ref={usageRef}
                  value={param.usage || ''}
                  onChange={(val) => handleFieldChange('usage', val || undefined)}
                  rows={1}
                  params={(allParams || []).map(p => ({ ...p, id: p.id || p['param-id'] }))}
                  placeholder={catalogDefaultParam?.usage || 'e.g. system review period'}
                />
              </div>
            </div>

            {/* Validation Constraint warning */}
            {constraintViolations.length > 0 && (
              <div style={{ fontSize: '11px', color: 'var(--color-danger)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>⚠️ Constraint Violation:</span> {constraintViolations.join('; ')}
              </div>
            )}
          </div>

          {/* ── OPTIONAL & ADVANCED METADATA SECTION (COLLAPSIBLE) ── */}
          {showAdvanced && (
            <div style={{ 
              background: 'var(--color-surface-2)', 
              padding: '16px', 
              borderRadius: 'var(--radius-md, 6px)', 
              border: '1px solid var(--color-border)', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-accent-hover, var(--color-primary))', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚙️ Advanced & Optional Metadata
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  Constraints, Choices, Dependencies & Extensions
                </span>
              </div>

              {/* Basic Meta Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Class</label>
                  <DebouncedInput
                    value={param.class || ''}
                    onChange={(val) => handleFieldChange('class', val || undefined)}
                    placeholder={catalogDefaultParam?.class || ''}
                    className={['form-input', styles['form-input-plain']].filter(Boolean).join(' ')}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Depends On (Param ID)</label>
                  <DebouncedInput
                    value={param['depends-on'] || ''}
                    onChange={(val) => handleFieldChange('depends-on', val || undefined)}
                    placeholder={catalogDefaultParam?.['depends-on'] || 'parameter-id'}
                    className={['form-input', styles['form-input-plain']].filter(Boolean).join(' ')}
                    style={{ width: '100%' }}
                    list={`other-params-${currentId}`}
                  />
                  <datalist id={`other-params-${currentId}`}>
                    {(allParams || []).filter(other => (other.id || other['param-id']) && (other.id || other['param-id']) !== currentId).map(other => {
                      const oid = other.id || other['param-id'];
                      return <option key={oid} value={oid} />;
                    })}
                  </datalist>
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Remarks / Notes</label>
                  <DebouncedInput
                    value={param.remarks || ''}
                    onChange={(val) => handleFieldChange('remarks', val || undefined)}
                    placeholder={catalogDefaultParam?.remarks || 'Parameter remarks...'}
                    className={['form-input', styles['form-input-plain']].filter(Boolean).join(' ')}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Select Options configuration (Catalog mode & Profile mode) */}
              <div style={{ background: 'var(--color-surface)', padding: '12px', borderRadius: '4px', border: '1px solid var(--color-border-subtle)' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Select / Choice Configuration</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>
                      Choices (comma-separated) {mode === 'profile' && catalogDefaultParam?.select?.choice ? `(Default: ${catalogDefaultParam.select.choice.join(', ')})` : ''}
                    </label>
                    <DebouncedInput
                      value={(param.select?.choice || []).join(', ')}
                      onChange={handleChoiceChange}
                      placeholder={catalogDefaultParam?.select?.choice?.join(', ') || "option A, option B"}
                      className={['form-input', styles['form-input-plain']].filter(Boolean).join(' ')}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>How Many?</label>
                    <select
                      value={param.select?.['how-many'] || ''}
                      onChange={(e) => handleSelectChange('how-many', e.target.value || undefined)}
                      className="form-input"
                      style={{ width: '100%', height: '32px', fontSize: '12px' }}
                    >
                      <option value="">-- inherit/none --</option>
                      <option value="one">one</option>
                      <option value="one-or-more">one-or-more</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Constraints array (Regex rules) */}
              <ParameterConstraints
                constraints={constraints}
                onAdd={addConstraint}
                onUpdate={updateConstraint}
                onRemove={removeConstraint}
                isEditing={isEditing}
              />

              {/* Guidelines (Prose) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0px' }}>Guidelines</label>
                  <button
                    type="button"
                    className={styles['btn-soft']}
                    style={{ padding: '2px 6px', fontSize: '10px', color: 'var(--color-primary)' }}
                    onClick={() => guidelinesRef.current?.insertParamPlaceholder()}
                  >
                    ⚙️ Add Parameter
                  </button>
                </div>
                <ProseWithParams
                  ref={guidelinesRef}
                  value={param.guidelines?.[0]?.prose || ''}
                  onChange={handleGuidelineChange}
                  rows={2}
                  params={(allParams || []).map(p => ({ ...p, id: p.id || p['param-id'] }))}
                  placeholder={catalogDefaultParam?.guidelines?.[0]?.prose || "Enter guidance for assigning this parameter..."}
                />
              </div>

              {/* Links & Properties Editor */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
                <div style={{ background: 'var(--color-surface)', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Parameter Links</span>
                  <LinksEditor
                    links={param.links || []}
                    onChange={(updated) => handleFieldChange('links', updated.length > 0 ? updated : undefined)}
                    readOnly={!isEditing}
                  />
                </div>
                <div style={{ background: 'var(--color-surface)', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Parameter Properties</span>
                  <PropsEditor
                    props={param.props || []}
                    onChange={(updated) => handleFieldChange('props', updated.length > 0 ? updated : undefined)}
                    allUsedKeys={[]}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
