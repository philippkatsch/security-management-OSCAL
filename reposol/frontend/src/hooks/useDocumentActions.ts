import { useMemo, useRef, useEffect } from 'react';
import { createActionDispatcher } from '../lib/document-actions';
import { OscalDocument } from '../lib/types/oscal';

export function useDocumentActions(lifecycle: any) {
  const { activeDoc, setDoc, pushUndoRedoState } = lifecycle;
  
  const activeDocRef = useRef(activeDoc);
  useEffect(() => {
    activeDocRef.current = activeDoc;
  }, [activeDoc]);

  const dispatch = useMemo(() => {
    return createActionDispatcher(
      () => activeDocRef.current,
      (newDoc: any) => {
        activeDocRef.current = newDoc;
        setDoc(newDoc);
      },
      pushUndoRedoState,
      { enableLogging: import.meta.env.DEV }
    );
  }, [setDoc, pushUndoRedoState]);
  
  return { dispatch };
}
