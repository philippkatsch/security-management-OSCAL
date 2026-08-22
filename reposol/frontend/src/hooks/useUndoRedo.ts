import { deepClone } from '@lib/document-updater';
import { useReducer, useCallback, useRef } from 'react';

/**
 * Helper to safely deep clone an object without throwing on undefined or null.
 */
function safeClone(obj) {
  if (obj === null || obj === undefined) return null;
  try {
    return deepClone(obj);
  } catch (err) {
    console.error('safeClone failed:', err);
    return null;
  }
}

/**
 * Hook for undo/redo history management.
 * Uses useReducer to avoid stale closure issues with separate history/index state.
 * @param {object} initialState - Initial document state
 * @param {number} maxHistory - Maximum history entries (default: 50)
 * @returns {object}
 */

function undoRedoReducer<T>(state: { history: T[]; index: number }, action: any): { history: T[]; index: number } {
  switch (action.type) {
    case 'PUSH': {
      if (!action.payload) return state;
      const cloned = safeClone(action.payload);
      if (!cloned) return state;
      const newHistory = state.history.slice(0, state.index + 1);
      newHistory.push(cloned);
      if (newHistory.length > action.maxHistory) {
        newHistory.shift();
        return { history: newHistory, index: newHistory.length - 1 };
      }
      return { history: newHistory, index: newHistory.length - 1 };
    }
    case 'UNDO':
      return state.index > 0
        ? { ...state, index: state.index - 1 }
        : state;
    case 'REDO':
      return state.index < state.history.length - 1
        ? { ...state, index: state.index + 1 }
        : state;
    case 'RESET': {
      if (!action.payload) return { history: [], index: -1 };
      const cloned = safeClone(action.payload);
      return cloned ? { history: [cloned], index: 0 } : { history: [], index: -1 };
    }
    default:
      return state;
  }
}

export function useUndoRedo<T = any>(initialState: T | null = null, maxHistory = 50) {
  const [state, dispatch] = useReducer(undoRedoReducer<T>, null, () => {
    const cloned = safeClone(initialState);
    return {
      history: cloned ? [cloned] : [],
      index: cloned ? 0 : -1,
    };
  });
  const isUndoRedoRef = useRef(false);

  const { history, index } = state;
  const current = index >= 0 && index < history.length ? history[index] : null;

  const pushState = useCallback((newState: T) => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }
    if (newState) {
      dispatch({ type: 'PUSH', payload: newState, maxHistory });
    }
  }, [maxHistory]);

  const undo = useCallback((): T | null => {
    if (index > 0) {
      isUndoRedoRef.current = true;
      dispatch({ type: 'UNDO' });
      return history[index - 1];
    }
    return null;
  }, [index, history]);

  const redo = useCallback((): T | null => {
    if (index < history.length - 1) {
      isUndoRedoRef.current = true;
      dispatch({ type: 'REDO' });
      return history[index + 1];
    }
    return null;
  }, [index, history]);

  const reset = useCallback((newState?: T | null) => {
    dispatch({ type: 'RESET', payload: newState });
  }, []);

  return {
    current,
    pushState,
    undo,
    redo,
    reset,
    canUndo: index > 0,
    canRedo: index < history.length - 1,
    historyLength: history.length,
    currentIndex: index,
  };
}
