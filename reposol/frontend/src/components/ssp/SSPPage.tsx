import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useDocumentLifecycle } from '@hooks/useDocumentLifecycle';
import { useDocumentActions } from '@hooks/useDocumentActions';
import {
  initializeSSPComponents,
  updateSSPField,
  updateSSPListItem,
  replaceSSP,
  setImportProfile,
  updateSystemComponent,
  updateSystemUser,
  updateInventoryItem,
  updateLeveragedAuthorization
} from '@lib/document-actions';
import { DocumentPageLayout } from '../layout/DocumentPageLayout';
import EntityDetailPanel from '@components/shared/entity/EntityDetailPanel';
import MetricCard from '@components/shared/dashboard/MetricCard';
import MetricCardGrid from '@components/shared/dashboard/MetricCardGrid';
import StatusBadge from '@components/shared/status/StatusBadge';
import StatusBreakdown from '@components/shared/dashboard/StatusBreakdown';
import { JsonEditor } from '@components/shared/JsonEditor';
import { StandardMetadataTab } from '@components/shared/tabs/StandardMetadataTab';
import { PropsEditor } from '@components/shared/PropsEditor';

import { UnifiedControlEditor } from '@components/shared/control-editor/UnifiedControlEditor';
import { SystemCharacteristicsTab } from './SystemCharacteristicsTab';
import { SystemImplementationTab } from './SystemImplementationTab';
import { ControlImplementationTab } from './ControlImplementationTab';
import { useControlTree } from '@hooks/useControlTree';
import { ControlTree } from '@components/shared/control-tree';
import { apiClient } from '@lib/api-client';
import { LoadingSpinner } from '@components/shared/ui/LoadingSpinner';

interface WorkspaceDoc {
  stage: 'catalogs' | 'profiles';
  uuid: string;
  title: string;
  version?: string;
  lastModified?: string;
  oscalVersion?: string;
}

export function SSPPage({ sspId, initialEditMode = false, onClose }: any) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemType, setItemType] = useState<any>(null);
  const jsonEditorRef = useRef<any>(null);
  const hasInitializedComponent = useRef(false);

  // Baseline resolution state
  const [catalog, setCatalog] = useState<any>({ groups: [], controls: [] });
  const [resolvedBaselineMeta, setResolvedBaselineMeta] = useState<any>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [editingProfileHref, setEditingProfileHref] = useState(false);
  const [profileHrefVal, setProfileHrefVal] = useState('');

  // Workspace Document Browser Modal state
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [browserTab, setBrowserTab] = useState<'all' | 'profiles' | 'catalogs' | 'custom'>('all');
  const [browserSearchQuery, setBrowserSearchQuery] = useState('');
  const [customUriInput, setCustomUriInput] = useState('');
  const [workspaceProfiles, setWorkspaceProfiles] = useState<WorkspaceDoc[]>([]);
  const [workspaceCatalogs, setWorkspaceCatalogs] = useState<WorkspaceDoc[]>([]);
  const [loadingWorkspaceDocs, setLoadingWorkspaceDocs] = useState(false);

  const lifecycle = useDocumentLifecycle('ssps', 'system-security-plan', sspId, initialEditMode);
  const { doc, setDoc, loading, error, isEditing, pushUndoRedoState } = lifecycle;
  const { dispatch } = useDocumentActions(lifecycle);

  const handleUpdate = (newDoc: any) => {
    pushUndoRedoState(newDoc);
    setDoc(newDoc);
  };

  const ssp = doc ? doc['system-security-plan'] : null;
  const sysChar = ssp ? (ssp['system-characteristics'] || {}) : {};
  const sysImp = ssp ? (ssp['system-implementation'] || {}) : {};
  const ctrlImp = ssp?.['control-implementation'] || { description: '', 'implemented-requirements': [] };

  // 1. Auto-initialize 'this-system' root component if missing
  useEffect(() => {
    if (doc && doc['system-security-plan'] && !hasInitializedComponent.current) {
      const currentSsp = doc['system-security-plan'];
      const currentSysImp = currentSsp['system-implementation'];
      if (!currentSysImp || !currentSysImp.components || currentSysImp.components.length === 0) {
        const sysName = currentSsp['system-characteristics']?.['system-name'] || 'New System';
        dispatch(initializeSSPComponents(sysName));
      }
      hasInitializedComponent.current = true;
    }
  }, [doc, dispatch]);

  // 2. Baseline Resolution function (POST /api/resolve/ssp/preview or GET /api/resolve/ssp/{id})
  const resolveBaseline = useCallback(async (sspPayload: any) => {
    const href = sspPayload?.['import-profile']?.href;
    if (!href || typeof href !== 'string' || !href.trim()) {
      setCatalog({ groups: [], controls: [] });
      setResolvedBaselineMeta(null);
      return;
    }

    setIsResolving(true);
    try {
      const res = await apiClient('/resolve/ssp/preview', {
        method: 'POST',
        body: JSON.stringify({ 'system-security-plan': sspPayload })
      });
      const data = await res.json();
      if (data && data.control_tree) {
        setCatalog({
          groups: data.control_tree.groups || [],
          controls: data.control_tree.controls || [],
          resolved_parameters: data.parameters
        });
        setResolvedBaselineMeta({
          source_baseline: data.source_baseline,
          implementation_summary: data.implementation_summary,
          parameters: data.parameters
        });
      }
    } catch (err: any) {
      // Fallback: leave catalog as empty or keep previous
      console.warn('Baseline resolution notice:', err?.message || err);
    } finally {
      setIsResolving(false);
    }
  }, []);

  // Fetch resolution whenever ssp['import-profile'].href changes
  const prevHrefRef = useRef<string | null | undefined>(null);
  useEffect(() => {
    const currentHref = ssp?.['import-profile']?.href;
    if (currentHref !== prevHrefRef.current && ssp) {
      prevHrefRef.current = currentHref;
      resolveBaseline(ssp);
    }
  }, [ssp, resolveBaseline]);

  // 3. Fetch Workspace Documents for Document Browser
  const fetchWorkspaceDocuments = useCallback(async () => {
    setLoadingWorkspaceDocs(true);
    try {
      const [profRes, catRes] = await Promise.all([
        apiClient('/documents/profiles').catch(() => null),
        apiClient('/documents/catalogs').catch(() => null)
      ]);

      if (profRes && profRes.ok) {
        const profData = await profRes.json();
        setWorkspaceProfiles(
          (profData || []).map((item: any) => {
            const p = item.profile || item;
            return {
              stage: 'profiles',
              uuid: p.uuid || p.id || item.uuid || item.id,
              title: p.metadata?.title || item.title || 'Untitled Profile',
              version: p.metadata?.version || item.version,
              lastModified: p.metadata?.['last-modified'] || item.last_modified,
              oscalVersion: p.metadata?.['oscal-version'] || item.oscal_version
            };
          })
        );
      }

      if (catRes && catRes.ok) {
        const catData = await catRes.json();
        setWorkspaceCatalogs(
          (catData || []).map((item: any) => {
            const c = item.catalog || item;
            return {
              stage: 'catalogs',
              uuid: c.uuid || c.id || item.uuid || item.id,
              title: c.metadata?.title || item.title || 'Untitled Catalog',
              version: c.metadata?.version || item.version,
              lastModified: c.metadata?.['last-modified'] || item.last_modified,
              oscalVersion: c.metadata?.['oscal-version'] || item.oscal_version
            };
          })
        );
      }
    } catch (e) {
      console.error('Failed to load workspace documents', e);
    } finally {
      setLoadingWorkspaceDocs(false);
    }
  }, []);

  const openDocumentBrowser = () => {
    setCustomUriInput(typeof ssp?.['import-profile']?.href === 'string' ? ssp['import-profile'].href : '');
    fetchWorkspaceDocuments();
    setIsBrowserOpen(true);
  };

  const handleSelectBaselineDoc = (docItem: WorkspaceDoc) => {
    const newHref = `../${docItem.stage}/${docItem.uuid}.json`;
    dispatch(setImportProfile(newHref));
    toast.success(`Selected baseline: ${docItem.title}`);
    setIsBrowserOpen(false);
  };

  const handleApplyCustomUri = () => {
    const trimmed = customUriInput.trim();
    if (trimmed) {
      dispatch(setImportProfile(trimmed));
      toast.success('Updated baseline reference URI');
      setIsBrowserOpen(false);
    }
  };

  const handleUpdateField = (path: any, value: any) => {
    dispatch(updateSSPField(path, value));
  };

  const openDetail = (type: any, item: any) => {
    setItemType(type);
    setSelectedItem(item);
  };

  // 4. Flatten all controls for calculation & tree fallback
  const allResolvedControlsList = useMemo(() => {
    const list: any[] = [];
    const traverseControls = (ctrls: any[]) => {
      for (const c of ctrls) {
        list.push(c);
        if (c.controls) traverseControls(c.controls);
      }
    };
    const traverseGroups = (groups: any[]) => {
      for (const g of groups) {
        if (g.controls) traverseControls(g.controls);
        if (g.groups) traverseGroups(g.groups);
      }
    };
    if (catalog?.controls) traverseControls(catalog.controls);
    if (catalog?.groups) traverseGroups(catalog.groups);
    return list;
  }, [catalog]);

  const totalReqs = (ctrlImp['implemented-requirements'] || []).length;
  const totalBaselineControls = allResolvedControlsList.length || totalReqs;

  let validCount = 0;
  const statusCounts: any = {};

  const implementedControls = (ctrlImp['implemented-requirements'] || []).map((req: any) => {
    const state = req['by-components']?.[0]?.['implementation-status']?.state || 'planned';
    if (['implemented', 'partial'].includes(state)) validCount++;
    statusCounts[state] = (statusCounts[state] || 0) + 1;

    const matchedResolved = allResolvedControlsList.find(
      c => c.id?.toLowerCase() === req['control-id']?.toLowerCase()
    );

    return {
      id: req['control-id'],
      title: matchedResolved?.title || req.description || req['control-id'],
      params: matchedResolved?.params,
      parts: matchedResolved?.parts,
      props: [{ name: 'status', value: state }]
    };
  });

  const coveragePercent =
    totalBaselineControls > 0
      ? Math.round((validCount / totalBaselineControls) * 100)
      : (totalReqs > 0 ? Math.round((validCount / totalReqs) * 100) : 0);

  const handleControlSelect = (id: string | null) => {
    if (id) {
      // 1. Check if an implemented requirement exists for this control
      let req = (ctrlImp['implemented-requirements'] || []).find(
        (r: any) => r['control-id']?.toLowerCase() === id.toLowerCase() || r.uuid === id
      );

      // 2. Find matching control definition in catalog
      const ctrlDef = allResolvedControlsList.find(c => c.id?.toLowerCase() === id.toLowerCase());

      if (!req && ctrlDef) {
        // Construct a virtual item so UnifiedControlEditor and SSPAdapter can initialize it
        req = {
          'control-id': ctrlDef.id,
          title: ctrlDef.title,
          params: ctrlDef.params,
          parts: ctrlDef.parts
        } as any;
      }

      if (req || ctrlDef) {
        openDetail('control', req || { 'control-id': id, title: id });
      }
    }
  };

  const tree = useControlTree({
    groups: catalog.groups && catalog.groups.length > 0 ? catalog.groups : [],
    controls: (catalog.controls && catalog.controls.length > 0) ? catalog.controls : implementedControls,
    onSelect: handleControlSelect
  });

  // Render Overview Tab
  const renderOverview = () => {
    const importHref = typeof ssp?.['import-profile']?.href === 'string' ? ssp['import-profile'].href : '';

    return (
      <div data-testid="ssp-overview-tab" className="overview-tab p-6 space-y-6">
        {/* Referenced Baseline Card */}
        <div data-testid="referenced-profile-card" className="p-5 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Imported Baseline Framework
              </h3>
              {isResolving && (
                <span className="text-[11px] text-blue-600 dark:text-blue-400 animate-pulse font-medium">
                  🔄 Resolving baseline tree...
                </span>
              )}
            </div>
            <div className="text-base font-semibold font-mono text-gray-900 dark:text-gray-100 break-all">
              {importHref || '<No baseline profile or catalog imported>'}
            </div>
            {resolvedBaselineMeta?.source_baseline && (
              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <span>Type: <strong className="uppercase">{resolvedBaselineMeta.source_baseline.type}</strong></span>
                <span>•</span>
                <span>Title: <strong>{resolvedBaselineMeta.source_baseline.title}</strong></span>
                <span>•</span>
                <span>Total Active Controls: <strong>{totalBaselineControls}</strong></span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {isEditing && (
              <>
                {editingProfileHref ? (
                  <div className="flex gap-2 items-center w-full md:w-auto">
                    <input
                      type="text"
                      data-testid="profile-href-input"
                      value={profileHrefVal}
                      onChange={(e) => setProfileHrefVal(e.target.value)}
                      className="form-input text-xs font-mono rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 py-1.5 px-2.5"
                      placeholder="e.g. ../profiles/fedramp-moderate.json"
                    />
                    <button
                      type="button"
                      data-testid="save-profile-href-btn"
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition"
                      onClick={() => {
                        if (profileHrefVal.trim()) {
                          dispatch(setImportProfile(profileHrefVal.trim()));
                          toast.success('Baseline reference updated');
                        }
                        setEditingProfileHref(false);
                      }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
                      onClick={() => setEditingProfileHref(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      data-testid="browse-baseline-btn"
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-100 rounded text-xs font-semibold border border-blue-200 dark:border-blue-800 transition"
                      onClick={openDocumentBrowser}
                    >
                      🔍 Browse Baseline...
                    </button>
                    <button
                      type="button"
                      data-testid="edit-profile-href-btn"
                      className="px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-300 dark:border-gray-600"
                      onClick={() => {
                        setProfileHrefVal(importHref);
                        setEditingProfileHref(true);
                      }}
                    >
                      Edit URI
                    </button>
                  </div>
                )}
              </>
            )}
            {importHref && (
              <button
                type="button"
                data-testid="reresolve-baseline-btn"
                className="px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 whitespace-nowrap"
                onClick={() => resolveBaseline(ssp)}
                title="Re-resolve baseline controls from backend"
              >
                🔄 Re-resolve
              </button>
            )}
          </div>
        </div>

        {/* Executive Metrics */}
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3">System Security Metrics</h2>
          <MetricCardGrid>
            <MetricCard title="Baseline Controls" value={totalBaselineControls} icon="📋" />
            <MetricCard title="Implemented Reqs" value={totalReqs} icon="📝" />
            <MetricCard title="Implementation Coverage" value={`${coveragePercent}%`} icon="✅" />
            <MetricCard title="System Components" value={(sysImp.components || []).length} icon="🧱" />
            <MetricCard title="System Users" value={(sysImp.users || []).length} icon="👥" />
          </MetricCardGrid>
        </div>

        {/* Impact Level and Status Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">
              FIPS-199 Security Impact Objectives (CIA)
            </h3>
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500 font-medium">Confidentiality</span>
                <StatusBadge status={sysChar['security-impact-level']?.['security-objective-confidentiality'] || 'moderate'} category="fips-impact" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500 font-medium">Integrity</span>
                <StatusBadge status={sysChar['security-impact-level']?.['security-objective-integrity'] || 'moderate'} category="fips-impact" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500 font-medium">Availability</span>
                <StatusBadge status={sysChar['security-impact-level']?.['security-objective-availability'] || 'moderate'} category="fips-impact" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">
              Implementation Status Breakdown
            </h3>
            <StatusBreakdown counts={statusCounts} category="implementation-status" />
          </div>
        </div>
      </div>
    );
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'syschar', label: 'System Characteristics' },
    { id: 'sysimp', label: 'System Implementation' },
    { id: 'ctrlimp', label: 'Control Implementation' },
    { id: 'metadata', label: 'Metadata' },
    { id: 'json', label: 'JSON Source' }
  ];

  // Document browser filtered list
  const allBrowserDocs = useMemo(() => [...workspaceProfiles, ...workspaceCatalogs], [workspaceProfiles, workspaceCatalogs]);
  const filteredBrowserDocs = useMemo(() => {
    let list = allBrowserDocs;
    if (browserTab === 'profiles') list = workspaceProfiles;
    if (browserTab === 'catalogs') list = workspaceCatalogs;

    const q = browserSearchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter(d =>
      d.title.toLowerCase().includes(q) ||
      d.uuid.toLowerCase().includes(q) ||
      (d.version && d.version.toLowerCase().includes(q))
    );
  }, [allBrowserDocs, workspaceProfiles, workspaceCatalogs, browserTab, browserSearchQuery]);

  // Determine active control for detail view
  const activeDetailControl = useMemo(() => {
    if (!selectedItem) return null;
    const cid = selectedItem['control-id'] || selectedItem.id;
    const fromResolved = allResolvedControlsList.find(
      c => c.id?.toLowerCase() === cid?.toLowerCase()
    );
    if (fromResolved) return fromResolved;

    const fromImplemented = implementedControls.find(
      c => c.id?.toLowerCase() === cid?.toLowerCase()
    );
    if (fromImplemented) return fromImplemented;

    return {
      id: cid,
      title: selectedItem.title || cid
    };
  }, [selectedItem, allResolvedControlsList, implementedControls]);

  const activeMatchingReq = useMemo(() => {
    if (!selectedItem) return undefined;
    const cid = selectedItem['control-id'] || selectedItem.id;
    return (ctrlImp['implemented-requirements'] || []).find(
      (r: any) => r['control-id']?.toLowerCase() === cid?.toLowerCase() || (selectedItem.uuid && r.uuid === selectedItem.uuid)
    );
  }, [selectedItem, ctrlImp]);

  if (loading && !doc) return <LoadingSpinner variant="skeleton" message="Loading System Security Plan..." />;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  if (!doc || !ssp) return null;

  return (
    <DocumentPageLayout
      stage="ssps"
      docId={sspId}
      lifecycle={lifecycle}
      title={ssp.metadata?.title || 'Untitled SSP'}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(newTab) => {
        if (activeTab === 'json' && newTab !== 'json') {
          const entityId = jsonEditorRef.current?.getCursorEntityId?.();
          if (entityId) tree.select(entityId);
        }
        setActiveTab(newTab);
      }}
      onClose={onClose}
      sidebarOpen={activeTab === 'ctrlimp'}
      sidebar={
        activeTab === 'ctrlimp' && (
          <ControlTree
            tree={tree}
            renderNodeExtra={(node) => {
              const req = (ctrlImp['implemented-requirements'] || []).find((r: any) => r['control-id']?.toLowerCase() === node.id?.toLowerCase());
              if (!req) return null;
              const state = req['by-components']?.[0]?.['implementation-status']?.state || 'planned';
              return <StatusBadge status={state} category="implementation-status" />;
            }}
          />
        )
      }
    >
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'syschar' && (
        <SystemCharacteristicsTab
          sysChar={sysChar}
          isEditing={isEditing}
          handleUpdateField={handleUpdateField}
          ssp={ssp}
          dispatch={dispatch}
          openDetail={openDetail}
        />
      )}
      {activeTab === 'sysimp' && (
        <SystemImplementationTab
          sysImp={sysImp}
          isEditing={isEditing}
          handleUpdateField={handleUpdateField}
          dispatch={dispatch}
          openDetail={openDetail}
          ssp={ssp}
        />
      )}
      {activeTab === 'ctrlimp' && (
        <ControlImplementationTab
          ctrlImp={ctrlImp}
          isEditing={isEditing}
          handleUpdateField={handleUpdateField}
          openDetail={openDetail}
          coveragePercent={coveragePercent}
          catalog={catalog}
          sysImp={sysImp}
          dispatch={dispatch}
          ssp={ssp}
          onSelectControl={handleControlSelect}
        />
      )}
      {activeTab === 'metadata' && (
        <StandardMetadataTab
          document={ssp}
          onChange={(newSsp: any) => dispatch(replaceSSP(newSsp))}
          isEditing={isEditing}
        />
      )}
      {activeTab === 'json' && (
        <div className="p-6 h-full">
          <JsonEditor
            ref={jsonEditorRef}
            value={doc}
            onChange={handleUpdate}
            readOnly={!isEditing}
            highlightId={selectedItem?.uuid || selectedItem?.['control-id'] || tree.selectedId || null}
          />
        </div>
      )}

      {/* Slide-out Entity Detail Panel */}
      <EntityDetailPanel
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={itemType === 'control' ? `Control ${selectedItem?.['control-id'] || selectedItem?.id || ''}` : 'Detail'}
      >
        <div className="p-4">
          {selectedItem && (
            itemType === 'control' ? (
              <UnifiedControlEditor
                control={activeDetailControl || { id: selectedItem['control-id'], title: selectedItem.title }}
                stage="ssp"
                isEditing={isEditing}
                implementation={activeMatchingReq}
                components={sysImp.components}
                catalog={catalog}
                profile={catalog}
                ssp={ssp}
                dispatch={dispatch}
                onChange={(updatedCtrl) => {
                  // If control was updated
                }}
              />
            ) : (
              <div className="space-y-4">
                {itemType === 'component' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium">Title</label>
                      <input
                        className="mt-1 block w-full rounded border-gray-300 dark:bg-gray-700 text-sm"
                        value={selectedItem.title || ''}
                        disabled={!isEditing}
                        onChange={e => {
                          const updated = { ...selectedItem, title: e.target.value };
                          setSelectedItem(updated);
                          dispatch(updateSystemComponent(selectedItem.uuid, { title: e.target.value }));
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Description</label>
                      <textarea
                        rows={3}
                        className="mt-1 block w-full rounded border-gray-300 dark:bg-gray-700 text-sm"
                        value={selectedItem.description || ''}
                        disabled={!isEditing}
                        onChange={e => {
                          const updated = { ...selectedItem, description: e.target.value };
                          setSelectedItem(updated);
                          dispatch(updateSystemComponent(selectedItem.uuid, { description: e.target.value }));
                        }}
                      />
                    </div>
                  </>
                )}

                {itemType === 'user' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium">Title</label>
                      <input
                        className="mt-1 block w-full rounded border-gray-300 dark:bg-gray-700 text-sm"
                        value={selectedItem.title || ''}
                        disabled={!isEditing}
                        onChange={e => {
                          const updated = { ...selectedItem, title: e.target.value };
                          setSelectedItem(updated);
                          dispatch(updateSystemUser(selectedItem.uuid, { title: e.target.value }));
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Description</label>
                      <textarea
                        rows={3}
                        className="mt-1 block w-full rounded border-gray-300 dark:bg-gray-700 text-sm"
                        value={selectedItem.description || ''}
                        disabled={!isEditing}
                        onChange={e => {
                          const updated = { ...selectedItem, description: e.target.value };
                          setSelectedItem(updated);
                          dispatch(updateSystemUser(selectedItem.uuid, { description: e.target.value }));
                        }}
                      />
                    </div>
                  </>
                )}

                {itemType === 'inventory' && (
                  <div>
                    <label className="block text-sm font-medium">Description</label>
                    <textarea
                      rows={3}
                      className="mt-1 block w-full rounded border-gray-300 dark:bg-gray-700 text-sm"
                      value={selectedItem.description || ''}
                      disabled={!isEditing}
                      onChange={e => {
                        const updated = { ...selectedItem, description: e.target.value };
                        setSelectedItem(updated);
                        dispatch(updateInventoryItem(selectedItem.uuid, { description: e.target.value }));
                      }}
                    />
                  </div>
                )}

                {itemType === 'auth' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium">Title</label>
                      <input
                        className="mt-1 block w-full rounded border-gray-300 dark:bg-gray-700 text-sm"
                        value={selectedItem.title || ''}
                        disabled={!isEditing}
                        onChange={e => {
                          const updated = { ...selectedItem, title: e.target.value };
                          setSelectedItem(updated);
                          dispatch(updateLeveragedAuthorization(selectedItem.uuid, { title: e.target.value }));
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Date Authorized</label>
                      <input
                        type="date"
                        className="mt-1 block w-full rounded border-gray-300 dark:bg-gray-700 text-sm"
                        value={selectedItem['date-authorized'] || ''}
                        disabled={!isEditing}
                        onChange={e => {
                          const updated = { ...selectedItem, 'date-authorized': e.target.value };
                          setSelectedItem(updated);
                          dispatch(updateLeveragedAuthorization(selectedItem.uuid, { 'date-authorized': e.target.value }));
                        }}
                      />
                    </div>
                  </>
                )}

                <div className="pt-2 border-t">
                  <PropsEditor
                    props={selectedItem.props || []}
                    isEditing={isEditing}
                    onChange={(newProps: any) => {
                      if (itemType === 'component') dispatch(updateSystemComponent(selectedItem.uuid, { props: newProps }));
                      if (itemType === 'user') dispatch(updateSystemUser(selectedItem.uuid, { props: newProps }));
                      if (itemType === 'inventory') dispatch(updateInventoryItem(selectedItem.uuid, { props: newProps }));
                      if (itemType === 'auth') dispatch(updateLeveragedAuthorization(selectedItem.uuid, { props: newProps }));
                      setSelectedItem((prev: any) => ({ ...prev, props: newProps }));
                    }}
                  />
                </div>
              </div>
            )
          )}
        </div>
      </EntityDetailPanel>

      {/* Workspace Document Browser Modal */}
      {isBrowserOpen && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="baseline-browser-modal"
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setIsBrowserOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[85vh] shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Select Baseline Profile or Catalog
                </h3>
                <p className="text-xs text-gray-500">
                  Choose a workspace Profile (Stage 2) or Catalog (Stage 1) to resolve baseline controls for this SSP.
                </p>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                onClick={() => setIsBrowserOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4">
              {[
                { id: 'all', label: `All Documents (${allBrowserDocs.length})` },
                { id: 'profiles', label: `🎯 Profiles (${workspaceProfiles.length})` },
                { id: 'catalogs', label: `📚 Catalogs (${workspaceCatalogs.length})` },
                { id: 'custom', label: '🔗 Custom URI' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  className={`py-2 px-3 text-xs font-semibold border-b-2 transition ${
                    browserTab === tab.id
                      ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                  onClick={() => setBrowserTab(tab.id as any)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-3">
              {browserTab !== 'custom' ? (
                <>
                  <input
                    type="text"
                    data-testid="browser-search-input"
                    className="form-input text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                    placeholder="Search documents by title, UUID, or version..."
                    value={browserSearchQuery}
                    onChange={e => setBrowserSearchQuery(e.target.value)}
                    autoFocus
                  />

                  {loadingWorkspaceDocs ? (
                    <div className="p-8 text-center text-xs text-gray-500">
                      Loading workspace documents...
                    </div>
                  ) : filteredBrowserDocs.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-500">
                      No documents found in workspace.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {filteredBrowserDocs.map(docItem => (
                        <div
                          key={docItem.uuid}
                          data-testid={`browser-doc-${docItem.uuid}`}
                          className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 cursor-pointer flex justify-between items-center transition"
                          onClick={() => handleSelectBaselineDoc(docItem)}
                        >
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {docItem.title}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                docItem.stage === 'profiles'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              }`}>
                                {docItem.stage === 'profiles' ? 'Profile' : 'Catalog'}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-gray-500">
                              UUID: {docItem.uuid} {docItem.version ? `| v${docItem.version}` : ''}
                            </span>
                          </div>

                          <button
                            type="button"
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition"
                          >
                            Select
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-3">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Custom URI Reference or Remote Catalog/Profile URL
                  </label>
                  <input
                    type="text"
                    data-testid="custom-uri-input"
                    className="form-input text-xs font-mono rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                    placeholder="https://raw.githubusercontent.com/usnistgov/oscal-content/master/... or ../profiles/uuid.json"
                    value={customUriInput}
                    onChange={e => setCustomUriInput(e.target.value)}
                  />
                  <p className="text-[11px] text-gray-500">
                    Enter any valid URI reference, external raw JSON link, or local workspace relative path.
                  </p>
                  <button
                    type="button"
                    data-testid="apply-custom-uri-btn"
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold self-start transition"
                    onClick={handleApplyCustomUri}
                  >
                    Apply Custom URI
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex justify-end bg-gray-50 dark:bg-gray-900">
              <button
                type="button"
                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded font-medium"
                onClick={() => setIsBrowserOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DocumentPageLayout>
  );
}

export default SSPPage;
