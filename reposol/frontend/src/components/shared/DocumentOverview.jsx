import React, { useState } from 'react';
import { MetadataEditor } from './MetadataEditor';
import { BackMatterEditor } from './BackMatterEditor';
import { PropsEditor } from './PropsEditor';
import { ParameterEditor } from './ParameterEditor';
import { DebouncedInput } from './DebouncedInput';
import { importFromRegistry, importFromUrl, fetchRegistry, fetchDocument } from '../../lib/api';

const countControls = (groups = [], controls = []) => {
  let total = 0;
  let active = 0;
  let withdrawn = 0;

  const traverseControl = (control) => {
    total++;
    const isWithdrawn = (control.props || []).some(
      p => p.name?.toLowerCase() === 'status' && p.value?.toLowerCase() === 'withdrawn'
    );
    if (isWithdrawn) {
      withdrawn++;
    } else {
      active++;
    }
    if (control.controls) {
      control.controls.forEach(traverseControl);
    }
  };

  controls.forEach(traverseControl);

  const traverseGroup = (group) => {
    if (group.controls) {
      group.controls.forEach(traverseControl);
    }
    if (group.groups) {
      group.groups.forEach(traverseGroup);
    }
  };

  groups.forEach(traverseGroup);

  return { total, active, withdrawn };
};

const countControlsInGroup = (group) => {
  let count = 0;
  const traverse = (item) => {
    count++;
    if (item.controls) {
      item.controls.forEach(traverse);
    }
  };
  if (group.controls) {
    group.controls.forEach(traverse);
  }
  const traverseGroup = (g) => {
    if (g.controls) {
      g.controls.forEach(traverse);
    }
    if (g.groups) {
      g.groups.forEach(traverseGroup);
    }
  };
  if (group.groups) {
    group.groups.forEach(traverseGroup);
  }
  return count;
};

/**
 * Unified Document Overview — replaces both CatalogOverview and ProfileOverview.
 *
 * mode='catalog': Shows Metadata, Tags (Accordion), BackMatter, Import Source tabs.
 * mode='profile': Shows Summary Bar, Import Sources, Metadata, Tags (Accordion), BackMatter tabs.
 */
export function DocumentOverview({
  document = {},
  onChange,
  isEditing = false,
  allUsedPropKeys = [],
  usedTagsSummary = {},
  mode = 'catalog',
  activeView = 'overview',
  onSelectGroup,
  onSelectControl,
  onGlobalPropertyRename,
  onGlobalPropertyDelete,
  // Profile-specific (optional):
  resolvedCatalog = null,
  availableCatalogs = [],
  availableProfiles = [],
  catalogCache = null,
  SourcesPanel = null // Pass the SourcesPanel component for profile mode
}) {
  const [activeTab, setActiveTab] = useState('metadata');
  const [openTags, setOpenTags] = useState({});
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [registryTemplates, setRegistryTemplates] = useState([]);
  const [loadingRegistry, setLoadingRegistry] = useState(false);

  // For profile mode: if 'imports' tab selected but not editing, fall back to metadata
  const effectiveTab = (activeTab === 'imports' && !isEditing) ? 'metadata' : activeTab;

  const toggleTag = (tagName) => {
    setOpenTags(prev => ({ ...prev, [tagName]: !prev[tagName] }));
  };

  const handleMetadataChange = (updatedMetadata) => {
    onChange({ ...document, metadata: updatedMetadata });
  };

  const handleBackMatterChange = (updatedBackMatter) => {
    onChange({ ...document, 'back-matter': updatedBackMatter });
  };

  // --- Dynamic Tags list & global property promotion ---
  const globalProps = document.metadata?.props || [];

  const getUnifiedProperties = () => {
    const properties = {};

    // 1. Scan metadata.props
    const metaProps = document.metadata?.props || [];
    metaProps.forEach(p => {
      if (!p.name) return;
      if (!properties[p.name]) {
        properties[p.name] = { 
          values: {}, 
          metaValues: [], 
          metaDetails: [],
          isMetadata: true, 
          isUsed: false, 
          totalCount: 0 
        };
      } else {
        properties[p.name].isMetadata = true;
      }
      if (p.value !== undefined && p.value !== '' && !properties[p.name].metaValues.includes(p.value)) {
        properties[p.name].metaValues.push(p.value);
      }
      properties[p.name].metaDetails.push({
        value: p.value,
        ns: p.ns,
        class: p.class,
        group: p.group,
        uuid: p.uuid,
        remarks: p.remarks
      });
    });

    // 2. Scan usedTagsSummary (which comes from groups & controls)
    Object.entries(usedTagsSummary || {}).forEach(([name, valMap]) => {
      const totalCount = Object.values(valMap).reduce((sum, c) => sum + c, 0);
      if (!properties[name]) {
        properties[name] = { values: { ...valMap }, metaValues: [], metaDetails: [], isMetadata: false, isUsed: true, totalCount };
      } else {
        properties[name].isUsed = true;
        properties[name].totalCount = totalCount;
        properties[name].values = { ...properties[name].values, ...valMap };
      }
    });

    return properties;
  };

  const handleUpdateMetaProp = (propName, metaIdx, field, newValue) => {
    const metaProps = document.metadata?.props || [];
    let count = 0;
    const updatedProps = metaProps.map(p => {
      if (p.name === propName) {
        if (count === metaIdx) {
          count++;
          const updated = { ...p, [field]: newValue };
          if (!newValue && (field === 'ns' || field === 'class' || field === 'uuid' || field === 'remarks' || field === 'group')) {
            delete updated[field];
          }
          return updated;
        }
        count++;
      }
      return p;
    });
    handleMetadataChange({ ...document.metadata, props: updatedProps });
  };

  const handleAddNewPropKey = () => {
    const newName = `new-property-${Date.now().toString().slice(-4)}`;
    const updatedProps = [...(document.metadata?.props || []), { name: newName, value: 'placeholder' }];
    handleMetadataChange({ ...document.metadata, props: updatedProps });
  };

  const handlePromoteTag = (tagName, tagValue) => {
    const exists = globalProps.some(p => p.name === tagName && p.value === tagValue);
    if (!exists) {
      const updatedProps = [...globalProps, { name: tagName, value: tagValue }];
      handleMetadataChange({ ...document.metadata, props: updatedProps });
    }
  };

  // --- Catalog Import Source (US 1.9) ---
  const handleOpenImportTab = async () => {
    setActiveTab('import');
    setLoadingRegistry(true);
    setImportError('');
    try {
      const registry = await fetchRegistry();
      const catalogs = registry.filter(r => r.model === 'catalog');
      setRegistryTemplates(catalogs);
    } catch (err) {
      setImportError('Registry could not be loaded.');
    } finally {
      setLoadingRegistry(false);
    }
  };

  const handleImportRegistry = async (sourceId) => {
    setImporting(true);
    setImportError('');
    try {
      const imported = await importFromRegistry(sourceId);
      const fullDoc = await fetchDocument(imported.stage, imported.uuid);
      const updatedCatalog = {
        ...fullDoc.catalog,
        uuid: document.uuid,
        metadata: document.metadata
      };
      onChange(updatedCatalog);
      setActiveTab('metadata');
    } catch (err) {
      setImportError(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleImportUrl = async () => {
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportError('');
    try {
      const imported = await importFromUrl(importUrl.trim());
      const fullDoc = await fetchDocument(imported.stage, imported.uuid);
      const updatedCatalog = {
        ...fullDoc.catalog,
        uuid: document.uuid,
        metadata: document.metadata
      };
      onChange(updatedCatalog);
      setActiveTab('metadata');
    } catch (err) {
      setImportError(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  // --- Profile Baseline Summary Stats ---
  const baselineStats = (() => {
    if (mode !== 'profile' || !resolvedCatalog) return null;
    let c = 0, g = 0;
    const traverse = (items, isGroup) => {
      if (!Array.isArray(items)) return;
      items.forEach((item) => {
        if (isGroup) { g++; traverse(item.groups, true); traverse(item.controls, false); }
        else { c++; traverse(item.controls, false); }
      });
    };
    traverse(resolvedCatalog.groups, true);
    traverse(resolvedCatalog.controls, false);

    const mergeMode = document.merge
      ? document.merge['as-is'] !== undefined ? 'As-Is'
        : document.merge.flat !== undefined ? 'Flat'
        : document.merge.custom !== undefined ? 'Custom'
        : 'As-Is'
      : 'As-Is (Default)';

    return {
      controlsCount: c,
      groupsCount: g,
      mergeMode,
      paramsCount: document.modify?.['set-parameters']?.length || 0,
      altersCount: document.modify?.alters?.length || 0
    };
  })();
  // --- Tab definitions ---
  const tabs = [];
  if (mode === 'profile' && isEditing) tabs.push({ id: 'imports', label: '📥 Import Sources' });
  tabs.push({ id: 'metadata', label: '📝 Metadata' });
  tabs.push({ id: 'parameters', label: '⚙️ Parameters' });
  tabs.push({ id: 'backmatter', label: '📎 Resources (Back Matter)' });
  if (mode === 'catalog' && isEditing) tabs.push({ id: 'import', label: '📥 Import Source' });

  // --- Shared Styles ---
  const tabBtnStyle = (tabId) => ({
    padding: '8px 16px',
    background: (mode === 'profile' ? effectiveTab : activeTab) === tabId ? 'var(--color-surface-2)' : 'none',
    border: 'none',
    color: (mode === 'profile' ? effectiveTab : activeTab) === tabId ? 'var(--color-text)' : 'var(--color-text-muted)',
    fontSize: '13px',
    fontWeight: 'bold',
    borderBottom: (mode === 'profile' ? effectiveTab : activeTab) === tabId ? '2px solid var(--color-primary)' : 'none',
    cursor: 'pointer'
  });

  const badgeStyle = {
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border-subtle)',
    padding: '4px 10px',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 'var(--radius-sm)'
  };

  const badgeLabelStyle = {
    fontSize: '9px',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  };

  let currentTab = activeView || (mode === 'profile' ? effectiveTab : activeTab);
  if (currentTab === 'back-matter') currentTab = 'backmatter';

  const stats = countControls(
    mode === 'catalog' ? (document.groups || []) : (resolvedCatalog?.groups || []),
    mode === 'catalog' ? (document.controls || []) : (resolvedCatalog?.controls || [])
  );

  const paramStats = (() => {
    const targetDoc = mode === 'catalog' ? document : (resolvedCatalog || {});
    let globalCount = targetDoc.params?.length || 0;
    let groupCount = 0;
    let controlCount = 0;

    const countControlParams = (control) => {
      if (control.params) {
        controlCount += control.params.length;
      }
      if (control.controls) {
        control.controls.forEach(countControlParams);
      }
    };

    const countGroupParams = (group) => {
      if (group.params) {
        groupCount += group.params.length;
      }
      if (group.controls) {
        group.controls.forEach(countControlParams);
      }
      if (group.groups) {
        group.groups.forEach(countGroupParams);
      }
    };

    if (targetDoc.groups) {
      targetDoc.groups.forEach(countGroupParams);
    }
    if (targetDoc.controls) {
      targetDoc.controls.forEach(countControlParams);
    }

    return { globalCount, groupCount, controlCount };
  })();

  const allResolvedCatalogParams = (() => {
    if (!resolvedCatalog) return [];
    const list = [];
    if (resolvedCatalog.params) {
      resolvedCatalog.params.forEach(p => list.push({ ...p, scope: 'catalog' }));
    }
    const traverseControl = (c, isSub = false) => {
      if (c.params) {
        c.params.forEach(p => list.push({ ...p, scope: 'control', isSubcontrol: isSub }));
      }
      if (c.controls) c.controls.forEach(childC => traverseControl(childC, true));
    };
    const traverseGroup = (g) => {
      if (g.params) {
        g.params.forEach(p => list.push({ ...p, scope: 'group' }));
      }
      if (g.controls) g.controls.forEach(c => traverseControl(c, false));
      if (g.groups) g.groups.forEach(traverseGroup);
    };
    if (resolvedCatalog.controls) resolvedCatalog.controls.forEach(c => traverseControl(c, false));
    if (resolvedCatalog.groups) resolvedCatalog.groups.forEach(traverseGroup);
    return list;
  })();

  const propertyStats = (() => {
    const unified = getUnifiedProperties();
    const uniqueKeys = Object.keys(unified).length;
    let declaredCount = document.metadata?.props?.length || 0;
    
    let elementCount = 0;
    let totalAssignments = 0;
    
    Object.values(unified).forEach(p => {
      if (p.isUsed) {
        elementCount++;
        totalAssignments += p.totalCount;
      }
    });
    
    return { uniqueKeys, declaredCount, elementCount, totalAssignments };
  })();

  const globalPropsLabel = mode === 'catalog'
    ? 'Global Document Properties (metadata.props)'
    : 'Global Profile Properties (metadata.props)';
  const usedTagsLabel = mode === 'catalog'
    ? 'Properties Used in Controls & Groups'
    : 'Properties Used in Imported Controls';

  const metricCardStyle = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '24px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: '8px',
    boxShadow: 'var(--shadow-sm)',
    flex: '1',
    minWidth: '150px'
  };

  const metricLabelStyle = {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Tab Content ── */}
      <div style={{ flex: 1, overflow: 'hidden', height: '100%' }}>

        {/* Overview Tab (Dashboard) */}
        {currentTab === 'overview' && (
          <div style={{ padding: '24px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Title & Metadata row */}
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-text)', marginBottom: '8px', lineHeight: '1.2' }}>
                {document.metadata?.title || 'Untitled Document'}
              </h1>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                {document.metadata?.version && (
                  <span><strong>Version:</strong> {document.metadata.version}</span>
                )}
                <span><strong>OSCAL Version:</strong> {document.metadata?.['oscal-version'] || 'v1.2.2'}</span>
                {document.metadata?.published && (
                  <span><strong>Published:</strong> {new Date(document.metadata.published).toLocaleDateString()}</span>
                )}
                {document.metadata?.['last-modified'] && (
                  <span><strong>Last Modified:</strong> {new Date(document.metadata['last-modified']).toLocaleDateString()}</span>
                )}
              </div>
            </div>

            {/* Metrics cards row */}
            <div className="overview-metrics-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              <div className="metric-card" style={metricCardStyle}>
                <span className="metric-value" style={{ fontSize: '32px', fontWeight: '800', color: 'var(--color-primary)' }}>
                  {mode === 'catalog' ? (document.groups?.length || 0) : (resolvedCatalog?.groups?.length || 0)}
                </span>
                <span className="metric-label" style={metricLabelStyle}>Control Families</span>
              </div>
              <div className="metric-card" style={metricCardStyle}>
                <span className="metric-value" style={{ fontSize: '32px', fontWeight: '800', color: 'var(--color-text)' }}>
                  {stats.total}
                </span>
                <span className="metric-label" style={metricLabelStyle}>Total Controls</span>
              </div>
              <div className="metric-card" style={metricCardStyle}>
                <span className="metric-value" style={{ fontSize: '32px', fontWeight: '800', color: 'var(--color-accent)' }}>
                  {stats.active}
                </span>
                <span className="metric-label" style={metricLabelStyle}>Active Controls</span>
              </div>
              <div className="metric-card" style={metricCardStyle}>
                <span className="metric-value" style={{ fontSize: '32px', fontWeight: '800', color: 'var(--color-text-muted)' }}>
                  {stats.withdrawn}
                </span>
                <span className="metric-label" style={metricLabelStyle}>Withdrawn</span>
              </div>
              <div className="metric-card" style={metricCardStyle}>
                <span className="metric-value" style={{ fontSize: '32px', fontWeight: '800', color: 'var(--color-text)' }}>
                  {document['back-matter']?.resources?.length || 0}
                </span>
                <span className="metric-label" style={metricLabelStyle}>Back Matter Resources</span>
              </div>
            </div>

            {/* Control families list */}
            <div style={{ marginTop: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                Control Families
              </h3>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', overflow: 'hidden' }}>
                {((mode === 'catalog' ? document.groups : resolvedCatalog?.groups) || []).length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '13px' }}>
                    No control families defined.
                  </div>
                ) : (
                  ((mode === 'catalog' ? document.groups : resolvedCatalog?.groups) || []).map((group, idx) => {
                    const count = countControlsInGroup(group);
                    return (
                      <div 
                        key={group.id} 
                        onClick={() => onSelectGroup?.(group.id)}
                        className="sidebar-item-like"
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '16px 20px', 
                          cursor: onSelectGroup ? 'pointer' : 'default',
                          borderBottom: idx < ((mode === 'catalog' ? document.groups : resolvedCatalog?.groups) || []).length - 1 ? '1px solid var(--color-border)' : 'none',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '16px' }}>📁</span>
                          <strong style={{ fontSize: '14px', color: 'var(--color-text)' }}>
                            {group.title || group.id}
                          </strong>
                        </div>
                        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                          {count} {count === 1 ? 'control' : 'controls'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        )}

        {/* Profile: Import Sources Tab */}
        {currentTab === 'imports' && mode === 'profile' && SourcesPanel && (
          <SourcesPanel
            profile={document}
            onChange={onChange}
            isEditing={isEditing}
            availableCatalogs={availableCatalogs}
            availableProfiles={availableProfiles}
            catalogCache={catalogCache}
            resolvedCatalog={resolvedCatalog}
          />
        )}

        {/* Metadata Tab */}
        {currentTab === 'metadata' && (
          <div style={{ padding: '20px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* ── Profile: Baseline Summary Box ── */}
            {mode === 'profile' && baselineStats && (
              <div style={{
                border: '1px solid var(--color-border-subtle)',
                background: 'var(--color-surface-2)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-text)' }}>
                  📋 Baseline Statistics
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <div className="badge" style={badgeStyle}>
                    <span style={badgeLabelStyle}>Controls</span>
                    <strong style={{ fontSize: '13px', color: 'var(--color-primary)' }}>{baselineStats.controlsCount}</strong>
                  </div>
                  <div className="badge" style={badgeStyle}>
                    <span style={badgeLabelStyle}>Groups</span>
                    <strong style={{ fontSize: '13px', color: 'var(--color-primary)' }}>{baselineStats.groupsCount}</strong>
                  </div>
                  <div className="badge" style={badgeStyle}>
                    <span style={badgeLabelStyle}>Merge</span>
                    <strong style={{ fontSize: '13px', color: 'var(--color-text)' }}>{baselineStats.mergeMode}</strong>
                  </div>
                  <div className="badge" style={badgeStyle}>
                    <span style={badgeLabelStyle}>Params</span>
                    <strong style={{ fontSize: '13px', color: 'var(--color-accent, var(--color-text))' }}>{baselineStats.paramsCount}</strong>
                  </div>
                  <div className="badge" style={badgeStyle}>
                    <span style={badgeLabelStyle}>Alters</span>
                    <strong style={{ fontSize: '13px', color: 'var(--color-accent, var(--color-text))' }}>{baselineStats.altersCount}</strong>
                  </div>
                </div>
              </div>
            )}

            <MetadataEditor
              metadata={document.metadata || {}}
              onChange={handleMetadataChange}
              readOnly={!isEditing}
            />
          </div>
        )}

        {/* Properties Tab */}
        {currentTab === 'properties' && (
          <div style={{ padding: '20px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Concept Explanation Card */}
            <div style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
                <span style={{ fontSize: '18px' }}>💡</span>
                <strong style={{ fontSize: '14px' }}>Central Property Hub</strong>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0, lineHeight: '1.5' }}>
                This dashboard displays all unique properties defined across the entire OSCAL document (including metadata header, groups, controls, sub-controls, parts, parameters, and resources).
              </p>
              <ul style={{ fontSize: '13px', color: 'var(--color-text)', margin: 0, paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li><strong>Document Properties Directory:</strong> Displays all unique property keys defined in the document (including header metadata and tree elements).</li>
                <li><strong>Global Rename:</strong> Editing a property name here immediately renames it everywhere across the entire document.</li>
                <li><strong>Unassigned Properties:</strong> Properties defined in <code>metadata.props</code> not yet assigned to any tree element are marked with a ⚠️ unused badge on the right side.</li>
                <li><strong>Global Delete:</strong> Deleting a property here removes it from the metadata header and all tree elements.</li>
              </ul>
            </div>
            
            {/* Properties Overview Metrics */}
            <div className="overview-metrics-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              <div className="metric-card" style={{ ...metricCardStyle, padding: '12px 16px', minWidth: '120px', flex: 1 }}>
                <span className="metric-value" style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-primary)' }}>
                  {propertyStats.declaredCount}
                </span>
                <span className="metric-label" style={{ ...metricLabelStyle, fontSize: '10px' }}>Global Header Properties</span>
              </div>
              <div className="metric-card" style={{ ...metricCardStyle, padding: '12px 16px', minWidth: '120px', flex: 1 }}>
                <span className="metric-value" style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-text)' }}>
                  {propertyStats.elementCount}
                </span>
                <span className="metric-label" style={{ ...metricLabelStyle, fontSize: '10px' }}>Element Properties</span>
              </div>
              <div className="metric-card" style={{ ...metricCardStyle, padding: '12px 16px', minWidth: '120px', flex: 1 }}>
                <span className="metric-value" style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-text-muted)' }}>
                  {propertyStats.uniqueKeys}
                </span>
                <span className="metric-label" style={{ ...metricLabelStyle, fontSize: '10px' }}>Unique Keys</span>
              </div>
              <div className="metric-card" style={{ ...metricCardStyle, padding: '12px 16px', minWidth: '120px', flex: 1 }}>
                <span className="metric-value" style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-accent)' }}>
                  {propertyStats.totalAssignments}
                </span>
                <span className="metric-label" style={{ ...metricLabelStyle, fontSize: '10px' }}>Total Assignments</span>
              </div>
            </div>
            
            {/* Properties List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>
                Document-Wide Property Directory
              </span>
              
              {Object.keys(getUnifiedProperties()).length === 0 ? (
                <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '12px' }}>No properties found.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {Object.entries(getUnifiedProperties()).map(([propName, propData]) => (
                    <div
                      key={propName}
                      className="card"
                      style={{
                        background: 'var(--color-surface-2)',
                        border: '1px solid var(--color-border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}
                    >
                      {/* Header line: Property Name & Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                        {/* Left side: Identity (Name + Type Badge) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          {isEditing ? (
                            <DebouncedInput
                              value={propName}
                              onChange={(newName) => {
                                if (newName && newName !== propName) {
                                  onGlobalPropertyRename?.(propName, newName);
                                }
                              }}
                              placeholder="Property name"
                              className="form-input form-input-plain"
                              style={{ fontWeight: 'bold', fontSize: '14px', width: '200px', borderBottom: '1px dashed var(--color-border)' }}
                            />
                          ) : (
                            <strong style={{ fontSize: '14px', color: 'var(--color-text)' }}>{propName}</strong>
                          )}

                          {propData.isMetadata ? (
                            <span
                              className="badge"
                              title="Saved in metadata.props (document header). Editable inline here in edit mode or renamed/deleted globally."
                              style={{ background: 'var(--color-primary-subtle, rgba(99,102,241,0.15))', color: 'var(--color-primary)', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: '500', cursor: 'help' }}
                            >
                              🏷️ Header Property
                            </span>
                          ) : (
                            <span
                              className="badge"
                              title="Assigned directly to elements in the document tree (controls, groups, parts). Editable on the tree element, or renamed/deleted globally here."
                              style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-border-subtle)', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', color: 'var(--color-text-muted)', cursor: 'help' }}
                            >
                              🏷️ Property
                            </span>
                          )}
                        </div>

                        {/* Right side: Status & Action (Usage badge / Unused + Delete button) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {propData.totalCount > 0 ? (
                            <span className="badge" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', color: 'var(--color-text)' }}>
                              {propData.totalCount}x in tree
                            </span>
                          ) : (
                            <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-warning)', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              ⚠️ unused
                            </span>
                          )}

                          {isEditing && (
                            <button
                              type="button"
                              className="btn-soft"
                              onClick={() => {
                                const confirmed = window.confirm(
                                  propData.totalCount > 0
                                    ? `Are you sure you want to remove the property name "${propName}" and all its ${propData.totalCount} occurrences across the entire document?`
                                    : `Are you sure you want to delete the unused property "${propName}"?`
                                );
                                if (confirmed) {
                                  onGlobalPropertyDelete?.(propName);
                                }
                              }}
                              title="Delete globally"
                              style={{ padding: '4px 8px', fontSize: '11px', color: '#ff4d4f', borderColor: 'rgba(255, 77, 79, 0.2)' }}
                            >
                              🗑 Delete
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Values List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* 1. Header Value & OSCAL Property Attributes (if defined in metadata.props) */}
                        {propData.isMetadata && propData.metaDetails && propData.metaDetails.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {propData.metaDetails.map((detail, idx) => (
                              <div key={idx} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>Header Value:</span>
                                {isEditing ? (
                                  <>
                                    <DebouncedInput
                                      value={detail.value || ''}
                                      onChange={(newVal) => handleUpdateMetaProp(propName, idx, 'value', newVal)}
                                      placeholder="Value"
                                      className="form-input form-input-plain"
                                      style={{ fontWeight: 'bold', fontSize: '13px', width: '220px', borderBottom: '1px dashed var(--color-border)' }}
                                    />
                                    <DebouncedInput
                                      value={detail.ns || ''}
                                      onChange={(newNs) => handleUpdateMetaProp(propName, idx, 'ns', newNs)}
                                      placeholder="ns (e.g. http://...)"
                                      className="form-input form-input-plain"
                                      style={{ fontSize: '11px', width: '220px', fontStyle: 'italic', borderBottom: '1px dashed var(--color-border)' }}
                                    />
                                    <DebouncedInput
                                      value={detail.class || ''}
                                      onChange={(newClass) => handleUpdateMetaProp(propName, idx, 'class', newClass)}
                                      placeholder="class"
                                      className="form-input form-input-plain"
                                      style={{ fontSize: '11px', width: '120px', borderBottom: '1px dashed var(--color-border)' }}
                                    />
                                    <DebouncedInput
                                      value={detail.remarks || ''}
                                      onChange={(newRemarks) => handleUpdateMetaProp(propName, idx, 'remarks', newRemarks)}
                                      placeholder="remarks"
                                      className="form-input form-input-plain"
                                      style={{ fontSize: '11px', flex: 1, minWidth: '150px', borderBottom: '1px dashed var(--color-border)' }}
                                    />
                                  </>
                                ) : (
                                  <>
                                    <span className="badge" style={{ background: 'var(--color-primary-subtle, rgba(99,102,241,0.12))', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '2px 10px', fontSize: '11px', color: 'var(--color-primary)', fontWeight: '600' }}>
                                      {detail.value || '(empty)'}
                                    </span>
                                    {detail.ns && (
                                      <span className="badge" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: '12px', padding: '2px 8px', fontSize: '10px', color: 'var(--color-text-muted)', fontStyle: 'italic' }} title="Property Namespace (ns)">
                                        ns: {detail.ns}
                                      </span>
                                    )}
                                    {detail.class && (
                                      <span className="badge" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: '12px', padding: '2px 8px', fontSize: '10px', color: 'var(--color-text-muted)' }} title="Property Class">
                                        class: {detail.class}
                                      </span>
                                    )}
                                    {detail.group && (
                                      <span className="badge" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: '12px', padding: '2px 8px', fontSize: '10px', color: 'var(--color-text-muted)' }} title="Property Group">
                                        group: {detail.group}
                                      </span>
                                    )}
                                    {detail.uuid && (
                                      <span className="badge" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: '12px', padding: '2px 8px', fontSize: '10px', color: 'var(--color-text-muted)' }} title="Property UUID">
                                        uuid: {detail.uuid}
                                      </span>
                                    )}
                                    {detail.remarks && (
                                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                        ({detail.remarks})
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 2. Tree Usage Values */}
                        {Object.keys(propData.values).length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              {propData.isMetadata ? 'Tree Values:' : 'Values:'}
                            </span>
                            {Object.entries(propData.values).map(([val, count]) => (
                              <span key={val} className="badge" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: '12px', padding: '2px 10px', fontSize: '11px' }}>
                                <span style={{ color: 'var(--color-text)' }}>{val}</span>
                                <span style={{ color: 'var(--color-text-muted)', marginLeft: '4px', fontSize: '9px' }}>({count}x)</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                            Not used in any control/group yet. This property behaves as a phantom suggestion.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isEditing && (
              <button
                type="button"
                className="btn-primary"
                onClick={handleAddNewPropKey}
                title="Add a document-level header property saved in metadata.props"
                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
              >
                ➕ Add Header Property
              </button>
            )}

          </div>
        )}



        {/* Back Matter Tab */}
        {currentTab === 'backmatter' && (
          <div style={{ padding: '20px', overflowY: 'auto', height: '100%' }}>
            <BackMatterEditor
              backMatter={document['back-matter'] || {}}
              onChange={handleBackMatterChange}
              readOnly={!isEditing}
            />
          </div>
        )}

        {/* Parameters Tab */}
        {currentTab === 'parameters' && (
          <div style={{ padding: '20px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Info & Scope Explanation Card */}
            <div style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
                <span style={{ fontSize: '18px' }}>💡</span>
                <strong style={{ fontSize: '14px' }}>
                  {mode === 'catalog' ? 'Parameter Scopes in OSCAL' : 'Profile Parameter Overrides & Scopes'}
                </strong>
              </div>
              
              <p style={{ fontSize: '13px', color: 'var(--color-text)', margin: 0, lineHeight: '1.5' }}>
                {mode === 'catalog'
                  ? 'Parameters are defined across three hierarchical scopes to manage inheritance:'
                  : 'All parameter adjustments, custom values, and profile overrides relative to the source catalog are centrally listed below. Parameters originate from three scopes:'}
              </p>

              <ul style={{ fontSize: '12px', color: 'var(--color-text)', margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li><strong>Global Parameters (Catalog Level):</strong> Catalog-wide defaults available to all groups and controls.</li>
                <li><strong>Group Parameters:</strong> Section-wide defaults available to controls within that group.</li>
                <li><strong>Control Parameters:</strong> Specific parameters declared inside individual controls.</li>
              </ul>
            </div>
            
            {/* Section 1: Parameters Overview Metrics */}
            <div>
              <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                📊 Parameter Counts by Baseline Scope
              </h3>
              <div className="overview-metrics-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                <div className="metric-card" style={{ ...metricCardStyle, padding: '12px 16px', minWidth: '120px', flex: 1 }}>
                  <span className="metric-value" style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-primary)' }}>
                    {paramStats.globalCount}
                  </span>
                  <span className="metric-label" style={{ ...metricLabelStyle, fontSize: '10px' }}>Global Parameters</span>
                </div>
                <div className="metric-card" style={{ ...metricCardStyle, padding: '12px 16px', minWidth: '120px', flex: 1 }}>
                  <span className="metric-value" style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-text)' }}>
                    {paramStats.groupCount}
                  </span>
                  <span className="metric-label" style={{ ...metricLabelStyle, fontSize: '10px' }}>Group Parameters</span>
                </div>
                <div className="metric-card" style={{ ...metricCardStyle, padding: '12px 16px', minWidth: '120px', flex: 1 }}>
                  <span className="metric-value" style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-accent)' }}>
                    {paramStats.controlCount}
                  </span>
                  <span className="metric-label" style={{ ...metricLabelStyle, fontSize: '10px' }}>Control Parameters</span>
                </div>
              </div>
            </div>
            
            {/* Section 2: Parameters Editor List */}
            <div 
              style={{ 
                background: 'var(--color-surface)', 
                border: '1px solid var(--color-border)', 
                borderRadius: 'var(--radius-lg)', 
                padding: '24px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '16px' 
              }}
            >
              <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {mode === 'catalog' ? '⚙️ Global Catalog Parameters' : '⚙️ Modified & Custom Profile Parameters'}
              </h3>
              <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px', marginTop: '4px' }}>
                {mode === 'catalog' ? (
                  <ParameterEditor
                    params={document.params || []}
                    onChange={(updatedParams) => onChange({ ...document, params: updatedParams })}
                    readOnly={!isEditing}
                    fullDocument={document}
                  />
                ) : (
                  <ParameterEditor
                    mode="profile"
                    params={document.modify?.['set-parameters'] || []}
                    catalogParams={allResolvedCatalogParams}
                    onChange={(updatedSetParams) => {
                      const modify = document.modify ? { ...document.modify } : {};
                      modify['set-parameters'] = updatedSetParams;
                      onChange({ ...document, modify });
                    }}
                    readOnly={!isEditing}
                    fullDocument={document}
                    catalogDocument={resolvedCatalog}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Catalog: Import Source Tab */}
        {currentTab === 'import' && mode === 'catalog' && isEditing && (
          <div style={{ padding: '20px', overflowY: 'auto', height: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px' }}>Import Catalog Content</h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                You can load the catalog content from a template or a JSON URL. This overrides the current content, but keeps the UUID.
              </p>

              {importError && (
                <div style={{ color: 'var(--color-danger)', background: 'rgba(248,81,73,0.1)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(248,81,73,0.3)', fontSize: '12px' }}>
                  ⚠️ {importError}
                </div>
              )}

              {/* URL Import */}
              <div style={{ border: '1px solid var(--color-border-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <strong style={{ fontSize: '13px' }}>Import from URL</strong>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    placeholder="https://example.com/catalog.json"
                    className="form-input"
                    style={{ flex: 1, height: '32px', fontSize: '12px' }}
                    disabled={importing}
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleImportUrl}
                    disabled={importing || !importUrl.trim()}
                    style={{ padding: '0 12px', fontSize: '12px' }}
                  >
                    {importing ? 'Importing...' : 'Load'}
                  </button>
                </div>
              </div>

              {/* Registry Templates */}
              <div style={{ border: '1px solid var(--color-border-subtle)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                <strong style={{ fontSize: '13px', display: 'block', marginBottom: '10px' }}>Import from Template Library</strong>
                {loadingRegistry ? (
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Loading templates...</span>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {registryTemplates.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          padding: '10px',
                          background: 'var(--color-surface-2)',
                          border: '1px solid var(--color-border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '12px', display: 'block' }}>{t.title}</strong>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Source: {t.source}</span>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleImportRegistry(t.id)}
                          disabled={importing}
                          style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}
                        >
                          Apply content
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>

    </div>
  );
}
