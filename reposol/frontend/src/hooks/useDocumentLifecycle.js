import { useState, useEffect, useCallback } from 'react';
import { useDocument } from './useDocument';
import { useVersions } from './useVersions';
import { useDraft } from './useDraft';
import { useUndoRedo } from './useUndoRedo';

/**
 * Unified Document Lifecycle Hook for all OSCAL document types.
 *
 * Centralizes:
 * - Document loading & saving (`useDocument`)
 * - Version management & listing (`useVersions`)
 * - Auto-saving & draft management (`useDraft`)
 * - Undo/Redo history tracking (`useUndoRedo`)
 * - Unified Edit/View mode switching with server draft detection
 * - Version selection & inspection
 * - Draft deletion & publication
 * - Unsaved changes back-button confirmation dialog
 *
 * @param {string} stage - OSCAL stage key (e.g. 'catalogs', 'profiles', 'ssps')
 * @param {string} modelName - OSCAL root key name for draft hook ('catalog', 'profile', 'system-security-plan')
 * @param {string} documentId - Document UUID
 * @returns {object} Unified lifecycle handlers and state
 */
export function useDocumentLifecycle(stage, modelName, documentId, initialEditMode = false) {
  const { doc, setDoc, loading, error, saving, validating, validationResult, save, validate, reload } = useDocument(stage, documentId, initialEditMode);
  const {
    versions,
    showDrawer,
    setShowDrawer,
    save: saveVersionTag,
    saveDraft: saveDraftTag,
    remove: deleteVersionTag,
    switchTo: loadVersion,
    reload: loadVersions
  } = useVersions(stage, documentId);

  const [isEditing, setIsEditing] = useState(() => {
    return initialEditMode || window.location.search.includes('edit=true');
  });
  const [editMode, setEditMode] = useState('visual');
  const [inspectedVersion, setInspectedVersion] = useState(null);

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

  const { saveNow: saveDraftNow, markDiscarded: markDraftDiscarded } = useDraft(
    modelName,
    documentId,
    activeDoc,
    isEditing,
    30000,
    saveDraftTag
  );

  const hasDraft = versions.some(
    v => v.is_draft || (typeof v.version === 'string' && v.version.endsWith('-draft'))
  );

  // Sync undoRedo state on initial doc load if not yet initialized
  useEffect(() => {
    if (doc && !undoRedoDoc) {
      resetUndoRedo(doc);
    }
  }, [doc, undoRedoDoc, resetUndoRedo]);

  const handleToggleEdit = useCallback(async () => {
    if (isEditing) {
      setIsEditing(false);
      if (window.location.search.includes('edit=true')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      try {
        await saveDraftTag(activeDoc);
        await loadVersions();
        const reloadedData = await reload({ silent: true });
        if (reloadedData) resetUndoRedo(reloadedData);
      } catch (err) {
        alert(`Saving failed: ${err.message}`);
      }
    } else {
      const hasDraftOnServer = versions.some(
        v => v.is_draft || (typeof v.version === 'string' && v.version.endsWith('-draft'))
      );
      if (hasDraftOnServer) {
        const draftData = await reload({ silent: true });
        if (draftData) resetUndoRedo(draftData);
      } else if (inspectedVersion) {
        const freshData = await reload({ silent: true });
        if (freshData) {
          await saveDraftTag(freshData);
          resetUndoRedo(freshData);
        }
      }
      setInspectedVersion(null);
      setIsEditing(true);
      if (!window.location.search.includes('edit=true')) {
        window.history.replaceState(null, '', window.location.pathname + '?edit=true');
      }
    }
  }, [isEditing, activeDoc, saveDraftTag, loadVersions, reload, resetUndoRedo, versions, inspectedVersion]);

  const handleSelectVersion = useCallback(async (ver) => {
    if (isEditing) return;
    if (ver === 'draft') {
      setInspectedVersion(null);
      const data = await reload();
      if (data) resetUndoRedo(data);
    } else {
      setInspectedVersion(ver);
      const data = await loadVersion(ver);
      if (data) {
        setDoc(data);
        resetUndoRedo(data);
      }
    }
  }, [isEditing, reload, loadVersion, setDoc, resetUndoRedo]);

  const handleDeleteDraft = useCallback(async () => {
    if (window.confirm('Are you sure you want to delete the active draft and revert to the published version?')) {
      markDraftDiscarded();
      try {
        if (deleteVersionTag) {
          await deleteVersionTag('draft');
        }
      } catch (err) {
        console.error('Failed to delete draft:', err);
      }
      setIsEditing(false);
      setInspectedVersion(null);
      await loadVersions();
      const data = await reload({ silent: false });
      if (data) resetUndoRedo(data);
    }
  }, [markDraftDiscarded, deleteVersionTag, loadVersions, reload, resetUndoRedo]);

  const handlePublishVersion = useCallback(async (ver, docToSave, remarks) => {
    await saveVersionTag(ver, docToSave || activeDoc, remarks);
    setIsEditing(false);
    if (window.location.search.includes('edit=true')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    setShowDrawer(false);
    await loadVersions();
    const data = await reload({ silent: true });
    if (data) resetUndoRedo(data);
  }, [saveVersionTag, activeDoc, loadVersions, reload, resetUndoRedo, setShowDrawer]);

  const handleBack = useCallback(async (navigateBackFn) => {
    if (isEditing) {
      const choice = window.confirm(
        'You have unsaved changes.\n\nClick OK to save the draft and go back.\nClick Cancel to discard the draft and go back.'
      );
      if (choice) {
        try {
          await saveDraftTag(activeDoc);
        } catch (err) {
          console.error("Back button draft save failed:", err);
        }
      } else {
        markDraftDiscarded();
        try {
          if (deleteVersionTag) {
            await deleteVersionTag('draft');
          }
        } catch (err) {
          console.error("Back button draft delete failed:", err);
        }
      }
    }
    if (navigateBackFn) {
      navigateBackFn();
    }
  }, [isEditing, activeDoc, saveDraftTag, markDraftDiscarded, deleteVersionTag]);

  return {
    doc,
    activeDoc,
    setDoc,
    loading,
    error,
    saving,
    validating,
    validationResult,
    save,
    validate,
    reload,

    versions,
    hasDraft,
    currentVersion: versions.find(v => v.is_active)?.version || null,
    inspectedVersion,
    setInspectedVersion,

    isEditing,
    setIsEditing,
    editMode,
    setEditMode,

    showDrawer,
    setShowDrawer,

    handleToggleEdit,
    handleSelectVersion,
    handleDeleteDraft,
    handlePublishVersion,
    handleBack,

    undo,
    redo,
    canUndo,
    canRedo,
    pushUndoRedoState,
    resetUndoRedo,
    markDraftDiscarded,
    saveDraftTag,
    saveVersionTag,
    deleteVersionTag,
    loadVersions
  };
}
