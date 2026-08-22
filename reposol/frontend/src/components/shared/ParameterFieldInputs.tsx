import React, { useState } from 'react';
import { DebouncedInput } from './DebouncedInput';
import styles from './SharedComponents.module.css';

export function ParameterFieldInputs({ displayParam, isEditing, mode, howMany, choices, activeValues, constraintViolations, handleValuesChange, handleSelectChange, handleChoiceChange, handleToggleMultiChoice, handleFieldChange }: any) {
  const [showCustomInput, setShowCustomInput] = useState(false);

  let content: React.ReactNode = null;
  
  if (isEditing) {
    if (choices.length > 0 && howMany === 'one') {
      content = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <select
            value={
              showCustomInput 
                ? '__custom__'
                : (activeValues && activeValues.length > 0)
                  ? (choices.includes(activeValues[0]) ? activeValues[0] : '__custom__')
                  : (mode === 'profile' && displayParam?.values === undefined ? '' : '')
            }
            onChange={(e) => {
              const selVal = e.target.value;
              if (selVal === '__custom__') {
                setShowCustomInput(true);
              } else if (selVal === '') {
                setShowCustomInput(false);
                handleFieldChange('values', undefined);
              } else {
                setShowCustomInput(false);
                handleFieldChange('values', [selVal]);
              }
            }}
            className="form-input"
            style={{ width: '100%', height: '34px', fontSize: '12px', fontWeight: 'bold', color: activeValues?.length > 0 ? 'var(--color-success, #059669)' : 'inherit' }}
          >
            <option value="">
              {mode === 'profile' && displayParam?.values?.length > 0 
                ? `-- Inherit Catalog Default (${displayParam.values[0]}) --` 
                : '-- Select a Choice Option --'}
            </option>
            {choices.map((choiceItem, idx) => (
              <option key={idx} value={choiceItem}>
                {choiceItem}
              </option>
            ))}
            <option value="__custom__">✏️ Custom Value (Freitext)...</option>
          </select>

          {(showCustomInput || (activeValues && activeValues.length > 0 && !choices.includes(activeValues[0]))) && (
            <div style={{ marginTop: '4px' }}>
              <DebouncedInput
                value={(activeValues || []).join(', ')}
                onChange={handleValuesChange}
                placeholder="Enter custom parameter value..."
                className={['form-input', styles['form-input-plain']].filter(Boolean).join(' ')}
                style={{ width: '100%', fontWeight: 'bold', color: 'var(--color-success, #059669)' }}
              />
            </div>
          )}
        </div>
      );
    } else if (choices.length > 0 && howMany === 'one-or-more') {
      content = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', background: 'var(--color-surface)', padding: '6px', borderRadius: '4px', border: '1px solid var(--color-border-subtle)' }}>
            {choices.map((choiceItem, idx) => {
              const isChecked = (activeValues || []).includes(choiceItem);
              return (
                <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer', background: isChecked ? 'var(--color-success-subtle, rgba(16, 185, 129, 0.15))' : 'transparent', color: isChecked ? 'var(--color-success, #059669)' : 'inherit', border: isChecked ? '1px solid var(--color-success)' : '1px solid transparent', padding: '2px 6px', borderRadius: '4px', fontWeight: isChecked ? 'bold' : 'normal' }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      let updated = [...(activeValues || [])];
                      if (e.target.checked) {
                        if (!updated.includes(choiceItem)) updated.push(choiceItem);
                      } else {
                        updated = updated.filter(v => v !== choiceItem);
                      }
                      handleFieldChange('values', updated.length > 0 ? updated : undefined);
                    }}
                  />
                  <span>{choiceItem}</span>
                </label>
              );
            })}
          </div>
        </div>
      );
    } else {
      content = (
        <div style={{ width: '100%' }}>
          <DebouncedInput
            value={activeValues.join(', ')}
            onChange={handleValuesChange}
            placeholder={mode === 'profile' && displayParam?.values ? displayParam.values.join(', ') : 'Enter default value(s), comma-separated'}
            className={['form-input', styles['form-input-plain']].filter(Boolean).join(' ')}
            style={{
              width: '100%',
              fontWeight: 'bold',
              color: activeValues?.length > 0 ? 'var(--color-success, #059669)' : 'inherit'
            }}
          />
        </div>
      );
    }
  }

  return (
    <>
      {content}
      {constraintViolations.length > 0 && (
        <span style={{ fontSize: '11px', color: 'var(--color-danger)' }}>
          ⚠️ {constraintViolations[0]}
        </span>
      )}
    </>
  );
}
