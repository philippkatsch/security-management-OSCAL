import { useState, useCallback, useRef } from 'react';

/**
 * Hook for undo/redo history management.
 * Stores document snapshots in a history stack.
 * @param {object} initialState - Initial document state
 * @param {number} maxHistory - Maximum history entries (default: 50)
 * @returns {object}
 */
export function useUndoRedo(initialState = null, maxHistory = 50) {
  const [history, setHistory] = useState(initialState ? [JSON.parse(JSON.stringify(initialState))] : []);
  const [index, setIndex] = useState(initialState ? 0 : -1);
  const isUndoRedoRef = useRef(false);

  const current = index >= 0 && index < history.length ? history[index] : null;

  const pushState = useCallback((state) => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }
    setHistory(prev => {
      const newHistory = prev.slice(0, index + 1);
      newHistory.push(JSON.parse(JSON.stringify(state)));
      if (newHistory.length > maxHistory) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setIndex(prev => Math.min(prev + 1, maxHistory - 1));
  }, [index, maxHistory]);

  const undo = useCallback(() => {
    if (index > 0) {
      isUndoRedoRef.current = true;
      setIndex(prev => prev - 1);
      return history[index - 1];
    }
    return null;
  }, [index, history]);

  const redo = useCallback(() => {
    if (index < history.length - 1) {
      isUndoRedoRef.current = true;
      setIndex(prev => prev + 1);
      return history[index + 1];
    }
    return null;
  }, [index, history]);

  const canUndo = index > 0;
  const canRedo = index < history.length - 1;

  const reset = useCallback((state) => {
    setHistory(state ? [JSON.parse(JSON.stringify(state))] : []);
    setIndex(state ? 0 : -1);
  }, []);

  return { current, pushState, undo, redo, canUndo, canRedo, reset };
}
