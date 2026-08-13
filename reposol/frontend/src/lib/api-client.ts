import { getDefaultStore } from 'jotai';
import { workspaceIdAtom } from '@stores/workspaceAtoms';
import toast from 'react-hot-toast';

const BASE_URL = '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiClient(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    let wsId: string | null = null;
    if (typeof window !== 'undefined' && window.location) {
      if (window.location.search) {
        const params = new URLSearchParams(window.location.search);
        wsId = params.get('w') || params.get('workspace');
        if (wsId) {
          localStorage.setItem('reposol_workspace_id', wsId);
        }
      }
      if (!wsId) {
        wsId = localStorage.getItem('reposol_workspace_id');
      }
    }
    const store = getDefaultStore();
    const workspaceId = wsId || store.get(workspaceIdAtom);
    if (workspaceId) {
      headers.set('X-Workspace-ID', workspaceId);
      headers.set('X-Workspace-Id', workspaceId);
    }
  } catch (e) {
    // Store might not be initialized yet
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    if (response.status >= 500) {
      toast.error(`Server error: ${error.detail || response.statusText}`);
    }
    throw new ApiError(response.status, error.detail || response.statusText);
  }
  
  return response;
}
