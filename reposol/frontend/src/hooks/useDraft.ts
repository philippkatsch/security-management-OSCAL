import { deepClone, updateDocumentWith } from '@lib/document-updater';
import { useEffect, useCallback, useRef } from 'react';

/**
 * Hook for auto-saving drafts to the backend.
 * @param {string} model - e.g. 'catalog', 'profile'
 * @param {string} uuid - Document UUID
 * @param {object} data - Current document data to auto-save
 * @param {boolean} isEditing - Only save when in edit mode
 * @param {number} interval - Auto-save interval in ms (default: 30000)
 * @param {function} saveDraftCallback - Function to persist draft to backend
 * @returns {object} { saveNow }
 */
export function useDraft(
  model?: string, 
  uuid?: string | null, 
  data?: any, 
  isEditing: boolean = false, 
  interval: number = 30000, 
  saveDraftCallback: ((data: any) => Promise<any>) | null = null,
  isDirty: boolean = false
) {
  const timerRef = useRef<any>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const isEditingRef = useRef(isEditing);
  isEditingRef.current = isEditing;

  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const saveCallbackRef = useRef(saveDraftCallback);
  saveCallbackRef.current = saveDraftCallback;

  const isDiscardedRef = useRef(false);

  // When isEditing changes to true, reset the discarded flag
  useEffect(() => {
    if (isEditing) {
      isDiscardedRef.current = false;
    }
  }, [isEditing]);

  // Auto-save on interval (only if document has uncommitted changes)
  useEffect(() => {
    if (!isEditing || !uuid || !saveDraftCallback) return;
    timerRef.current = setInterval(() => {
      if (dataRef.current && isDirtyRef.current && !isDiscardedRef.current && saveDraftCallback) {
        saveDraftCallback(dataRef.current).catch(err => {
          console.error('Backend auto-save failed:', err);
        });
      }
    }, interval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [model, uuid, isEditing, interval, saveDraftCallback]);

  // Save on unmount with closure data matching exact uuid (only if document has uncommitted changes)
  useEffect(() => {
    const currentUuid = uuid;
    return () => {
      if (isEditingRef.current && isDirtyRef.current && dataRef.current && currentUuid && !isDiscardedRef.current && saveCallbackRef.current) {
        saveCallbackRef.current(dataRef.current).catch(err => {
          console.error('Backend save on unmount failed:', err);
        });
      }
    };
  }, [model, uuid]);

  const markDiscarded = useCallback(() => {
    isDiscardedRef.current = true;
  }, []);

  const saveNow = useCallback(() => {
    if (dataRef.current && uuid && saveDraftCallback) {
      saveDraftCallback(dataRef.current).catch(err => {
        console.error('Manual backend save failed:', err);
      });
    }
  }, [model, uuid, saveDraftCallback]);

  return { saveNow, markDiscarded };
}

