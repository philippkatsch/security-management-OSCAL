import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProfileResolution } from '../../hooks/useProfileResolution';
import * as apiModule from '../../lib/api';

describe('Challenger M4-1: Empirical Stress Tests for useProfileResolution (Debounce, Abort, Errors, Latency)', () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // ===========================================================================
  // 1. RAPID SEQUENTIAL MUTATIONS & DEBOUNCING
  // ===========================================================================
  describe('Rapid Sequential Mutations (10-20 document changes in < 100ms)', () => {
    it('collapses 20 rapid mutations in 100ms into exactly 1 network request and lands final state', async () => {
      const authFetchSpy = vi.spyOn(apiModule, 'authFetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          controls: [{ id: 'ctrl-20', title: 'Control from mutation 20' }],
          groups: [{ id: 'group-20', title: 'Custom Group 20', controls: [{ id: 'ctrl-20' }] }],
          all_controls: [{ id: 'ctrl-20' }],
          all_groups: [],
          conflicts: null,
          source_catalog_id: 'cat-root',
          source_catalog_title: 'Root NIST Catalog'
        })
      } as any);

      const { result } = renderHook(() => useProfileResolution(), {
        wrapper: createWrapper(),
      });

      // Fire 20 mutations within 100ms (one every 5ms)
      for (let i = 1; i <= 20; i++) {
        act(() => {
          result.current.previewResolve({
            profile: {
              uuid: `profile-v${i}`,
              metadata: { title: `Profile Mutation V${i}` },
              merge: {
                custom: {
                  groups: [{ id: `group-${i}`, title: `Custom Group ${i}` }]
                }
              }
            }
          });
        });
        act(() => {
          vi.advanceTimersByTime(5);
        });
      }

      // After 100ms total elapsed, debounce timer has reset on every call, so 0 fetches fired
      expect(authFetchSpy).not.toHaveBeenCalled();
      expect(result.current.resolving).toBe(false);

      // Advance by full 500ms to trigger the debounce of mutation 20
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Exactly 1 fetch should have occurred
      expect(authFetchSpy).toHaveBeenCalledTimes(1);
      expect(authFetchSpy).toHaveBeenCalledWith(
        '/api/resolve/profile/preview',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            profile: {
              uuid: 'profile-v20',
              metadata: { title: 'Profile Mutation V20' },
              merge: {
                custom: {
                  groups: [{ id: 'group-20', title: 'Custom Group 20' }]
                }
              }
            }
          })
        })
      );

      // State is populated with mutation 20's resolved result
      expect(result.current.resolvedCatalog).toBeDefined();
      expect(result.current.resolvedCatalog.uuid).toBe('profile-v20');
      expect(result.current.resolvedCatalog.groups[0].id).toBe('group-20');
      expect(result.current.resolving).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('handles staggered mutation bursts and resets debounce timer correctly on each mutation', async () => {
      const fetchCalls: any[] = [];
      vi.spyOn(apiModule, 'authFetch').mockImplementation(async (_url, options: any) => {
        const body = JSON.parse(options.body);
        fetchCalls.push(body.profile.uuid);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            controls: [{ id: `c-${body.profile.uuid}` }],
            groups: [],
            all_controls: [],
            all_groups: []
          })
        } as any;
      });

      const { result } = renderHook(() => useProfileResolution(), {
        wrapper: createWrapper(),
      });

      // Burst 1: 5 mutations spaced by 100ms (total 400ms - never reaches 500ms debounce)
      for (let i = 1; i <= 5; i++) {
        act(() => {
          result.current.previewResolve({ profile: { uuid: `burst1-m${i}` } });
        });
        act(() => {
          vi.advanceTimersByTime(100);
        });
      }

      expect(fetchCalls).toHaveLength(0);

      // Now wait 500ms after burst 1's last mutation -> Fires fetch for burst1-m5
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0]).toBe('burst1-m5');
      expect(result.current.resolvedCatalog?.uuid).toBe('burst1-m5');

      // Burst 2: 10 rapid mutations spaced by 10ms (100ms total)
      for (let i = 1; i <= 10; i++) {
        act(() => {
          result.current.previewResolve({ profile: { uuid: `burst2-m${i}` } });
        });
        act(() => {
          vi.advanceTimersByTime(10);
        });
      }

      expect(fetchCalls).toHaveLength(1); // No new fetch yet

      // Wait 500ms -> Fires fetch for burst2-m10
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(fetchCalls).toHaveLength(2);
      expect(fetchCalls[1]).toBe('burst2-m10');
      expect(result.current.resolvedCatalog?.uuid).toBe('burst2-m10');
    });
  });

  // ===========================================================================
  // 2. ABORT SIGNAL, IN-FLIGHT CANCELLATION & RACE CONDITION RESISTANCE
  // ===========================================================================
  describe('In-Flight Request Abort & Race Condition Immunity', () => {
    it('aborts active in-flight request when a new debounce fires, ignoring previous response', async () => {
      const abortLog: string[] = [];

      vi.spyOn(apiModule, 'authFetch').mockImplementation(async (_url, options: any) => {
        const signal = options?.signal as AbortSignal;
        const body = JSON.parse(options?.body);
        const reqId = body.profile.uuid;

        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: async () => ({
                controls: [{ id: `c-${reqId}` }],
                groups: [],
                all_controls: [],
                all_groups: []
              })
            } as any);
          }, 800);

          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              abortLog.push(`aborted:${reqId}`);
              const err = new Error('The user aborted a request.');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      });

      const { result } = renderHook(() => useProfileResolution(), {
        wrapper: createWrapper(),
      });

      // 1. Trigger Request 1
      act(() => {
        result.current.previewResolve({ profile: { uuid: 'req-1' } });
      });

      // Advance 500ms to launch Request 1 into the network
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(result.current.resolving).toBe(true);

      // 2. While Request 1 is still in-flight (at +200ms into its 800ms duration), trigger 10 rapid mutations for Request 2
      for (let i = 1; i <= 10; i++) {
        act(() => {
          result.current.previewResolve({ profile: { uuid: `req-2-step${i}` } });
        });
        act(() => {
          vi.advanceTimersByTime(5);
        });
      }

      // Advance 500ms to trigger Request 2 debounce. This should abort Request 1!
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(abortLog).toContain('aborted:req-1');
      expect(result.current.error).toBeNull(); // AbortError was swallowed silently

      // Advance remaining time for Request 2 to complete
      await act(async () => {
        vi.advanceTimersByTime(800);
      });

      expect(result.current.resolving).toBe(false);
      expect(result.current.resolvedCatalog?.uuid).toBe('req-2-step10');
    });

    it('prevents slow out-of-order responses from overwriting newer resolved state', async () => {
      let resolveSlowRequest: any = null;

      vi.spyOn(apiModule, 'authFetch').mockImplementation(async (_url, options: any) => {
        const body = JSON.parse(options.body);
        const reqId = body.profile.uuid;

        if (reqId === 'slow-req') {
          return new Promise((resolve) => {
            resolveSlowRequest = () => {
              resolve({
                ok: true,
                status: 200,
                json: async () => ({
                  controls: [{ id: 'stale-slow-control' }],
                  groups: [],
                  all_controls: [],
                  all_groups: []
                })
              } as any);
            };
          });
        }

        // Fast request resolves immediately
        return {
          ok: true,
          status: 200,
          json: async () => ({
            controls: [{ id: 'fresh-fast-control' }],
            groups: [],
            all_controls: [],
            all_groups: []
          })
        } as any;
      });

      const { result } = renderHook(() => useProfileResolution(), {
        wrapper: createWrapper(),
      });

      // Launch slow request
      act(() => {
        result.current.previewResolve({ profile: { uuid: 'slow-req' } });
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Now launch fast request
      act(() => {
        result.current.previewResolve({ profile: { uuid: 'fast-req' } });
      });
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Fast request has completed and populated state
      expect(result.current.resolvedCatalog?.uuid).toBe('fast-req');
      expect(result.current.resolvedCatalog?.controls[0].id).toBe('fresh-fast-control');

      // Now simulate slow request finally resolving later
      if (resolveSlowRequest) {
        await act(async () => {
          resolveSlowRequest();
        });
      }

      // Fast request state MUST NOT be corrupted or overwritten by the aborted/stale slow request
      expect(result.current.resolvedCatalog?.uuid).toBe('fast-req');
      expect(result.current.resolvedCatalog?.controls[0].id).toBe('fresh-fast-control');
    });
  });

  // ===========================================================================
  // 3. ERROR HANDLING & RESILIENCE (500, 502, 504, Network Crash)
  // ===========================================================================
  describe('HTTP 500, Bad Gateway, and Network Failure Resilience', () => {
    it('handles HTTP 500 with custom JSON error detail payload', async () => {
      vi.spyOn(apiModule, 'authFetch').mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ detail: 'Custom profile resolution engine failure: group loop detected' })
      } as any);

      const { result } = renderHook(() => useProfileResolution(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.previewResolve({ profile: { uuid: 'p-error-500' } });
      });

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.resolving).toBe(false);
      expect(result.current.error).toBe('Custom profile resolution engine failure: group loop detected');
      expect(result.current.resolvedCatalog).toBeNull();
    });

    it('handles HTTP 502/504 Bad Gateway with non-JSON (HTML) error response gracefully', async () => {
      vi.spyOn(apiModule, 'authFetch').mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => {
          throw new Error('Unexpected token < in JSON at position 0');
        }
      } as any);

      const { result } = renderHook(() => useProfileResolution(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.previewResolve({ profile: { uuid: 'p-error-502' } });
      });

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.resolving).toBe(false);
      expect(result.current.error).toContain('Preview failed: Bad Gateway');
      expect(result.current.resolvedCatalog).toBeNull();
    });

    it('handles catastrophic network disconnect (TypeError: Failed to fetch)', async () => {
      vi.spyOn(apiModule, 'authFetch').mockRejectedValue(new TypeError('Failed to fetch'));

      const { result } = renderHook(() => useProfileResolution(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.previewResolve({ profile: { uuid: 'p-network-down' } });
      });

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.resolving).toBe(false);
      expect(result.current.error).toBe('Failed to fetch');
      expect(result.current.resolvedCatalog).toBeNull();
    });

    it('recovers cleanly from an error state when subsequent valid document is submitted', async () => {
      const authFetchSpy = vi.spyOn(apiModule, 'authFetch')
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ detail: 'Temporary glitch' })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            controls: [{ id: 'recovered-ctrl' }],
            groups: [],
            all_controls: [{ id: 'recovered-ctrl' }],
            all_groups: []
          })
        } as any);

      const { result } = renderHook(() => useProfileResolution(), {
        wrapper: createWrapper(),
      });

      // 1. Trigger failing request
      act(() => {
        result.current.previewResolve({ profile: { uuid: 'p-fail' } });
      });
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(result.current.error).toBe('Temporary glitch');
      expect(result.current.resolving).toBe(false);

      // 2. Trigger recovering request
      act(() => {
        result.current.previewResolve({ profile: { uuid: 'p-success' } });
      });
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.error).toBeNull();
      expect(result.current.resolving).toBe(false);
      expect(result.current.resolvedCatalog?.uuid).toBe('p-success');
      expect(result.current.resolvedCatalog?.controls[0].id).toBe('recovered-ctrl');
    });
  });

  // ===========================================================================
  // 4. CACHE INVALIDATION & clearCache()
  // ===========================================================================
  describe('Cache Invalidation & clearCache()', () => {
    it('cancels pending debounce and active in-flight request when clearCache is called', async () => {
      let aborted = false;
      vi.spyOn(apiModule, 'authFetch').mockImplementation(async (_url, options: any) => {
        options?.signal?.addEventListener('abort', () => {
          aborted = true;
        });
        return new Promise(() => {}); // never finishes
      });

      const { result } = renderHook(() => useProfileResolution(), {
        wrapper: createWrapper(),
      });

      // Start debounce
      act(() => {
        result.current.previewResolve({ profile: { uuid: 'p-in-flight' } });
      });

      // Trigger fetch
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Clear cache while request is in-flight
      act(() => {
        result.current.clearCache();
      });

      expect(aborted).toBe(true);
      expect(result.current.resolvedCatalog).toBeNull();
      expect(result.current.conflicts).toBeNull();
    });

    it('cancels pending timer if clearCache is called before 500ms elapse', async () => {
      const authFetchSpy = vi.spyOn(apiModule, 'authFetch');

      const { result } = renderHook(() => useProfileResolution(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.previewResolve({ profile: { uuid: 'p-before-timer' } });
      });

      act(() => {
        vi.advanceTimersByTime(250);
      });

      act(() => {
        result.current.clearCache();
      });

      // Advance remaining time
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(authFetchSpy).not.toHaveBeenCalled();
      expect(result.current.resolvedCatalog).toBeNull();
    });
  });

  // ===========================================================================
  // 5. SAVED-STATE RESOLVE & DUAL-MODE COMPATIBILITY
  // ===========================================================================
  describe('Saved State resolve() vs Live previewResolve()', () => {
    it('handles resolve() from saved state with missing UUID by setting error', async () => {
      const { result } = renderHook(() => useProfileResolution(), {
        wrapper: createWrapper(),
      });

      let res: any;
      await act(async () => {
        res = await result.current.resolve({});
      });

      expect(res).toBeNull();
      expect(result.current.error).toContain('Invalid profile document: missing UUID');
      expect(result.current.resolving).toBe(false);
    });

    it('handles resolve() network failure gracefully', async () => {
      vi.spyOn(apiModule, 'authFetch').mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ detail: 'Profile document not found on server' })
      } as any);

      const { result } = renderHook(() => useProfileResolution(), {
        wrapper: createWrapper(),
      });

      let res: any;
      await act(async () => {
        res = await result.current.resolve({ profile: { uuid: 'missing-uuid' } });
      });

      expect(res).toBeNull();
      expect(result.current.error).toContain('Profile document not found on server');
      expect(result.current.resolving).toBe(false);
    });

    it('successfully executes resolve() and sets resultCatalog with conflict reports', async () => {
      vi.spyOn(apiModule, 'authFetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          controls: [{ id: 'ac-1' }],
          groups: [{ id: 'g1', title: 'Group 1' }],
          all_controls: [{ id: 'ac-1' }, { id: 'ac-2' }],
          all_groups: [],
          excluded_control_ids: ['ac-2'],
          source_catalog_id: 'cat-123',
          source_catalog_title: 'Catalog Title',
          conflicts: {
            has_conflicts: true,
            orphaned_alters: [{ 'control-id': 'ac-99', adds_count: 1, removes_count: 0 }],
            orphaned_params: [],
            orphaned_custom_refs: []
          }
        })
      } as any);

      const { result } = renderHook(() => useProfileResolution(), {
        wrapper: createWrapper(),
      });

      let res: any;
      await act(async () => {
        res = await result.current.resolve({
          profile: {
            uuid: 'valid-uuid',
            metadata: { title: 'Test Profile' }
          }
        });
      });

      expect(res).toBeDefined();
      expect(result.current.resolvedCatalog?.uuid).toBe('valid-uuid');
      expect(result.current.resolvedCatalog?.excluded_control_ids).toEqual(['ac-2']);
      expect(result.current.conflicts?.has_conflicts).toBe(true);
      expect(result.current.conflicts?.orphaned_alters).toHaveLength(1);
    });
  });

  // ===========================================================================
  // 6. MALFORMED INPUTS & BOUNDARY RESILIENCE
  // ===========================================================================
  describe('Malformed & Boundary Inputs', () => {
    it('ignores null, undefined, primitive, and empty payloads without crashing', async () => {
      const authFetchSpy = vi.spyOn(apiModule, 'authFetch');

      const { result } = renderHook(() => useProfileResolution(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.previewResolve(null);
        result.current.previewResolve(undefined);
        result.current.previewResolve(12345);
        result.current.previewResolve('string-doc');
        result.current.previewResolve(false);
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(authFetchSpy).not.toHaveBeenCalled();
      expect(result.current.resolvedCatalog).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('handles unmount cleanly during a rapid 50-mutation stream', () => {
      const { result, unmount } = renderHook(() => useProfileResolution(), {
        wrapper: createWrapper(),
      });

      for (let i = 0; i < 50; i++) {
        act(() => {
          result.current.previewResolve({ profile: { uuid: `unmount-stream-${i}` } });
        });
      }

      // Unmount immediately while timer is pending
      unmount();

      // Advancing timer after unmount does not throw or log state update warning
      act(() => {
        vi.advanceTimersByTime(2000);
      });
    });
  });
});
