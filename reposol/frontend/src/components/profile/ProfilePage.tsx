import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import styles from './ProfilePage.module.css';
import { useDocumentLifecycle } from '@hooks/useDocumentLifecycle';
import { useDocumentListQuery } from '@hooks/useDocumentQuery';
import { useProfileResolution } from '@hooks/useProfileResolution';
import { DocumentPageLayout } from '@components/layout/DocumentPageLayout';
import { ProfileSidebar } from './ProfileSidebar';
import { UnifiedControlEditor } from '@components/shared/control-editor/UnifiedControlEditor';
import { DocumentOverview } from '@components/shared/DocumentOverview';
import { SourcesPanel } from './SourcesPanel';
import { GroupEditor } from '@components/shared/GroupEditor';
import { ValidationFeedback } from '@components/shared/ValidationFeedback';
import { JsonEditor } from '@components/shared/JsonEditor';
import { ConfirmDialog } from '@components/shared/ConfirmDialog';
import { ProfileBaselineDiffView } from './ProfileBaselineDiffView';
import { ExportModal } from '@components/shared/ui/ExportModal';
import { LoadingSpinner } from '@components/shared/ui/LoadingSpinner';
import { toast } from 'react-hot-toast';


const getAncestors = (targetId, root) => {
  if (!targetId || !root) return [];
  
  const traverse = (node, currentPath) => {
    if (node.id === targetId) {
      return currentPath;
    }
    if (node.groups) {
      for (const g of node.groups) {
        const path = traverse(g, node.id && node.id !== '__root__' ? [...currentPath, node.id] : currentPath);
        if (path) return path;
      }
    }
    if (node.controls) {
      for (const c of node.controls) {
        const path = traverse(c, node.id && node.id !== '__root__' ? [...currentPath, node.id] : currentPath);
        if (path) return path;
      }
    }
    return null;
  };
  
  const rootNode = { id: '__root__', groups: root.groups || [], controls: root.controls || [] };
  return traverse(rootNode, []) || [];
};

/**
 * Orchestrating Profile Page (Tailoring Baseline View / Editor).
 */
export interface ProfilePageProps {
  profileId?: string;
  docTitle?: string;
  initialEditMode?: boolean;
  onClose?: () => void;
}

export function ProfilePage({
  profileId = '',
  docTitle,
  initialEditMode = false,
  onClose
}: ProfilePageProps) {
  // Unified Document Lifecycle Hook
  const lifecycle = useDocumentLifecycle('profiles', 'profile', profileId, initialEditMode);
  const {
    doc,
    activeDoc,
    setDoc,
    loading,
    error,
    saving,
    validating,
    validationResult,
    validate,
    reload,

    versions,
    hasDraft,
    currentVersion,
    inspectedVersion,
    setInspectedVersion,

    isEditing,
    setIsEditing,
    editMode,
    setEditMode,

    showDrawer: showVersions,
    setShowDrawer: setShowVersions,

    handleToggleEdit,
    handleSelectVersion,
    handleDeleteDraft,
    handlePublishVersion,
    handleBack,

    undo,
    redo,
    canUndo,
    canRedo,
    pushUndoRedoState,
    resetUndoRedo,
    markDraftDiscarded,
    saveDraftTag,
    saveVersionTag,
    deleteVersionTag,
    loadVersions
  } = lifecycle;

  // 2. Local States
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeSidebarView, setActiveSidebarView] = useState<string | null>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [jsonText, setJsonText] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const { data: catalogsData } = useDocumentListQuery('catalogs');
  const { data: profilesData } = useDocumentListQuery('profiles');
  const availableCatalogs = useMemo(() => catalogsData || [], [catalogsData]);
  const availableProfiles = useMemo(() => profilesData || [], [profilesData]);
  const jsonEditorRef = useRef<any>(null);

  const handleSelectGroup = (id: string | null) => {
    setSelectedGroupId(id);
    setSelectedControlId(null);
    if (id === null) {
      setActiveSidebarView('overview');
    } else {
      setActiveSidebarView(null);
    }
  };

  const handleSelectControl = (id: string | null) => {
    setSelectedControlId(id);
    setSelectedGroupId(null);
    setActiveSidebarView(null);
  };

  // 3. Custom Profile Resolution Hook (live preview resolved state)
  const {
    resolvedCatalog,
    resolving,
    error: resolutionError,
    resolve,
    clearCache,
    catalogCache
  } = useProfileResolution();

  // Auto-expand parent groups and the selected item itself when selection changes
  useEffect(() => {
    const activeId = selectedControlId || selectedGroupId;
    if (activeId && resolvedCatalog) {
      const ancestors = getAncestors(activeId, resolvedCatalog);
      setExpandedGroups(prev => {
        const next = { ...prev };
        let changed = false;
        ancestors.forEach(id => {
          if (!next[id]) {
            next[id] = true;
            changed = true;
          }
        });
        if (!next[activeId]) {
          next[activeId] = true;
          changed = true;
        }
        return changed ? next : prev;
      });
    }
  }, [selectedControlId, selectedGroupId, resolvedCatalog]);

  // Run resolution engine on document change
  useEffect(() => {
    if (activeDoc && typeof resolve === 'function') {
      resolve(activeDoc);
    }
  }, [activeDoc, resolve]);



  // Auto-migrate profile to strip #placeholder import and ensure merge configuration exists
  useEffect(() => {
    if (doc && doc.profile) {
      const p = doc.profile;
      const needsMergeInit = !p.merge;
      const hasPlaceholder = p.imports?.some(imp => imp.href === '#placeholder');
      
      if (needsMergeInit || hasPlaceholder) {
        let updatedImports = p.imports || [];
        if (hasPlaceholder) {
          updatedImports = updatedImports.filter(imp => imp.href !== '#placeholder');
        }
        
        const migrated = {
          ...p,
          imports: updatedImports,
          merge: p.merge || { 'as-is': {} }
        };
        setDoc({ ...doc, profile: migrated as any });
      }
    }
  }, [doc, setDoc]);

  // Update active document state helper
  const handleDocChange = (updated: any) => {
    setDoc(updated);
    pushUndoRedoState(updated);
  };

  const handleToggleEditMode = (mode: string) => {
    if (mode === 'json') {
      setJsonText(JSON.stringify(activeDoc, null, 2));
    } else {
      // Reverse sync: select control at cursor when switching to visual
      const entityId = jsonEditorRef.current?.getCursorEntityId?.();
      if (entityId) setSelectedControlId(entityId);
      try {
        const parsed = JSON.parse(jsonText);
        handleDocChange(parsed);
      } catch (err: any) {
        toast.error(`JSON syntax error: Cannot switch to visual view. ${err?.message || 'Syntax Error'}`);
        return;
      }
    }
    setEditMode(mode);
  };

  const handleBackWithNavigation = () => {
    handleBack(onClose);
  };

  const handleExport = () => {
    setShowExportModal(true);
  };

  // --- Toggle Control Selection Callback in tailoring (US 2.2, 2.14) ---
  const handleToggleControlSelection = (controlId: string, isChecked: boolean) => {
    const profileData: any = activeDoc.profile || {};
    const imports = profileData.imports || [];
    if (imports.length === 0) return;

    // Standard baseline selection changes the first catalog import's settings
    const idx = 0;
    const item = { ...imports[idx] };

    const isIncludeAll = item['include-all'] !== undefined;

    if (isIncludeAll) {
      // Toggle exclusion rule (exclude-controls)
      let excludes = item['exclude-controls']?.[0]?.['with-ids'] || [];
      if (isChecked) {
        // Remove from excludes
        excludes = excludes.filter(id => id !== controlId);
      } else {
        // Add to excludes
        if (!excludes.includes(controlId)) {
          excludes.push(controlId);
        }
      }
      item['exclude-controls'] = excludes.length > 0 ? [{ 'with-ids': excludes }] : undefined;
      if (!item['exclude-controls']) delete item['exclude-controls'];
    } else {
      // Toggle inclusion rule (include-controls)
      let includes = item['include-controls']?.[0]?.['with-ids'] || [];
      if (isChecked) {
        if (!includes.includes(controlId)) {
          includes.push(controlId);
        }
      } else {
        includes = includes.filter(id => id !== controlId);
      }
      item['include-controls'] = [{ 'with-ids': includes }];
    }

    const updatedImports = imports.map((imp, i) => i === idx ? item : imp);
    handleDocChange({
      ...activeDoc,
      profile: { ...profileData, imports: updatedImports }
    });
  };

  // Helper to construct a Set of all currently selected control IDs
  const getSelectedControlIds = () => {
    const ids = new Set();
    const traverse = (item) => {
      if (item.id) ids.add(item.id);
      if (item.groups) item.groups.forEach(traverse);
      if (item.controls) item.controls.forEach(traverse);
    };
    if (resolvedCatalog) {
      (resolvedCatalog.controls || []).forEach(traverse);
      (resolvedCatalog.groups || []).forEach(traverse);
    }
    return ids;
  };

  // Helper to extract keys of properties used across resolved controls
  const getUsedTagsSummary = () => {
    const summary = {};
    const allKeys = new Set();
    const traverse = (item) => {
      const props = item.props || [];
      props.forEach(p => {
        if (!p.name || !p.value) return;
        allKeys.add(p.name);
        if (!summary[p.name]) {
          summary[p.name] = {};
        }
        summary[p.name][p.value] = (summary[p.name][p.value] || 0) + 1;
      });
      if (item.groups) item.groups.forEach(traverse);
      if (item.controls) item.controls.forEach(traverse);
    };
    if (resolvedCatalog) {
      (resolvedCatalog.controls || []).forEach(traverse);
      (resolvedCatalog.groups || []).forEach(traverse);
    }
    return { summary, allKeys: Array.from(allKeys) };
  };

  // --- Global Property Management (DD-011 Central Hub) ---
  const handleGlobalPropertyRename = (oldName: string, newName: string) => {
    if (!oldName || !newName || oldName === newName) return;
    const profileData: any = activeDoc.profile || {};
    const renameInProps = (props: any[]) => {
      if (!props) return props;
      return props.map(p => p.name === oldName ? { ...p, name: newName } : p);
    };
    let updatedProfile = { ...profileData };
    if (updatedProfile.metadata?.props) {
      updatedProfile.metadata = { ...updatedProfile.metadata, props: renameInProps(updatedProfile.metadata.props) };
    }
    handleDocChange({ ...activeDoc, profile: updatedProfile });
  };

  const handleGlobalPropertyDelete = (propName: string) => {
    if (!propName) return;
    const profileData: any = activeDoc.profile || {};
    const removeFromProps = (props: any[]) => {
      if (!props) return props;
      const filtered = props.filter(p => p.name !== propName);
      return filtered.length > 0 ? filtered : undefined;
    };
    let updatedProfile = { ...profileData };
    if (updatedProfile.metadata?.props) {
      updatedProfile.metadata = { ...updatedProfile.metadata, props: removeFromProps(updatedProfile.metadata.props) };
    }
    handleDocChange({ ...activeDoc, profile: updatedProfile });
  };

  // Render a specific control detail in tailoring panel
  const getSelectedControlDetails = () => {
    if (!selectedControlId) return null;
    const traverse = (item) => {
      if (!item) return null;
      if (item.id === selectedControlId) return item;
      if (item.controls) {
        for (let c of item.controls) {
          const found = traverse(c);
          if (found) return found;
        }
      }
      if (item.groups) {
        for (let g of item.groups) {
          const found = traverse(g);
          if (found) return found;
        }
      }
      return null;
    };
    if (resolvedCatalog) {
      for (let c of resolvedCatalog.controls || []) {
        const found = traverse(c);
        if (found) return found;
      }
      for (let g of resolvedCatalog.groups || []) {
        const found = traverse(g);
        if (found) return found;
      }
    }
    // Fallback to imported catalogs cache so component never unmounts during re-resolution
    return findOriginalControl(selectedControlId);
  };

  // Find the original (unmodified) control from imported catalogs for diff/reset
  const findOriginalControl = (controlId) => {
    if (!controlId || !catalogCache) return null;
    const traverse = (item) => {
      if (item.id === controlId) return item;
      if (item.controls) {
        for (let c of item.controls) {
          const found = traverse(c);
          if (found) return found;
        }
      }
      if (item.groups) {
        for (let g of item.groups) {
          const found = traverse(g);
          if (found) return found;
        }
      }
      return null;
    };
    // Search through all cached catalogs
    if (catalogCache && typeof (catalogCache as any)[Symbol.iterator] === 'function') {
      for (const [, entry] of catalogCache) {
        const catData = entry?.data || entry;
        const catalog = catData?.catalog || catData;
        if (!catalog) continue;
        for (let c of catalog.controls || []) {
          const found = traverse(c);
          if (found) return found;
        }
        for (let g of catalog.groups || []) {
          const found = traverse(g);
          if (found) return found;
        }
      }
    }
    return null;
  };

  const findGroupById = (groupId, groupsList) => {
    for (const g of groupsList) {
      if (g.id === groupId) return g;
      if (g.groups) {
        const found = findGroupById(groupId, g.groups);
        if (found) return found;
      }
    }
    return null;
  };

  const handleGroupChange = (updatedGroup: any) => {
    const profileData: any = activeDoc.profile || {};
    const currentGroups = profileData.merge?.custom?.groups || [];
    
    const updateGroupRecursive = (list: any[]) => {
      return list.map((g: any) => {
        if (g.id === selectedGroupId || g.id === updatedGroup.id) {
          return {
            ...g,
            id: updatedGroup.id,
            title: updatedGroup.title,
            props: updatedGroup.props,
            parts: updatedGroup.parts,
            links: updatedGroup.links
          };
        }
        if (g.groups) {
          return { ...g, groups: updateGroupRecursive(g.groups) };
        }
        return g;
      });
    };

    const updatedGroups = updateGroupRecursive(currentGroups);
    if (updatedGroup.id && updatedGroup.id !== selectedGroupId) {
      setSelectedGroupId(updatedGroup.id);
    }
    handleDocChange({
      ...activeDoc,
      profile: {
        ...profileData,
        merge: {
          ...profileData.merge,
          custom: {
            ...(profileData.merge?.custom || {}),
            groups: updatedGroups
          }
        }
      }
    });
  };

  if (loading && !activeDoc) return <LoadingSpinner variant="skeleton" message="Loading Profile..." />;
  if (error) return <div style={{ padding: '20px', color: 'var(--color-danger)' }}>Error: {error}</div>;
  if (!doc) return <div style={{ padding: '20px' }}>No document loaded.</div>;

  const profileData: any = activeDoc.profile || {};
  const selectedControl = getSelectedControlDetails();
  const selectedGroup = selectedGroupId ? findGroupById(selectedGroupId, resolvedCatalog?.groups || []) : null;

  const selectedControlIds = getSelectedControlIds();
  const { summary: usedTagsSummary, allKeys: scannedKeys } = getUsedTagsSummary();
  const allUsedPropKeys = Array.from(new Set([
    ...scannedKeys,
    ...(profileData.metadata?.props || []).map(p => p.name).filter(Boolean)
  ]));

  const profileSidebar = (
    <ProfileSidebar
      resolvedCatalog={resolvedCatalog || {}}
      profile={profileData}
      catalogCache={catalogCache}
      selectedControlId={selectedControlId}
      selectedGroupId={selectedGroupId}
      activeSidebarView={activeSidebarView}
      onSelectControl={handleSelectControl}
      onSelectGroup={handleSelectGroup}
      onSelectOverview={() => {
        setSelectedControlId(null);
        setSelectedGroupId(null);
        setActiveSidebarView('overview');
      }}
      onSelectMetadata={() => {
        setSelectedControlId(null);
        setSelectedGroupId(null);
        setActiveSidebarView('metadata');
      }}
      onSelectProperties={() => {
        setSelectedControlId(null);
        setSelectedGroupId(null);
        setActiveSidebarView('properties');
      }}
      onSelectParameters={() => {
        setSelectedControlId(null);
        setSelectedGroupId(null);
        setActiveSidebarView('parameters');
      }}
      onSelectBackMatter={() => {
        setSelectedControlId(null);
        setSelectedGroupId(null);
        setActiveSidebarView('back-matter');
      }}
      onSelectImports={() => {
        setSelectedControlId(null);
        setSelectedGroupId(null);
        setActiveSidebarView('imports');
      }}
      onSelectDiff={() => {
        setSelectedControlId(null);
        setSelectedGroupId(null);
        setActiveSidebarView('diff');
      }}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      isEditing={isEditing}
      expandedGroups={expandedGroups}
      onToggleGroup={(id, bulkState) => {
        if (id === null && bulkState !== undefined) {
           setExpandedGroups(bulkState);
        } else {
          setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
        }
      }}
      onChange={(updatedProfile) => handleDocChange({ ...activeDoc, profile: updatedProfile })}
    />
  );

  const tabs = [
    { id: 'visual', label: 'Visual' },
    { id: 'json', label: 'JSON Source' }
  ];

  return (
    <DocumentPageLayout
      stage="profiles"
      docId={profileId}
      lifecycle={{
        ...lifecycle,
        activeDoc,
        loading,
        saving,
        validating,
        validationResult,
        validate,
        hasDraft,
        handleDeleteDraft,
        undo,
        redo,
        canUndo,
        canRedo,
        setShowDrawer: setShowVersions,
        showDrawer: showVersions,
        versions,
        currentVersion,
        inspectedVersion,
        handleSelectVersion,
        handlePublishVersion,
        isEditing,
        handleToggleEdit,
        handleBack: handleBackWithNavigation
      }}
      title={profileData.metadata?.title || 'Untitled Profile'}
      tabs={tabs}
      activeTab={editMode}
      onTabChange={(mode) => {
        if (editMode === 'json' && mode !== 'json') {
          const entityId = jsonEditorRef.current?.getCursorEntityId?.();
          if (entityId) handleSelectControl(entityId);
        }
        setEditMode(mode);
      }}
      onClose={onClose}
      sidebar={profileSidebar}
      onExport={handleExport}
    >

      {/* Validation / Resolution error feedbacks */}
      {(validationResult || resolutionError) && (
        <div style={{ padding: '0 20px' }}>
          {validationResult && <ValidationFeedback result={validationResult} />}
          {resolutionError && (
            <div style={{ margin: '12px 0', padding: '12px', borderRadius: 'var(--radius-md)', background: 'rgba(248, 81, 73, 0.15)', border: '1px solid rgba(248, 81, 73, 0.4)', color: 'var(--color-danger)', fontSize: '13px' }}>
              ⚠️ Resolution Engine Error: {resolutionError}
            </div>
          )}
        </div>
      )}

      {/* Main workspace content */}
      {editMode === 'json' ? (
        <div style={{ flex: 1, padding: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <JsonEditor
            ref={jsonEditorRef}
            value={jsonText}
            onChange={setJsonText}
            highlightId={selectedControlId}
            onValidate={async (text) => {
              try {
                const parsed = JSON.parse(text);
                await validate(parsed);
              } catch (err: any) {
                toast.error(`JSON syntax error: ${err.message}`);
              }
            }}
          />
        </div>
      ) : (
        <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
          {selectedControlId && selectedControl ? (
            <UnifiedControlEditor
              control={selectedControl}
              stage="profile"
              isEditing={isEditing}
              allUsedPropKeys={allUsedPropKeys}
              originalControl={findOriginalControl(selectedControlId)}
              profile={profileData}
              catalog={resolvedCatalog}
              onProfileChange={(updatedProfile: any) => handleDocChange({ ...activeDoc, profile: updatedProfile })}
              backMatterResources={(profileData['back-matter']?.resources) || []}
              onSelectControl={handleSelectControl}
              onSelectGroup={handleSelectGroup}
              alterations={profileData.modify?.alters?.filter((a: any) => a['control-id'] === selectedControl.id) || []}
            />
          ) : selectedGroupId && selectedGroup ? (
            <GroupEditor
              group={selectedGroup}
              catalog={resolvedCatalog}
              onChange={handleGroupChange}
              isEditing={isEditing}
              allUsedPropKeys={allUsedPropKeys}
              onSelectGroup={handleSelectGroup}
              onSelectControl={handleSelectControl}
              mode="profile"
              profile={profileData}
              onProfileChange={(updatedProfile) => handleDocChange({ ...activeDoc, profile: updatedProfile })}
            />
          ) : activeSidebarView === 'diff' ? (
            <ProfileBaselineDiffView
              profileId={profileId}
              profileDoc={profileData}
              availableCatalogs={availableCatalogs}
            />
          ) : (
            <DocumentOverview
              document={profileData}
              onChange={(updatedProfile) => handleDocChange({ ...activeDoc, profile: updatedProfile })}
              isEditing={isEditing}
              allUsedPropKeys={allUsedPropKeys}
              usedTagsSummary={usedTagsSummary}
              mode="profile"
              resolvedCatalog={resolvedCatalog}
              availableCatalogs={availableCatalogs}
              availableProfiles={availableProfiles}
              catalogCache={catalogCache}
              SourcesPanel={SourcesPanel}
              activeView={activeSidebarView}
              onSelectGroup={handleSelectGroup}
              onSelectControl={handleSelectControl}
              onGlobalPropertyRename={handleGlobalPropertyRename}
              onGlobalPropertyDelete={handleGlobalPropertyDelete}
              onNavigateToProperties={() => setActiveSidebarView('properties')}
            />
          )}
        </div>
      )}

      <ExportModal
        isOpen={showExportModal}
        docId={profileId}
        docTitle={docTitle || activeDoc?.['profile']?.metadata?.title || 'Profile'}
        stage="profiles"
        onClose={() => setShowExportModal(false)}
      />
    </DocumentPageLayout>
  );
}
