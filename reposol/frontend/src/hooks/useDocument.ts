import { useState, useEffect, useCallback, useRef } from 'react';
import { useSetAtom } from 'jotai';
import { useDocumentQuery, useDocumentMutation, useDocumentValidationMutation } from './useDocumentQuery';
import { currentStageAtom, currentDocIdAtom } from '@stores/documentAtoms';
import { saveStatusAtom } from '@stores/uiAtoms';
import { cleanEmptyArrays } from '@lib/oscal-utils';
import { OscalDocument, OscalStage } from '@lib/types/oscal';
import { ValidationResult } from '@lib/types/api';

/**
 * Modernized hook for loading, saving, and validating an OSCAL document using React Query & Jotai.
 * @param {OscalStage} stage - e.g. 'catalog', 'profile'
 * @param {string} documentId - UUID of the document
 */
export function useDocument(stage: OscalStage, documentId: string) {
  const setCurrentStage = useSetAtom(currentStageAtom);
  const setCurrentDocId = useSetAtom(currentDocIdAtom);
  const setSaveStatus = useSetAtom(saveStatusAtom);

  const query = useDocumentQuery(stage, documentId);
  const mutation = useDocumentMutation(stage);
  const validationMutation = useDocumentValidationMutation(stage);

  const [doc, setDocState] = useState<OscalDocument | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const docRef = useRef<OscalDocument | null>(doc);
  docRef.current = doc;

  // Sync stage and docId to Jotai
  useEffect(() => {
    if (stage) setCurrentStage(stage);
    if (documentId) setCurrentDocId(documentId);
  }, [stage, documentId, setCurrentStage, setCurrentDocId]);

  // Removed currentDocumentAtom
  useEffect(() => {
    if (query.data) {
      setDocState(query.data);
      docRef.current = query.data;
    }
  }, [query.data]);

  const updateDoc = useCallback((updater: OscalDocument | ((prev: OscalDocument | null) => OscalDocument | null)) => {
    setDocState((prev: OscalDocument | null) => {
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
    setSaveStatus('saving');
    try {
      const targetDoc = documentToSave || docRef.current || doc;
      if (!targetDoc) throw new Error('No document to save');
      const cleaned = cleanEmptyArrays(targetDoc);
      const result = await mutation.mutateAsync({ docId: documentId, data: cleaned });
      updateDoc(result);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      return result;
    } catch (err: unknown) {
      setSaveStatus('error');
      throw err;
    }
  }, [documentId, doc, mutation, updateDoc, setSaveStatus]);

  const validate = useCallback(async (documentToValidate?: OscalDocument): Promise<ValidationResult> => {
    setValidationResult(null);
    try {
      const targetDoc = documentToValidate || docRef.current || doc;
      if (!targetDoc) throw new Error('No document to validate');
      const result = await validationMutation.mutateAsync(targetDoc);
      const mappedResult: ValidationResult = { ...result, valid: result.status === 'valid' };
      setValidationResult(mappedResult);
      return mappedResult;
    } catch (err: Error | unknown) {
      const failedResult: ValidationResult = { valid: false, errors: err.errors || [err.message] };
      setValidationResult(failedResult);
      return failedResult;
    }
  }, [doc, validationMutation]);

  return {
    doc,
    setDoc: updateDoc,
    loading: query.isLoading,
    error: query.isError ? (query.error?.message || String(query.error)) : null,
    saving: mutation.isPending,
    validating: validationMutation.isPending,
    validationResult,
    save,
    validate,
    reload
  };
}
