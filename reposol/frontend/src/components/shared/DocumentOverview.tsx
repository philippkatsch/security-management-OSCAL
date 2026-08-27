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
import { SourcesPanel as DefaultSourcesPanel } from '../profile/SourcesPanel';
import ImportWizard from '../document/ImportWizard';
import styles from './SharedComponents.module.css';

export const countControlsInGroup = (group: any) => {
  let count = 0;
  const traverse = (item: any) => {
    count++;
    if (item.controls) item.controls.forEach(traverse);
  };
  if (group.controls) group.controls.forEach(traverse);
  const traverseGroup = (g: any) => {
    if (g.controls) g.controls.forEach(traverse);
    if (g.groups) g.groups.forEach(traverseGroup);
  };
  if (group.groups) group.groups.forEach(traverseGroup);
  return count;
};

const countControls = (groups: any[] = [], controls: any[] = []) => {
  let total = 0;
  let active = 0;
  let withdrawn = 0;

  const traverseControl = (control: any) => {
    total++;
    const isWithdrawn = (control.props || []).some(
      (p: any) => p.name?.toLowerCase() === 'status' && p.value?.toLowerCase() === 'withdrawn'
    );
    if (isWithdrawn) withdrawn++; else active++;
    if (control.controls) control.controls.forEach(traverseControl);
  };

  const traverseGroup = (group: any) => {
    if (group.controls) group.controls.forEach(traverseControl);
    if (group.groups) group.groups.forEach(traverseGroup);
  };

  controls.forEach(traverseControl);
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
  conflicts = null,
  SourcesPanel = null,
  onNavigateToProperties
}: any) {
  const document = rawDocument?.catalog || rawDocument?.profile || rawDocument?.['component-definition'] || rawDocument?.['system-security-plan'] || rawDocument?.['assessment-plan'] || rawDocument?.['assessment-results'] || rawDocument?.['plan-of-action-and-milestones'] || rawDocument || {};
  const globalEditMode = useAtomValue(editModeAtom);
  const isEditingState = isEditing !== undefined ? isEditing : globalEditMode;
  const ActiveSourcesPanel = SourcesPanel || DefaultSourcesPanel;

  const [activeTab, setActiveTab] = useState('metadata');
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [registryTemplates, setRegistryTemplates] = useState<any[]>([]);
  const [loadingRegistry, setLoadingRegistry] = useState(false);

  const effectiveTab = activeTab;

  const handleMetadataChange = (updatedMetadata: any) => onChange({ ...document, metadata: updatedMetadata });
  const handleBackMatterChange = (updatedBackMatter: any) => onChange({ ...document, 'back-matter': updatedBackMatter });

  const globalProps = document.metadata?.props || [];

  const getUnifiedProperties = () => {
    const properties: Record<string, any> = {};

    globalProps.forEach((p: any) => {
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

    Object.entries((usedTagsSummary || {}) as Record<string, any>).forEach(([name, valMap]) => {
      const totalCount = Object.values(valMap || {}).reduce((sum: number, c: any) => sum + Number(c || 0), 0);
      const safeValMap = (typeof valMap === 'object' && valMap !== null) ? valMap : {};
      if (!properties[name]) {
        properties[name] = { values: { ...safeValMap }, metaValues: [], metaDetails: [], isMetadata: false, isUsed: true, totalCount };
      } else {
        properties[name].isUsed = true;
        properties[name].totalCount = totalCount;
        properties[name].values = { ...(properties[name].values || {}), ...safeValMap };
      }
    });

    return properties;
  };

  const handleUpdateMetaProp = (propName: string, metaIdx: number, field: string, newValue: any) => {
    const metaProps = document.metadata?.props || [];
    let count = 0;
    const updatedProps = metaProps.map((p: any) => {
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
    } catch (err: any) {
      setImportError(`Import failed: ${err?.message || 'Error'}`);
    } finally {
      setImporting(false);
    }
  };

  const handleImportRegistry = (sourceId: string) => performImport(importFromRegistry(sourceId));
  const handleImportUrl = () => { if (importUrl.trim()) performImport(importFromUrl(importUrl.trim())); };

  const baselineStats = (() => {
    if (mode !== 'profile' || !resolvedCatalog) return null;
    let c = 0, g = 0;
    const traverse = (items: any[], isGroup: boolean) => {
      if (!Array.isArray(items)) return;
      items.forEach((item: any) => {
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

    const countControlParams = (control: any) => {
      if (control.params) controlCount += control.params.length;
      if (control.controls) control.controls.forEach(countControlParams);
    };

    const countGroupParams = (group: any) => {
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
    const list: any[] = [];
    if (resolvedCatalog.params) resolvedCatalog.params.forEach((p: any) => list.push({ ...p, scope: 'catalog' }));
    const traverseControl = (c: any, isSub = false) => {
      if (c.params) c.params.forEach((p: any) => list.push({ ...p, scope: 'control', isSubcontrol: isSub }));
      if (c.controls) c.controls.forEach((childC: any) => traverseControl(childC, true));
    };
    const traverseGroup = (g: any) => {
      if (g.params) g.params.forEach((p: any) => list.push({ ...p, scope: 'group' }));
      if (g.controls) g.controls.forEach((c: any) => traverseControl(c, false));
      if (g.groups) g.groups.forEach(traverseGroup);
    };
    if (resolvedCatalog.controls) resolvedCatalog.controls.forEach((c: any) => traverseControl(c, false));
    if (resolvedCatalog.groups) resolvedCatalog.groups.forEach(traverseGroup);
    return list;
  })();

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'hidden', height: '100%' }}>
        {currentTab === 'overview' && mode === 'catalog' && <CatalogOverviewPanel document={document} stats={stats} onSelectGroup={onSelectGroup} />}
        {currentTab === 'overview' && mode === 'profile' && <ProfileOverviewPanel document={document} resolvedCatalog={resolvedCatalog} stats={stats} onSelectGroup={onSelectGroup} />}
        {currentTab === 'imports' && mode === 'profile' && (
          <ActiveSourcesPanel profile={document} onChange={onChange} isEditing={isEditingState} isEditingState={isEditingState} availableCatalogs={availableCatalogs} availableProfiles={availableProfiles} conflicts={conflicts} resolvedCatalog={resolvedCatalog} />
        )}
        {currentTab === 'metadata' && <DocumentOverviewMetadata mode={mode} document={document} isEditingState={isEditingState} baselineStats={baselineStats} onChange={onChange} onNavigateToProperties={onNavigateToProperties || (() => setActiveTab('properties'))} />}
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
          <div style={{ padding: '24px', overflowY: 'auto', height: '100%' }}>
            <ImportWizard
              stage="catalogs"
              embedded={true}
              currentDocument={document}
              title="📥 Import Catalog Content"
              subtitle="Load and apply catalog content from standard templates, remote URLs, or local files (JSON, YAML, XML). Your catalog UUID and document settings will be preserved."
              onApplyContent={(importedCatalog) => {
                onChange({
                  ...importedCatalog,
                  uuid: document.uuid,
                  metadata: {
                    ...importedCatalog.metadata,
                    title: document.metadata?.title || importedCatalog.metadata?.title,
                    version: document.metadata?.version || importedCatalog.metadata?.version || '1.0.0',
                  }
                });
                setActiveTab('overview');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
