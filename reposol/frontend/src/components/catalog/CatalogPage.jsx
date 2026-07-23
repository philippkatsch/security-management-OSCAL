import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDocument } from '../../hooks/useDocument';
import { useVersions } from '../../hooks/useVersions';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { useDraft } from '../../hooks/useDraft';
import { DocumentToolbar } from '../shared/DocumentToolbar';
import { CatalogSidebar } from './CatalogSidebar';
import { GroupEditor } from '../shared/GroupEditor';
import { DocumentOverview } from '../shared/DocumentOverview';
import { ControlDetailView } from '../shared/ControlDetailView';
import { VersionDrawer } from '../shared/VersionDrawer';
import { ValidationFeedback } from '../shared/ValidationFeedback';
import { JsonEditor } from '../shared/JsonEditor';
import { ConfirmDialog } from '../shared/ConfirmDialog';

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
 * Orchestrating Catalog Page (View / Edit mode).
 */
export function CatalogPage({
  catalogId,
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
  } = useDocument('catalogs', catalogId);

  // 2. Versions Hook
  const {
    versions,
    showDrawer,
    setShowDrawer,
    save: saveVersionTag,
    saveDraft: saveDraftTag,
    remove: deleteVersionTag,
    switchTo: loadVersion
  } = useVersions('catalogs', catalogId);

  // 3. States
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [selectedControlId, setSelectedControlId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [activeSidebarView, setActiveSidebarView] = useState('overview');
  const [editMode, setEditMode] = useState('visual'); // visual | json
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [jsonText, setJsonText] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
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

  // 4. Undo / Redo Hook (stores full document states)
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

  // 5. Backend Draft Hook for Auto-save
  const {
    saveNow: saveDraftNow
  } = useDraft('catalog', catalogId, activeDoc, isEditing, 30000, saveDraftTag);

  // Auto-expand parent groups and the selected item itself when selection changes
  useEffect(() => {
    const activeId = selectedControlId || selectedGroupId;
    if (activeId && activeDoc?.catalog) {
      const ancestors = getAncestors(activeId, activeDoc.catalog);
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
  }, [selectedControlId, selectedGroupId, activeDoc]);

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

  // Helper function to update the active document and push to history
  const handleDocChange = (updated) => {
    setDoc(updated);
    pushUndoRedoState(updated);
  };

  // Switch between Visual & JSON mode
  const handleToggleEditMode = (mode) => {
    if (mode === 'json') {
      setJsonText(JSON.stringify(activeDoc, null, 2));
    } else {
      // Validate JSON syntax before switching back
      try {
        const parsed = JSON.parse(jsonText);
        handleDocChange(parsed);
      } catch (err) {
        alert(`JSON Syntax Error: Cannot switch to visual view. ${err.message}`);
        return;
      }
    }
    setEditMode(mode);
  };

  // Toggle Editing Mode (Exit saves draft to backend, edits main doc)
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
        alert(`Saving failed: ${err.message}`);
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
            if (!window.confirm("The JSON content is invalid and cannot be saved. Do you still want to proceed? Your unsaved JSON changes will be lost.")) {
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

  const handleCopy = () => {
    alert('Copy function is used in the SSP/Profile editor.');
  };

  const handleExport = () => {
    const format = window.prompt("Select format for export: json, yaml or xml", "json");
    if (!format) return;
    const fmt = format.trim().toLowerCase();
    if (['json', 'yaml', 'xml'].includes(fmt)) {
      window.open(`/api/export/catalogs/${catalogId}?format=${fmt}`, '_blank');
    } else {
      alert("Invalid format.");
    }
  };

  // --- Traverse Catalog helper functions ---
  const findControlById = (id, items = []) => {
    for (let item of items) {
      if (item.id === id) return item;
      if (item.controls) {
        const found = findControlById(id, item.controls);
        if (found) return found;
      }
      if (item.groups) {
        const found = findControlById(id, item.groups);
        if (found) return found;
      }
    }
    return null;
  };

  const findGroupById = (id, groupsList = []) => {
    for (let g of groupsList) {
      if (g.id === id) return g;
      if (g.groups) {
        const found = findGroupById(id, g.groups);
        if (found) return found;
      }
    }
    return null;
  };

  const updateControlInList = (id, updatedControl, items = []) => {
    return items.map(item => {
      if (item.id === id) return updatedControl;
      if (item.controls) {
        return { ...item, controls: updateControlInList(id, updatedControl, item.controls) };
      }
      if (item.groups) {
        return { ...item, groups: updateControlInList(id, updatedControl, item.groups) };
      }
      return item;
    });
  };

  const updateGroupInList = (id, updatedGroup, groupsList = []) => {
    return groupsList.map(g => {
      if (g.id === id) return updatedGroup;
      if (g.groups) {
        return { ...g, groups: updateGroupInList(id, updatedGroup, g.groups) };
      }
      return g;
    });
  };

  // --- Sidebar tree update callbacks ---
  const handleControlChange = (updatedControl) => {
    const catalogData = activeDoc.catalog || {};
    const rootControls = catalogData.controls || [];
    const rootGroups = catalogData.groups || [];

    let updatedCatalog = { ...catalogData };
    if (rootControls.some(c => c.id === controlId)) {
      updatedCatalog.controls = rootControls.map(c => c.id === controlId ? updatedControl : c);
    } else {
      updatedCatalog.groups = updateControlInList(controlId, updatedControl, rootGroups);
    }

    if (updatedControl.id && updatedControl.id !== controlId) {
      setSelectedControlId(updatedControl.id);
    }

    handleDocChange({ ...activeDoc, catalog: updatedCatalog });
  };

  const handleGroupChange = (updatedGroup) => {
    const catalogData = activeDoc.catalog || {};
    const rootGroups = catalogData.groups || [];

    let updatedCatalog = { ...catalogData };
    updatedCatalog.groups = updateGroupInList(groupId, updatedGroup, rootGroups);

    if (updatedGroup.id && updatedGroup.id !== groupId) {
      setSelectedGroupId(updatedGroup.id);
    }

    handleDocChange({ ...activeDoc, catalog: updatedCatalog });
  };

  // --- Dynamic Tags Calculation (US 1.10) ---
  const getUsedTagsSummary = (catalogData) => {
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
    (catalogData.groups || []).forEach(traverse);
    (catalogData.controls || []).forEach(traverse);
    return { summary, allKeys: Array.from(allKeys) };
  };

  // --- Global Property Management (DD-011 Central Hub) ---
  const handleGlobalPropertyRename = (oldName, newName) => {
    if (!oldName || !newName || oldName === newName) return;
    const catalogData = activeDoc.catalog || {};

    const renameInProps = (props) => {
      if (!props) return props;
      return props.map(p => p.name === oldName ? { ...p, name: newName } : p);
    };

    const traverseItem = (item) => {
      const result = { ...item };
      if (result.props) result.props = renameInProps(result.props);
      if (result.controls) result.controls = result.controls.map(traverseItem);
      if (result.groups) result.groups = result.groups.map(traverseItem);
      return result;
    };

    let updatedCatalog = { ...catalogData };
    if (updatedCatalog.metadata?.props) {
      updatedCatalog.metadata = { ...updatedCatalog.metadata, props: renameInProps(updatedCatalog.metadata.props) };
    }
    if (updatedCatalog.groups) updatedCatalog.groups = updatedCatalog.groups.map(traverseItem);
    if (updatedCatalog.controls) updatedCatalog.controls = updatedCatalog.controls.map(traverseItem);
    handleDocChange({ ...activeDoc, catalog: updatedCatalog });
  };

  const handleGlobalPropertyDelete = (propName) => {
    if (!propName) return;
    const catalogData = activeDoc.catalog || {};

    const removeFromProps = (props) => {
      if (!props) return props;
      const filtered = props.filter(p => p.name !== propName);
      return filtered.length > 0 ? filtered : undefined;
    };

    const traverseItem = (item) => {
      const result = { ...item };
      if (result.props) result.props = removeFromProps(result.props);
      if (result.controls) result.controls = result.controls.map(traverseItem);
      if (result.groups) result.groups = result.groups.map(traverseItem);
      return result;
    };

    let updatedCatalog = { ...catalogData };
    if (updatedCatalog.metadata?.props) {
      updatedCatalog.metadata = { ...updatedCatalog.metadata, props: removeFromProps(updatedCatalog.metadata.props) };
    }
    if (updatedCatalog.groups) updatedCatalog.groups = updatedCatalog.groups.map(traverseItem);
    if (updatedCatalog.controls) updatedCatalog.controls = updatedCatalog.controls.map(traverseItem);
    handleDocChange({ ...activeDoc, catalog: updatedCatalog });
  };
  const handleAddGroup = (parentGroupId) => {
    const catalogData = activeDoc.catalog || {};
    const rootGroups = catalogData.groups || [];
    const newGroup = {
      id: `group_new_${Date.now().toString().slice(-4)}`,
      title: 'New Group Folder',
      controls: []
    };

    let updatedCatalog = { ...catalogData };
    if (!parentGroupId) {
      // Add top-level group
      updatedCatalog.groups = [...rootGroups, newGroup];
    } else {
      // Nest group in parent
      const addNested = (groupsList) => {
        return groupsList.map(g => {
          if (g.id === parentGroupId) {
            const nested = g.groups ? [...g.groups] : [];
            return { ...g, groups: [...nested, newGroup] };
          }
          if (g.groups) {
            return { ...g, groups: addNested(g.groups) };
          }
          return g;
        });
      };
      updatedCatalog.groups = addNested(rootGroups);
    }
    handleDocChange({ ...activeDoc, catalog: updatedCatalog });
  };

  const handleAddControl = (groupId) => {
    const catalogData = activeDoc.catalog || {};
    const rootGroups = catalogData.groups || [];
    const newControl = {
      id: `control_${Date.now().toString().slice(-4)}`,
      title: 'New Control Requirement',
      parts: [{ id: `statement_${Date.now().toString().slice(-4)}`, name: 'statement', prose: '' }]
    };

    let updatedCatalog = { ...catalogData };
    const addControlToGroup = (groupsList) => {
      return groupsList.map(g => {
        if (g.id === groupId) {
          const groupCtrls = g.controls ? [...g.controls] : [];
          return { ...g, controls: [...groupCtrls, newControl] };
        }
        if (g.groups) {
          return { ...g, groups: addControlToGroup(g.groups) };
        }
        return g;
      });
    };
    updatedCatalog.groups = addControlToGroup(rootGroups);
    handleDocChange({ ...activeDoc, catalog: updatedCatalog });
  };

  const handleDeleteGroup = (id) => {
    if (!window.confirm('Are you sure you want to delete this folder and all sub-elements?')) return;
    const catalogData = activeDoc.catalog || {};
    const rootGroups = catalogData.groups || [];

    const removeGroup = (groupsList) => {
      return groupsList
        .filter(g => g.id !== id)
        .map(g => {
          if (g.groups) {
            return { ...g, groups: removeGroup(g.groups) };
          }
          return g;
        });
    };

    let updatedCatalog = { ...catalogData };
    updatedCatalog.groups = removeGroup(rootGroups);
    handleDocChange({ ...activeDoc, catalog: updatedCatalog });
    if (selectedGroupId === id) setSelectedGroupId(null);
  };

  const handleDeleteControl = (id) => {
    if (!window.confirm('Are you sure you want to delete this control?')) return;
    const catalogData = activeDoc.catalog || {};
    const rootControls = catalogData.controls || [];
    const rootGroups = catalogData.groups || [];

    const removeControl = (items) => {
      return items
        .filter(item => item.id !== id)
        .map(item => {
          if (item.controls) {
            return { ...item, controls: removeControl(item.controls) };
          }
          if (item.groups) {
            return { ...item, groups: removeControl(item.groups) };
          }
          return item;
        });
    };

    let updatedCatalog = { ...catalogData };
    if (rootControls.some(c => c.id === id)) {
      updatedCatalog.controls = rootControls.filter(c => c.id !== id);
    } else {
      updatedCatalog.groups = removeControl(rootGroups);
    }

    handleDocChange({ ...activeDoc, catalog: updatedCatalog });
    if (selectedControlId === id) setSelectedControlId(null);
  };

  // ── Sort-ID helpers (US 1.14) ─────────────────────────────────
  // Detect the sort-id pattern from existing values in a sibling list
  const detectSortIdPattern = (sortIdValues) => {
    if (!sortIdValues.length) return null;
    const sample = sortIdValues[0];

    // Dotted hierarchical: "00001.00001" or "00001.00001.00001"
    if (sample.includes('.')) {
      const parts = sample.split('.');
      const lastPart = parts[parts.length - 1];
      const prefix = parts.slice(0, -1).join('.');
      const pad = lastPart.length;
      return { type: 'dotted', prefix, pad };
    }

    // Prefix + number: "ac-01", "at-02"
    const prefixMatch = sample.match(/^(.+?)(\d+)$/);
    if (prefixMatch) {
      const prefix = prefixMatch[1]; // "ac-"
      const numStr = prefixMatch[2]; // "01"
      // If prefix ends with a separator like "-", it's prefix-num
      if (/[^a-zA-Z0-9]$/.test(prefix) || prefix === '') {
        return { type: 'prefix-num', prefix, pad: numStr.length };
      }
      // Could be pure numeric like "00001" — check if prefix is empty after stripping digits
      if (/^\d+$/.test(sample)) {
        return { type: 'pure-num', pad: sample.length };
      }
      // Generic prefix+number
      return { type: 'prefix-num', prefix, pad: numStr.length };
    }

    // Pure numeric: "00001"
    if (/^\d+$/.test(sample)) {
      return { type: 'pure-num', pad: sample.length };
    }

    return null; // unknown pattern
  };

  // Generate a sort-id value from a pattern and 0-based index
  const generateSortId = (pattern, index) => {
    const num = String(index + 1).padStart(pattern.pad, '0');
    switch (pattern.type) {
      case 'pure-num':
        return num;
      case 'prefix-num':
        return `${pattern.prefix}${num}`;
      case 'dotted':
        return `${pattern.prefix}.${num}`;
      default:
        return num;
    }
  };

  // Recalculate sort-id props for all items in a sibling array
  const recalculateSortIds = (siblings) => {
    if (!siblings || siblings.length === 0) return;

    // Collect existing sort-id props
    const existingSortIds = siblings
      .map(item => (item.props || []).find(p => p.name === 'sort-id'))
      .filter(Boolean);

    // If no items have sort-ids, skip (Array position = order)
    if (existingSortIds.length === 0) return;

    const pattern = detectSortIdPattern(existingSortIds.map(p => p.value));
    if (!pattern) return;

    // Reassign sort-ids based on new array position
    siblings.forEach((item, index) => {
      if (!item.props) item.props = [];
      const sortIdProp = item.props.find(p => p.name === 'sort-id');
      const newValue = generateSortId(pattern, index);

      if (sortIdProp) {
        sortIdProp.value = newValue;
      } else {
        // Only add sort-id if majority of siblings have one
        if (existingSortIds.length >= siblings.length / 2) {
          item.props.push({ name: 'sort-id', value: newValue });
        }
      }
    });
  };

  // Recursive helper to find and remove an item from any array within catalog
  const findAndRemoveItem = (container, id) => {
    if (container.groups) {
      const idx = container.groups.findIndex(g => g.id === id);
      if (idx !== -1) {
        return { array: container.groups, index: idx, item: container.groups.splice(idx, 1)[0] };
      }
      for (const g of container.groups) {
        const res = findAndRemoveItem(g, id);
        if (res) return res;
      }
    }
    if (container.controls) {
      const idx = container.controls.findIndex(c => c.id === id);
      if (idx !== -1) {
        return { array: container.controls, index: idx, item: container.controls.splice(idx, 1)[0] };
      }
      for (const c of container.controls) {
        const res = findAndRemoveItem(c, id);
        if (res) return res;
      }
    }
    return null;
  };

  // Recursive helper to find target parent node by id (to drop inside it)
  const findNodeById = (container, id) => {
    if (container.id === id) return container;
    if (container.groups) {
      for (const g of container.groups) {
        const found = findNodeById(g, id);
        if (found) return found;
      }
    }
    if (container.controls) {
      for (const c of container.controls) {
        const found = findNodeById(c, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Recursive helper to find the parent array and index of any item within catalog
  const findParentArrayAndIndex = (container, id) => {
    if (container.groups) {
      const idx = container.groups.findIndex(g => g.id === id);
      if (idx !== -1) {
        return { array: container.groups, index: idx };
      }
      for (const g of container.groups) {
        const res = findParentArrayAndIndex(g, id);
        if (res) return res;
      }
    }
    if (container.controls) {
      const idx = container.controls.findIndex(c => c.id === id);
      if (idx !== -1) {
        return { array: container.controls, index: idx };
      }
      for (const c of container.controls) {
        const res = findParentArrayAndIndex(c, id);
        if (res) return res;
      }
    }
    return null;
  };

  const handleMoveItem = (draggedId, draggedType, targetId, targetType, position) => {
    const catalogData = activeDoc.catalog || {};
    let updatedCatalog = JSON.parse(JSON.stringify(catalogData)); // deep clone

    // 1. Remove the dragged item from its current position recursively
    const removeResult = findAndRemoveItem(updatedCatalog, draggedId);
    if (!removeResult || !removeResult.item) return; // element not found
    const draggedItem = removeResult.item;

    // 1b. Recalculate sort-ids for the SOURCE sibling array (the one the item was removed from)
    if (removeResult.array && removeResult.array.length > 0) {
      recalculateSortIds(removeResult.array);
    }

    // 2. Insert at target position
    if (position === 'inside') {
      // Find the target node in updatedCatalog
      const targetNode = findNodeById(updatedCatalog, targetId);
      if (targetNode) {
        const key = draggedType === 'group' ? 'groups' : 'controls';
        if (!targetNode[key]) targetNode[key] = [];
        targetNode[key].push(draggedItem);
      }
    } else if (position === 'root') {
      // Insert at root level
      const key = draggedType === 'group' ? 'groups' : 'controls';
      if (!updatedCatalog[key]) updatedCatalog[key] = [];
      updatedCatalog[key].push(draggedItem);
    } else {
      // position === 'before' or 'after'
      const siblingResult = findParentArrayAndIndex(updatedCatalog, targetId);
      if (siblingResult) {
        const insertIdx = position === 'before' ? siblingResult.index : siblingResult.index + 1;
        siblingResult.array.splice(insertIdx, 0, draggedItem);
      }
    }

    // Clean up empty arrays (OSCAL requires minItems: 1)
    const cleanEmpty = (obj) => {
      if (obj.groups && obj.groups.length === 0) delete obj.groups;
      if (obj.controls && obj.controls.length === 0) delete obj.controls;
      if (obj.groups) obj.groups.forEach(cleanEmpty);
      if (obj.controls) obj.controls.forEach(cleanEmpty);
    };
    cleanEmpty(updatedCatalog);

    // 3. Recalculate sort-id props for the DESTINATION sibling array the dragged item landed in
    const landedResult = findParentArrayAndIndex(updatedCatalog, draggedId);
    if (landedResult && landedResult.array) {
      recalculateSortIds(landedResult.array);
    }

    handleDocChange({ ...activeDoc, catalog: updatedCatalog });
  };


  // --- Rendering resolution logic ---
  if (loading) return <div style={{ padding: '20px', color: 'var(--color-text-muted)' }}>Loading catalog...</div>;
  if (error) return <div style={{ padding: '20px', color: 'var(--color-danger)' }}>Error: {error}</div>;
  if (!doc) return <div style={{ padding: '20px' }}>No document loaded.</div>;

  const catalogData = activeDoc.catalog || {};
  const controlId = selectedControlId;
  const groupId = selectedGroupId;

  const selectedControl = controlId ? findControlById(controlId, [catalogData]) : null;
  const selectedGroup = groupId ? findGroupById(groupId, catalogData.groups || []) : null;

  const { summary: usedTagsSummary, allKeys: scannedKeys } = getUsedTagsSummary(catalogData);
  const allUsedPropKeys = Array.from(new Set([
    ...scannedKeys,
    ...(catalogData.metadata?.props || []).map(p => p.name).filter(Boolean)
  ]));

  return (
    <div
      className="catalog-viewer"
      data-testid="catalog-viewer"
      data-catalog-id={catalogId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--color-background)',
        overflow: 'hidden'
      }}
    >
      {/* 1. Header Toolbar */}
      <DocumentToolbar
        title={catalogData.metadata?.title}
        isEditing={isEditing}
        onToggleEdit={handleToggleEdit}
        onCopy={handleCopy}
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
        mode="catalog"
      />

      {/* Validation Feedback Box */}
      {validationResult && (
        <div style={{ padding: '0 20px' }}>
          <ValidationFeedback result={validationResult} />
        </div>
      )}

      {/* 2. Main split view panels */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {editMode === 'json' ? (
          <div style={{ flex: 1, padding: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <JsonEditor
              ref={jsonEditorRef}
              value={jsonText}
              onChange={setJsonText}
              highlightId={selectedControlId || selectedGroupId}
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
            {/* Sidebar tree (Groups/Controls navigation list) */}
            <CatalogSidebar
              catalog={catalogData}
              selectedControlId={controlId}
              selectedGroupId={groupId}
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
                setActiveSidebarView('import');
              }}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              expandedGroups={expandedGroups}
              onToggleGroup={(id) => setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }))}
              isEditing={isEditing}
              onAddGroup={handleAddGroup}
              onAddControl={handleAddControl}
              onDeleteGroup={handleDeleteGroup}
              onDeleteControl={handleDeleteControl}
              onMoveItem={handleMoveItem}
            />

            {/* Main content right panel */}
            <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
              {selectedControl ? (
                <ControlDetailView
                  control={selectedControl}
                  isEditing={isEditing}
                  allUsedPropKeys={allUsedPropKeys}
                  mode="catalog"
                  catalog={catalogData}
                  onControlChange={handleControlChange}
                  onSelectControl={handleSelectControl}
                  onSelectGroup={handleSelectGroup}
                />
              ) : selectedGroup ? (
                <GroupEditor
                  group={selectedGroup}
                  catalog={catalogData}
                  onChange={handleGroupChange}
                  isEditing={isEditing}
                  allUsedPropKeys={allUsedPropKeys}
                  onSelectGroup={handleSelectGroup}
                  onSelectControl={handleSelectControl}
                />
              ) : (
                <DocumentOverview
                  document={catalogData}
                  onChange={(updatedCatalog) => handleDocChange({ ...activeDoc, catalog: updatedCatalog })}
                  isEditing={isEditing}
                  allUsedPropKeys={allUsedPropKeys}
                  usedTagsSummary={usedTagsSummary}
                  mode="catalog"
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
        currentVersion={catalogData.metadata?.version}
        show={showDrawer}
        isEditing={isEditing}
        onClose={() => setShowDrawer(false)}
        onSwitch={async (version) => {
          const loaded = await loadVersion(version);
          setDoc(loaded);
          resetUndoRedo(loaded);
          setShowDrawer(false);
        }}
        onDelete={deleteVersionTag}
        onSave={async (versionNum, remarks) => {
          await saveVersionTag(versionNum, activeDoc, remarks);
          // Update local state with new version so currentVersion is in sync
          const updatedDoc = JSON.parse(JSON.stringify(activeDoc));
          if (updatedDoc.catalog?.metadata) {
            updatedDoc.catalog.metadata.version = versionNum;
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
