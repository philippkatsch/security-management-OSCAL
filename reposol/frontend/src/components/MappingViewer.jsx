import { useState, useEffect } from 'react';
import { authFetch } from '../lib/api';

export default function MappingViewer({ mappingId, initialEditMode, onClose, onEdit }) {
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('metadata'); // 'metadata', 'pairs', 'gap', 'viz'

  // Master lists for source/target selection
  const [catalogs, setCatalogs] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [sourceControls, setSourceControls] = useState([]);
  const [targetControls, setTargetControls] = useState([]);

  // Form states for new mapping pair
  const [newPairSource, setNewPairSource] = useState('');
  const [newPairTarget, setNewPairTarget] = useState('');
  const [newPairRel, setNewPairRel] = useState('subset-of');
  const [newPairRemarks, setNewPairRemarks] = useState('');
  const [pairError, setPairError] = useState(null);

  // Versions state
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [saveVersionNumber, setSaveVersionNumber] = useState('');
  const [saveVersionRemarks, setSaveVersionRemarks] = useState('');

  // Local storage draft key
  const draftKey = `reposol_draft_control-mappings_${mappingId}`;

  // Fetch initial documents and metadata list
  useEffect(() => {
    fetchMappingDocument();
    fetchCatalogsAndProfiles();
    fetchVersions();
  }, [mappingId]);

  const fetchMappingDocument = async () => {
    setLoading(true);
    try {
      // Check localStorage draft first
      const draft = localStorage.getItem(draftKey);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (window.confirm("An unsaved draft was found. Do you want to restore it?")) {
          setDoc(parsed);
          loadReferencedControls(parsed['mapping-collection']);
          setLoading(false);
          return;
        } else {
          localStorage.removeItem(draftKey);
        }
      }

      const res = await authFetch(`/api/documents/control-mappings/${mappingId}`);
      if (!res.ok) throw new Error("Error loading the mapping.");
      const data = await res.json();
      setDoc(data);
      setSelectedVersion(data['mapping-collection'].metadata?.version);
      loadReferencedControls(data['mapping-collection']);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalogsAndProfiles = async () => {
    try {
      const resCat = await authFetch('/api/documents/catalogs');
      if (resCat.ok) setCatalogs(await resCat.json());
      const resProf = await authFetch('/api/documents/profiles');
      if (resProf.ok) setProfiles(await resProf.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchVersions = async () => {
    try {
      const res = await authFetch(`/api/documents/control-mappings/${mappingId}/versions`);
      if (res.ok) {
        setVersions(await res.json());
      }
    } catch (e) {
      console.warn("Could not load versions:", e);
    }
  };

  const loadReferencedControls = async (mappingCollection) => {
    if (!mappingCollection) return;
    const mappings = mappingCollection.mappings?.[0] || {};
    if (mappings['source-resource']) {
      fetchControlsForResource(mappings['source-resource'], setSourceControls);
    }
    if (mappings['target-resource']) {
      fetchControlsForResource(mappings['target-resource'], setTargetControls);
    }
  };

  const fetchControlsForResource = async (resource, setter) => {
    if (!resource?.href) {
      setter([]);
      return;
    }
    const match = resource.href.match(/([a-f0-9-]{36})/i);
    if (!match) {
      setter([]);
      return;
    }
    const uuid = match[1];
    const stage = resource.type === 'catalog' ? 'catalogs' : 'profiles';
    try {
      const res = await authFetch(`/api/documents/${stage}/${uuid}`);
      if (res.ok) {
        const docData = await res.json();
        const controls = [];
        const traverse = (item) => {
          if (item.controls) {
            item.controls.forEach(c => {
              controls.push({ id: c.id, title: c.title, group: item.title || 'Ungrouped' });
              if (c.controls) c.controls.forEach(sub => traverse(sub));
            });
          }
          if (item.groups) {
            item.groups.forEach(g => traverse(g));
          }
        };
        const root = docData[resource.type === 'catalog' ? 'catalog' : 'profile'];
        if (root) {
          if (resource.type === 'profile') {
            const resolvedRes = await authFetch(`/api/documents/profiles/${uuid}`);
            const resolvedData = await resolvedRes.json();
            if (resolvedData?.profile?.catalog) {
              traverse(resolvedData.profile.catalog);
            } else if (resolvedData?.catalog) {
              traverse(resolvedData.catalog);
            }
          } else {
            traverse(root);
          }
        }
        setter(controls);
      }
    } catch (e) {
      console.error("Error loading resource controls:", e);
      setter([]);
    }
  };

  // Auto-caching draft on changes when editing
  useEffect(() => {
    if (isEditing && doc) {
      localStorage.setItem(draftKey, JSON.stringify(doc));
    }
  }, [doc, isEditing]);

  const handleFieldChange = (path, value) => {
    setDoc(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      let current = copy['mapping-collection'];
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) current[path[i]] = {};
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return copy;
    });
  };

  const handleResourceChange = async (type, isSource, value) => {
    setDoc(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const col = copy['mapping-collection'];
      if (!col.mappings) col.mappings = [{}];
      if (!col.mappings[0]) col.mappings[0] = {};
      
      const key = isSource ? 'source-resource' : 'target-resource';
      col.mappings[0][key] = {
        type: type,
        href: `../${type === 'catalog' ? 'catalogs' : 'profiles'}/${value}.json`
      };
      return copy;
    });

    const resource = {
      type: type,
      href: `../${type === 'catalog' ? 'catalogs' : 'profiles'}/${value}.json`
    };
    if (isSource) {
      await fetchControlsForResource(resource, setSourceControls);
    } else {
      await fetchControlsForResource(resource, setTargetControls);
    }
  };

  const handleAddMappingPair = (e) => {
    e.preventDefault();
    setPairError(null);
    if (!newPairSource || !newPairTarget) {
      setPairError("Please select both a source and target control.");
      return;
    }

    setDoc(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const col = copy['mapping-collection'];
      if (!col.mappings) col.mappings = [{}];
      if (!col.mappings[0]) col.mappings[0] = {};
      if (!col.mappings[0].maps) col.mappings[0].maps = [];

      const duplicate = col.mappings[0].maps.some(m => 
        m.sources?.some(s => s['id-ref'] === newPairSource) &&
        m.targets?.some(t => t['id-ref'] === newPairTarget)
      );
      if (duplicate) {
        setPairError("This mapping already exists.");
        return prev;
      }

      const pair = {
        uuid: crypto.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : r & 0x3 | 0x8).toString(16);
        }),
        relationship: newPairRel,
        sources: [{ type: 'control', 'id-ref': newPairSource }],
        targets: [{ type: 'control', 'id-ref': newPairTarget }],
        ...(newPairRemarks ? { remarks: newPairRemarks } : {})
      };

      col.mappings[0].maps.push(pair);
      return copy;
    });

    setNewPairSource('');
    setNewPairTarget('');
    setNewPairRemarks('');
  };

  const handleDeleteMappingPair = (pairUuid) => {
    if (!window.confirm("Do you want to delete this mapping pair?")) return;
    setDoc(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const col = copy['mapping-collection'];
      if (col.mappings?.[0]?.maps) {
        col.mappings[0].maps = col.mappings[0].maps.filter(m => m.uuid !== pairUuid);
      }
      return copy;
    });
  };

  const handleSaveDocument = async () => {
    try {
      const response = await authFetch(`/api/documents/control-mappings/${mappingId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Saving failed.");
      }
      localStorage.removeItem(draftKey);
      alert("Saved successfully!");
      setIsEditing(false);
      fetchVersions();
    } catch (e) {
      alert("Error saving: " + e.message);
    }
  };

  const handleDiscardChanges = () => {
    if (window.confirm("Do you want to discard all unsaved changes?")) {
      localStorage.removeItem(draftKey);
      setIsEditing(false);
      fetchMappingDocument();
    }
  };

  const handleVersionChange = async (verStr) => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/documents/control-mappings/${mappingId}/versions/${verStr}`);
      if (!res.ok) throw new Error("Error loading this version.");
      const data = await res.json();
      setDoc(data);
      setSelectedVersion(verStr);
      loadReferencedControls(data['mapping-collection']);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewVersion = async (e) => {
    e.preventDefault();
    if (!saveVersionNumber.trim()) {
      alert("Please enter a version number.");
      return;
    }
    // Deep clone and set version
    const copy = JSON.parse(JSON.stringify(doc));
    copy['mapping-collection'].metadata.version = saveVersionNumber.trim();
    if (saveVersionRemarks.trim()) {
      copy['mapping-collection'].metadata.remarks = saveVersionRemarks.trim();
    }

    try {
      const response = await authFetch(`/api/documents/control-mappings/${mappingId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(copy),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Error creating version.");
      }
      alert(`Version ${saveVersionNumber} successfully created!`);
      setSaveVersionNumber('');
      setSaveVersionRemarks('');
      fetchVersions();
      fetchMappingDocument();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDeleteVersion = async (verStr) => {
    if (!window.confirm(`Are you sure you want to delete version ${verStr}?`)) return;
    try {
      const response = await authFetch(`/api/documents/control-mappings/${mappingId}/versions/${verStr}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error("Deleting version failed.");
      fetchVersions();
      if (selectedVersion === verStr) {
        fetchMappingDocument();
      }
    } catch (e) {
      alert(e.message);
    }
  };

  // Gap analysis calculations
  const calculateGapStats = () => {
    if (!doc?.['mapping-collection']?.mappings?.[0]) {
      return { coverage: 0, unmappedSource: [], unmappedTarget: [] };
    }
    const maps = doc['mapping-collection'].mappings[0].maps || [];
    const mappedSourceIds = new Set(maps.flatMap(m => m.sources?.map(s => s['id-ref']) || []));
    const mappedTargetIds = new Set(maps.flatMap(m => m.targets?.map(t => t['id-ref']) || []));

    const unmappedSource = sourceControls.filter(c => !mappedSourceIds.has(c.id));
    const unmappedTarget = targetControls.filter(c => !mappedTargetIds.has(c.id));

    const totalSource = sourceControls.length;
    const coverage = totalSource > 0 ? Math.round(((totalSource - unmappedSource.length) / totalSource) * 100) : 0;

    return { coverage, unmappedSource, unmappedTarget };
  };

  const stats = calculateGapStats();

  const handleExportGapCSV = () => {
    const csvContent = [
      ["Type", "Control ID", "Title", "Group"],
      ...stats.unmappedSource.map(c => ["Source (Unmapped)", c.id, c.title, c.group]),
      ...stats.unmappedTarget.map(c => ["Target (Unmapped)", c.id, c.title, c.group])
    ].map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `gap_report_${mappingId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = () => {
    const format = window.prompt("Select format for export: json, yaml or xml", "json");
    if (!format) return;
    const fmt = format.trim().toLowerCase();
    if (['json', 'yaml', 'xml'].includes(fmt)) {
      window.open(`/api/export/control-mappings/${mappingId}?format=${fmt}`, '_blank');
    } else {
      alert("Invalid format. Please enter 'json', 'yaml' or 'xml'.");
    }
  };

  if (loading) {
    return (
      <div className="loading-indicator">
        <span className="spinner" />
        Loading mapping workspace…
      </div>
    );
  }

  if (error) {
    return <div className="error-message">⚠️ {error}</div>;
  }

  const mc = doc['mapping-collection'];
  const mappingNode = mc.mappings?.[0] || {};
  const maps = mappingNode.maps || [];

  return (
    <div className="catalog-viewer" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="viewer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px', marginBottom: '16px' }}>
        <div>
          <span className="stage-badge" style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>
            {isEditing ? "Editing Mapping Collection" : "Mapping Collection Viewer"}
          </span>
          <h2 style={{ margin: '4px 0 0 0' }}>{mc.metadata?.title || 'Untitled Mapping'}</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            className={`btn-secondary ${showVersions ? 'active' : ''}`} 
            onClick={() => setShowVersions(!showVersions)}
            title="Version history"
          >
            🕐 Versions {selectedVersion ? `(${selectedVersion})` : `(${versions.length})`}
          </button>
          {!isEditing ? (
            <>
              <button className="btn-primary" onClick={() => setIsEditing(true)}>✏️ Edit</button>
              <button className="btn-secondary" onClick={handleExport}>📥 Export</button>
              <button className="btn-secondary" onClick={onClose}>Back</button>
            </>
          ) : (
            <>
              <button className="btn-primary" onClick={handleSaveDocument}>💾 Save</button>
              <button className="btn-secondary" onClick={handleDiscardChanges}>Cancel</button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: '20px', minHeight: 0 }}>
        {/* Main Workspace Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Sub tabs */}
          <div className="sub-tabs-row" style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '16px', gap: '16px' }}>
            <button className={`sub-tab-btn ${activeSubTab === 'metadata' ? 'active' : ''}`} onClick={() => setActiveSubTab('metadata')}>
              Metadata & Provenance
            </button>
            <button className={`sub-tab-btn ${activeSubTab === 'pairs' ? 'active' : ''}`} onClick={() => setActiveSubTab('pairs')}>
              Mapping Pairs ({maps.length})
            </button>
            <button className={`sub-tab-btn ${activeSubTab === 'gap' ? 'active' : ''}`} onClick={() => setActiveSubTab('gap')}>
              Gap Analysis & Coverage ({stats.coverage}%)
            </button>
            <button className={`sub-tab-btn ${activeSubTab === 'viz' ? 'active' : ''}`} onClick={() => setActiveSubTab('viz')}>
              Visualization
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
            {/* SUBTAB: METADATA & PROVENANCE */}
            {activeSubTab === 'metadata' && (
              <div className="metadata-form-card" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', padding: '20px', borderRadius: '8px' }}>
                <h3 style={{ marginTop: 0 }}>General Metadata</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Title *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={mc.metadata?.title || ''}
                      onChange={(e) => handleFieldChange(['metadata', 'title'], e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Version *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={mc.metadata?.version || ''}
                      onChange={(e) => handleFieldChange(['metadata', 'version'], e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <h3>Provenance (Origin & Methodology)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Method</label>
                    <select
                      className="form-select"
                      value={mc.provenance?.method || 'human'}
                      onChange={(e) => handleFieldChange(['provenance', 'method'], e.target.value)}
                      disabled={!isEditing}
                    >
                      <option value="human">Expert Analysis (human)</option>
                      <option value="automation">Automated (automation)</option>
                      <option value="hybrid">Semi-automated (hybrid)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Relationship Logic</label>
                    <select
                      className="form-select"
                      value={mc.provenance?.['matching-rationale'] || 'functional'}
                      onChange={(e) => handleFieldChange(['provenance', 'matching-rationale'], e.target.value)}
                      disabled={!isEditing}
                    >
                      <option value="syntactic">Syntactic (wording)</option>
                      <option value="semantic">Semantic (meaning)</option>
                      <option value="functional">Functional (outcome)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Status</label>
                    <select
                      className="form-select"
                      value={mc.provenance?.status || 'draft'}
                      onChange={(e) => handleFieldChange(['provenance', 'status'], e.target.value)}
                      disabled={!isEditing}
                    >
                      <option value="draft">Draft (draft)</option>
                      <option value="complete">Completed (complete)</option>
                      <option value="deprecated">Deprecated (deprecated)</option>
                    </select>
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Methodology Description</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={mc.provenance?.['mapping-description'] || ''}
                    onChange={(e) => handleFieldChange(['provenance', 'mapping-description'], e.target.value)}
                    placeholder="Describe the mapping methodology, auditor expertise, or tool support applied..."
                    disabled={!isEditing}
                  />
                </div>

                <h3>Linked Frameworks (Imports)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div style={{ background: 'var(--color-surface-3)', padding: '16px', borderRadius: '6px', border: '1px solid var(--color-border-subtle)' }}>
                    <h4 style={{ margin: '0 0 12px 0' }}>Source Framework</h4>
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Resource Type</label>
                      <select
                        className="form-select"
                        value={mappingNode['source-resource']?.type || 'catalog'}
                        onChange={(e) => handleResourceChange(e.target.value, true, '')}
                        disabled={!isEditing}
                      >
                        <option value="catalog">Catalog</option>
                        <option value="profile">Profile</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Referenced Document</label>
                      <select
                        className="form-select"
                        value={mappingNode['source-resource']?.href?.match(/([a-f0-9-]{36})/i)?.[1] || ''}
                        onChange={(e) => handleResourceChange(mappingNode['source-resource']?.type || 'catalog', true, e.target.value)}
                        disabled={!isEditing}
                      >
                        <option value="">-- Select document --</option>
                        {(mappingNode['source-resource']?.type === 'profile' ? profiles : catalogs).map(doc => {
                          const data = doc[mappingNode['source-resource']?.type || 'catalog'];
                          return <option key={data.uuid} value={data.uuid}>{data.metadata?.title || data.uuid}</option>;
                        })}
                      </select>
                    </div>
                    <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      Loaded controls: <strong>{sourceControls.length}</strong>
                    </div>
                  </div>

                  <div style={{ background: 'var(--color-surface-3)', padding: '16px', borderRadius: '6px', border: '1px solid var(--color-border-subtle)' }}>
                    <h4 style={{ margin: '0 0 12px 0' }}>Target Framework</h4>
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Resource Type</label>
                      <select
                        className="form-select"
                        value={mappingNode['target-resource']?.type || 'catalog'}
                        onChange={(e) => handleResourceChange(e.target.value, false, '')}
                        disabled={!isEditing}
                      >
                        <option value="catalog">Catalog</option>
                        <option value="profile">Profile</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Referenced Document</label>
                      <select
                        className="form-select"
                        value={mappingNode['target-resource']?.href?.match(/([a-f0-9-]{36})/i)?.[1] || ''}
                        onChange={(e) => handleResourceChange(mappingNode['target-resource']?.type || 'catalog', false, e.target.value)}
                        disabled={!isEditing}
                      >
                        <option value="">-- Select document --</option>
                        {(mappingNode['target-resource']?.type === 'profile' ? profiles : catalogs).map(doc => {
                          const data = doc[mappingNode['target-resource']?.type || 'catalog'];
                          return <option key={data.uuid} value={data.uuid}>{data.metadata?.title || data.uuid}</option>;
                        })}
                      </select>
                    </div>
                    <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      Loaded controls: <strong>{targetControls.length}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB: MAPPING PAIRS */}
            {activeSubTab === 'pairs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {isEditing && (
                  <form onSubmit={handleAddMappingPair} style={{ background: 'var(--color-surface-2)', border: '1px dashed var(--color-border)', padding: '16px', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 12px 0' }}>Add New Mapping Pair</h4>
                    {pairError && <div className="error-message" style={{ marginBottom: '12px' }}>⚠️ {pairError}</div>}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div className="form-group">
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Source Control</label>
                        <select className="form-select" value={newPairSource} onChange={(e) => setNewPairSource(e.target.value)}>
                          <option value="">-- Select --</option>
                          {sourceControls.map(c => <option key={c.id} value={c.id}>{c.id} - {c.title.substring(0, 40)}...</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Relationship (Relation)</label>
                        <select className="form-select" value={newPairRel} onChange={(e) => setNewPairRel(e.target.value)}>
                          <option value="equivalent-to">equivalent-to (Equivalent)</option>
                          <option value="equal-to">equal-to (Identical)</option>
                          <option value="subset-of">subset-of (Subset)</option>
                          <option value="superset-of">superset-of (Superset)</option>
                          <option value="intersects-with">intersects-with (Intersects)</option>
                          <option value="no-relationship">no-relationship (No Relationship)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Target Control</label>
                        <select className="form-select" value={newPairTarget} onChange={(e) => setNewPairTarget(e.target.value)}>
                          <option value="">-- Select --</option>
                          {targetControls.map(c => <option key={c.id} value={c.id}>{c.id} - {c.title.substring(0, 40)}...</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Remarks / Rationale</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="E.g., 'AC-2 additionally requires MFA, which ISO 5.18 does not explicitly require.'"
                        value={newPairRemarks}
                        onChange={(e) => setNewPairRemarks(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn-primary">+ Add Pair</button>
                  </form>
                )}

                <div className="matrix-table-container">
                  <table className="documents-table">
                    <thead>
                      <tr>
                        <th style={{ width: '150px' }}>Source</th>
                        <th style={{ width: '150px' }}>Relationship</th>
                        <th style={{ width: '150px' }}>Target</th>
                        <th>Remarks / Rationale</th>
                        {isEditing && <th style={{ width: '80px' }}>Aktionen</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {maps.length === 0 ? (
                        <tr>
                          <td colSpan={isEditing ? 5 : 4} className="empty-state-text" style={{ textAlign: 'center', padding: '24px' }}>
                            No mapping pairs defined. Use the editor above to add mappings.
                          </td>
                        </tr>
                      ) : (
                        maps.map((pair) => {
                          const relClass = `rel-${pair.relationship}`;
                          return (
                            <tr key={pair.uuid}>
                              <td style={{ fontWeight: 'bold' }}>{pair.sources?.[0]?.['id-ref']}</td>
                              <td>
                                <span className={`status-badge ${relClass}`} style={{ fontSize: '11px' }}>
                                  {pair.relationship}
                                </span>
                              </td>
                              <td style={{ fontWeight: 'bold' }}>{pair.targets?.[0]?.['id-ref']}</td>
                              <td>{pair.remarks || '—'}</td>
                              {isEditing && (
                                <td>
                                  <button className="btn-delete btn-sm" onClick={() => handleDeleteMappingPair(pair.uuid)}>
                                    🗑
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUBTAB: GAP ANALYSIS */}
            {activeSubTab === 'gap' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
                  <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', fontWeight: 'bold', marginBottom: '8px' }}>Framework Coverage Degree</div>
                    <div style={{ fontSize: '64px', fontWeight: 'bold', color: 'var(--color-success)' }}>{stats.coverage}%</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '8px' }}>
                      {sourceControls.length - stats.unmappedSource.length} of {sourceControls.length} source controls are mapped to at least one target control.
                    </div>
                  </div>

                  <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '20px' }}>
                    <h3 style={{ marginTop: 0 }}>Gap Report Options</h3>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                      Identify gaps in your compliance coverage. The gap report lists all controls of the source and target frameworks for which no direct mapping yet exists.
                    </p>
                    <button className="btn-primary" onClick={handleExportGapCSV}>
                      📥 Download Gap Report (.CSV)
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  {/* Unmapped Source */}
                  <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
                    <h4 style={{ margin: '0 0 12px 0', display: 'flex', justifyContent: 'space-between' }}>
                      <span>❌ Unmapped Source Controls</span>
                      <span className="badge" style={{ background: 'var(--color-error-subtle)', color: 'var(--color-error)' }}>{stats.unmappedSource.length}</span>
                    </h4>
                    <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--color-border-subtle)', borderRadius: '4px' }}>
                      {stats.unmappedSource.length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)' }}>No gaps! All controls mapped.</div>
                      ) : (
                        stats.unmappedSource.map(c => (
                          <div key={c.id} style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border-subtle)', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                            <strong>{c.id}</strong>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{c.group}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Unmapped Target */}
                  <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
                    <h4 style={{ margin: '0 0 12px 0', display: 'flex', justifyContent: 'space-between' }}>
                      <span>❌ Unmapped Target Controls</span>
                      <span className="badge" style={{ background: 'var(--color-error-subtle)', color: 'var(--color-error)' }}>{stats.unmappedTarget.length}</span>
                    </h4>
                    <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--color-border-subtle)', borderRadius: '4px' }}>
                      {stats.unmappedTarget.length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)' }}>All target controls covered.</div>
                      ) : (
                        stats.unmappedTarget.map(c => (
                          <div key={c.id} style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border-subtle)', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                            <strong>{c.id}</strong>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{c.group}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB: VISUALIZATION */}
            {activeSubTab === 'viz' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* 1. Matrix View */}
                <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '20px' }}>
                  <h3 style={{ marginTop: 0 }}>Framework Mapping Matrix</h3>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '16px' }}>
                    Intersection display of controls. Shows the relative relationship types between the source framework (rows) and target framework (columns).
                  </p>
                  <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-subtle)', borderRadius: '6px' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-surface-3)' }}>
                          <th style={{ border: '1px solid var(--color-border-subtle)', padding: '8px' }}>Source \ Target</th>
                          {targetControls.map(tc => (
                            <th key={tc.id} style={{ border: '1px solid var(--color-border-subtle)', padding: '8px', minWidth: '60px' }}>{tc.id}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sourceControls.map(sc => (
                          <tr key={sc.id}>
                            <td style={{ border: '1px solid var(--color-border-subtle)', padding: '8px', fontWeight: 'bold', background: 'var(--color-surface-3)' }}>{sc.id}</td>
                            {targetControls.map(tc => {
                              const pair = maps.find(m => 
                                m.sources?.some(s => s['id-ref'] === sc.id) &&
                                m.targets?.some(t => t['id-ref'] === tc.id)
                              );
                              const cellStyle = pair 
                                ? { background: `var(--color-${pair.relationship === 'no-relationship' ? 'error' : pair.relationship === 'equivalent-to' || pair.relationship === 'equal-to' ? 'success' : 'primary'}-subtle)`, color: 'var(--color-text)', textAlign: 'center' }
                                : { textAlign: 'center', color: '#555' };
                              return (
                                <td key={tc.id} style={{ border: '1px solid var(--color-border-subtle)', padding: '8px', ...cellStyle }}>
                                  {pair ? pair.relationship.substring(0, 4) : '—'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. Group Level Sankey Flow */}
                <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '20px' }}>
                  <h3 style={{ marginTop: 0 }}>Group-level flow chart (Sankey replacement)</h3>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '20px' }}>
                    Visualization of control flow between chapters or control groups of the two frameworks.
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Calculate group mappings */}
                    {(() => {
                      const groupMappings = {}; // { [sourceGroup]: { [targetGroup]: count } }
                      maps.forEach(m => {
                        const scId = m.sources?.[0]?.['id-ref'];
                        const tcId = m.targets?.[0]?.['id-ref'];
                        const sc = sourceControls.find(c => c.id === scId);
                        const tc = targetControls.find(c => c.id === tcId);
                        if (sc && tc) {
                          const sg = sc.group;
                          const tg = tc.group;
                          if (!groupMappings[sg]) groupMappings[sg] = {};
                          if (!groupMappings[sg][tg]) groupMappings[sg][tg] = 0;
                          groupMappings[sg][tg]++;
                        }
                      });

                      const sourceGroups = Array.from(new Set(sourceControls.map(c => c.group)));
                      
                      return sourceGroups.map(sg => {
                        const targets = groupMappings[sg] || {};
                        const totalLinks = Object.values(targets).reduce((a, b) => a + b, 0);
                        if (totalLinks === 0) return null;

                        return (
                          <div key={sg} style={{ display: 'flex', alignItems: 'center', background: 'var(--color-surface-3)', border: '1px solid var(--color-border-subtle)', borderRadius: '6px', padding: '12px' }}>
                            <div style={{ width: '200px', fontWeight: 'bold', borderRight: '2px solid var(--color-primary)', paddingRight: '12px' }}>
                              {sg}
                            </div>
                            <div style={{ flex: 1, paddingLeft: '16px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                              {Object.entries(targets).map(([tg, count]) => (
                                <div key={tg} style={{ background: 'var(--color-surface)', padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span>{tg}</span>
                                  <span style={{ background: 'var(--color-primary)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold' }}>
                                    {count} {count === 1 ? 'Mapping' : 'Mappings'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SIDEBAR: VERSION HISTORY DRAWER */}
        {showVersions && (
          <div className="versions-drawer" style={{ width: '320px', borderLeft: '1px solid var(--color-border)', background: 'var(--color-surface-2)', padding: '16px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <h3 style={{ margin: 0 }}>🕐 Versions</h3>
              <button className="btn-icon" onClick={() => setShowVersions(false)}>✕</button>
            </div>

            {/* Save new version form */}
            {isEditing && (
              <form onSubmit={handleCreateNewVersion} style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border-subtle)', borderRadius: '6px', padding: '12px', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 10px 0' }}>Save as new version</h4>
                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Version number *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="E.g., 1.0.1"
                    value={saveVersionNumber}
                    onChange={(e) => setSaveVersionNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>Change comment</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="What was changed?"
                    value={saveVersionRemarks}
                    onChange={(e) => setSaveVersionRemarks(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn-primary btn-sm" style={{ width: '100%' }}>+ Create version</button>
              </form>
            )}

            {/* Version List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
              {versions.length === 0 ? (
                <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', textAlign: 'center', padding: '24px' }}>No versions found.</div>
              ) : (
                versions.map((v) => {
                  const isActive = selectedVersion === v.version;
                  return (
                    <div 
                      key={v.version} 
                      style={{ 
                        background: isActive ? 'var(--color-surface-3)' : 'var(--color-surface)',
                        border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border-subtle)'}`,
                        borderRadius: '6px',
                        padding: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        position: 'relative'
                      }}
                      onClick={() => handleVersionChange(v.version)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '14px', color: isActive ? 'var(--color-primary)' : 'var(--color-text)' }}>
                          Version {v.version} {isActive ? ' (Active)' : ''}
                        </span>
                        {versions.length > 1 && (
                          <button 
                            className="btn-delete btn-sm" 
                            style={{ padding: '2px 6px', fontSize: '10px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteVersion(v.version);
                            }}
                            title="Delete version"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                        {v['last-modified'] ? new Date(v['last-modified']).toLocaleString() : '—'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text)' }}>
                        {v.remarks || 'No comment available.'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
