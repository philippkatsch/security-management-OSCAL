import React from 'react';
import styles from './ControlDetail.module.css';
import { ParameterEditor } from '../ParameterEditor';

export interface ControlParametersPanelProps {
  mode?: any;
  isEditing?: boolean;
  isSubcontrol?: boolean;
  isWithdrawn?: boolean;
  params?: any[];
  setParams?: any;
  originalControl?: any;
  handleFieldChange?: any;
  control?: any;
  controlId?: string;
  profile?: any;
  onProfileChange?: any;
  updateAlter?: any;
  catalog?: any;
  paramSectionRef?: any;
  infoTooltip?: any;
  [key: string]: any;
}

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
  controlId: _controlId,
  profile,
  onProfileChange,
  updateAlter,
  catalog,
  paramSectionRef,
  infoTooltip
}: ControlParametersPanelProps) {
  return (
    <div 
      ref={paramSectionRef} 
      className={styles['section-container']} 
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
