import { useState, useEffect, useCallback, useRef } from 'react';
import { useDocumentQuery, useDocumentMutation, useDocumentValidationMutation } from './useDocumentQuery';
import { useVersions } from './useVersions';
import { useDraft } from './useDraft';
import { cleanEmptyArrays } from '@lib/oscal-utils';
import { OscalDocument, OscalStage } from '@lib/types/oscal';
import { ValidationResult } from '@lib/types/api';

export function useDocumentData(stage: OscalStage, modelName: string, documentId: string, isEditing: boolean) {
  const query = useDocumentQuery(stage, documentId);
  const mutation = useDocumentMutation(stage);
  const validationMutation = useDocumentValidationMutation(stage);

  const [doc, setDocState] = useState<OscalDocument | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const docRef = useRef<OscalDocument | null>(null);

  useEffect(() => {
    if (query.data) {
      setDocState(query.data);
      docRef.current = query.data;
    }
  }, [query.data]);

  const updateDoc = useCallback((updater: OscalDocument | ((prev: OscalDocument | null) => OscalDocument | null)) => {
    setDocState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      docRef.current = next;
      return next;
    });
  }, []);

  const reload = useCallback(async (options: { silent?: boolean } = {}): Promise<OscalDocument | null> => {
    const result = await query.refetch();
    if (result.data) {
      updateDoc(result.data);
      return result.data;
    }
    return null;
  }, [query, updateDoc]);

  const save = useCallback(async (documentToSave?: OscalDocument): Promise<OscalDocument> => {
    const targetDoc = documentToSave || docRef.current;
    if (!targetDoc) throw new Error('No document to save');
    const cleaned = cleanEmptyArrays(targetDoc);
    const result = await mutation.mutateAsync({ docId: documentId, data: cleaned });
    updateDoc(result);
    return result;
  }, [documentId, mutation, updateDoc]);

  const validate = useCallback(async (documentToValidate?: OscalDocument): Promise<ValidationResult> => {
    setValidationResult(null);
    try {
      const targetDoc = documentToValidate || docRef.current;
      if (!targetDoc) throw new Error('No document to validate');
      const result = await validationMutation.mutateAsync(targetDoc);
      const mappedResult: ValidationResult = { ...result, valid: result.status === 'valid' };
      setValidationResult(mappedResult);
      return mappedResult;
    } catch (err: any) {
      const failedResult: ValidationResult = { valid: false, errors: err.errors || [err.message] };
      setValidationResult(failedResult);
      return failedResult;
    }
  }, [validationMutation]);

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

  const { saveNow: saveDraftNow, markDiscarded: markDraftDiscarded } = useDraft(
    modelName,
    documentId,
    docRef.current,
    isEditing,
    30000,
    saveDraftTag
  );

  const hasDraft = versions.some(
    v => v.is_draft || (typeof v.version === 'string' && v.version.endsWith('-draft'))
  );

  return {
    doc,
    setDoc: updateDoc,
    loading: query.isLoading,
    error: query.isError ? (query.error as Error)?.message || String(query.error) : null,
    saving: mutation.isPending,
    validating: validationMutation.isPending,
    validationResult,
    save,
    validate,
    reload,
    versions,
    showDrawer,
    setShowDrawer,
    saveVersionTag,
    saveDraftTag,
    deleteVersionTag,
    loadVersion,
    loadVersions,
    saveDraftNow,
    markDraftDiscarded,
    hasDraft
  };
}
