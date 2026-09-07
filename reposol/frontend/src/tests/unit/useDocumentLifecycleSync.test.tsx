import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDocumentLifecycle } from '../../hooks/useDocumentLifecycle';

// Mock dependencies of useDocumentLifecycle
const mockSetDoc = vi.fn();
const mockResetUndoRedo = vi.fn();
let mockDoc: any = null;
let mockActiveDoc: any = null;
let mockHasUnsavedChanges = false;
let mockCurrentIndex = 0;

vi.mock('../../hooks/useConfirm', () => ({
  useConfirm: () => ({ confirm: vi.fn() }),
}));

vi.mock('../../hooks/useUnsavedChangesWarning', () => ({
  useUnsavedChangesWarning: vi.fn(),
}));

vi.mock('jotai', () => ({
  useAtom: () => [false, vi.fn()],
  atom: vi.fn(),
}));

vi.mock('../../hooks/useDocumentData', () => ({
  useDocumentData: () => ({
    doc: mockDoc,
    setDoc: mockSetDoc,
    loading: false,
    error: null,
    saving: false,
    validating: false,
    validationResult: null,
    save: vi.fn(),
    validate: vi.fn(),
    reload: vi.fn(),
    versions: [],
    hasDraft: false,
    markDraftDiscarded: vi.fn(),
    saveDraftTag: vi.fn(),
    saveVersionTag: vi.fn(),
    deleteVersionTag: vi.fn(),
    loadVersions: vi.fn(),
    showDrawer: false,
    setShowDrawer: vi.fn(),
  }),
}));

vi.mock('../../hooks/useDocumentHistory', () => ({
  useDocumentHistory: () => ({
    activeDoc: mockActiveDoc,
    pushUndoRedoState: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    resetUndoRedo: mockResetUndoRedo,
    hasUnsavedChanges: mockHasUnsavedChanges,
    currentIndex: mockCurrentIndex,
  }),
}));

describe('useDocumentLifecycle activeDoc Synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc = { profile: { uuid: 'p1', metadata: { title: 'Base' } } };
    mockActiveDoc = mockDoc;
    mockHasUnsavedChanges = false;
    mockCurrentIndex = 0;
  });

  it('does not clobber external data.doc changes when activeDoc has not changed', () => {
    // Mount the hook with initial edit mode = true
    const { rerender } = renderHook(() =>
      useDocumentLifecycle('profiles', 'profile', 'p1', true)
    );

    // Initial mount: mockActiveDoc === mockDoc, no extra setDoc calls
    expect(mockSetDoc).not.toHaveBeenCalled();

    // Simulate an external migration that updates data.doc directly
    mockDoc = {
      profile: {
        uuid: 'p1',
        metadata: { title: 'Base' },
        merge: { 'as-is': true },
      },
    };
    // Note: mockActiveDoc has NOT changed yet
    rerender();

    // Because activeDoc has not changed, the hook must NOT overwrite data.doc with stale activeDoc
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('syncs data.doc when activeDoc changes (e.g. from undo/redo or resetUndoRedo)', () => {
    const { rerender } = renderHook(() =>
      useDocumentLifecycle('profiles', 'profile', 'p1', true)
    );

    // Simulate activeDoc changing (e.g., undo or history reset)
    const newActiveDoc = {
      profile: {
        uuid: 'p1',
        metadata: { title: 'Updated ActiveDoc' },
        merge: { 'as-is': true },
      },
    };
    mockActiveDoc = newActiveDoc;
    rerender();

    // Now setDoc should have been called with the new activeDoc
    expect(mockSetDoc).toHaveBeenCalledWith(newActiveDoc);
  });
});
