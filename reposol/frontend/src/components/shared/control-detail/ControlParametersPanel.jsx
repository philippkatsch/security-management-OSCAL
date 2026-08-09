import React from 'react';
import { ParameterEditor } from '../ParameterEditor';

export function ControlParametersPanel({
  mode,
  isEditing,
  isSubcontrol,
  isWithdrawn,
  params,
  setParams,
  originalControl,
  handleFieldChange,
  control,
  profile,
  onProfileChange,
  updateAlter,
  catalog,
  paramSectionRef,
  infoTooltip
}) {
  return (
    <div 
      ref={paramSectionRef} 
      className="section-container" 
      style={{ 
        background: 'var(--color-surface)', 
        border: '1px solid var(--color-border)', 
        borderRadius: 'var(--radius-lg)', 
        padding: '24px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '16px',
        marginTop: '16px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>
          {mode === 'profile' && isEditing 
            ? (isSubcontrol ? 'Sub-control Parameter Overrides' : 'Control Parameter Overrides') 
            : (isSubcontrol ? 'Sub-control Parameters' : 'Control Parameters')}
        </h4>
        {infoTooltip}
      </div>
      <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px', marginTop: '4px' }}>
        {mode === 'catalog' ? (
          <ParameterEditor
            params={params}
            onChange={(updatedParams) => handleFieldChange('params', updatedParams)}
            readOnly={!isEditing || isWithdrawn}
            fullDocument={catalog}
          />
        ) : (
          <ParameterEditor
            params={setParams}
            catalogParams={originalControl?.params || []}
            mode="profile"
            context="local"
            parentId={control?.id}
            parentType="control"
            onChange={(updatedSetParams) => {
              const modify = profile.modify ? { ...profile.modify } : {};
              modify['set-parameters'] = updatedSetParams;
              onProfileChange({ ...profile, modify });
            }}
            onChangeAlters={(updateFn) => updateAlter(control.id, updateFn)}
            readOnly={!isEditing || isWithdrawn}
            fullDocument={profile}
            catalogDocument={catalog}
          />
        )}
      </div>
    </div>
  );
}
