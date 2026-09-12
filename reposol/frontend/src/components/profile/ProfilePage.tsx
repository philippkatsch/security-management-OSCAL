import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import styles from './ProfilePage.module.css';
import { useDocumentLifecycle } from '@hooks/useDocumentLifecycle';
import { useDocumentActions } from '@hooks/useDocumentActions';
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
import { ExportModal } from '@components/shared/ui/ExportModal';
import { LoadingSpinner } from '@components/shared/ui/LoadingSpinner';
import { ConflictBanner } from './ConflictBanner';
import { toast } from 'react-hot-toast';
import { DeleteCustomGroupDialog } from './DeleteCustomGroupDialog';
import {
  addCustomGroup,
  renameCustomGroup,
  deleteCustomGroup,
  moveCustomGroup,
  assignControlToCustomGroup,
  assignMultipleControlsToCustomGroup,
  removeControlFromCustomGroup,
  removeMultipleControlsFromCustomGroup,
  reorderControlsInCustomGroup,
  importCustomGroupBranch,
  toggleControlInBaseline,
  updateCustomGroup,
  renameProfileGlobalProperty,
  deleteProfileGlobalProperty,
  removeProfileOrphans,
  updateProfileDocument,
  mapCatalogGroupsToCustomGroups
} from '@lib/document-actions/profile-actions';


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
  initialView?: string;
  onClose?: () => void;
}

export function ProfilePage({
  profileId = '',
  docTitle,
  initialEditMode = false,
  initialView,
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
  const { dispatch } = useDocumentActions(lifecycle);

  // 2. Local States
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeSidebarView, setActiveSidebarView] = useState<string | null>(initialView || 'overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [showExportModal, setShowExportModal] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<any | null>(null);
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
    previewResolve,
    conflicts,
    clearCache
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

  // Run resolution engine on document change (live preview from unsaved state)
  useEffect(() => {
    if (activeDoc && typeof previewResolve === 'function') {
      previewResolve(activeDoc);
    }
  }, [activeDoc, previewResolve]);



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
          merge: p.merge || { 'as-is': true }
        };
        const updatedDoc = { ...doc, profile: migrated as any };
        setDoc(updatedDoc);
        if (resetUndoRedo) {
          resetUndoRedo(updatedDoc);
        }
      }
    }
  }, [doc, setDoc, resetUndoRedo]);

  // Update active document state helper
  const handleDocChange = (updated: any) => {
    setDoc(updated);
    pushUndoRedoState(updated);
  };

  const handleBackWithNavigation = () => {
    handleBack(onClose);
  };

  const handleExport = () => {
    setShowExportModal(true);
  };

  // --- Toggle Control Selection Callback in tailoring (US 2.2, 2.14) ---
  const handleToggleControlSelection = (controlId: string, isChecked: boolean) => {
    if (!controlId) return;
    dispatch(toggleControlInBaseline(controlId, isChecked));
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
    dispatch(renameProfileGlobalProperty(oldName, newName));
  };

  const handleGlobalPropertyDelete = (propName: string) => {
    if (!propName) return;
    dispatch(deleteProfileGlobalProperty(propName));
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
      // Check all_controls and all_groups for unassigned controls
      for (let c of resolvedCatalog.all_controls || []) {
        const found = traverse(c);
        if (found) return found;
      }
      for (let g of resolvedCatalog.all_groups || []) {
        const found = traverse(g);
        if (found) return found;
      }
    }
    // Fallback to imported catalogs cache so component never unmounts during re-resolution
    return findOriginalControl(selectedControlId);
  };

  // Find the original (unmodified) control from imported catalogs for diff/reset
  const findOriginalControl = (controlId: string) => {
    if (!resolvedCatalog || !controlId) return null;
    let targetId = controlId.toLowerCase();

    // If controlId is an overridden ID, find the original catalog control ID from alters
    const alterWithIdOverride = profileData?.modify?.alters?.find((a: any) =>
      a.adds?.some((add: any) =>
        add.props?.some((p: any) => p.name === 'id-override' && p.value?.toLowerCase() === targetId)
      )
    );
    if (alterWithIdOverride && alterWithIdOverride['control-id']) {
      targetId = alterWithIdOverride['control-id'].toLowerCase();
    }
    const traverse = (item: any): any => {
      if (!item) return null;
      if (item.id && item.id.toLowerCase() === targetId) return item;
      if (item.controls) {
        for (const c of item.controls) {
          const found = traverse(c);
          if (found) return found;
        }
      }
      if (item.groups) {
        for (const g of item.groups) {
          const found = traverse(g);
          if (found) return found;
        }
      }
      return null;
    };
    for (const c of resolvedCatalog.all_controls || []) {
      const found = traverse(c);
      if (found) return found;
    }
    for (const g of resolvedCatalog.all_groups || []) {
      const found = traverse(g);
      if (found) return found;
    }
    return null;
  };

  const findGroupById = (groupId?: string | null, groupsList?: any[]): any => {
    if (!groupId || !groupsList) return null;
    const target = groupId.toLowerCase();
    for (const g of groupsList) {
      if (g.id && g.id.toLowerCase() === target) return g;
      if (g.groups) {
        const found = findGroupById(groupId, g.groups);
        if (found) return found;
      }
    }
    return null;
  };

  const handleGroupChange = (updatedGroup: any) => {
    if (selectedGroupId) {
      dispatch(updateCustomGroup(selectedGroupId, updatedGroup));
    }
    if (updatedGroup.id && updatedGroup.id !== selectedGroupId) {
      setSelectedGroupId(updatedGroup.id);
    }
  };

  const dispatchAction = useCallback((action: any) => {
    dispatch(action);
  }, [dispatch]);

  const handleAddCustomGroup = useCallback((parentGroupId?: string | null) => {
    const title = parentGroupId ? 'New Sub-Group' : 'New Custom Group';
    dispatchAction(addCustomGroup({
      title,
      parentGroupId: parentGroupId || null
    }));
  }, [dispatchAction]);

  const handleRenameCustomGroup = useCallback((groupId: string, newTitle: string, newId?: string) => {
    const resolvedGroups = (resolvedCatalog?.groups && resolvedCatalog.groups.length > 0)
      ? resolvedCatalog.groups
      : (resolvedCatalog?.all_groups || []);
    const initialCustomGroups = mapCatalogGroupsToCustomGroups(resolvedGroups);
    dispatchAction(renameCustomGroup({
      groupId,
      title: newTitle,
      newId,
      initialCustomGroups
    }));
  }, [dispatchAction, resolvedCatalog]);

  const handleRequestDeleteGroup = useCallback((groupId?: string) => {
    const gid = groupId || selectedGroupId;
    if (!gid) return;
    const grp = findGroupById(gid, (activeDoc?.profile as any)?.merge?.custom?.groups || []) ||
      findGroupById(gid, resolvedCatalog?.groups || []) ||
      findGroupById(gid, resolvedCatalog?.all_groups || []);
    if (grp) {
      setGroupToDelete(grp);
    } else {
      setGroupToDelete({ id: gid, title: gid });
    }
  }, [selectedGroupId, resolvedCatalog, activeDoc]);

  const handleConfirmDeleteGroup = useCallback((options: { deleteChildren: boolean; reassignToGroupId: string | null }) => {
    if (!groupToDelete) return;
    const resolvedGroups = (resolvedCatalog?.groups && resolvedCatalog.groups.length > 0)
      ? resolvedCatalog.groups
      : (resolvedCatalog?.all_groups || []);
    const initialCustomGroups = mapCatalogGroupsToCustomGroups(resolvedGroups);
    dispatchAction(deleteCustomGroup({
      groupId: groupToDelete.id,
      deleteChildren: options.deleteChildren,
      reassignToGroupId: options.reassignToGroupId,
      initialCustomGroups
    }));
    if (selectedGroupId === groupToDelete.id) {
      setSelectedGroupId(null);
      setActiveSidebarView('overview');
    }
    setGroupToDelete(null);
  }, [groupToDelete, dispatchAction, selectedGroupId, resolvedCatalog]);

  const handleMoveNode = useCallback((nodeId: string, targetParentId: string | null, targetIndex?: number) => {
    if (nodeId === '__unassigned__') return;
    if (nodeId.startsWith('{') && nodeId.includes('"catalog-group-structure"')) {
      try {
        const parsed = JSON.parse(nodeId);
        if (parsed.type === 'catalog-group-structure' && parsed.group) {
          dispatchAction(importCustomGroupBranch({
            group: parsed.group,
            targetParentId: (targetParentId === '__unassigned__' ? null : targetParentId),
            targetIndex
          }));
          toast.success(`Imported group "${parsed.group.title || parsed.group.id}" into Custom Groups.`);
          return;
        }
      } catch (err) {
        console.error('Failed to import group branch', err);
      }
    }
    if (nodeId.startsWith('{') && nodeId.includes('"batch-controls"')) {
      try {
        const parsed = JSON.parse(nodeId);
        if (parsed.type === 'batch-controls' && Array.isArray(parsed.controlIds)) {
          if (targetParentId === '__unassigned__') {
            dispatchAction(removeMultipleControlsFromCustomGroup({ controlIds: parsed.controlIds }));
          } else {
            dispatchAction(assignMultipleControlsToCustomGroup({ controlIds: parsed.controlIds, targetGroupId: targetParentId }));
          }
          return;
        }
      } catch {
        // fallback
      }
    }
    const isGroup = Boolean(
      findGroupById(nodeId, (activeDoc?.profile as any)?.merge?.custom?.groups || []) ||
      findGroupById(nodeId, resolvedCatalog?.groups || []) ||
      findGroupById(nodeId, resolvedCatalog?.all_groups || [])
    );
    const resolvedGroups = (resolvedCatalog?.groups && resolvedCatalog.groups.length > 0)
      ? resolvedCatalog.groups
      : (resolvedCatalog?.all_groups || []);
    const initialCustomGroups = mapCatalogGroupsToCustomGroups(resolvedGroups);
    if (isGroup) {
      if (targetParentId === '__unassigned__') return;
      dispatchAction(moveCustomGroup({
        sourceGroupId: nodeId,
        targetGroupId: targetParentId,
        targetIndex,
        initialCustomGroups
      }));
    } else {
      if (targetParentId === '__unassigned__') {
        dispatchAction(removeControlFromCustomGroup({
          controlId: nodeId
        }));
      } else {
        dispatchAction(assignControlToCustomGroup({
          controlId: nodeId,
          targetGroupId: targetParentId,
          targetIndex,
          initialCustomGroups
        }));
      }
    }
  }, [dispatchAction, resolvedCatalog, activeDoc]);

  const handleUnassignControl = useCallback((controlId: string, groupId: string) => {
    dispatchAction(removeControlFromCustomGroup({
      controlId,
      sourceGroupId: groupId
    }));
  }, [dispatchAction]);

  const handleOrderChange = useCallback((order: 'keep' | 'ascending' | 'descending') => {
    if (!selectedGroupId) return;
    dispatchAction(reorderControlsInCustomGroup({
      groupId: selectedGroupId,
      order
    }));
  }, [selectedGroupId, dispatchAction]);

  const availableTargetGroups = useMemo(() => {
    const groups: Array<{ id: string; title: string; depth?: number }> = [];
    const collect = (list: any[], depth = 0) => {
      for (const g of list || []) {
        if (g.id) {
          groups.push({ id: g.id, title: g.title || g.id, depth });
        }
        if (g.groups) collect(g.groups, depth + 1);
      }
    };
    const customGroups = (activeDoc?.profile as any)?.merge?.custom?.groups || resolvedCatalog?.groups || [];
    collect(customGroups);
    return groups;
  }, [activeDoc?.profile, resolvedCatalog?.groups]);

  if (loading && !activeDoc) return <LoadingSpinner variant="skeleton" message="Loading Profile..." />;
  if (error) return <div style={{ padding: '20px', color: 'var(--color-danger)' }}>Error: {error}</div>;
  if (!doc) return <div style={{ padding: '20px' }}>No document loaded.</div>;

  const profileData: any = activeDoc.profile || {};
  const selectedControl = getSelectedControlDetails();
  const selectedGroup = selectedGroupId 
    ? (findGroupById(selectedGroupId, resolvedCatalog?.groups || []) || findGroupById(selectedGroupId, profileData?.merge?.custom?.groups || [])) 
    : null;

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
      conflicts={conflicts}
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
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      isEditing={isEditing}
      onExcludeFromBaseline={(controlId: string) => handleToggleControlSelection(controlId, false)}
      onIncludeInBaseline={(controlId: string) => handleToggleControlSelection(controlId, true)}
      dispatch={dispatchAction}
      onAddCustomGroup={handleAddCustomGroup}
      onRenameCustomGroup={handleRenameCustomGroup}
      onDeleteCustomGroup={handleRequestDeleteGroup}
      onMoveNode={handleMoveNode}
      expandedGroups={expandedGroups}
      onToggleGroup={(id, bulkState) => {
        if (id === null && bulkState !== undefined) {
           setExpandedGroups(bulkState);
        } else {
          setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
        }
      }}
      onChange={(updatedProfile) => dispatch(updateProfileDocument(updatedProfile))}
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

      {/* Conflict banner for orphaned modifications (US 2.32) */}
      {conflicts?.has_conflicts && (
        <div style={{ padding: '0 20px' }}>
          <ConflictBanner
            conflicts={conflicts}
            isEditing={isEditing}
            onRemoveOrphans={() => {
              dispatch(removeProfileOrphans(conflicts));
            }}
          />
        </div>
      )}

      {/* Main workspace content */}
      {editMode === 'json' ? (
        <div style={{ flex: 1, padding: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <JsonEditor
            ref={jsonEditorRef}
            value={activeDoc}
            onChange={handleDocChange}
            onValidate={validate}
            readOnly={!isEditing}
            highlightId={selectedControlId || selectedGroupId}
          />
        </div>
      ) : (
        <div style={{ flex: 1, height: '100%', overflow: 'hidden', padding: '0 20px' }}>
          {selectedControlId && selectedControl ? (
            <UnifiedControlEditor
              control={selectedControl}
              stage="profile"
              isEditing={isEditing}
              allUsedPropKeys={allUsedPropKeys}
              originalControl={findOriginalControl(selectedControlId) ?? undefined}
              profile={profileData}
              catalog={resolvedCatalog}
              onProfileChange={(updatedProfile: any) => dispatch(updateProfileDocument(updatedProfile))}
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
              onProfileChange={(updatedProfile) => dispatch(updateProfileDocument(updatedProfile))}
              onDeleteGroup={handleRequestDeleteGroup}
              onAddSubgroup={handleAddCustomGroup}
              onUnassignControl={handleUnassignControl}
              onOrderChange={handleOrderChange}
            />
          ) : (
            <DocumentOverview
              document={profileData}
              onChange={(updatedProfile) => dispatch(updateProfileDocument(updatedProfile))}
              isEditing={isEditing}
              allUsedPropKeys={allUsedPropKeys}
              usedTagsSummary={usedTagsSummary}
              mode="profile"
              resolvedCatalog={resolvedCatalog}
              availableCatalogs={availableCatalogs}
              availableProfiles={availableProfiles}
              conflicts={conflicts}
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

      <DeleteCustomGroupDialog
        isOpen={Boolean(groupToDelete)}
        group={groupToDelete}
        availableTargetGroups={availableTargetGroups}
        onConfirm={handleConfirmDeleteGroup}
        onCancel={() => setGroupToDelete(null)}
      />
    </DocumentPageLayout>
  );
}
