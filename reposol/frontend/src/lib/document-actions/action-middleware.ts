import { produce } from 'immer';
import { DocumentAction, ActionDispatcher } from './types';

export function createActionDispatcher(
  getDocument: () => any,
  setDocument: (doc: any) => void,
  pushUndoSnapshot: (doc: any) => void,
  options?: { enableLogging?: boolean }
): ActionDispatcher {
  return (action: DocumentAction) => {
    const currentDoc = getDocument();
    if (!currentDoc) return;
    
    pushUndoSnapshot(currentDoc);
    
    if (options?.enableLogging) {
      console.debug(`[Action] ${action.domain}/${action.type}:`, action.description);
    }
    
    const newDoc = produce(currentDoc, (draft: any) => {
      action.apply(draft);
    });
    
    setDocument(newDoc);
  };
}
