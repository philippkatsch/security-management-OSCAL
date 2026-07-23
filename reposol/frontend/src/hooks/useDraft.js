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
export function useDraft(model, uuid, data, isEditing = false, interval = 30000, saveDraftCallback = null) {
  const timerRef = useRef(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const isEditingRef = useRef(isEditing);
  isEditingRef.current = isEditing;

  const isDiscardedRef = useRef(false);

  // When isEditing changes to true, reset the discarded flag
  useEffect(() => {
    if (isEditing) {
      isDiscardedRef.current = false;
    }
  }, [isEditing]);

  // Auto-save on interval
  useEffect(() => {
    if (!isEditing || !uuid || !saveDraftCallback) return;
    timerRef.current = setInterval(() => {
      if (dataRef.current && !isDiscardedRef.current) {
        saveDraftCallback(dataRef.current).catch(err => {
          console.error('Backend auto-save failed:', err);
        });
      }
    }, interval);
    return () => clearInterval(timerRef.current);
  }, [model, uuid, isEditing, interval, saveDraftCallback]);

  // Save on unmount if editing (only runs on actual unmount or uuid change)
  useEffect(() => {
    return () => {
      if (isEditingRef.current && dataRef.current && uuid && !isDiscardedRef.current && saveDraftCallback) {
        saveDraftCallback(dataRef.current).catch(err => {
          console.error('Backend save on unmount failed:', err);
        });
      }
    };
  }, [model, uuid, saveDraftCallback]);

  const saveNow = useCallback(() => {
    if (dataRef.current && uuid && saveDraftCallback) {
      saveDraftCallback(dataRef.current).catch(err => {
        console.error('Manual backend save failed:', err);
      });
    }
  }, [model, uuid, saveDraftCallback]);

  return { saveNow };
}
