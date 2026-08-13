import React, { useState, useEffect } from 'react';
import { useDocumentLifecycle } from '@hooks/useDocumentLifecycle';
import { useDocumentActions } from '@hooks/useDocumentActions';
import { updateDocumentWith } from '@lib/document-updater';
import { DocumentPageLayout } from '../layout/DocumentPageLayout';
import { GroupEditor } from '@components/shared/GroupEditor';
import { DocumentOverview } from '@components/shared/DocumentOverview';
import { UnifiedControlEditor } from '@components/shared/control-editor/UnifiedControlEditor';
import { JsonEditor } from '@components/shared/JsonEditor';
import styles from './CatalogPage.module.css';
import { useControlTree } from '@hooks/useControlTree';
import { ControlTree } from '@components/shared/control-tree';
import sharedStyles from '@components/shared/SharedComponents.module.css';

export interface CatalogPageProps {
  catalogId: string;
  initialEditMode?: boolean;
  onClose?: () => void;
}

export const CatalogPage: React.FC<CatalogPageProps> = ({
  catalogId,
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

  const catalogData = activeDoc?.catalog || {};

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
    showWithdrawn: true
  });

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

  const tabs = [
    { id: 'visual', label: 'Visual' },
    { id: 'json', label: 'JSON Source' }
  ];

  const headerContent = (
    <div style={{ padding: '12px 12px 0 12px' }}>
      <div
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
        onClick={() => { tree.select(null); setActiveSidebarView('metadata'); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'metadata') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>ℹ️</span>
          <span>Metadata</span>
        </div>
      </div>
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
      onTabChange={(mode) => setEditMode(mode)}
      onClose={onClose}
      sidebarOpen={true}
      sidebar={
        <div style={{ width: '300px', height: '100%', background: 'var(--color-surface)' }}>
           <ControlTree tree={tree} headerContent={headerContent} />
        </div>
      }
    >
      <div className={styles['catalog-main-content']}>
        {editMode === 'visual' && (
          <div className={styles['main-layout']}>
             {activeSidebarView === 'overview' && (
               <DocumentOverview 
                 document={activeDoc} 
                 type="catalog" 
                 isEditing={isEditing} 
                 onChange={handleDocChange} 
               />
             )}
             {tree.selectedNode?.type === 'group' && (
               <GroupEditor 
                  group={/* fetch group */ {}} 
                  isEditing={isEditing} 
                  onChange={(group) => {}}
               />
             )}
             {tree.selectedNode?.type === 'control' && (
               <UnifiedControlEditor
                  control={findControl(tree.selectedId!, catalogData) || { id: tree.selectedId! }}
                  stage="catalog"
                  isEditing={isEditing}
                  catalog={catalogData}
                  onSelectControl={(id: string) => tree.select(id)}
                  onChange={(updated: any) => {
                     handleUpdate((draft: any) => {
                       if (!draft.catalog) return;
                       const updateCtrl = (controls: any[] = []): boolean => {
                         for (let i = 0; i < controls.length; i++) {
                           if (controls[i].id === updated.id) {
                             controls[i] = updated;
                             return true;
                           }
                           if (controls[i].controls && updateCtrl(controls[i].controls)) return true;
                         }
                         return false;
                       };
                       const updateGrp = (groups: any[] = []): boolean => {
                         for (const g of groups) {
                           if (g.controls && updateCtrl(g.controls)) return true;
                           if (g.groups && updateGrp(g.groups)) return true;
                         }
                         return false;
                       };
                       if (draft.catalog.controls) updateCtrl(draft.catalog.controls);
                       if (draft.catalog.groups) updateGrp(draft.catalog.groups);
                     });
                  }}
               />
             )}
          </div>
        )}
        {editMode === 'json' && (
          <JsonEditor
            value={activeDoc}
            onChange={handleDocChange}
            onValidate={lifecycle.validate}
            readOnly={!isEditing}
          />
        )}
      </div>
    </DocumentPageLayout>
  );
};

export default CatalogPage;
