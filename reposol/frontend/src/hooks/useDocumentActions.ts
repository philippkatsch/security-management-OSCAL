import { useMemo } from 'react';
import { createActionDispatcher } from '../lib/document-actions';
import { OscalDocument } from '../lib/types/oscal';

export function useDocumentActions(lifecycle: any) {
  const { activeDoc, setDoc, pushUndoRedoState } = lifecycle;
  
  const dispatch = useMemo(() => {
    return createActionDispatcher(
      () => activeDoc,
      setDoc,
      pushUndoRedoState,
      { enableLogging: import.meta.env.DEV }
    );
  }, [activeDoc, setDoc, pushUndoRedoState]);
  
  return { dispatch };
}
