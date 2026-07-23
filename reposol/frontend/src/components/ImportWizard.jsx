import { useState, useEffect } from 'react';
import { authFetch } from '../lib/api';

const SOURCE_LABELS = {
  nist: { label: 'NIST', color: '#1a7fd4' },
  fedramp: { label: 'FedRAMP', color: '#1a7fd4' },
  bsi: { label: 'BSI', color: '#1a7fd4' },
  sample: { label: 'Sample', color: '#1a7fd4' },
};

const MODEL_ICONS = {
  catalog: '📖',
  profile: '⚙️',
  ssp: '📝',
  'system-security-plan': '📝',
  'component-definition': '🧱',
  'assessment-plan': '📅',
  'assessment-results': '✅',
  poam: '⚠️',
};

const STAGE_TO_MODEL = {
  catalogs: 'catalog',
  profiles: 'profile',
  ssps: 'ssp',
  'component-definitions': 'component-definition',
  'assessment-plans': 'assessment-plan',
  'assessment-results': 'assessment-results',
  poams: 'poam'
};

export default function ImportWizard({ stage, onImported, onClose }) {
  const [tab, setTab] = useState('registry'); // 'registry' | 'url' | 'upload'
  const [registry, setRegistry] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState(() => {
    return STAGE_TO_MODEL[stage] || 'all';
  });
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(null); // id being imported
  const [results, setResults] = useState({}); // { id: {ok, message} }
  
  // URL Import states
  const [urlInput, setUrlInput] = useState('');
  const [urlImporting, setUrlImporting] = useState(false);
  const [urlResult, setUrlResult] = useState(null);

  // File Upload states
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  useEffect(() => {
    setLoading(true);
    authFetch('/api/import/registry')
      .then((r) => r.json())
      .then((data) => setRegistry(data))
      .catch(() => setRegistry([]))
      .finally(() => setLoading(false));
  }, []);

  const modelTypes = ['all', ...new Set(registry.map((e) => e.model))];

  const filtered = registry.filter((entry) => {
    const matchModel = filter === 'all' || entry.model === filter;
    const matchSearch =
      !search ||
      entry.title.toLowerCase().includes(search.toLowerCase()) ||
      entry.description.toLowerCase().includes(search.toLowerCase());
    return matchModel && matchSearch;
  });

  const handleImport = async (entry) => {
    setImporting(entry.id);
    setResults((prev) => ({ ...prev, [entry.id]: null }));
    try {
      const response = await authFetch(`/api/import/registry/${entry.id}`, {
        method: 'POST',
      });
      const data = await response.json();
      if (response.ok) {
        setResults((prev) => ({
          ...prev,
          [entry.id]: {
            ok: true,
            message: `${data.status === 'created' ? '✅ Imported' : '🔄 Updated'}: "${data.title}"`,
          },
        }));
        if (onImported) onImported(data.stage);
      } else {
        setResults((prev) => ({
          ...prev,
          [entry.id]: { ok: false, message: `❌ ${data.detail || 'Import failed'}` },
        }));
      }
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [entry.id]: { ok: false, message: `❌ Network error: ${err.message}` },
      }));
    } finally {
      setImporting(null);
    }
  };

  const handleUrlImport = async () => {
    if (!urlInput.trim()) return;
    setUrlImporting(true);
    setUrlResult(null);
    try {
      const response = await authFetch('/api/import/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim(), validate_schema: true }),
      });
      const data = await response.json();
      if (response.ok) {
        setUrlResult({
          ok: true,
          message: `${data.status === 'created' ? '✅ Imported' : '🔄 Updated'}: "${data.title}" (${data.stage})`,
        });
        if (onImported) onImported(data.stage);
      } else {
        setUrlResult({ ok: false, message: `❌ ${data.detail || 'Import failed'}` });
      }
    } catch (err) {
      setUrlResult({ ok: false, message: `❌ Network error: ${err.message}` });
    } finally {
      setUrlImporting(false);
    }
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setUploadResult(null);
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append("file", selectedFile);
    try {
      const response = await authFetch("/api/import/file", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        setUploadResult({
          ok: true,
          message: `${data.status === 'created' ? '✅ Imported' : '🔄 Updated'}: "${data.title}" (${data.stage})`,
        });
        if (onImported) onImported(data.stage);
      } else {
        setUploadResult({ ok: false, message: `❌ ${data.detail || 'Import failed'}` });
      }
    } catch (err) {
      setUploadResult({ ok: false, message: `❌ Network error: ${err.message}` });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="editor-overlay">
      <div className="editor-panel import-panel">
        <div className="editor-header">
          <h3>📥 Import OSCAL Document</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Tab bar */}
        <div className="import-tabs">
          <button
            className={`import-tab ${tab === 'registry' ? 'active' : ''}`}
            onClick={() => setTab('registry')}
          >
            📚 Registry
          </button>
          <button
            className={`import-tab ${tab === 'url' ? 'active' : ''}`}
            onClick={() => setTab('url')}
          >
            🔗 Import from URL
          </button>
          <button
            className={`import-tab ${tab === 'upload' ? 'active' : ''}`}
            onClick={() => setTab('upload')}
          >
            📤 Upload File
          </button>
        </div>

        {tab === 'registry' && (
          <div className="import-registry">
            {/* Filters */}
            <div className="import-filters">
              <input
                type="text"
                className="form-input"
                placeholder="Search by title or description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {(!stage || stage === 'dashboard') && (
                <div className="filter-chips">
                  {modelTypes.map((m) => (
                    <button
                      key={m}
                      className={`chip ${filter === m ? 'active' : ''}`}
                      onClick={() => setFilter(m)}
                    >
                      {m === 'all' ? 'All' : `${MODEL_ICONS[m] || ''} ${m}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="registry-list">
              {loading ? (
                <div className="loading-indicator">
                  <span className="spinner" /> Loading registry…
                </div>
              ) : filtered.length === 0 ? (
                <div className="empty-state">
                  <p>No documents match your filter.</p>
                </div>
              ) : (
                filtered.map((entry) => {
                  const result = results[entry.id];
                  const isImporting = importing === entry.id;
                  const src = SOURCE_LABELS[entry.source] || { label: entry.source, color: '#1a7fd4' };

                  return (
                    <div key={entry.id} className="registry-entry">
                      <div className="registry-entry-icon">
                        {MODEL_ICONS[entry.model] || '📄'}
                      </div>
                      <div className="registry-entry-body">
                        <div className="registry-entry-title">
                          {entry.title}
                          <span
                            className="source-badge"
                            style={{ backgroundColor: src.color + '22', color: src.color, borderColor: src.color + '55' }}
                          >
                            {src.label}
                          </span>
                          {entry.is_imported && (
                            <span
                              className="source-badge"
                              style={{ backgroundColor: '#2e7d3222', color: '#2e7d32', borderColor: '#2e7d3255', marginLeft: '6px' }}
                            >
                              ✓ Imported
                            </span>
                          )}
                        </div>
                        <div className="registry-entry-desc">{entry.description}</div>
                        {result && (
                          <div className={`registry-result ${result.ok ? 'ok' : 'err'}`}>
                            {result.message}
                          </div>
                        )}
                      </div>
                      <button
                        className={`btn-import ${result?.ok ? 'imported' : ''}`}
                        onClick={() => handleImport(entry)}
                        disabled={isImporting}
                        title={entry.url}
                      >
                        {isImporting ? <span className="spinner-sm" /> : result?.ok ? '✓' : entry.is_imported ? '🔄 Update' : 'Import'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {tab === 'url' && (
          <div className="import-url-tab editor-body">
            <div className="form-group">
              <label>Document URL</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://raw.githubusercontent.com/…/catalog.json"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUrlImport()}
              />
              <p className="field-hint">
                Paste any raw URL to a valid OSCAL JSON document. The stage will be auto-detected from the root key.
              </p>
            </div>

            <div className="form-group">
              <label>Example URLs</label>
              <div className="example-urls">
                {[
                  {
                    label: 'NIST SP 800-53 Rev5 Catalog',
                    url: 'https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json',
                  },
                  {
                    label: 'NIST CSF 2.0 Catalog',
                    url: 'https://raw.githubusercontent.com/usnistgov/oscal-content/refs/heads/main/nist.gov/CSF/v2.0/json/NIST_CSF_v2.0_catalog.json',
                  },
                ].map((ex) => (
                  <button
                    key={ex.url}
                    className="btn-secondary btn-sm example-url-btn"
                    onClick={() => setUrlInput(ex.url)}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            {urlResult && (
              <div className={`validation-result ${urlResult.ok ? 'valid' : 'invalid'}`}>
                {urlResult.message}
              </div>
            )}
          </div>
        )}

        {tab === 'upload' && (
          <div className="import-url-tab editor-body">
            <div className="form-group">
              <label>Select file (JSON, YAML, XML)</label>
              <input
                type="file"
                className="form-input"
                accept=".json,.yaml,.yml,.xml"
                onChange={handleFileChange}
              />
              <p className="field-hint">
                Select a local OSCAL file. The format is automatically recognized and validated.
              </p>
            </div>
            {uploadResult && (
              <div className={`validation-result ${uploadResult.ok ? 'valid' : 'invalid'}`}>
                {uploadResult.message}
              </div>
            )}
          </div>
        )}

        <div className="editor-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          {tab === 'url' && (
            <button
              className="btn-primary"
              onClick={handleUrlImport}
              disabled={urlImporting || !urlInput.trim()}
            >
              {urlImporting ? 'Importing…' : '📥 Import'}
            </button>
          )}
          {tab === 'upload' && (
            <button
              className="btn-primary"
              onClick={handleFileUpload}
              disabled={uploading || !selectedFile}
            >
              {uploading ? 'Uploading…' : '📤 Upload'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
