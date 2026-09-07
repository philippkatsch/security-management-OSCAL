import { useState, useEffect, useCallback, useRef } from 'react';
import { useAtom } from 'jotai';
import { produce } from 'immer';
import { useDocumentData } from './useDocumentData';
import { useDocumentHistory } from './useDocumentHistory';
import { useUnsavedChangesWarning } from './useUnsavedChangesWarning';
import { editModeAtom } from '@stores/uiAtoms';
import { OscalStage, OscalDocument } from '@lib/types/oscal';
import { VersionInfo } from '@lib/types/api';
import { useConfirm } from './useConfirm';
import { toast } from 'react-hot-toast';
import { ROOT_KEYS as STAGE_ROOT_KEYS } from '@lib/oscal-constants';

/**
 * Unified Document Lifecycle Hook for all OSCAL document types.
 */
export function useDocumentLifecycle(stage: OscalStage, modelName: string, documentId: string, initialEditMode = false) {
  const { confirm } = useConfirm();
  const [, setGlobalEditMode] = useAtom(editModeAtom);
  const [isEditing, setIsEditingState] = useState<boolean>(() => {
    return initialEditMode || window.location.search.includes('edit=true');
  });

  const setIsEditing = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    setIsEditingState(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      return next;
    });
  }, []);

  useEffect(() => {
    setGlobalEditMode(isEditing);
  }, [isEditing, setGlobalEditMode]);

  const [editMode, setEditMode] = useState<string>('visual');
  const [inspectedVersion, setInspectedVersion] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  const data = useDocumentData(stage, modelName, documentId, isEditing, isDirty);
  const history = useDocumentHistory(data.doc, data.setDoc, isEditing);

  useEffect(() => {
    setIsDirty(history.hasUnsavedChanges);
  }, [history.hasUnsavedChanges]);

  // Keep underlying doc reference in sync with activeDoc so useDraft and auto-save have current edits
  const prevActiveDocRef = useRef(history.activeDoc);
  const prevIsEditingRef = useRef(isEditing);
  useEffect(() => {
    const isEditingToggledOn = isEditing && !prevIsEditingRef.current;
    prevIsEditingRef.current = isEditing;

    if (isEditing && history.activeDoc) {
      if (history.activeDoc !== prevActiveDocRef.current || isEditingToggledOn) {
        prevActiveDocRef.current = history.activeDoc;
        if (history.activeDoc !== data.doc) {
          data.setDoc(history.activeDoc);
        }
      }
    } else {
      prevActiveDocRef.current = history.activeDoc;
    }
  }, [history.activeDoc, isEditing, data.doc, data.setDoc]);
  
  useUnsavedChangesWarning(history.hasUnsavedChanges, isEditing);

  // Sync undoRedo state on initial doc load if not yet initialized
  useEffect(() => {
    if (data.doc && history.currentIndex === -1) {
      history.resetUndoRedo(data.doc);
    }
  }, [data.doc, history.currentIndex, history.resetUndoRedo]);

  const handleToggleEdit = useCallback(async () => {
    if (isEditing) {
      setIsEditing(false);
      if (window.location.search.includes('edit=')) {
        const params = new URLSearchParams(window.location.search);
        params.delete('edit');
        const newSearch = params.toString() ? `?${params.toString()}` : '';
        window.history.replaceState(null, '', `${window.location.pathname}${newSearch}`);
      }
      try {
        const docToSave = (history.activeDoc || data.doc) as OscalDocument;
        if (docToSave) {
          await data.saveDraftTag(docToSave);
          await data.loadVersions();
        }
        const reloadedData = await data.reload({ silent: true });
        if (reloadedData) history.resetUndoRedo(reloadedData);
      } catch (err: any) {
        toast.error(`Saving failed: ${err.message}`);
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
      const params = new URLSearchParams(window.location.search);
      if (!params.get('edit')) {
        params.set('edit', 'true');
        window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
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
    const confirmed = await confirm({
      title: 'Delete Active Draft',
      message: 'Are you sure you want to delete the active draft and revert to the published version?',
      confirmLabel: 'Delete Draft',
      variant: 'danger',
    });
    if (confirmed) {
      data.markDraftDiscarded();
      try {
        if (data.deleteVersionTag) {
          await data.deleteVersionTag('draft');
        }
      } catch (err: any) {
        toast.error(`Failed to delete draft: ${err.message || err}`);
      }
      setIsEditing(false);
      setInspectedVersion(null);
      await data.loadVersions();
      const docData = await data.reload({ silent: false });
      if (docData) history.resetUndoRedo(docData);
    }
  }, [confirm, data, history, setIsEditing]);

  const handlePublishVersion = useCallback(async (ver: string, docToSave?: OscalDocument | string, remarks?: string) => {
    let actualDocToSave: OscalDocument | undefined = undefined;
    let actualRemarks: string | undefined = remarks;

    if (typeof docToSave === 'string') {
      actualRemarks = docToSave;
      actualDocToSave = (history.activeDoc || data.doc) as OscalDocument;
    } else {
      actualDocToSave = docToSave || (history.activeDoc || data.doc) as OscalDocument;
    }

    if (actualDocToSave) {
      const rootKey = STAGE_ROOT_KEYS[stage] || stage.replace(/s$/, '');
      const docWithNewVer = produce(actualDocToSave, (draft: any) => {
        const root = draft[rootKey] || draft[stage];
        if (root?.metadata) {
          root.metadata.version = ver;
        }
      });
      if (data.save) {
        await data.save(docWithNewVer);
      }
      actualDocToSave = docWithNewVer;
    }

    await data.saveVersionTag(ver, actualDocToSave, actualRemarks);
    setIsEditing(false);
    if (window.location.search.includes('edit=true')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    data.setShowDrawer(false);
    await data.loadVersions();
    const docData = await data.reload({ silent: true });
    if (docData) history.resetUndoRedo(docData);
  }, [data, history, setIsEditing, stage]);

  const isBackInProgressRef = useRef(false);
  const handleBack = useCallback(async (navigateBackFn?: () => void) => {
    if (isBackInProgressRef.current) return;
    isBackInProgressRef.current = true;
    try {
      if (isEditing && history.hasUnsavedChanges) {
        const choice = await confirm({
          title: 'Unsaved Draft Changes',
          message: 'You have unsaved changes in your active draft. Click Save to save your draft, or Discard to discard changes.',
          confirmLabel: 'Save Draft',
          cancelLabel: 'Discard Changes',
          variant: 'warning',
        });
        if (choice) {
          try {
            await data.saveDraftTag(history.activeDoc as OscalDocument);
            data.markDraftDiscarded();
            setIsDirty(false);
            history.resetUndoRedo(history.activeDoc as OscalDocument);
          } catch (err: any) {
            toast.error(`Draft save failed: ${err.message || err}`);
            return;
          }
        } else {
          data.markDraftDiscarded();
          setIsDirty(false);
          try {
            if (data.deleteVersionTag) {
              await data.deleteVersionTag('draft');
            }
          } catch (err: any) {
            // Silent catch if draft tag did not exist on server
          }
        }
      }
      if (navigateBackFn) {
        navigateBackFn();
      }
    } finally {
      isBackInProgressRef.current = false;
    }
  }, [isEditing, history.hasUnsavedChanges, history.activeDoc, data, history, confirm]);

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
