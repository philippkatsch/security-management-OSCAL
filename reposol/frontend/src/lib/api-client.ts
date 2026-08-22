import { getDefaultStore } from 'jotai';
import { workspaceIdAtom, isMasterModeAtom } from '@stores/workspaceAtoms';
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
    const store = getDefaultStore();
    const isMasterMode = store.get(isMasterModeAtom);
    // In master mode, use 'default' (the master/template workspace on the backend).
    // Otherwise, use the user's session workspace ID from the atom.
    const workspaceId = isMasterMode ? 'default' : store.get(workspaceIdAtom);
    if (workspaceId) {
      headers.set('X-Workspace-ID', workspaceId);
    }
  } catch (e) {
    // Store might not be initialized yet — fall back to localStorage
    const wsId = localStorage.getItem('reposol_workspace_id');
    if (wsId) {
      headers.set('X-Workspace-ID', wsId);
    }
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
