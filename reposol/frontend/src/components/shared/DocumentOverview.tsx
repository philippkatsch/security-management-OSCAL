import React, { useState } from 'react';
import { useAtomValue } from 'jotai';
import { editModeAtom } from '@stores/uiAtoms';
import { BackMatterEditor } from './BackMatterEditor';
import { importFromRegistry, importFromUrl, fetchRegistry, fetchDocument } from '@lib/api';
import { CatalogOverviewPanel } from './overview/CatalogOverviewPanel';
import { ProfileOverviewPanel } from './overview/ProfileOverviewPanel';
import { DocumentOverviewMetadata } from './overview/DocumentOverviewMetadata';
import { DocumentOverviewProperties } from './overview/DocumentOverviewProperties';
import { DocumentOverviewParameters } from './overview/DocumentOverviewParameters';
import styles from './SharedComponents.module.css';

export const countControlsInGroup = (group) => {
  let count = 0;
  const traverse = (item) => {
    count++;
    if (item.controls) item.controls.forEach(traverse);
  };
  if (group.controls) group.controls.forEach(traverse);
  const traverseGroup = (g) => {
    if (g.controls) g.controls.forEach(traverse);
    if (g.groups) g.groups.forEach(traverseGroup);
  };
  if (group.groups) group.groups.forEach(traverseGroup);
  return count;
};

const countControls = (groups = [], controls = []) => {
  let total = 0;
  let active = 0;
  let withdrawn = 0;

  const traverseControl = (control) => {
    total++;
    const isWithdrawn = (control.props || []).some(
      p => p.name?.toLowerCase() === 'status' && p.value?.toLowerCase() === 'withdrawn'
    );
    if (isWithdrawn) withdrawn++; else active++;
    if (control.controls) control.controls.forEach(traverseControl);
  };

  controls.forEach(traverseControl);

  const traverseGroup = (group) => {
    if (group.controls) group.controls.forEach(traverseControl);
    if (group.groups) group.groups.forEach(traverseGroup);
  };

  groups.forEach(traverseGroup);
  return { total, active, withdrawn };
};

export function DocumentOverview({
  document: rawDocument = {},
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
  resolvedCatalog = null,
  availableCatalogs = [],
  availableProfiles = [],
  catalogCache = null,
  SourcesPanel = null
}) {
  const document = rawDocument || {};
  const globalEditMode = useAtomValue(editModeAtom);
  const isEditingState = isEditing !== undefined ? isEditing : globalEditMode;

  const [activeTab, setActiveTab] = useState('metadata');
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [registryTemplates, setRegistryTemplates] = useState([]);
  const [loadingRegistry, setLoadingRegistry] = useState(false);

  const effectiveTab = (activeTab === 'imports' && !isEditingState) ? 'metadata' : activeTab;

  const handleMetadataChange = (updatedMetadata) => onChange({ ...document, metadata: updatedMetadata });
  const handleBackMatterChange = (updatedBackMatter) => onChange({ ...document, 'back-matter': updatedBackMatter });

  const globalProps = document.metadata?.props || [];

  const getUnifiedProperties = () => {
    const properties = {};
    const metaProps = document.metadata?.props || [];
    metaProps.forEach(p => {
      if (!p.name) return;
      if (!properties[p.name]) {
        properties[p.name] = { values: {}, metaValues: [], metaDetails: [], isMetadata: true, isUsed: false, totalCount: 0 };
      } else {
        properties[p.name].isMetadata = true;
      }
      if (p.value !== undefined && p.value !== '' && !properties[p.name].metaValues.includes(p.value)) {
        properties[p.name].metaValues.push(p.value);
      }
      properties[p.name].metaDetails.push({
        value: p.value, ns: p.ns, class: p.class, group: p.group, uuid: p.uuid, remarks: p.remarks
      });
    });

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

  const handleOpenImportTab = async () => {
    setActiveTab('import');
    setLoadingRegistry(true);
    setImportError('');
    try {
      const registry = await fetchRegistry();
      setRegistryTemplates(registry.filter(r => r.model === 'catalog'));
    } catch (err) {
      setImportError('Registry could not be loaded.');
    } finally {
      setLoadingRegistry(false);
    }
  };

  const performImport = async (importPromise) => {
    setImporting(true);
    setImportError('');
    try {
      const imported = await importPromise;
      const fullDoc = await fetchDocument(imported.stage, imported.uuid);
      onChange({ ...fullDoc.catalog, uuid: document.uuid, metadata: document.metadata });
      setActiveTab('metadata');
    } catch (err) {
      setImportError(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleImportRegistry = (sourceId) => performImport(importFromRegistry(sourceId));
  const handleImportUrl = () => { if (importUrl.trim()) performImport(importFromUrl(importUrl.trim())); };

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

    const mergeMode = document.merge ? (document.merge['as-is'] !== undefined ? 'As-Is' : document.merge.flat !== undefined ? 'Flat' : document.merge.custom !== undefined ? 'Custom' : 'As-Is') : 'As-Is (Default)';

    return { controlsCount: c, groupsCount: g, mergeMode, paramsCount: document.modify?.['set-parameters']?.length || 0, altersCount: document.modify?.alters?.length || 0 };
  })();

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
      if (control.params) controlCount += control.params.length;
      if (control.controls) control.controls.forEach(countControlParams);
    };

    const countGroupParams = (group) => {
      if (group.params) groupCount += group.params.length;
      if (group.controls) group.controls.forEach(countControlParams);
      if (group.groups) group.groups.forEach(countGroupParams);
    };

    if (targetDoc.groups) targetDoc.groups.forEach(countGroupParams);
    if (targetDoc.controls) targetDoc.controls.forEach(countControlParams);

    return { globalCount, groupCount, controlCount };
  })();

  const allResolvedCatalogParams = (() => {
    if (!resolvedCatalog) return [];
    const list = [];
    if (resolvedCatalog.params) resolvedCatalog.params.forEach(p => list.push({ ...p, scope: 'catalog' }));
    const traverseControl = (c, isSub = false) => {
      if (c.params) c.params.forEach(p => list.push({ ...p, scope: 'control', isSubcontrol: isSub }));
      if (c.controls) c.controls.forEach(childC => traverseControl(childC, true));
    };
    const traverseGroup = (g) => {
      if (g.params) g.params.forEach(p => list.push({ ...p, scope: 'group' }));
      if (g.controls) g.controls.forEach(c => traverseControl(c, false));
      if (g.groups) g.groups.forEach(traverseGroup);
    };
    if (resolvedCatalog.controls) resolvedCatalog.controls.forEach(c => traverseControl(c, false));
    if (resolvedCatalog.groups) resolvedCatalog.groups.forEach(traverseGroup);
    return list;
  })();

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'hidden', height: '100%' }}>
        {currentTab === 'overview' && mode === 'catalog' && <CatalogOverviewPanel document={document} stats={stats} onSelectGroup={onSelectGroup} />}
        {currentTab === 'overview' && mode === 'profile' && <ProfileOverviewPanel document={document} resolvedCatalog={resolvedCatalog} stats={stats} onSelectGroup={onSelectGroup} />}
        {currentTab === 'imports' && mode === 'profile' && SourcesPanel && (
          <SourcesPanel profile={document} onChange={onChange} isEditingState={isEditingState} availableCatalogs={availableCatalogs} availableProfiles={availableProfiles} catalogCache={catalogCache} resolvedCatalog={resolvedCatalog} />
        )}
        {currentTab === 'metadata' && <DocumentOverviewMetadata mode={mode} document={document} isEditingState={isEditingState} baselineStats={baselineStats} onChange={onChange} />}
        {currentTab === 'properties' && (
          <DocumentOverviewProperties properties={getUnifiedProperties()} globalProps={globalProps} isEditingState={isEditingState} onGlobalPropertyRename={onGlobalPropertyRename} onGlobalPropertyDelete={onGlobalPropertyDelete} onAddProperty={handleAddNewPropKey} onUpdateMetaProp={handleUpdateMetaProp} />
        )}
        {currentTab === 'backmatter' && (
          <div style={{ padding: '20px', overflowY: 'auto', height: '100%' }}>
            <BackMatterEditor backMatter={document['back-matter'] || {}} onChange={handleBackMatterChange} readOnly={!isEditingState} />
          </div>
        )}
        {currentTab === 'parameters' && (
          <DocumentOverviewParameters mode={mode} document={document} paramStats={paramStats} allResolvedCatalogParams={allResolvedCatalogParams} isEditingState={isEditingState} resolvedCatalog={resolvedCatalog} onChange={onChange} />
        )}
        {currentTab === 'import' && mode === 'catalog' && isEditingState && (
          <div style={{ padding: '20px', overflowY: 'auto', height: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px' }}>Import Catalog Content</h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                You can load the catalog content from a template or a JSON URL. This overrides the current content, but keeps the UUID.
              </p>
              {importError && (
                <div style={{ color: 'var(--color-danger)', background: 'rgba(248,81,73,0.1)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(248,81,73,0.3)', fontSize: '12px' }}>⚠️ {importError}</div>
              )}
              <div style={{ border: '1px solid var(--color-border-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <strong style={{ fontSize: '13px' }}>Import from URL</strong>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://example.com/catalog.json" className="form-input" style={{ flex: 1, height: '32px', fontSize: '12px' }} disabled={importing} />
                  <button type="button" className={styles['btn-primary']} onClick={handleImportUrl} disabled={importing || !importUrl.trim()} style={{ padding: '0 12px', fontSize: '12px' }}>{importing ? 'Importing...' : 'Load'}</button>
                </div>
              </div>
              <div style={{ border: '1px solid var(--color-border-subtle)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                <strong style={{ fontSize: '13px', display: 'block', marginBottom: '10px' }}>Import from Template Library</strong>
                {loadingRegistry ? (
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Loading templates...</span>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {registryTemplates.map((t) => (
                      <div key={t.id} style={{ padding: '10px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '8px' }}>
                        <div>
                          <strong style={{ fontSize: '12px', display: 'block' }}>{t.title}</strong>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Source: {t.source}</span>
                        </div>
                        <button type="button" className={styles['btn-secondary']} onClick={() => handleImportRegistry(t.id)} disabled={importing} style={{ padding: '4px 8px', fontSize: '11px', width: '100%' }}>Apply content</button>
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
