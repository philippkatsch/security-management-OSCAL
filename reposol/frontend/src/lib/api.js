/**
 * api.js
 * Centralized API client for the Reposol OSCAL application.
 * Extracted from CatalogViewer.jsx, DocumentEditor.jsx, App.jsx,
 * ImportWizard.jsx, and MappingViewer.jsx.
 *
 * All functions return parsed JSON (or throw on error) unless noted otherwise.
 */

const BASE = '/api';

/**
 * Retrieves or generates an anonymous session workspace ID stored in localStorage.
 * Ensures multi-user workspace isolation when running in a public demo environment.
 * @returns {string} The workspace UUID.
 */
export function getWorkspaceId() {
  if (typeof window !== 'undefined' && window.location && window.location.search) {
    const params = new URLSearchParams(window.location.search);
    const urlWsId = params.get('w') || params.get('workspace');
    if (urlWsId) {
      const cleanWsId = urlWsId.replace(/[^a-zA-Z0-9_-]/g, '');
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

/**
 * Wrapper around global fetch that automatically attaches the X-Workspace-ID header.
 *
 * @param {string} url     - The URL to fetch.
 * @param {Object} options - Fetch options.
 * @returns {Promise<Response>}
 */
export function authFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('X-Workspace-ID', getWorkspaceId());
  return fetch(url, { ...options, headers });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parse the JSON body from a response and throw an error if the response
 * status is not OK.
 *
 * @param {Response} res   - Fetch Response object.
 * @param {string}   label - Human-readable label for error messages.
 * @returns {Promise<any>}
 */
async function handleResponse(res, label = 'Request') {
  if (!res.ok) {
    let detail = res.statusText;
    let errors = [];
    try {
      const body = await res.json();
      detail = body.detail || detail;
      errors = body.errors || [];
    } catch { /* ignore parse errors */ }
    const err = new Error(`${label} failed: ${detail}`);
    err.errors = errors;
    throw err;
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Document CRUD
// ---------------------------------------------------------------------------

/**
 * Fetch a single document by stage and UUID.
 *
 * @param {string} stage - e.g. 'catalogs', 'profiles', 'ssps'
 * @param {string} id    - Document UUID.
 * @returns {Promise<Object>} The OSCAL document.
 */
export async function fetchDocument(stage, id) {
  const res = await authFetch(`${BASE}/documents/${stage}/${id}`);
  return handleResponse(res, `Fetch ${stage}/${id}`);
}

/**
 * Fetch all documents for a given stage.
 *
 * @param {string} stage - e.g. 'catalogs', 'profiles'
 * @returns {Promise<Array>} Array of OSCAL documents.
 */
export async function fetchDocuments(stage) {
  const res = await authFetch(`${BASE}/documents/${stage}`);
  return handleResponse(res, `Fetch ${stage} list`);
}

/**
 * Save (create or update) a document.
 *
 * @param {string} stage    - e.g. 'catalogs', 'profiles'
 * @param {Object} document - Full OSCAL document object.
 * @returns {Promise<Object>} Server response.
 */
export async function saveDocument(stage, document) {
  const res = await authFetch(`${BASE}/documents/${stage}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(document),
  });
  return handleResponse(res, `Save ${stage} document`);
}

/**
 * Delete a document.
 *
 * @param {string}  stage - e.g. 'catalogs'
 * @param {string}  id    - Document UUID.
 * @param {boolean} [force=false] - If true, bypasses referential integrity checks.
 * @returns {Promise<Object>} Server response.
 */
export async function deleteDocument(stage, id, force = false) {
  const url = force
    ? `${BASE}/documents/${stage}/${id}?force=true`
    : `${BASE}/documents/${stage}/${id}`;
  const res = await authFetch(url, { method: 'DELETE' });
  return handleResponse(res, `Delete ${stage}/${id}`);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate an OSCAL document against the schema.
 *
 * @param {string} stage    - e.g. 'catalogs'
 * @param {Object} document - The document to validate.
 * @returns {Promise<Object>} Validation result from the server.
 */
export async function validateDocument(stage, document) {
  const res = await authFetch(`${BASE}/validate/${stage}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(document),
  });
  return handleResponse(res, `Validate ${stage} document`);
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Open an export URL in a new browser tab.
 * This does NOT return data — it triggers a download via `window.open`.
 *
 * @param {string} stage  - e.g. 'catalogs', 'control-mappings'
 * @param {string} id     - Document UUID.
 * @param {string} format - Export format, e.g. 'json', 'yaml', 'xml'.
 */
export function exportDocument(stage, id, format) {
  const wsId = getWorkspaceId();
  window.open(`${BASE}/export/${stage}/${id}?format=${format}&workspace_id=${encodeURIComponent(wsId)}`, '_blank');
}

// ---------------------------------------------------------------------------
// Versioning
// ---------------------------------------------------------------------------

/**
 * Fetch the list of versions for a document.
 *
 * @param {string} stage - e.g. 'catalogs'
 * @param {string} id    - Document UUID.
 * @returns {Promise<Array>} List of version entries.
 */
export async function fetchVersions(stage, id) {
  const res = await authFetch(`${BASE}/documents/${stage}/${id}/versions`);
  return handleResponse(res, `Fetch versions for ${stage}/${id}`);
}

/**
 * Save a new version of a document.
 *
 * @param {string} stage    - e.g. 'catalogs'
 * @param {string} id       - Document UUID.
 * @param {string} _version - (unused, kept for signature compat) version label.
 * @param {Object} document - Full document snapshot.
 * @returns {Promise<Object>} Server response.
 */
export async function saveVersion(stage, id, version, document, remarks = '', isDraft = false) {
  let url = `${BASE}/documents/${stage}/${id}/versions?is_draft=${isDraft}`;
  if (remarks) {
    url += `&remarks=${encodeURIComponent(remarks)}`;
  }
  const res = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(document),
  });
  return handleResponse(res, `Save version for ${stage}/${id}`);
}

/**
 * Delete a specific version of a document.
 *
 * @param {string} stage   - e.g. 'catalogs'
 * @param {string} id      - Document UUID.
 * @param {string} version - Version string to delete.
 * @returns {Promise<Object>} Server response.
 */
export async function deleteVersion(stage, id, version) {
  const res = await authFetch(`${BASE}/documents/${stage}/${id}/versions/${version}`, {
    method: 'DELETE',
  });
  return handleResponse(res, `Delete version ${version} of ${stage}/${id}`);
}

/**
 * Load a specific version of a document.
 *
 * @param {string} stage   - e.g. 'catalogs'
 * @param {string} id      - Document UUID.
 * @param {string} version - Version string.
 * @returns {Promise<Object>} The OSCAL document at that version.
 */
export async function getVersion(stage, id, version) {
  const res = await authFetch(`${BASE}/documents/${stage}/${id}/versions/${version}`);
  return handleResponse(res, `Get version ${version} of ${stage}/${id}`);
}

// ---------------------------------------------------------------------------
// Dashboard / recent documents
// ---------------------------------------------------------------------------

/**
 * Fetch recently modified documents for the dashboard view.
 *
 * @returns {Promise<Array>} Array of recent document summaries.
 */
export async function fetchRecentDocuments() {
  const res = await authFetch(`${BASE}/recent-documents`);
  return handleResponse(res, 'Fetch recent documents');
}

// ---------------------------------------------------------------------------
// Registry & import
// ---------------------------------------------------------------------------

/**
 * Fetch the list of available registry templates.
 *
 * @returns {Promise<Array>} Array of registry template entries.
 */
export async function fetchRegistry() {
  const res = await authFetch(`${BASE}/import/registry`);
  return handleResponse(res, 'Fetch registry');
}

/**
 * Import a document from the registry by its template/source ID.
 *
 * @param {string} sourceId - The registry entry ID to import.
 * @returns {Promise<Object>} Import result (includes uuid, title, stage, status).
 */
export async function importFromRegistry(sourceId) {
  const res = await authFetch(`${BASE}/import/registry/${sourceId}`, {
    method: 'POST',
  });
  return handleResponse(res, `Import registry entry ${sourceId}`);
}

/**
 * Import a document from a remote URL.
 *
 * @param {string}  url            - The URL to fetch the OSCAL document from.
 * @param {boolean} [validateSchema=true] - Whether to validate against the schema.
 * @returns {Promise<Object>} Import result.
 */
export async function importFromUrl(url, validateSchema = true) {
  const res = await authFetch(`${BASE}/import/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, validate_schema: validateSchema }),
  });
  return handleResponse(res, 'Import from URL');
}

// ---------------------------------------------------------------------------
// File upload
// ---------------------------------------------------------------------------

/**
 * Upload a file (e.g. diagram image) to the server.
 *
 * @param {FormData} formData - FormData with the file attached under key 'file'.
 * @returns {Promise<Object>} Server response (includes `url` of uploaded file).
 */
export async function uploadFile(formData) {
  const res = await authFetch(`${BASE}/upload`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse(res, 'Upload file');
}
