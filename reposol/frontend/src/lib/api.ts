import type { ImportResult, ValidationResult, DocumentSummary, VersionInfo } from './types/api';
import { OscalStage, OscalDocument } from './types/oscal';
import { apiClient } from './api-client';

export function getWorkspaceId(): string {
  if (typeof window !== 'undefined' && window.location && window.location.search) {
    const params = new URLSearchParams(window.location.search);
    const urlWsId = params.get('w') || params.get('workspace');
    if (urlWsId) {
      const cleanWsId = urlWsId.replace(/[^a-zA-Z0-9_\-]/g, '');
      if (cleanWsId) {
        localStorage.setItem('reposol_workspace_id', cleanWsId);
        return cleanWsId;
      }
    }
  }

  let wsId = localStorage.getItem('reposol_workspace_id');
  if (!wsId) {
    wsId = `session-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('reposol_workspace_id', wsId);
  }
  return wsId;
}

export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Strip /api prefix if present since apiClient adds it
  const path = url.startsWith('/api') ? url.slice(4) : url;
  return apiClient(path, options);
}

export async function fetchDocument(stage: OscalStage, id: string): Promise<OscalDocument> {
  const res = await apiClient(`/documents/${stage}/${id}`);
  return res.json();
}

export async function fetchDocuments(stage: OscalStage): Promise<DocumentSummary[]> {
  const res = await apiClient(`/documents/${stage}`);
  return res.json();
}

export async function saveDocument(stage: OscalStage, document: OscalDocument): Promise<OscalDocument> {
  const res = await apiClient(`/documents/${stage}`, {
    method: 'POST',
    body: JSON.stringify(document),
  });
  return res.json();
}

export async function deleteDocument(stage: OscalStage, id: string, force = false): Promise<void> {
  const url = force
    ? `/documents/${stage}/${id}?force=true`
    : `/documents/${stage}/${id}`;
  await apiClient(url, { method: 'DELETE' });
}

export async function validateDocument(stage: OscalStage, document: OscalDocument): Promise<ValidationResult> {
  const res = await apiClient(`/validate/${stage}`, {
    method: 'POST',
    body: JSON.stringify(document),
  });
  return res.json();
}

export function exportDocument(stage: OscalStage, id: string, format: string): void {
  const wsId = getWorkspaceId();
  window.open(`/api/export/${stage}/${id}?format=${format}&workspace_id=${encodeURIComponent(wsId)}`, '_blank');
}

export async function fetchVersions(stage: OscalStage, id: string): Promise<VersionInfo[]> {
  const res = await apiClient(`/documents/${stage}/${id}/versions`);
  return res.json();
}

export async function saveVersion(stage: OscalStage, id: string, version: string, document: OscalDocument, remarks = '', isDraft = false): Promise<void> {
  let url = `/documents/${stage}/${id}/versions?is_draft=${isDraft}`;
  if (remarks) {
    url += `&remarks=${encodeURIComponent(remarks)}`;
  }
  await apiClient(url, {
    method: 'POST',
    body: JSON.stringify(document),
  });
}

export async function deleteVersion(stage: OscalStage, id: string, version: string): Promise<void> {
  await apiClient(`/documents/${stage}/${id}/versions/${version}`, {
    method: 'DELETE',
  });
}

export async function getVersion(stage: OscalStage, id: string, version: string): Promise<OscalDocument> {
  const res = await apiClient(`/documents/${stage}/${id}/versions/${version}`);
  return res.json();
}

export async function fetchRecentDocuments(): Promise<DocumentSummary[]> {
  const res = await apiClient(`/recent-documents`);
  return res.json();
}

export async function fetchRegistry(): Promise<Record<string, unknown>[]> {
  const res = await apiClient(`/import/registry`);
  return res.json();
}

export async function importFromRegistry(sourceId: string): Promise<ImportResult> {
  const res = await apiClient(`/import/registry/${sourceId}`, {
    method: 'POST',
  });
  return res.json();
}

export async function importFromUrl(url: string, validateSchema = true): Promise<ImportResult> {
  const res = await apiClient(`/import/url`, {
    method: 'POST',
    body: JSON.stringify({ url, validate_schema: validateSchema }),
  });
  return res.json();
}

export async function uploadFile(formData: FormData): Promise<ImportResult> {
  const res = await apiClient(`/upload`, {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

