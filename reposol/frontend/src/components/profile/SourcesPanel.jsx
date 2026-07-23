import React, { useState, useMemo } from 'react';
import { ImportManager } from './ImportManager';

export function SourcesPanel({
  profile = {},
  onChange,
  isEditing = false,
  availableCatalogs = [],
  availableProfiles = [],
  catalogCache = null,
  resolvedCatalog = null
}) {
  const [poolSearch, setPoolSearch] = useState('');

  const handleImportsChange = (updatedImports) => {
    if (updatedImports.length === 0) {
      let cleanMerge = { ...(profile.merge || {}) };
      delete cleanMerge.custom;
      delete cleanMerge.flat;
      cleanMerge['as-is'] = true;
      onChange({ ...profile, imports: [], merge: cleanMerge });
    } else {
      onChange({ ...profile, imports: updatedImports });
    }
  };

  const handleCopyStructure = (href, mode = 'all') => {
    const match = href.match(/([a-f0-9-]{36})/i);
    const uuid = match ? match[1]?.toLowerCase() : null;
    if (!uuid || !catalogCache) return;

    const cacheEntry = catalogCache.get(uuid);
    const docData = cacheEntry?.data || cacheEntry;
    const catalog = docData?.catalog || docData?.profile;
    if (!catalog) {
      alert('Document data has not been loaded yet. Please load the profile first.');
      return;
    }

    const isAll = mode === 'all';

    const mapCatalogGroupToCustomGroup = (g) => {
      const customGroup = {
        id: g.id || `custom_grp_${Math.random().toString(36).slice(2, 6)}`,
        title: g.title || 'Untitled Group',
      };

      if (isAll) {
        const controlIds = (g.controls || []).map(c => c.id);
        if (controlIds.length > 0) {
          customGroup['insert-controls'] = [
            {
              order: 'keep',
              'include-controls': [
                { 'with-ids': controlIds }
              ]
            }
          ];
        } else {
          customGroup['insert-controls'] = [];
        }
      } else {
        customGroup['insert-controls'] = [];
      }

      if (g.groups && g.groups.length > 0) {
        customGroup.groups = g.groups.map(mapCatalogGroupToCustomGroup);
      }

      return customGroup;
    };

    const sourceGroups = catalog.groups || [];
    const customGroups = sourceGroups.map(mapCatalogGroupToCustomGroup);

    const existingGroups = profile.merge?.custom?.groups || [];
    const existingGroupIds = new Set(existingGroups.map(g => g.id));
    const newGroups = customGroups.filter(g => !existingGroupIds.has(g.id));
    const mergedGroups = [...existingGroups, ...newGroups];

    const existingInsert = profile.merge?.custom?.['insert-controls'] || [];
    let mergedInsertControls = [...existingInsert];

    if (isAll) {
      const topLevelControlIds = (catalog.controls || []).map(c => c.id);
      if (topLevelControlIds.length > 0) {
        const existingIds = new Set();
        existingInsert.forEach(ic => {
          if (ic['include-controls']) {
            ic['include-controls'].forEach(inc => {
              if (inc['with-ids']) {
                inc['with-ids'].forEach(id => existingIds.add(id));
              }
            });
          }
        });

        const newControlIds = topLevelControlIds.filter(id => !existingIds.has(id));
        if (newControlIds.length > 0) {
          mergedInsertControls.push({
            order: 'keep',
            'include-controls': [
              { 'with-ids': newControlIds }
            ]
          });
        }
      }
    }

    const cleanMerge = {
      ...(profile.merge || {}),
      custom: {
        ...(profile.merge?.custom || {}),
        groups: mergedGroups,
        'insert-controls': mergedInsertControls
      }
    };
    delete cleanMerge['as-is'];
    delete cleanMerge.flat;

    onChange({
      ...profile,
      merge: cleanMerge
    });
  };

  const handleRemoveControlFromGroups = (controlId) => {
    const currentGroups = profile.merge?.custom?.groups || [];
    
    const removeControlFromGroups = (groupsList, cid) => {
      return groupsList.map(g => {
        let icArray = Array.isArray(g['insert-controls']) ? g['insert-controls'] : (g['insert-controls'] ? [g['insert-controls']] : []);
        icArray = icArray.map(ic => {
          if (ic['include-controls']) {
            return {
              ...ic,
              'include-controls': ic['include-controls'].map(inc => {
                if (inc['with-ids']) {
                  return { ...inc, 'with-ids': inc['with-ids'].filter(id => id.toLowerCase() !== cid.toLowerCase()) };
                }
                return inc;
              })
            };
          }
          return ic;
        });
        return {
          ...g,
          'insert-controls': icArray,
          groups: g.groups ? removeControlFromGroups(g.groups, cid) : undefined
        };
      });
    };
    
    const updatedGroups = removeControlFromGroups(currentGroups, controlId);
    
    onChange({
      ...profile,
      merge: {
        ...profile.merge,
        custom: {
          ...(profile.merge?.custom || {}),
          groups: updatedGroups
        }
      }
    });
  };

  const assignedControlIds = useMemo(() => {
    const ids = new Set();

    // 1. Gather all control and group IDs from resolvedCatalog
    if (resolvedCatalog) {
      const collectControls = (c) => {
        if (c.id) ids.add(c.id.toLowerCase());
        if (c.controls) {
          c.controls.forEach(collectControls);
        }
      };

      const collectGroups = (g) => {
        if (g.id) ids.add(g.id.toLowerCase());
        if (g.controls) {
          g.controls.forEach(collectControls);
        }
        if (g.groups) {
          g.groups.forEach(collectGroups);
        }
      };

      if (resolvedCatalog.groups) {
        resolvedCatalog.groups.forEach(collectGroups);
      }
      if (resolvedCatalog.controls) {
        resolvedCatalog.controls.forEach(collectControls);
      }
    }

    // 2. Backward compatibility & safety: gather custom group IDs and insert-control with-ids
    const collectInsertControls = (icArray) => {
      const arr = Array.isArray(icArray) ? icArray : (icArray ? [icArray] : []);
      arr.forEach((ic) => {
        if (ic['include-controls']) {
          ic['include-controls'].forEach((inc) => {
            if (inc['with-ids']) {
              inc['with-ids'].forEach((id) => ids.add(id.toLowerCase()));
            }
          });
        }
      });
    };

    const collectCustomGroups = (groupsList) => {
      if (!Array.isArray(groupsList)) return;
      groupsList.forEach((g) => {
        if (g.id) ids.add(g.id.toLowerCase());
        collectInsertControls(g['insert-controls']);
        if (g.groups) collectCustomGroups(g.groups);
      });
    };

    collectCustomGroups(profile.merge?.custom?.groups || []);
    collectInsertControls(profile.merge?.custom?.['insert-controls']);

    return ids;
  }, [profile.merge?.custom, resolvedCatalog]);

  const allImportedControls = useMemo(() => {
    if (!profile.imports || !catalogCache) return [];
    
    const list = [];
    const seenIds = new Set();
    
    const traverse = (item, catalogId, catalogTitle, isGroup = false) => {
      if (item.id) {
        const idLower = item.id.toLowerCase();
        if (!seenIds.has(idLower)) {
          seenIds.add(idLower);
          list.push({
            id: item.id,
            title: item.title || 'Untitled',
            catalogId,
            catalogTitle,
            isGroup
          });
        }
      }
      if (item.controls) {
        item.controls.forEach(c => traverse(c, catalogId, catalogTitle, false));
      }
      if (item.groups) {
        item.groups.forEach(g => traverse(g, catalogId, catalogTitle, true));
      }
    };

    profile.imports.forEach((imp) => {
      const match = imp.href.match(/([a-f0-9-]{36})/i);
      const uuid = match ? match[1]?.toLowerCase() : null;
      if (!uuid) return;
      
      const cacheEntry = catalogCache.get(uuid);
      const docData = cacheEntry?.data || cacheEntry;
      const catalog = docData?.catalog || docData?.profile;
      if (!catalog) return;

      const catalogTitle = catalog.metadata?.title || 'Catalog';
      const catControls = catalog.controls || [];
      const catGroups = catalog.groups || [];
      
      catControls.forEach(c => traverse(c, catalog.uuid || uuid, catalogTitle, false));
      catGroups.forEach(g => traverse(g, catalog.uuid || uuid, catalogTitle, true));
    });

    return list;
  }, [profile.imports, catalogCache]);

  const filteredPoolControls = useMemo(() => {
    return allImportedControls.filter((ctrl) => {
      if (poolSearch.trim()) {
        const q = poolSearch.toLowerCase();
        return ctrl.id.toLowerCase().includes(q) || ctrl.title.toLowerCase().includes(q);
      }
      return true;
    });
  }, [allImportedControls, poolSearch]);

  const mergeMode = useMemo(() => {
    const merge = profile.merge || {};
    if (merge.flat) return 'flat';
    if (merge.custom !== undefined) return 'custom';
    return 'as-is';
  }, [profile.merge]);

  const handleMergeModeChange = (newMode) => {
    let cleanMerge = { ...(profile.merge || {}) };
    if (newMode === 'as-is') {
      delete cleanMerge.custom;
      delete cleanMerge.flat;
      cleanMerge['as-is'] = true;
    } else if (newMode === 'flat') {
      delete cleanMerge.custom;
      delete cleanMerge['as-is'];
      cleanMerge.flat = true;
    } else if (newMode === 'custom') {
      delete cleanMerge['as-is'];
      delete cleanMerge.flat;
      if (!cleanMerge.custom) {
        cleanMerge.custom = { groups: [] };
      }
    }
    onChange({ ...profile, merge: cleanMerge });
  };

  return (
    <div
      className="sources-panel"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-background)',
        overflow: 'hidden'
      }}
    >
      <div 
        style={{ 
          padding: '20px', 
          borderBottom: '1px solid var(--color-border-subtle)', 
          background: 'var(--color-surface)',
          overflowY: 'auto',
          maxHeight: '40%'
        }}
      >
        <ImportManager
          imports={profile.imports || []}
          onChange={handleImportsChange}
          availableCatalogs={availableCatalogs}
          availableProfiles={availableProfiles}
          isEditing={isEditing}
          onCopyStructure={handleCopyStructure}
          mergeMode={mergeMode}
          onMergeModeChange={handleMergeModeChange}
        />
      </div>


      <div 
        onDragOver={(e) => { if (isEditing) e.preventDefault(); }}
        onDrop={(e) => {
          if (isEditing) {
            e.preventDefault();
            const ctrlId = e.dataTransfer.getData('text/plain');
            if (ctrlId) {
              handleRemoveControlFromGroups(ctrlId);
            }
          }
        }}
        style={{ 
          flex: 1, 
          padding: '20px', 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden' 
        }}
      >
        <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          📥 Control Pool (Drag & Drop)
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 'normal' }}>
            ({filteredPoolControls.length} available)
          </span>
        </h3>
        <p style={{ margin: '0 0 16px 0', fontSize: '12.5px', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
          Drag and drop controls to a group in the sidebar on the left to assign them.
        </p>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={poolSearch}
            onChange={(e) => setPoolSearch(e.target.value)}
            placeholder="Search pool..."
            className="form-input"
            style={{ flex: 1, height: '32px', fontSize: '12.5px' }}
          />
        </div>

        <div 
          style={{ 
            flex: 1, 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', 
            gap: '10px', 
            overflowY: 'auto',
            padding: '8px',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-subtle)',
            alignContent: 'start'
          }}
        >
          {filteredPoolControls.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
              No controls found in the pool.
            </div>
          ) : (
            filteredPoolControls.map(ctrl => {
              const isAssigned = assignedControlIds.has(ctrl.id.toLowerCase());
              return (
                <div
                  key={ctrl.id}
                  draggable={isEditing}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', ctrl.id);
                    e.dataTransfer.setData('draggedType', ctrl.isGroup ? 'group' : 'control');
                    e.dataTransfer.setData('catalogUuid', ctrl.catalogId);
                  }}
                  style={{
                    padding: '10px 12px',
                    background: isAssigned ? 'var(--color-surface)' : 'var(--color-surface-2)',
                    border: isAssigned ? '1px dashed var(--color-border-subtle)' : '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    cursor: isEditing ? 'grab' : 'default',
                    opacity: isAssigned ? 0.45 : 1,
                    fontSize: '12.5px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    userSelect: 'none',
                    transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s, opacity 0.2s',
                    boxShadow: isAssigned ? 'none' : 'var(--shadow-sm)'
                  }}
                  onMouseOver={(e) => isEditing && !isAssigned && (e.currentTarget.style.background = 'var(--color-surface-3)')}
                  onMouseOut={(e) => isEditing && !isAssigned && (e.currentTarget.style.background = 'var(--color-surface-2)')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                    <span className="badge" style={{
                      fontSize: '10px',
                      padding: '1px 5px',
                      fontFamily: 'monospace',
                      background: ctrl.isGroup ? 'var(--color-primary-subtle)' : 'var(--color-surface-3)',
                      color: ctrl.isGroup ? 'var(--color-primary)' : 'var(--color-text)'
                    }}>
                      {ctrl.isGroup ? '📁 ' : ''}{ctrl.id}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }} title={ctrl.catalogTitle}>{ctrl.catalogTitle}</span>
                  </div>
                  <div style={{ color: isAssigned ? 'var(--color-text-muted)' : 'var(--color-text)', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ctrl.title}>{ctrl.title}</div>
                  {isAssigned && (
                    <span style={{ fontSize: '9.5px', color: 'var(--color-success)', marginTop: '2px', fontWeight: 'bold' }}>✓ Assigned</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
