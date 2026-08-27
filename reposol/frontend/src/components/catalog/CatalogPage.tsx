import React, { useState, useEffect, useRef } from 'react';
import { useDocumentLifecycle } from '@hooks/useDocumentLifecycle';
import { useDocumentActions } from '@hooks/useDocumentActions';
import { updateDocumentWith } from '@lib/document-updater';
import {
  addGroup,
  addControl,
  removeControl,
  removeGroup,
  moveNode,
  withdrawControl,
  restoreControl,
  withdrawAllControlsInGroup,
  restoreAllControlsInGroup
} from '@lib/document-actions/catalog-actions';
import { DocumentPageLayout } from '../layout/DocumentPageLayout';
import { GroupEditor } from '@components/shared/GroupEditor';
import { DocumentOverview } from '@components/shared/DocumentOverview';
import { MetadataEditor } from '@components/shared/MetadataEditor';
import { UnifiedControlEditor } from '@components/shared/control-editor/UnifiedControlEditor';
import { JsonEditor } from '@components/shared/JsonEditor';
import styles from './CatalogPage.module.css';
import { useControlTree } from '@hooks/useControlTree';
import { ControlTree } from '@components/shared/control-tree';
import sharedStyles from '@components/shared/SharedComponents.module.css';

export interface CatalogPageProps {
  catalogId?: string;
  docTitle?: string;
  initialEditMode?: boolean;
  onClose?: () => void;
}

export const CatalogPage: React.FC<CatalogPageProps> = ({
  catalogId = '',
  initialEditMode = false,
  onClose
}) => {
  const lifecycle = useDocumentLifecycle('catalogs', 'catalog', catalogId, initialEditMode);
  
  const {
    activeDoc,
    setDoc,
    isEditing,
    editMode,
    pushUndoRedoState,
    setEditMode,
  } = lifecycle;
  const { dispatch } = useDocumentActions(lifecycle);

  const [activeSidebarView, setActiveSidebarView] = useState<string | null>('overview');
  const jsonEditorRef = useRef<any>(null);

  const catalogData: any = activeDoc?.catalog || {};

  const findControl = (nodeId: string, doc: any): any => {
    const searchControls = (controls: any[] = []): any => {
      for (const c of controls) {
        if (c.id === nodeId) return c;
        if (c.controls) {
          const found = searchControls(c.controls);
          if (found) return found;
        }
      }
      return null;
    };
    const searchGroups = (groups: any[] = []): any => {
      for (const g of groups) {
        const found = searchControls(g.controls);
        if (found) return found;
        const foundInGroup = searchGroups(g.groups);
        if (foundInGroup) return foundInGroup;
      }
      return null;
    };
    return searchControls(doc.controls) || searchGroups(doc.groups);
  };

  const findGroup = (nodeId: string, doc: any): any => {
    const searchGroups = (groups: any[] = []): any => {
      for (const g of groups) {
        if (g.id === nodeId) return g;
        if (g.groups) {
          const found = searchGroups(g.groups);
          if (found) return found;
        }
      }
      return null;
    };
    return searchGroups(doc.groups);
  };

  const handleGroupChange = (updatedGroup: any) => {
    const targetId = tree.selectedId;
    handleUpdate((draft: any) => {
      if (!draft.catalog) return;
      const updateGrp = (groups: any[] = []): boolean => {
        for (let i = 0; i < groups.length; i++) {
          if (groups[i].id === targetId || groups[i].id === updatedGroup.id) {
            groups[i] = updatedGroup;
            return true;
          }
          if (groups[i].groups && updateGrp(groups[i].groups)) {
            return true;
          }
        }
        return false;
      };
      if (draft.catalog.groups) {
        updateGrp(draft.catalog.groups);
      }
    });

    if (updatedGroup.id && updatedGroup.id !== targetId) {
      tree.select(updatedGroup.id);
    }
  };

  const handleControlChange = (updatedControl: any) => {
    const targetId = tree.selectedId;
    handleUpdate((draft: any) => {
      if (!draft.catalog) return;
      const updateInControls = (controls: any[] = []): boolean => {
        for (let i = 0; i < controls.length; i++) {
          if (controls[i].id === targetId || controls[i].id === updatedControl.id) {
            controls[i] = updatedControl;
            return true;
          }
          if (controls[i].controls && updateInControls(controls[i].controls)) {
            return true;
          }
        }
        return false;
      };
      const updateInGroups = (groups: any[] = []): boolean => {
        for (let i = 0; i < groups.length; i++) {
          if (groups[i].controls && updateInControls(groups[i].controls)) {
            return true;
          }
          if (groups[i].groups && updateInGroups(groups[i].groups)) {
            return true;
          }
        }
        return false;
      };
      if (draft.catalog.controls && updateInControls(draft.catalog.controls)) return;
      if (draft.catalog.groups && updateInGroups(draft.catalog.groups)) return;
    });

    if (updatedControl.id && updatedControl.id !== targetId) {
      tree.select(updatedControl.id);
    }
  };

  const handleControlSelect = (id: string | null) => {
    if (!id) {
       setActiveSidebarView('overview');
       return;
    }
    setActiveSidebarView(null);
  };

  const tree = useControlTree({
    groups: catalogData.groups || [],
    controls: catalogData.controls || [],
    onSelect: handleControlSelect,
    showWithdrawn: isEditing
  });

  useEffect(() => {
    if (!isEditing && tree.selectedNode?.withdrawn) {
      tree.select(null);
      setActiveSidebarView('overview');
    }
  }, [isEditing, tree.selectedNode, tree]);

  const handleDocChange = (updated: any) => {
    let parsed = updated;
    if (typeof updated === 'string') {
      try {
        parsed = JSON.parse(updated);
      } catch (e) {
        // Invalid JSON string - do not push invalid state to document object
        return;
      }
    }
    setDoc(parsed);
    pushUndoRedoState(parsed);
  };

  const handleUpdate = (updater: (draft: any) => void) => {
    const nextDoc = updateDocumentWith(activeDoc, updater);
    handleDocChange(nextDoc);
  };

  // Extract property usage across catalog controls and groups
  const getUsedTagsSummary = () => {
    const summary: Record<string, Record<string, number>> = {};
    const allKeys = new Set<string>();
    const traverse = (item: any) => {
      const props = item.props || [];
      props.forEach((p: any) => {
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
    if (catalogData.controls) catalogData.controls.forEach(traverse);
    if (catalogData.groups) catalogData.groups.forEach(traverse);
    return { summary, allKeys: Array.from(allKeys) };
  };

  const { summary: usedTagsSummary, allKeys: scannedKeys } = getUsedTagsSummary();
  const allUsedPropKeys = Array.from(new Set([
    ...scannedKeys,
    ...(catalogData.metadata?.props || []).map((p: any) => p.name).filter(Boolean)
  ]));

  const handleGlobalPropertyRename = (oldName: string, newName: string) => {
    if (!oldName || !newName || oldName === newName) return;
    handleUpdate((draft: any) => {
      if (!draft.catalog) return;
      const renameInProps = (props: any[]) => {
        if (!props) return props;
        return props.map((p: any) => p.name === oldName ? { ...p, name: newName } : p);
      };
      if (draft.catalog.metadata?.props) {
        draft.catalog.metadata.props = renameInProps(draft.catalog.metadata.props);
      }
    });
  };

  const handleGlobalPropertyDelete = (propName: string) => {
    if (!propName) return;
    handleUpdate((draft: any) => {
      if (!draft.catalog) return;
      if (draft.catalog.metadata?.props) {
        draft.catalog.metadata.props = draft.catalog.metadata.props.filter((p: any) => p.name !== propName);
      }
    });
  };

  const handleAddGroup = (parentGroupId: string | null) => {
    const newId = `group-${Date.now().toString(36)}`;
    dispatch(addGroup(parentGroupId, { id: newId, title: 'New Group' }));
    if (parentGroupId) {
      tree.expandToNode(parentGroupId);
    }
    setTimeout(() => {
      if (parentGroupId) tree.expandToNode(parentGroupId);
      tree.expandToNode(newId);
      tree.select(newId);
    }, 50);
  };

  const handleAddControl = (parentGroupId: string | null) => {
    const newId = `ctrl-${Date.now().toString(36)}`;
    dispatch(addControl(parentGroupId, { id: newId, title: 'New Control' }));
    if (parentGroupId) {
      tree.expandToNode(parentGroupId);
    }
    setTimeout(() => {
      if (parentGroupId) tree.expandToNode(parentGroupId);
      tree.expandToNode(newId);
      tree.select(newId);
    }, 50);
  };

  const handleDeleteNode = (nodeId: string, nodeType: 'group' | 'control') => {
    if (nodeType === 'group') {
      dispatch(removeGroup(nodeId));
    } else {
      dispatch(removeControl(nodeId));
    }
    if (tree.selectedId === nodeId) {
      tree.select(null);
      setActiveSidebarView('overview');
    }
  };

  const handleWithdrawNode = (controlId: string) => {
    dispatch(withdrawControl(controlId));
  };

  const handleRestoreNode = (controlId: string) => {
    dispatch(restoreControl(controlId));
  };

  const handleWithdrawAllInGroup = (groupId: string) => {
    dispatch(withdrawAllControlsInGroup(groupId));
  };

  const handleRestoreAllInGroup = (groupId: string) => {
    dispatch(restoreAllControlsInGroup(groupId));
  };

  const handleMoveNode = (nodeId: string, targetParentId: string | null, targetIndex?: number) => {
    dispatch(moveNode(nodeId, targetParentId, targetIndex));
  };

  const tabs = [
    { id: 'visual', label: 'Visual' },
    { id: 'json', label: 'JSON Source' }
  ];

  const headerContent = (
    <div style={{ padding: '12px 12px 0 12px' }}>
      <div
        data-testid="catalog-sidebar-overview"
        onClick={() => { tree.select(null); setActiveSidebarView('overview'); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'overview') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>🏠</span>
          <span>Overview</span>
        </div>
      </div>
      <div
        data-testid="catalog-sidebar-metadata"
        onClick={() => { tree.select(null); setActiveSidebarView('metadata'); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'metadata') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>ℹ️</span>
          <span>Metadata</span>
        </div>
      </div>
      <div
        data-testid="catalog-sidebar-properties"
        onClick={() => { tree.select(null); setActiveSidebarView('properties'); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'properties') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>🏷️</span>
          <span>Properties</span>
        </div>
      </div>
      <div
        data-testid="catalog-sidebar-parameters"
        onClick={() => { tree.select(null); setActiveSidebarView('parameters'); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'parameters') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>⚙️</span>
          <span>Parameters</span>
        </div>
      </div>
      <div
        data-testid="catalog-sidebar-backmatter"
        onClick={() => { tree.select(null); setActiveSidebarView('backmatter'); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && (activeSidebarView === 'backmatter' || activeSidebarView === 'back-matter')) ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>📖</span>
          <span>Back Matter</span>
        </div>
      </div>
      {isEditing && (
        <div
          data-testid="catalog-sidebar-import"
          onClick={() => { tree.select(null); setActiveSidebarView('import'); }}
          className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'import') ? sharedStyles['sidebar-item-selected'] : ''}`}
          style={{ fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>📥</span>
            <span>Import Catalog</span>
          </div>
        </div>
      )}
      <div style={{ borderTop: '1px solid var(--color-border-subtle)', margin: '8px 0' }} />
    </div>
  );

  return (
    <DocumentPageLayout
      stage="catalogs"
      docId={catalogId}
      lifecycle={lifecycle}
      title={catalogData.metadata?.title || 'Untitled Catalog'}
      tabs={tabs}
      activeTab={editMode}
      onTabChange={(mode) => {
        if (editMode === 'json' && mode !== 'json') {
          const entityId = jsonEditorRef.current?.getCursorEntityId?.();
          if (entityId) tree.select(entityId);
        }
        setEditMode(mode);
      }}
      onClose={onClose}
      sidebar={
        <ControlTree
          tree={tree}
          headerContent={headerContent}
          isEditing={isEditing}
          onMoveNode={handleMoveNode}
          onAddGroup={handleAddGroup}
          onAddControl={handleAddControl}
          onDeleteNode={handleDeleteNode}
          onWithdrawNode={handleWithdrawNode}
          onRestoreNode={handleRestoreNode}
          onWithdrawAllInGroup={handleWithdrawAllInGroup}
          onRestoreAllInGroup={handleRestoreAllInGroup}
        />
      }
    >
      <div className={styles['catalog-main-content']}>
        {editMode === 'visual' && (
          <div className={styles['main-layout']}>
              {tree.selectedNode?.type === 'control' ? (
                <UnifiedControlEditor
                   control={findControl(tree.selectedId!, catalogData) || { id: tree.selectedId! }}
                   stage="catalog"
                   isEditing={isEditing}
                   catalog={catalogData}
                   allUsedPropKeys={allUsedPropKeys}
                   backMatterResources={catalogData['back-matter']?.resources || []}
                   onSelectControl={(id: string) => tree.select(id)}
                   onChange={handleControlChange}
                />
              ) : tree.selectedNode?.type === 'group' ? (
                 <GroupEditor 
                    group={findGroup(tree.selectedId!, catalogData) || { id: tree.selectedId! }}
                    catalog={catalogData}
                    isEditing={isEditing} 
                    allUsedPropKeys={allUsedPropKeys}
                    onChange={handleGroupChange}
                    onSelectGroup={(id: string) => tree.select(id)}
                    onSelectControl={(id: string) => tree.select(id)}
                 />
              ) : activeSidebarView === 'metadata' ? (
                <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text)' }}>Document Metadata</h2>
                  <MetadataEditor
                    metadata={catalogData.metadata || {}}
                    onChange={(updatedMeta: any) => {
                      handleUpdate((draft: any) => {
                        if (draft.catalog) draft.catalog.metadata = updatedMeta;
                      });
                    }}
                    readOnly={!isEditing}
                    onNavigateToProperties={() => {
                      tree.select(null);
                      setActiveSidebarView('properties');
                    }}
                  />
                </div>
              ) : (
                <DocumentOverview 
                  document={catalogData} 
                  mode="catalog"
                  activeView={activeSidebarView}
                  isEditing={isEditing} 
                  allUsedPropKeys={allUsedPropKeys}
                  usedTagsSummary={usedTagsSummary}
                  onSelectGroup={(id: string) => tree.select(id)}
                  onSelectControl={(id: string) => tree.select(id)}
                  onGlobalPropertyRename={handleGlobalPropertyRename}
                  onGlobalPropertyDelete={handleGlobalPropertyDelete}
                  onNavigateToProperties={() => {
                    tree.select(null);
                    setActiveSidebarView('properties');
                  }}
                  onChange={(updatedDoc: any) => {
                    handleUpdate((draft: any) => {
                      draft.catalog = { ...draft.catalog, ...updatedDoc };
                    });
                  }} 
                />
              )}
          </div>
        )}
        {editMode === 'json' && (
          <JsonEditor
            ref={jsonEditorRef}
            value={activeDoc}
            onChange={handleDocChange}
            onValidate={lifecycle.validate}
            readOnly={!isEditing}
            highlightId={tree.selectedId}
          />
        )}
      </div>
    </DocumentPageLayout>
  );
};

export default CatalogPage;
