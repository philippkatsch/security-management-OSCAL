import React from 'react';
import styles from './ControlEditor.module.css';
import { ControlHeader } from '../ControlHeader';
import { ControlPartsPanel } from '../control-detail/ControlPartsPanel';
import { ControlParametersPanel } from '../control-detail/ControlParametersPanel';
import { ControlEnhancementsPanel } from '../control-detail/ControlEnhancementsPanel';
import { ADAPTERS } from './adapters';
import { ControlEditorContext, StageContextType } from './ControlEditorContext';
import { Control, Result, ImplementedRequirement, ProfileAlter } from '@lib/types/oscal';
import { ErrorBoundary } from '@components/shared/ui/ErrorBoundary';

interface UnifiedControlEditorProps {
  control: Control;
  stage: StageContextType;
  onChange?: (updated: Control) => void;
  dispatch?: any;
  isEditing?: boolean;

  // Stage-specific data
  alterations?: ProfileAlter[];
  implementation?: ImplementedRequirement;
  components?: any[];
  assessmentResults?: Result[];
  
  // Extra props that were used by old panels
  originalControl?: Control;
  catalog?: any;
  profile?: any;
  onProfileChange?: any;
  [key: string]: any;
}

export function UnifiedControlEditor({
  control,
  stage,
  onChange,
  dispatch,
  isEditing = false,
  catalog,
  ...stageProps
}: UnifiedControlEditorProps) {
  const StageAdapter = ADAPTERS[stage];
  const { onSelectControl, onRestoreControl, allUsedPropKeys } = stageProps as any;

  const contextValue = {
    stage,
    control,
    isEditing,
    dispatch
  };

  // Compile all available parameters for prose resolution
  const allParams = React.useMemo(() => {
    const list: any[] = [];
    if (control?.params) {
      control.params.forEach((p: any) => list.push({ ...p, scope: 'control' }));
    }
    if (catalog?.params) {
      catalog.params.forEach((p: any) => list.push({ ...p, scope: 'catalog' }));
    }
    const searchGroups = (groups: any[] = []) => {
      for (const g of groups) {
        if (g.params) g.params.forEach((p: any) => list.push({ ...p, scope: 'group' }));
        if (g.groups) searchGroups(g.groups);
      }
    };
    if (catalog?.groups) searchGroups(catalog.groups);
    return list;
  }, [control, catalog]);

  const renderProseToReact = React.useCallback((proseText: string) => {
    if (!proseText) return null;
    const regex = /\{\{\s*insert:\s*param,\s*([^\s}]+)\s*\}\}/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(proseText)) !== null) {
      const matchIndex = match.index;
      const paramId = match[1];

      if (matchIndex > lastIndex) {
        elements.push(proseText.substring(lastIndex, matchIndex));
      }

      const param = allParams.find((p: any) => (p.id || p['param-id']) === paramId);
      const val = param?.values && param.values.length > 0 ? param.values.join(', ') : null;
      const label = param?.label || paramId;
      const isSet = !!val;

      elements.push(
        <span
          key={`param-insert-${matchIndex}`}
          className="param-chip"
          title={`Parameter: ${paramId}\nStatus: ${isSet ? 'Assigned' : 'Unset'}${param?.guidelines?.[0]?.prose ? `\nGuidance: ${param.guidelines[0].prose}` : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            const el = document.querySelector(`[data-param-id="${paramId}"]`) || document.querySelector(`[data-testid="param-card-${paramId}"]`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '1px 6px',
            margin: '0 2px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            background: isSet ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
            color: isSet ? 'var(--color-success, #22c55e)' : 'var(--color-primary, #3b82f6)',
            border: `1px solid ${isSet ? 'rgba(34, 197, 94, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
            verticalAlign: 'baseline',
            transition: 'all 0.15s ease'
          }}
        >
          {isSet ? val : `[${label}]`}
        </span>
      );

      lastIndex = matchIndex + match[0].length;
    }

    if (lastIndex < proseText.length) {
      elements.push(proseText.substring(lastIndex));
    }

    return elements.length > 0 ? <>{elements}</> : proseText;
  }, [allParams]);

  const handleAddEnhancement = () => {
    const enhancements = control?.controls ? [...control.controls] : [];
    const newNum = enhancements.length + 1;
    const newId = `${control?.id || 'ctrl'}.${newNum}`;
    const newEnhancement: Control = {
      id: newId,
      title: `Enhancement ${newNum}`,
      parts: [
        {
          id: `${newId}_smt`,
          name: 'statement',
          prose: 'Enhancement statement requirement...'
        }
      ]
    };
    onChange?.({
      ...control,
      controls: [...enhancements, newEnhancement]
    });
  };

  const handleRemoveEnhancement = (index: number, ev: React.MouseEvent) => {
    ev.stopPropagation();
    if (!control?.controls) return;
    const updated = control.controls.filter((_, i) => i !== index);
    onChange?.({
      ...control,
      controls: updated.length > 0 ? updated : undefined
    });
  };

  return (
    <ErrorBoundary>
      <ControlEditorContext.Provider value={contextValue}>
        <div className={styles.controlEditor}>
          <ControlHeader 
            id={control?.id}
            title={control?.title}
            controlClass={control?.class}
            isEditing={isEditing}
            control={control}
            onSelectControl={onSelectControl}
            onRestoreControl={onRestoreControl}
            onChange={onChange}
            onTitleChange={(val) => onChange?.({ ...control, title: val })}
            onIdChange={(val) => onChange?.({ ...control, id: val })}
            onClassChange={(val) => onChange?.({ ...control, class: val })}
          />
          <div className={styles.editorContent}>
            <ControlPartsPanel 
              parts={control?.parts || []} 
              isEditing={isEditing} 
              mode={stage} 
              controlId={control?.id} 
              combinedParams={allParams}
              renderProseToReact={renderProseToReact}
              handleFieldChange={(field, val) => onChange?.({ ...control, [field]: val })}
            />
            <ControlParametersPanel 
              params={control?.params || []} 
              setParams={(stageProps as any).profile?.modify?.['set-parameters'] || []}
              originalControl={(stageProps as any).originalControl}
              profile={(stageProps as any).profile}
              onProfileChange={(stageProps as any).onProfileChange}
              isEditing={isEditing} 
              mode={stage} 
              control={control}
              controlId={control?.id} 
              catalog={catalog}
              handleFieldChange={(field, val) => onChange?.({ ...control, [field]: val })}
            />
            
            {StageAdapter && (
              <StageAdapter 
                control={control} 
                isEditing={isEditing} 
                onChange={onChange} 
                allUsedPropKeys={allUsedPropKeys}
                catalog={catalog}
                {...stageProps} 
              />
            )}
            
            {((isEditing && stage === 'catalog') || (control?.controls && control.controls.length > 0)) && (
              <ControlEnhancementsPanel 
                enhancements={control?.controls || []} 
                isEditing={isEditing} 
                mode={stage} 
                controlId={control?.id}
                onSelectControl={onSelectControl}
                handleAddEnhancement={handleAddEnhancement}
                handleRemoveEnhancement={handleRemoveEnhancement}
              />
            )}
          </div>
        </div>
      </ControlEditorContext.Provider>
    </ErrorBoundary>
  );
}
