import { useState, useCallback, useMemo } from 'react';
import { authFetch } from '@lib/api';
import { useQueryClient, useQuery } from '@tanstack/react-query';

/**
 * Hook for resolving OSCAL profiles into virtual catalogs.
 * Uses the backend resolution engine.
 *
 * @returns {object}
 */
export function useProfileResolution() {
  const [resolvedCatalog, setResolvedCatalog] = useState<any>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

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
        groups: data.groups
      };

      setResolvedCatalog(resultCatalog);
      return resultCatalog;
    } catch (err: any) {
      const msg = err?.status ? `HTTP ${err.status} - ${err.message || ''}` : (err.message || String(err));
      setError(msg);
      return null;
    } finally {
      setResolving(false);
    }
  }, [queryClient]);

  const clearCache = useCallback(() => {
    setResolvedCatalog(null);
  }, []);

  const cacheMap = useMemo(() => new Map(), []);

  return { resolvedCatalog, resolving, error, resolve, clearCache, catalogCache: cacheMap };
}

/**
 * React Query hook for fetching baseline diff between a profile and a catalog.
 */
export function useProfileDiffQuery(profileId: string | null | undefined, catalogId: string | null | undefined) {
  return useQuery({
    queryKey: ['profile-baseline-diff', profileId, catalogId],
    queryFn: async () => {
      if (!profileId || !catalogId) return null;
      const res = await authFetch(`/api/resolve/profile/${profileId}/diff/${catalogId}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: `Failed to fetch diff: ${res.statusText}` }));
        throw new Error(errData.detail || `Failed to fetch diff: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: Boolean(profileId && catalogId),
    staleTime: 60 * 1000,
  });
}

