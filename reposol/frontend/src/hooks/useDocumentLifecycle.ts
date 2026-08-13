import { useState, useEffect, useCallback } from 'react';
import { useAtom } from 'jotai';
import { useDocumentData } from './useDocumentData';
import { useDocumentHistory } from './useDocumentHistory';
import { useUnsavedChangesWarning } from './useUnsavedChangesWarning';
import { editModeAtom } from '@stores/uiAtoms';
import { OscalStage, OscalDocument } from '@lib/types/oscal';
import { VersionInfo } from '@lib/types/api';

/**
 * Unified Document Lifecycle Hook for all OSCAL document types.
 */
export function useDocumentLifecycle(stage: OscalStage, modelName: string, documentId: string, initialEditMode = false) {
  const [, setGlobalEditMode] = useAtom(editModeAtom);
  const [isEditing, setIsEditingState] = useState<boolean>(() => {
    return initialEditMode || window.location.search.includes('edit=true');
  });

  const setIsEditing = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    setIsEditingState(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      setGlobalEditMode(next);
      return next;
    });
  }, [setGlobalEditMode]);

  useEffect(() => {
    setGlobalEditMode(isEditing);
  }, [isEditing, setGlobalEditMode]);

  const [editMode, setEditMode] = useState<string>('visual');
  const [inspectedVersion, setInspectedVersion] = useState<string | null>(null);

  const data = useDocumentData(stage, modelName, documentId, isEditing);
  const history = useDocumentHistory(data.doc, data.setDoc, isEditing);
  
  useUnsavedChangesWarning(history.hasUnsavedChanges, isEditing);

  // Sync undoRedo state on initial doc load if not yet initialized
  useEffect(() => {
    if (data.doc && !history.activeDoc) {
      history.resetUndoRedo(data.doc);
    }
  }, [data.doc, history.activeDoc, history.resetUndoRedo]);

  const handleToggleEdit = useCallback(async () => {
    if (isEditing) {
      setIsEditing(false);
      if (window.location.search.includes('edit=true')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      try {
        await data.saveDraftTag(history.activeDoc as OscalDocument);
        await data.loadVersions();
        const reloadedData = await data.reload({ silent: true });
        if (reloadedData) history.resetUndoRedo(reloadedData);
      } catch (err: any) {
        alert(`Saving failed: ${err.message}`);
      }
    } else {
      const hasDraftOnServer = data.versions.some(
        (v: VersionInfo) => v.is_draft || (typeof v.version === 'string' && v.version.endsWith('-draft'))
      );
      if (hasDraftOnServer) {
        const draftData = await data.reload({ silent: true });
        if (draftData) history.resetUndoRedo(draftData);
      } else if (inspectedVersion) {
        const freshData = await data.reload({ silent: true });
        if (freshData) {
          await data.saveDraftTag(freshData);
          history.resetUndoRedo(freshData);
        }
      }
      setInspectedVersion(null);
      setIsEditing(true);
      if (!window.location.search.includes('edit=true')) {
        window.history.replaceState(null, '', window.location.pathname + '?edit=true');
      }
    }
  }, [isEditing, history.activeDoc, data, history, inspectedVersion, setIsEditing]);

  const handleSelectVersion = useCallback(async (ver: string) => {
    if (isEditing) return;
    if (ver === 'draft') {
      setInspectedVersion(null);
      const docData = await data.reload();
      if (docData) history.resetUndoRedo(docData);
    } else {
      setInspectedVersion(ver);
      const docData = await data.loadVersion(ver);
      if (docData) {
        data.setDoc(docData);
        history.resetUndoRedo(docData);
      }
    }
  }, [isEditing, data, history]);

  const handleDeleteDraft = useCallback(async () => {
    if (window.confirm('Are you sure you want to delete the active draft and revert to the published version?')) {
      data.markDraftDiscarded();
      try {
        if (data.deleteVersionTag) {
          await data.deleteVersionTag('draft');
        }
      } catch (err) {
        console.error('Failed to delete draft:', err);
      }
      setIsEditing(false);
      setInspectedVersion(null);
      await data.loadVersions();
      const docData = await data.reload({ silent: false });
      if (docData) history.resetUndoRedo(docData);
    }
  }, [data, history, setIsEditing]);

  const handlePublishVersion = useCallback(async (ver: string, docToSave?: OscalDocument, remarks?: string) => {
    await data.saveVersionTag(ver, docToSave || (history.activeDoc as OscalDocument), remarks);
    setIsEditing(false);
    if (window.location.search.includes('edit=true')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    data.setShowDrawer(false);
    await data.loadVersions();
    const docData = await data.reload({ silent: true });
    if (docData) history.resetUndoRedo(docData);
  }, [data, history, setIsEditing]);

  const handleBack = useCallback(async (navigateBackFn?: () => void) => {
    if (isEditing) {
      const choice = window.confirm(
        'You have unsaved changes.\n\nClick OK to save the draft and go back.\nClick Cancel to discard the draft and go back.'
      );
      if (choice) {
        try {
          await data.saveDraftTag(history.activeDoc as OscalDocument);
        } catch (err) {
          console.error("Back button draft save failed:", err);
        }
      } else {
        data.markDraftDiscarded();
        try {
          if (data.deleteVersionTag) {
            await data.deleteVersionTag('draft');
          }
        } catch (err) {
          console.error("Back button draft delete failed:", err);
        }
      }
    }
    if (navigateBackFn) {
      navigateBackFn();
    }
  }, [isEditing, data, history]);

  return {
    doc: data.doc,
    activeDoc: history.activeDoc as OscalDocument,
    setDoc: data.setDoc,
    loading: data.loading,
    error: data.error,
    saving: data.saving,
    validating: data.validating,
    validationResult: data.validationResult,
    save: data.save,
    validate: data.validate,
    reload: data.reload,

    versions: data.versions,
    hasDraft: data.hasDraft,
    currentVersion: data.versions.find((v: VersionInfo) => v.is_active)?.version || null,
    inspectedVersion,
    setInspectedVersion,

    isEditing,
    setIsEditing,
    editMode,
    setEditMode,

    showDrawer: data.showDrawer,
    setShowDrawer: data.setShowDrawer,

    handleToggleEdit,
    handleSelectVersion,
    handleDeleteDraft,
    handlePublishVersion,
    handleBack,

    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    pushUndoRedoState: history.pushUndoRedoState,
    resetUndoRedo: history.resetUndoRedo,
    markDraftDiscarded: data.markDraftDiscarded,
    saveDraftTag: data.saveDraftTag,
    saveVersionTag: data.saveVersionTag,
    deleteVersionTag: data.deleteVersionTag,
    loadVersions: data.loadVersions
  };
}
