import { useState, useCallback, useRef, useMemo } from 'react';
import { resolveProfileSync, fetchImportedCatalogs } from '../lib/profile-resolver';
import { authFetch } from '../lib/api';

/**
 * Hook for resolving OSCAL profiles into virtual catalogs.
 * Caches fetched catalogs to avoid redundant API calls.
 *
 * Resolution pipeline:
 *   1. fetchImportedCatalogs() — async fetch of all referenced catalogs/profiles into a Map cache
 *   2. resolveProfileSync()   — synchronous resolution using the populated cache
 *
 * @returns {object}
 */
export function useProfileResolution() {
  const [resolvedCatalog, setResolvedCatalog] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState(null);
  const catalogCache = useRef(new Map());
  const [cacheVersion, setCacheVersion] = useState(0);

  const resolve = useCallback(async (profileDoc) => {
    setResolving(true);
    setError(null);
    try {
      // Step 1: Fetch all imported catalogs/profiles into the Map cache
      await fetchImportedCatalogs(profileDoc, catalogCache.current, authFetch);

      // Step 2: Synchronously resolve the profile using the populated cache
      const result = resolveProfileSync(profileDoc, catalogCache.current, false);
      setResolvedCatalog(result?.catalog || null);
      setCacheVersion(v => v + 1);
      return result?.catalog || null;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setResolving(false);
    }
  }, []);

  const clearCache = useCallback(() => {
    catalogCache.current = new Map();
    setResolvedCatalog(null);
    setCacheVersion(v => v + 1);
  }, []);

  const cacheMap = useMemo(() => {
    return new Map(catalogCache.current);
  }, [cacheVersion]);

  return { resolvedCatalog, resolving, error, resolve, clearCache, catalogCache: cacheMap };
}
