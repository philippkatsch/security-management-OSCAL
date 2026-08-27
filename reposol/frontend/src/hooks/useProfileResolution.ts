import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { authFetch } from '@lib/api';
import { useQueryClient, useQuery } from '@tanstack/react-query';

export interface ModifyConflicts {
  has_conflicts: boolean;
  orphaned_alters: Array<{ 'control-id': string; adds_count: number; removes_count: number }>;
  orphaned_params: Array<{ 'param-id': string }>;
  orphaned_custom_refs: Array<{ 'group-id': string; 'control-id': string }>;
}

/**
 * Hook for resolving OSCAL profiles into virtual catalogs.
 * Supports both saved-state resolution (resolve) and live preview (previewResolve).
 *
 * @returns {object}
 */
export function useProfileResolution() {
  const [resolvedCatalog, setResolvedCatalog] = useState<any>(null);
  const [conflicts, setConflicts] = useState<ModifyConflicts | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Resolve from saved state (initial load)
  const resolve = useCallback(async (profileDoc: any) => {
    setResolving(true);
    setError(null);
    try {
      const profileId = profileDoc?.profile?.uuid || profileDoc?.uuid;
      if (!profileId) {
        throw new Error('Invalid profile document: missing UUID');
      }

      // Call the backend resolution endpoint
      const data = await queryClient.fetchQuery({
        queryKey: ['resolve-profile', profileId],
        queryFn: async () => {
          const res = await authFetch(`/api/resolve/profile/${profileId}`);
          if (!res.ok) {
            const errData = await res.json().catch(() => ({ detail: `Failed to resolve profile: ${res.statusText}` }));
            throw new Error(errData.detail || `Failed to resolve profile: ${res.statusText}`);
          }
          return res.json();
        },
        staleTime: 60 * 1000,
      });

      const resultCatalog = {
        uuid: profileId,
        metadata: profileDoc?.profile?.metadata || profileDoc?.metadata || {},
        controls: data.controls,
        groups: data.groups,
        all_controls: data.all_controls,
        all_groups: data.all_groups,
        excluded_control_ids: data.excluded_control_ids || [],
        source_catalog_id: data.source_catalog_id,
        source_catalog_title: data.source_catalog_title
      };

      setResolvedCatalog(resultCatalog);
      setConflicts(data.conflicts || null);
      return resultCatalog;
    } catch (err: any) {
      const msg = err?.status ? `HTTP ${err.status} - ${err.message || ''}` : (err.message || String(err));
      setError(msg);
      return null;
    } finally {
      setResolving(false);
    }
  }, [queryClient]);

  // Live preview resolution from unsaved state (debounced 500ms)
  const previewResolve = useCallback((profileDoc: any) => {
    const profile = profileDoc?.profile || profileDoc;
    if (!profile || typeof profile !== 'object') return;

    // Cancel any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      // Abort any in-flight preview request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setResolving(true);
      setError(null);
      try {
        const res = await authFetch('/api/resolve/profile/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile }),
          signal: controller.signal
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ detail: `Preview failed: ${res.statusText}` }));
          throw new Error(errData.detail || `Preview failed: ${res.statusText}`);
        }

        const data = await res.json();

        // Only update if this request wasn't aborted
        if (!controller.signal.aborted) {
          setResolvedCatalog({
            uuid: profile.uuid,
            metadata: profile.metadata || {},
            controls: data.controls,
            groups: data.groups,
            all_controls: data.all_controls,
            all_groups: data.all_groups,
            excluded_control_ids: data.excluded_control_ids || [],
            source_catalog_id: data.source_catalog_id,
            source_catalog_title: data.source_catalog_title
          });
          setConflicts(data.conflicts || null);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return; // Ignore aborted requests
        const msg = err?.status ? `HTTP ${err.status} - ${err.message || ''}` : (err.message || String(err));
        setError(msg);
      } finally {
        if (!controller.signal.aborted) {
          setResolving(false);
        }
      }
    }, 500);
  }, []);

  const clearCache = useCallback(() => {
    setResolvedCatalog(null);
    setConflicts(null);
    // Cancel any pending preview
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return { resolvedCatalog, resolving, error, conflicts, resolve, previewResolve, clearCache };
}
