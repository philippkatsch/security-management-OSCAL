import { useState, useEffect, useCallback } from 'react';
import { fetchDocument, saveDocument, validateDocument } from '../lib/api';

/**
 * Hook for loading, saving, and validating an OSCAL document.
 * @param {string} stage - e.g. 'catalogs', 'profiles'
 * @param {string} documentId - UUID of the document
 * @returns {object} { doc, setDoc, loading, error, saving, save, validate, validationResult, reload }
 */
export function useDocument(stage, documentId) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  const load = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDocument(stage, documentId);
      setDoc(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [stage, documentId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (document) => {
    setSaving(true);
    setError(null);
    try {
      const result = await saveDocument(stage, document);
      setDoc(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [stage]);

  const validate = useCallback(async (document) => {
    setValidating(true);
    setValidationResult(null);
    try {
      const result = await validateDocument(stage, document || doc);
      const mappedResult = { ...result, valid: result.status === 'valid' };
      setValidationResult(mappedResult);
      return mappedResult;
    } catch (err) {
      setValidationResult({ valid: false, error: err.message, errors: err.errors || [] });
      return { valid: false, error: err.message, errors: err.errors || [] };
    } finally {
      setValidating(false);
    }
  }, [stage, doc]);

  return { doc, setDoc, loading, error, saving, validating, validationResult, save, validate, reload: load };
}
