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
  searchQuery = '',
  onSearchChange
}: any) {
  const tree = useControlTree({
    groups: resolvedCatalog.groups || [],
    controls: resolvedCatalog.controls || [],
    initialSelectedId: selectedControlId || selectedGroupId || null,
    onSelect: (id) => {
      // Need to figure out if id is a group or control.
      // useControlTree maintains `selectedNode` but it only updates after render.
      // We can use a trick or just let the page track it.
      // For now, if we don't know, we could check the flatList.
    },
    showWithdrawn: true
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
     if (activeId && activeId !== tree.selectedId) {
         tree.select(activeId);
     }
  }, [activeId]);
  
  // Custom onSelect logic that bridges ControlTree with ProfilePage
  const handleSelect = (id: string | null) => {
      tree.select(id);
      if (!id) {
          onSelectOverview();
          return;
      }
      const node = tree.flatList.find(n => n.id === id);
      if (node?.type === 'group') {
          onSelectGroup(id);
      } else {
          onSelectControl(id);
      }
  };
  
  // Override the tree's select to use our bridging logic
  tree.select = handleSelect;

  const headerContent = (
    <div style={{ padding: '12px 12px 0 12px' }}>
      <div
        onClick={() => handleSelect(null)}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'overview') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>🏠</span>
          <span>Overview</span>
        </div>
      </div>
      <div
        onClick={() => { handleSelect(null); onSelectMetadata(); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'metadata') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>ℹ️</span>
          <span>Metadata</span>
        </div>
      </div>
      <div
        onClick={() => { handleSelect(null); onSelectProperties(); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'properties') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>🏷️</span>
          <span>Properties</span>
        </div>
      </div>
      <div
        onClick={() => { handleSelect(null); onSelectParameters(); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'parameters') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>⚙️</span>
          <span>Parameters</span>
        </div>
      </div>
      <div
        onClick={() => { handleSelect(null); onSelectImports(); }}
        className={`${sharedStyles['sidebar-item']} ${(!tree.selectedId && activeSidebarView === 'imports') ? sharedStyles['sidebar-item-selected'] : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>📥</span>
          <span>Imports</span>
        </div>
      </div>
      <div
        onClick={() => { handleSelect(null); onSelectBackMatter(); }}
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
    <div style={{ width: '300px', height: '100%', background: 'var(--color-surface)' }}>
      <ControlTree 
        tree={tree} 
        headerContent={headerContent} 
        renderNodeExtra={(node) => node.hasAlterations ? <span style={{fontSize: '10px', color: '#f59e0b'}}>●</span> : null}
      />
    </div>
  );
}
