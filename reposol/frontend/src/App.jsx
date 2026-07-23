import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import DocumentEditor from './components/DocumentEditor';
import ImportWizard from './components/ImportWizard';
import { CreateDocumentDialog } from './components/document/CreateDocumentDialog';
import { CatalogPage } from './components/catalog/CatalogPage';
import { ProfilePage } from './components/profile/ProfilePage';
import MappingViewer from './components/MappingViewer';
import { authFetch, getWorkspaceId } from './lib/api';

const parseLocation = () => {
  const path = window.location.pathname;
  const search = window.location.search;
  const queryParams = new URLSearchParams(search);
  const initialEditMode = queryParams.get('edit') === 'true';

  const catalogMatch = path.match(/^\/(catalog|caterlog)\/([a-fA-F0-9-]+)/);
  if (catalogMatch) {
    return { type: 'catalog-view', catalogId: catalogMatch[2], initialEditMode };
  }
  const profileMatch = path.match(/^\/profile\/([a-fA-F0-9-]+)/);
  if (profileMatch) {
    return { type: 'profile-view', profileId: profileMatch[1], initialEditMode };
  }
  const mappingMatch = path.match(/^\/(control-mapping|control-mappings|mapping)\/([a-fA-F0-9-]+)/);
  if (mappingMatch) {
    return { type: 'mapping-view', mappingId: mappingMatch[2], initialEditMode };
  }
  const tabMatch = path.match(/^\/([^/]+)/);
  const tab = tabMatch ? tabMatch[1] : 'dashboard';
  // Standardize stage tab names if necessary
  return { type: 'tab', tab: (tab === 'catalog' || tab === 'caterlog') ? 'catalogs' : tab === 'profile' ? 'profiles' : (tab === 'control-mapping' || tab === 'control-mappings' || tab === 'mapping') ? 'control-mappings' : tab };
};

export default function App() {
  const [route, setRoute] = useState(parseLocation());
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [counts, setCounts] = useState({
    catalogs: 0,
    profiles: 0,
    ssps: 0,
    'component-definitions': 0,
    'assessment-plans': 0,
    'assessment-results': 0,
    poams: 0,
    'control-mappings': 0,
  });
  const [showEditor, setShowEditor] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [showImport, setShowImport] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [recentDocs, setRecentDocs] = useState([]);

  // Custom SPA router navigation helper
  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    setRoute(parseLocation());
  };

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseLocation());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const activeTab = route.type === 'tab' ? route.tab : route.type === 'profile-view' ? 'profiles' : route.type === 'mapping-view' ? 'control-mappings' : 'catalogs';

  const fetchDocuments = async (stage) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/api/documents/${stage}`);
      if (!response.ok) throw new Error(`Error fetching ${stage}: ${response.statusText}`);
      const data = await response.json();
      setDocuments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllCounts = async () => {
    const stages = [
      'catalogs', 'profiles', 'ssps',
      'component-definitions', 'assessment-plans', 'assessment-results', 'poams',
      'control-mappings',
    ];
    const newCounts = {};
    await Promise.all(
      stages.map(async (stage) => {
        try {
          const response = await authFetch(`/api/documents/${stage}`);
          newCounts[stage] = response.ok ? (await response.json()).length : 0;
        } catch {
          newCounts[stage] = 0;
        }
      })
    );
    setCounts(newCounts);
  };

  useEffect(() => {
    fetchAllCounts();
    // Fetch recent documents for dashboard
    authFetch('/api/recent-documents')
      .then(res => res.json())
      .then(data => setRecentDocs(data))
      .catch(() => setRecentDocs([]));
  }, [refreshTrigger]);

  useEffect(() => {
    if (activeTab !== 'dashboard') {
      fetchDocuments(activeTab);
    }
  }, [activeTab, route.type, refreshTrigger]);

  const handleDelete = async (stage, id) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      const response = await authFetch(`/api/documents/${stage}/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setRefreshTrigger(prev => prev + 1);
      } else if (response.status === 409) {
        const errorData = await response.json();
        const detail = errorData.detail || '';
        
        const forceDelete = window.confirm(
          `${detail}\n\nDo you still want to force delete this document? (Warning: This breaks the reference integrity in the referencing documents!)`
        );
        
        if (forceDelete) {
          const forceResponse = await authFetch(`/api/documents/${stage}/${id}?force=true`, { method: 'DELETE' });
          if (forceResponse.ok) {
            setRefreshTrigger(prev => prev + 1);
          } else {
            const forceError = await forceResponse.json();
            alert(`Delete failed: ${forceError.detail || forceResponse.statusText}`);
          }
        }
      } else {
        const errJson = await response.json().catch(() => ({}));
        alert(`Delete failed: ${errJson.detail || 'Generic Error'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleNewDoc = () => {
    handleNewDocBlank();
  };

  const handleNewDocBlank = () => {
    setEditDoc(null);
    setShowEditor(true);
  };

  const handleEditDoc = (doc) => {
    if (doc.profile && doc.profile.uuid) {
      navigateTo(`/profile/${doc.profile.uuid}?edit=true`);
    } else if (doc.catalog && doc.catalog.uuid) {
      navigateTo(`/catalog/${doc.catalog.uuid}?edit=true`);
    } else if (doc['mapping-collection'] && doc['mapping-collection'].uuid) {
      navigateTo(`/control-mapping/${doc['mapping-collection'].uuid}?edit=true`);
    } else {
      setEditDoc(doc);
      setShowEditor(true);
    }
  };

  const handleSaved = (savedDoc) => {
    setShowEditor(false);
    setEditDoc(null);
    setRefreshTrigger(prev => prev + 1);

    if (savedDoc) {
      const docData = savedDoc[ROOT_KEYS[activeTab]];
      if (docData && docData.uuid) {
        if (activeTab === 'catalogs') {
          navigateTo(`/catalog/${docData.uuid}?edit=true`);
        } else if (activeTab === 'profiles') {
          navigateTo(`/profile/${docData.uuid}?edit=true`);
        } else if (activeTab === 'control-mappings') {
          navigateTo(`/control-mapping/${docData.uuid}?edit=true`);
        } else {
          if (route.type === 'catalog-view') {
            navigateTo(`/catalog/${docData.uuid}`);
          } else if (route.type === 'profile-view') {
            navigateTo(`/profile/${docData.uuid}`);
          } else if (route.type === 'mapping-view') {
            navigateTo(`/control-mapping/${docData.uuid}`);
          }
        }
      }
    }
  };

  const handleCancelEditor = () => {
    setShowEditor(false);
    setEditDoc(null);
  };

  const ROOT_KEYS = {
    catalogs: 'catalog',
    profiles: 'profile',
    ssps: 'system-security-plan',
    'component-definitions': 'component-definition',
    'assessment-plans': 'assessment-plan',
    'assessment-results': 'assessment-results',
    poams: 'plan-of-action-and-milestones',
    'control-mappings': 'mapping-collection',
  };

  const STAGE_LABELS = {
    catalogs: 'Catalogs',
    profiles: 'Profiles',
    ssps: 'System Security Plans',
    'component-definitions': 'Component Definitions',
    'assessment-plans': 'Assessment Plans',
    'assessment-results': 'Assessment Results',
    poams: 'POA&Ms',
    'control-mappings': 'Control Mappings',
  };

  const STAGE_ICONS = {
    catalogs: '📖',
    profiles: '⚙️',
    ssps: '📝',
    'component-definitions': '🧱',
    'assessment-plans': '📅',
    'assessment-results': '✅',
    poams: '⚠️',
    'control-mappings': '🔗',
  };

  const handleExport = (stage, docId) => {
    const format = window.prompt("Select format for export: json, yaml or xml", "json");
    if (!format) return;
    const fmt = format.trim().toLowerCase();
    if (['json', 'yaml', 'xml'].includes(fmt)) {
      const wsId = getWorkspaceId();
      window.open(`/api/export/${stage}/${docId}?format=${fmt}&w=${encodeURIComponent(wsId)}`, '_blank');
    } else {
      alert("Invalid format. Please enter 'json', 'yaml' or 'xml'.");
    }
  };

  const WORKFLOW_STEPS = [
    { stage: 'catalogs', label: 'Catalog', icon: '📖', desc: 'Control definitions' },
    { stage: 'profiles', label: 'Profile', icon: '⚙️', desc: 'Tailored baselines' },
    { stage: 'component-definitions', label: 'Components', icon: '🧱', desc: 'System parts', isDev: true },
    { stage: 'ssps', label: 'SSP', icon: '📝', desc: 'Security plans', isDev: true },
    { stage: 'assessment-plans', label: 'AP', icon: '📅', desc: 'Assessment plans', isDev: true },
    { stage: 'assessment-results', label: 'AR', icon: '✅', desc: 'Audit results', isDev: true },
    { stage: 'poams', label: 'POA&M', icon: '⚠️', desc: 'Remediation tracking', isDev: true },
  ];

  const UNDER_DEV_STAGES = ['component-definitions', 'ssps', 'assessment-plans', 'assessment-results', 'poams', 'control-mappings'];

  const STAGE_LABEL_MAP = {
    catalogs: 'Catalog', profiles: 'Profile', ssps: 'SSP',
    'component-definitions': 'Component', 'assessment-plans': 'AP',
    'assessment-results': 'AR', poams: 'POA&M', 'control-mappings': 'Mapping'
  };

  const renderDashboard = () => (
    <div className="dashboard-view">
      <div className="welcome-banner">
        <div className="welcome-icon">🛡️</div>
        <div className="welcome-text">
          <h2>Welcome to Reposol</h2>
          <p>Your local OSCAL management application. Edit and manage security controls, system plans, and assessments.</p>
        </div>
      </div>

      {/* OSCAL Workflow Pipeline */}
      <div className="section-title">OSCAL Lifecycle Pipeline</div>
      <div className="workflow-pipeline">
        {WORKFLOW_STEPS.map((step, i) => (
          <div className="workflow-step-wrapper" key={step.stage}>
            <div
              className={`workflow-step ${counts[step.stage] > 0 ? 'has-docs' : ''}`}
              onClick={() => navigateTo('/' + step.stage)}
              title={`${step.label}: ${counts[step.stage]} documents${step.isDev ? ' (Under Active Development)' : ''}`}
            >
              <span className="workflow-icon">{step.icon}</span>
              <span className="workflow-label">{step.label}</span>
              <span className="workflow-count">{counts[step.stage]}</span>
              <span className="workflow-desc">{step.desc}</span>
              {step.isDev && (
                <span className="workflow-dev-badge" title="Under Active Development">
                  🚧 In Dev
                </span>
              )}
            </div>
            {i < WORKFLOW_STEPS.length - 1 && (
              <span className="workflow-arrow">→</span>
            )}
          </div>
        ))}
      </div>

      <div className="dashboard-two-col">
        {/* Quick Guide to OSCAL Workflow */}
        <div className="dashboard-col">
          <div className="section-title">Quick Guide: The OSCAL Lifecycle</div>
          <div className="help-card" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px', height: 'calc(100% - 40px)' }}>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '20px', fontSize: '14px', lineHeight: '1.6' }}>
              Welcome to Reposol! Follow the workflow above to construct, customize, and compile your compliance documentation:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px 0', fontSize: '15px' }}>📖 1. Catalogs</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                  Define core control sets (e.g. NIST SP 800-53), categories, prose statements, and default parameter variables.
                </p>
              </div>
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px 0', fontSize: '15px' }}>⚙️ 2. Profiles</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                  Create baseline definitions by importing controls, tailoring prose statements, and defining organizational baseline values.
                </p>
              </div>
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px 0', fontSize: '15px' }}>🧱 3. Components <span style={{ fontSize: '10px', color: '#fbbf24' }}>🚧</span></h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                  Inventory physical assets, software, services, and policies including security certifications (e.g., EAL 4+).
                </p>
              </div>
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px 0', fontSize: '15px' }}>📝 4. SSPs <span style={{ fontSize: '10px', color: '#fbbf24' }}>🚧</span></h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                  Construct System Security Plans, assign active components to selected profile controls, and tailor parameter overrides inline.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="dashboard-col">
          <div className="section-title">Recent Activity</div>
          {recentDocs.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px' }}>
              <p>No recent documents found. Import or create your first document!</p>
            </div>
          ) : (
            <div className="recent-activity-list">
              {recentDocs.map((doc, i) => (
                <div
                  className="recent-activity-item"
                  key={`${doc.stage}-${doc.uuid}-${i}`}
                  onClick={() => {
                    if (doc.stage === 'catalogs') navigateTo(`/catalog/${doc.uuid}`);
                    else if (doc.stage === 'profiles') navigateTo(`/profile/${doc.uuid}`);
                    else navigateTo('/' + doc.stage);
                  }}
                >
                  <span className="recent-icon">{STAGE_ICONS[doc.stage]}</span>
                  <div className="recent-info">
                    <span className="recent-title">{doc.title}</span>
                    <span className="recent-meta">
                      <span className="recent-stage-badge">{STAGE_LABEL_MAP[doc.stage] || doc.stage}</span>
                      {doc['last-modified'] && (
                        <span className="recent-date">{new Date(doc['last-modified']).toLocaleDateString()}</span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStageView = (stage) => {
    const rootKey = ROOT_KEYS[stage];
    const label = STAGE_LABELS[stage];
    const isUnderDev = UNDER_DEV_STAGES.includes(stage);

    const filteredDocs = searchQuery.trim()
      ? documents.filter(doc => {
          const data = doc[rootKey];
          if (!data) return false;
          const title = (data.metadata?.title || '').toLowerCase();
          const uuid = (data.uuid || '').toLowerCase();
          const q = searchQuery.toLowerCase();
          return title.includes(q) || uuid.includes(q);
        })
      : documents;

    return (
      <div className="stage-view">
        <div className="stage-header">
          <div>
            <h2>
              <span className="stage-icon">{STAGE_ICONS[stage]}</span>
              {label}
              {isUnderDev && <span className="stage-dev-badge" title="Under Active Development">🚧 Under Development</span>}
            </h2>
            <span className="stage-meta">Manage OSCAL {label} documents.</span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-secondary" onClick={() => setShowImport(true)}>
              📥 Import {label.replace(/s$/, '')}
            </button>
            <button className="btn-primary" onClick={handleNewDoc}>
              + New {label.replace(/s$/, '')}
            </button>
          </div>
        </div>

        {isUnderDev && (
          <div className="under-dev-banner">
            <span className="under-dev-icon">🚧</span>
            <div className="under-dev-text">
              <strong>Stage Under Active Development:</strong> A specialized visual editor for {label} is currently in progress. Document creation, import/export, raw JSON editing, and schema validation are active and functional.
            </div>
          </div>
        )}

        {error && <div className="error-message">⚠️ {error}</div>}

        {loading ? (
          <div className="loading-indicator">
            <span className="spinner" />
            Loading documents…
          </div>
        ) : documents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">{STAGE_ICONS[stage]}</div>
            <h3>No documents yet</h3>
            <p>Create your first {label.replace(/s$/, '')} document or import an existing one to get started.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px' }}>
              <button className="btn-secondary" onClick={() => setShowImport(true)}>
                📥 Import {label.replace(/s$/, '')}
              </button>
              <button className="btn-primary" onClick={handleNewDoc}>
                + New {label.replace(/s$/, '')}
              </button>
            </div>
          </div>
        ) : (
          <div className="documents-section">
            {/* Search bar */}
            <div className="search-bar-container">
              <input
                type="text"
                className="search-input"
                placeholder={`Search ${label.toLowerCase()} by title or UUID…`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="search-clear-btn" onClick={() => setSearchQuery('')}>✕</button>
              )}
              <span className="search-results-count">{filteredDocs.length} of {documents.length}</span>
            </div>

            <table className="documents-table">
              <thead>
                <tr>
                  <th>UUID</th>
                  <th>Title</th>
                  <th>Version</th>
                  <th>OSCAL Version</th>
                  <th>Last Modified</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc) => {
                  const data = doc[rootKey];
                  if (!data) return null;
                  const lastMod = data.metadata?.['last-modified'];
                  return (
                    <tr key={data.uuid}>
                      <td className="uuid-cell" title={data.uuid}>
                        {data.uuid.substring(0, 8)}…
                      </td>
                      <td className="title-cell">
                        <span
                          className="clickable-title"
                          onClick={() => {
                            if (stage === 'catalogs' || stage === 'profiles') {
                              navigateTo((stage === 'catalogs' ? '/catalog/' : '/profile/') + data.uuid);
                            } else if (stage === 'control-mappings') {
                              navigateTo('/control-mapping/' + data.uuid);
                            } else {
                              handleEditDoc(doc);
                            }
                          }}
                          title={(stage === 'catalogs' || stage === 'profiles' || stage === 'control-mappings') ? "View document controls" : "Edit document"}
                        >
                          {data.metadata?.title || 'Untitled'}
                        </span>
                      </td>
                      <td>{data.metadata?.version || '—'}</td>
                      <td>{data.metadata?.['oscal-version'] || '—'}</td>
                      <td className="date-cell">
                        {lastMod ? new Date(lastMod).toLocaleDateString() : '—'}
                      </td>
                      <td className="actions-cell">
                        <div className="action-buttons-row">
                          {(stage === 'catalogs' || stage === 'profiles' || stage === 'control-mappings') && (
                            <button
                              className="btn-action btn-view"
                              onClick={() => {
                                if (stage === 'control-mappings') {
                                  navigateTo('/control-mapping/' + data.uuid);
                                } else {
                                  navigateTo((stage === 'catalogs' ? '/catalog/' : '/profile/') + data.uuid);
                                }
                              }}
                              title="View controls"
                            >
                              👁
                            </button>
                          )}
                          <button
                            className="btn-action btn-edit"
                            onClick={() => handleEditDoc(doc)}
                            title="Edit document"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn-action btn-export"
                            onClick={() => handleExport(stage, data.uuid)}
                            title="Export as JSON"
                          >
                            📥
                          </button>
                          <button
                            className="btn-action btn-delete"
                            onClick={() => handleDelete(stage, data.uuid)}
                            title="Delete document"
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout 
      activeTab={activeTab} 
      onTabChange={(tabId) => navigateTo(tabId === 'dashboard' ? '/' : '/' + tabId)} 
      noPadding={route.type === 'catalog-view' || route.type === 'profile-view' || route.type === 'mapping-view'}
      counts={counts}
    >
      {route.type === 'catalog-view' ? (
        <CatalogPage
          key={`catalog-${route.catalogId}-${refreshTrigger}`}
          catalogId={route.catalogId}
          initialEditMode={route.initialEditMode}
          onClose={() => {
            navigateTo('/catalogs');
          }}
        />
      ) : route.type === 'profile-view' ? (
        <ProfilePage
          key={`profile-${route.profileId}-${refreshTrigger}`}
          profileId={route.profileId}
          initialEditMode={route.initialEditMode}
          onClose={() => {
            navigateTo('/profiles');
          }}
        />
      ) : route.type === 'mapping-view' ? (
        <MappingViewer
          key={`mapping-${route.mappingId}-${refreshTrigger}`}
          mappingId={route.mappingId}
          initialEditMode={route.initialEditMode}
          onEdit={handleEditDoc}
          onClose={() => {
            navigateTo('/control-mappings');
          }}
        />
      ) : activeTab === 'dashboard' ? (
        renderDashboard()
      ) : (
        renderStageView(activeTab)
      )}
      {showEditor && activeTab !== 'dashboard' && (
        !editDoc ? (
          <CreateDocumentDialog
            stage={activeTab}
            onSaved={handleSaved}
            onCancel={handleCancelEditor}
          />
        ) : (
          <DocumentEditor
            stage={activeTab}
            editDoc={editDoc}
            onSaved={handleSaved}
            onCancel={handleCancelEditor}
            onTemplateLoaded={(importedDoc) => {
              setEditDoc(importedDoc);
              setRefreshTrigger(prev => prev + 1);
            }}
          />
        )
      )}

      {showImport && (
        <ImportWizard
          stage={activeTab}
          onImported={(stage) => {
            setRefreshTrigger(prev => prev + 1);
          }}
          onClose={() => setShowImport(false)}
        />
      )}
    </Layout>
  );
}
