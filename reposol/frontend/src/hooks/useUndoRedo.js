import { useReducer, useCallback, useRef } from 'react';

/**
 * Hook for undo/redo history management.
 * Uses useReducer to avoid stale closure issues with separate history/index state.
 * @param {object} initialState - Initial document state
 * @param {number} maxHistory - Maximum history entries (default: 50)
 * @returns {object}
 */

function undoRedoReducer(state, action) {
  switch (action.type) {
    case 'PUSH': {
      const newHistory = state.history.slice(0, state.index + 1);
      newHistory.push(JSON.parse(JSON.stringify(action.payload)));
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
    case 'RESET':
      return action.payload
        ? { history: [JSON.parse(JSON.stringify(action.payload))], index: 0 }
        : { history: [], index: -1 };
    default:
      return state;
  }
}

export function useUndoRedo(initialState = null, maxHistory = 50) {
  const [state, dispatch] = useReducer(undoRedoReducer, null, () => ({
    history: initialState ? [JSON.parse(JSON.stringify(initialState))] : [],
    index: initialState ? 0 : -1,
  }));
  const isUndoRedoRef = useRef(false);

  const { history, index } = state;
  const current = index >= 0 && index < history.length ? history[index] : null;

  const pushState = useCallback((newState) => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }
    dispatch({ type: 'PUSH', payload: newState, maxHistory });
  }, [maxHistory]);

  const undo = useCallback(() => {
    if (index > 0) {
      isUndoRedoRef.current = true;
      dispatch({ type: 'UNDO' });
      return history[index - 1];
    }
    return null;
  }, [index, history]);

  const redo = useCallback(() => {
    if (index < history.length - 1) {
      isUndoRedoRef.current = true;
      dispatch({ type: 'REDO' });
      return history[index + 1];
    }
    return null;
  }, [index, history]);

  const canUndo = index > 0;
  const canRedo = index < history.length - 1;

  const reset = useCallback((resetState) => {
    dispatch({ type: 'RESET', payload: resetState });
  }, []);

  return { current, pushState, undo, redo, canUndo, canRedo, reset };
}
