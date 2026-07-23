import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDocument } from '../../hooks/useDocument';
import { useVersions } from '../../hooks/useVersions';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { useDraft } from '../../hooks/useDraft';
import { useProfileResolution } from '../../hooks/useProfileResolution';
import { DocumentToolbar } from '../shared/DocumentToolbar';
import { ProfileSidebar } from './ProfileSidebar';
import { ControlDetailView } from '../shared/ControlDetailView';
import { DocumentOverview } from '../shared/DocumentOverview';
import { SourcesPanel } from './SourcesPanel';
import { GroupEditor } from '../shared/GroupEditor';
import { VersionDrawer } from '../shared/VersionDrawer';
import { ValidationFeedback } from '../shared/ValidationFeedback';
import { JsonEditor } from '../shared/JsonEditor';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { fetchDocuments } from '../../lib/api';

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
export function ProfilePage({
  profileId,
  initialEditMode = false,
  onClose
}) {
  // 1. Backend Document Integration Hook
  const {
    doc,
    setDoc,
    loading,
    error,
    saving,
    validating,
    validationResult,
    save,
    validate,
    reload
  } = useDocument('profiles', profileId);

  // 2. Versions Hook
  const {
    versions,
    showDrawer,
    setShowDrawer,
    save: saveVersionTag,
    saveDraft: saveDraftTag,
    remove: deleteVersionTag,
    switchTo: loadVersion
  } = useVersions('profiles', profileId);

  // 3. States
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [selectedControlId, setSelectedControlId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [activeSidebarView, setActiveSidebarView] = useState('overview');
  // No top-level tabs — mirrors CatalogPage pattern (sidebar selection drives right panel)
  const [editMode, setEditMode] = useState('visual'); // visual | json
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [jsonText, setJsonText] = useState('');
  const [availableCatalogs, setAvailableCatalogs] = useState([]);
  const [availableProfiles, setAvailableProfiles] = useState([]);
  const jsonEditorRef = useRef(null);

  const handleSelectGroup = (id) => {
    setSelectedGroupId(id);
    setSelectedControlId(null);
    if (id === null) {
      setActiveSidebarView('overview');
    } else {
      setActiveSidebarView(null);
    }
  };

  const handleSelectControl = (id) => {
    setSelectedControlId(id);
    setSelectedGroupId(null);
    setActiveSidebarView(null);
  };

  // 4. Custom Profile Resolution Hook (live preview resolved state)
  const {
    resolvedCatalog,
    resolving,
    error: resolutionError,
    resolve,
    clearCache,
    catalogCache
  } = useProfileResolution();

  // 5. Undo / Redo History Hook
  const {
    current: undoRedoDoc,
    pushState: pushUndoRedoState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetUndoRedo
  } = useUndoRedo(doc);

  // Sync undoRedo state with active doc state
  useEffect(() => {
    if (doc && !undoRedoDoc) {
      resetUndoRedo(doc);
    }
  }, [doc, undoRedoDoc, resetUndoRedo]);

  const activeDoc = undoRedoDoc || doc;

  // 6. Backend Draft Hook for Auto-save
  const {
    saveNow: saveDraftNow
  } = useDraft('profile', profileId, activeDoc, isEditing, 30000, saveDraftTag);

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

  // Load catalogs and profiles list for import selectors
  useEffect(() => {
    fetchDocuments('catalogs')
      .then(setAvailableCatalogs)
      .catch(err => console.error('Failed to load catalogs:', err));
    fetchDocuments('profiles')
      .then(setAvailableProfiles)
      .catch(err => console.error('Failed to load profiles:', err));
  }, []);

  // Run resolution engine on document change
  useEffect(() => {
    if (activeDoc) {
      resolve(activeDoc);
    }
  }, [activeDoc, resolve]);

  // Keyboard Shortcuts for Undo/Redo (Ctrl+Z / Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isEditing || editMode !== 'visual') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        const prev = undo();
        if (prev) setDoc(prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        const next = redo();
        if (next) setDoc(next);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, editMode, undo, redo, setDoc]);

  // Auto-migrate profile to use custom merge and strip #placeholder import by default when loaded
  useEffect(() => {
    if (doc && doc.profile) {
      const p = doc.profile;
      const needsMigration = !p.merge || p.merge.custom === undefined;
      const hasPlaceholder = p.imports?.some(imp => imp.href === '#placeholder');
      
      if (needsMigration || hasPlaceholder) {
        let updatedImports = p.imports || [];
        if (hasPlaceholder) {
          updatedImports = updatedImports.filter(imp => imp.href !== '#placeholder');
        }
        
        const migrated = {
          ...p,
          imports: updatedImports,
          merge: {
            ...p.merge,
            custom: p.merge?.custom || { groups: [] }
          }
        };
        setDoc({ ...doc, profile: migrated });
      }
    }
  }, [doc, setDoc]);

  // Update active document state helper
  const handleDocChange = (updated) => {
    setDoc(updated);
    pushUndoRedoState(updated);
  };

  const handleToggleEditMode = (mode) => {
    if (mode === 'json') {
      setJsonText(JSON.stringify(activeDoc, null, 2));
    } else {
      try {
        const parsed = JSON.parse(jsonText);
        handleDocChange(parsed);
      } catch (err) {
        alert(`JSON syntax error: Cannot switch to visual view. ${err.message}`);
        return;
      }
    }
    setEditMode(mode);
  };

  const handleToggleEdit = async () => {
    if (isEditing) {
      try {
        let finalDoc = activeDoc;
        if (editMode === 'json') {
          finalDoc = JSON.parse(jsonText);
        }
        await saveDraftTag(finalDoc);
        setIsEditing(false);
        await reload();
      } catch (err) {
        alert(`Save failed: ${err.message}`);
      }
    } else {
      setIsEditing(true);
    }
  };

  const handleBack = async () => {
    if (isEditing) {
      try {
        let finalDoc = activeDoc;
        if (editMode === 'json') {
          try {
            finalDoc = JSON.parse(jsonText);
          } catch (e) {
            if (!window.confirm("The JSON content is invalid and cannot be saved. Do you want to continue anyway? Your unsaved JSON changes will be lost.")) {
              return;
            }
          }
        }
        await saveDraftTag(finalDoc);
      } catch (err) {
        console.error("Back button draft save failed:", err);
      }
    }
    onClose();
  };

  const handleExport = () => {
    const format = window.prompt("Export format: json, yaml, or xml", "json");
    if (!format) return;
    const fmt = format.trim().toLowerCase();
    if (['json', 'yaml', 'xml'].includes(fmt)) {
      window.open(`/api/export/profiles/${profileId}?format=${fmt}`, '_blank');
    } else {
      alert("Invalid format.");
    }
  };

  // --- Toggle Control Selection Callback in tailoring (US 2.2, 2.14) ---
  const handleToggleControlSelection = (controlId, isChecked) => {
    const profileData = activeDoc.profile || {};
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
  const handleGlobalPropertyRename = (oldName, newName) => {
    if (!oldName || !newName || oldName === newName) return;
    const profileData = activeDoc.profile || {};
    const renameInProps = (props) => {
      if (!props) return props;
      return props.map(p => p.name === oldName ? { ...p, name: newName } : p);
    };
    let updatedProfile = { ...profileData };
    if (updatedProfile.metadata?.props) {
      updatedProfile.metadata = { ...updatedProfile.metadata, props: renameInProps(updatedProfile.metadata.props) };
    }
    handleDocChange({ ...activeDoc, profile: updatedProfile });
  };

  const handleGlobalPropertyDelete = (propName) => {
    if (!propName) return;
    const profileData = activeDoc.profile || {};
    const removeFromProps = (props) => {
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

  const handleGroupChange = (updatedGroup) => {
    const profileData = activeDoc.profile || {};
    const currentGroups = profileData.merge?.custom?.groups || [];
    
    const updateGroupRecursive = (list) => {
      return list.map(g => {
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

  if (loading) return <div style={{ padding: '20px', color: 'var(--color-text-muted)' }}>Loading Profile...</div>;
  if (error) return <div style={{ padding: '20px', color: 'var(--color-danger)' }}>Error: {error}</div>;
  if (!doc) return <div style={{ padding: '20px' }}>No document loaded.</div>;

  const profileData = activeDoc.profile || {};
  const selectedControl = getSelectedControlDetails();
  const selectedGroup = selectedGroupId ? findGroupById(selectedGroupId, resolvedCatalog?.groups || []) : null;

  const selectedControlIds = getSelectedControlIds();
  const { summary: usedTagsSummary, allKeys: scannedKeys } = getUsedTagsSummary();
  const allUsedPropKeys = Array.from(new Set([
    ...scannedKeys,
    ...(profileData.metadata?.props || []).map(p => p.name).filter(Boolean)
  ]));

  return (
    <div
      className="profile-viewer"
      data-testid="profile-viewer"
      data-profile-id={profileId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--color-background)',
        overflow: 'hidden'
      }}
    >
      {/* Header Toolbar */}
      <DocumentToolbar
        title={profileData.metadata?.title}
        isEditing={isEditing}
        onToggleEdit={handleToggleEdit}
        onExport={handleExport}
        onBack={handleBack}
        onSaveVersion={() => setShowDrawer(true)}
        versions={versions}
        editMode={editMode}
        onToggleEditMode={handleToggleEditMode}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => {
          if (editMode === 'json') {
            jsonEditorRef.current?.undo();
          } else {
            const prev = undo();
            if (prev) setDoc(prev);
          }
        }}
        onRedo={() => {
          if (editMode === 'json') {
            jsonEditorRef.current?.redo();
          } else {
            const next = redo();
            if (next) setDoc(next);
          }
        }}
        saving={saving}
        validating={validating}
        mode="profile"
        resolving={resolving}
      />

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

      {/* Main split views panels */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
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
                } catch (err) {
                  console.error("Syntax error:", err.message);
                }
              }}
            />
          </div>
        ) : (
          <>
            {/* Left sidebar tree representing the resolved catalog structure */}
            {resolvedCatalog ? (
              <ProfileSidebar
                resolvedCatalog={resolvedCatalog}
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
            ) : (
              <div style={{ width: '300px', borderRight: '1px solid var(--color-border)', padding: '20px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                Loading resolved controls...
              </div>
            )}

            {/* Right main workspace detail views */}
            {/* Right main workspace — 3-way conditional like CatalogPage */}
            <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
              {selectedControlId && selectedControl ? (
                <ControlDetailView
                  control={selectedControl}
                  isEditing={isEditing}
                  allUsedPropKeys={allUsedPropKeys}
                  mode="profile"
                  originalControl={findOriginalControl(selectedControlId)}
                  profile={profileData}
                  catalog={resolvedCatalog}
                  onProfileChange={(updatedProfile) => handleDocChange({ ...activeDoc, profile: updatedProfile })}
                  backMatterResources={(profileData['back-matter']?.resources) || []}
                  onSelectControl={handleSelectControl}
                  onSelectGroup={handleSelectGroup}
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
                />
              )}
            </div>
          </>
        )}
      </div>

      <VersionDrawer
        versions={versions}
        currentVersion={profileData.metadata?.version}
        show={showDrawer}
        isEditing={isEditing}
        onClose={() => setShowDrawer(false)}
        onSwitch={async (version) => {
          const loaded = await loadVersion(version);
          setDoc(loaded);
          resetUndoRedo(loaded);
          clearCache(); // Reset catalog caches for the new version
          setShowDrawer(false);
        }}
        onDelete={deleteVersionTag}
        onSave={async (versionNum, remarks) => {
          await saveVersionTag(versionNum, activeDoc, remarks);
          // Update local state with new version so currentVersion is in sync
          const updatedDoc = JSON.parse(JSON.stringify(activeDoc));
          if (updatedDoc.profile?.metadata) {
            updatedDoc.profile.metadata.version = versionNum;
          }
          setDoc(updatedDoc);
          resetUndoRedo(updatedDoc);
          
          // Exit edit mode when saving as a new version (backend automatically deletes draft)
          setIsEditing(false);
          
          setShowDrawer(false);
          await reload();
        }}
      />
    </div>
  );
}
