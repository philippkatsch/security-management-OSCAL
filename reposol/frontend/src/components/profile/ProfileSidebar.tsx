import React from 'react';
import { useControlTree } from '@hooks/useControlTree';
import { ControlTree } from '@components/shared/control-tree';
import sharedStyles from '@components/shared/SharedComponents.module.css';

export function ProfileSidebar({
  resolvedCatalog = {},
  selectedControlId = null,
  selectedGroupId = null,
  activeSidebarView = 'overview',
  onSelectControl,
  onSelectGroup,
  onSelectOverview,
  onSelectMetadata,
  onSelectProperties,
  onSelectParameters,
  onSelectBackMatter,
  onSelectImports,
  onSelectDiff,
  searchQuery = '',
  onSearchChange,
  isEditing = false
}: any) {
  const findNodeType = React.useCallback((id: string) => {
    const isGrp = (items: any[]): boolean => {
      if (!items) return false;
      for (const item of items) {
        if (item.id === id) return true;
        if (item.groups && isGrp(item.groups)) return true;
      }
      return false;
    };
    return isGrp(resolvedCatalog.groups || []) ? 'group' : 'control';
  }, [resolvedCatalog]);

  const tree = useControlTree({
    groups: resolvedCatalog.groups || [],
    controls: resolvedCatalog.controls || [],
    initialSelectedId: selectedControlId || selectedGroupId || null,
    onSelect: (id) => {
      if (!id) return;
      const type = findNodeType(id);
      if (type === 'group') {
        onSelectGroup(id);
      } else {
        onSelectControl(id);
      }
    },
    showWithdrawn: isEditing
  });
  
  // Sync external search query if needed (or just use tree's)
  React.useEffect(() => {
     if (searchQuery !== tree.searchQuery) {
         tree.setSearchQuery(searchQuery);
     }
  }, [searchQuery]);

  React.useEffect(() => {
     if (tree.searchQuery !== searchQuery && onSearchChange) {
         onSearchChange(tree.searchQuery);
     }
  }, [tree.searchQuery]);
  
  // Sync selected node
  const activeId = selectedControlId || selectedGroupId;
  React.useEffect(() => {
     if (activeId !== tree.selectedId) {
         tree.select(activeId);
     }
  }, [activeId]);
  
  const handleSelectNode = (id: string | null) => {
    tree.select(id);
    if (!id) return;
    const node = tree.flatList.find(n => n.id === id);
    if (node?.type === 'group') {
      onSelectGroup(id);
    } else {
      onSelectControl(id);
    }
  };

  const headerContent = (
    <div style={{ padding: '12px 12px 0 12px' }}>
      <div
        data-testid="profile-sidebar-overview"
        onClick={() => { tree.select(null); onSelectOverview(); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'overview') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>🏠</span>
          <span>Overview</span>
        </div>
      </div>
      <div
        data-testid="profile-sidebar-metadata"
        onClick={() => { tree.select(null); onSelectMetadata(); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'metadata') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>ℹ️</span>
          <span>Metadata</span>
        </div>
      </div>
      <div
        data-testid="profile-sidebar-properties"
        onClick={() => { tree.select(null); onSelectProperties(); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'properties') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>🏷️</span>
          <span>Properties</span>
        </div>
      </div>
      <div
        data-testid="profile-sidebar-parameters"
        onClick={() => { tree.select(null); onSelectParameters(); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'parameters') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>⚙️</span>
          <span>Parameters</span>
        </div>
      </div>
      <div
        data-testid="profile-sidebar-imports"
        onClick={() => { tree.select(null); onSelectImports(); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'imports') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>📥</span>
          <span>Imports</span>
        </div>
      </div>
      <div
        data-testid="profile-sidebar-diff"
        onClick={() => { tree.select(null); onSelectDiff && onSelectDiff(); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'diff') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>⚖️</span>
          <span>Baseline Diff</span>
        </div>
      </div>
      <div
        data-testid="profile-sidebar-backmatter"
        onClick={() => { tree.select(null); onSelectBackMatter(); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'back-matter') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>📖</span>
          <span>Back Matter</span>
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--color-border-subtle)', margin: '8px 0' }} />
    </div>
  );

  return (
    <ControlTree 
      tree={tree} 
      headerContent={headerContent} 
      renderNodeExtra={(node) => node.hasAlterations ? <span style={{fontSize: '10px', color: '#f59e0b'}}>●</span> : null}
    />
  );
}
