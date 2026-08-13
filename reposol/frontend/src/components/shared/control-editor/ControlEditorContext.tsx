import React, { createContext, useContext } from 'react';
import { Control } from '@lib/types/oscal';

export type StageContextType = 'catalog' | 'profile' | 'ssp' | 'assessment';

export interface ControlEditorContextValue {
  stage: StageContextType;
  control: Control;
  isEditing: boolean;
  dispatch: any; // from useDocumentActions, fallback to any if not strictly typed
}

export const ControlEditorContext = createContext<ControlEditorContextValue | null>(null);

export function useControlEditorContext() {
  const context = useContext(ControlEditorContext);
  if (!context) {
    throw new Error('useControlEditorContext must be used within a ControlEditorContext.Provider');
  }
  return context;
}
