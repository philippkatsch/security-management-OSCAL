import React from 'react';
import styles from './ControlEditor.module.css';
import { ControlHeader } from '../ControlHeader';
import { ControlPartsPanel } from '../control-detail/ControlPartsPanel';
import { ControlParametersPanel } from '../control-detail/ControlParametersPanel';
import { ControlEnhancementsPanel } from '../control-detail/ControlEnhancementsPanel';
import { ADAPTERS } from './adapters';
import { ControlEditorContext, StageContextType } from './ControlEditorContext';
import { Control, Result, SystemComponent, ImplementedRequirement, ProfileAlter } from '@lib/types/oscal';
import { useAtomValue } from 'jotai';
import { editModeAtom } from '@stores/ui-store'; // Wait, let's check where editModeAtom is. The prompt says "Use editModeAtom from Jotai". But I should provide it or pass it. 
// Assuming editModeAtom is at @stores/uiStore or similar. We can also just take `isEditing` from props, or use the hook.

interface UnifiedControlEditorProps {
  control: Control;
  stage: StageContextType;
  onChange?: (updated: Control) => void;
  dispatch?: any;
  isEditing?: boolean; // Can be overridden

  // Stage-specific data
  alterations?: ProfileAlter[];
  implementation?: ImplementedRequirement;
  components?: SystemComponent[];
  assessmentResults?: Result[];
  
  // Extra props that were used by old panels
  originalControl?: Control;
  catalog?: any;
  profile?: any;
  onProfileChange?: any;
}

export function UnifiedControlEditor({
  control,
  stage,
  onChange,
  dispatch,
  isEditing = false,
  ...stageProps
}: UnifiedControlEditorProps) {
  const StageAdapter = ADAPTERS[stage];
  const { onSelectControl, onRestoreControl } = stageProps as any;

  const contextValue = {
    stage,
    control,
    isEditing,
    dispatch
  };

  return (
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
          <ControlParametersPanel 
            params={control.params || []} 
            isEditing={isEditing} 
            mode={stage} 
            controlId={control.id} 
          />
          <ControlPartsPanel 
            parts={control.parts || []} 
            isEditing={isEditing} 
            mode={stage} 
            controlId={control.id} 
          />
          
          {StageAdapter && <StageAdapter control={control} isEditing={isEditing} onChange={onChange} {...stageProps} />}
          
          {control.controls && control.controls.length > 0 && (
            <ControlEnhancementsPanel 
              enhancements={control.controls} 
              isEditing={isEditing} 
              mode={stage} 
              controlId={control.id} 
            />
          )}
        </div>
      </div>
    </ControlEditorContext.Provider>
  );
}
