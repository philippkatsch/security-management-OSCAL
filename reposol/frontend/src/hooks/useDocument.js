import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchDocument, saveDocument, validateDocument } from '../lib/api';
import { cleanEmptyArrays } from '../lib/oscal-utils';

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

  const docRef = useRef(doc);
  docRef.current = doc;
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  const updateDoc = useCallback((updater) => {
    setDoc(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      docRef.current = next;
      return next;
    });
  }, []);

  const load = useCallback(async (options = {}) => {
    if (!documentId) return null;
    const isSilent = typeof options === 'boolean' ? options : !!options?.silent;
    if (!isSilent) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await fetchDocument(stage, documentId);
      updateDoc(data);
      return data;
    } catch (err) {
      if (!isSilent) {
        updateDoc(null);
      }
      setError(err.message);
      return null;
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, [stage, documentId, updateDoc]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (documentToSave) => {
    setSaving(true);
    setError(null);
    try {
      const targetDoc = documentToSave || docRef.current || doc;
      const cleaned = cleanEmptyArrays(targetDoc);
      const result = await saveDocument(stage, cleaned);
      updateDoc(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [stage, doc, updateDoc]);

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

  return { doc, setDoc: updateDoc, loading, error, saving, validating, validationResult, save, validate, reload: load };
}
