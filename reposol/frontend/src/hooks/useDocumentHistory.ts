import { useEffect, useCallback } from 'react';
import { useUndoRedo } from './useUndoRedo';
import { OscalDocument } from '@lib/types/oscal';

export function useDocumentHistory(doc: OscalDocument | null, setDoc: (doc: OscalDocument) => void, isEditing: boolean) {
  const {
    current: undoRedoDoc,
    pushState: pushUndoRedoState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetUndoRedo
  } = useUndoRedo(doc);

  const activeDoc = undoRedoDoc || doc;
  
  // Track if there are unsaved changes (i.e. undo history exists since last save/reset)
  // Or simply when canUndo is true
  const hasUnsavedChanges = canUndo;

  // Keyboard shortcuts
  useEffect(() => {
    if (!isEditing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          if (canRedo) {
            e.preventDefault();
            redo();
          }
        } else {
          if (canUndo) {
            e.preventDefault();
            undo();
          }
        }
      }
      // Ctrl+Y or Cmd+Y
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (canRedo) {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, canUndo, canRedo, undo, redo]);

  return {
    activeDoc,
    pushUndoRedoState,
    undo,
    redo,
    canUndo,
    canRedo,
    resetUndoRedo,
    hasUnsavedChanges
  };
}
