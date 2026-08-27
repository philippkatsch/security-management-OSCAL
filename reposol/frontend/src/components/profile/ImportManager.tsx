import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styles from './ProfilePage.module.css';
import sharedStyles from '@components/shared/SharedComponents.module.css';
import { toast } from 'react-hot-toast';
import { fetchDocument } from '@lib/api';

export interface ImportManagerProps {
  imports?: any[];
  onChange?: (imports: any[]) => void;
  availableCatalogs?: any[];
  availableProfiles?: any[];
  isEditing?: boolean;
  onCopyStructure?: (href: string, mode?: string) => void;
  onNavigateToPool?: () => void;
  mergeMode?: string;
  onMergeModeChange?: (mode: string) => void;
  combineMethod?: string;
  onCombineMethodChange?: (m: string) => void;
  catalogCache?: Record<string, any>;
}

export function ImportManager({
  imports = [],
  onChange = () => {},
  availableCatalogs = [],
  availableProfiles = [],
  isEditing = false,
  onCopyStructure,
  onNavigateToPool,
  mergeMode = 'as-is',
  onMergeModeChange,
  combineMethod = 'use-first',
  onCombineMethodChange,
  catalogCache
}: ImportManagerProps) {
  const [fetchedDocs, setFetchedDocs] = useState<Record<string, any>>({});

  // Auto-fetch full document data for all imported sources to populate controls and counts
  useEffect(() => {
    let isMounted = true;
    imports.forEach(async (imp: any) => {
      const href = imp?.href || '';
      const isProfile = href.toLowerCase().includes('profile');
      const uuidMatch = href.match(/([a-fA-F0-9-]{36})/);
      const uuid = uuidMatch ? uuidMatch[1] : null;
      if (!uuid) return;

      const cacheHit = typeof catalogCache?.get === 'function'
        ? (catalogCache.get(uuid) || catalogCache.get(uuid.toLowerCase()))
        : (catalogCache?.[uuid] || catalogCache?.[uuid.toLowerCase()]);

      if (cacheHit || fetchedDocs[uuid] || fetchedDocs[uuid.toLowerCase()]) return;

      try {
        const stage = isProfile ? 'profiles' : 'catalogs';
        const doc = await fetchDocument(stage, uuid);
        if (isMounted && doc) {
          setFetchedDocs(prev => ({
            ...prev,
            [uuid]: doc,
            [uuid.toLowerCase()]: doc
          }));
        }
      } catch {
        // Ignore fetch errors for remote or invalid hrefs
      }
    });

    return () => {
      isMounted = false;
    };
  }, [imports, catalogCache, fetchedDocs]);

  const handleAddImport = (uuid: string, type: string) => {
    if (!uuid) return;
    const stage = type === 'profile' ? 'profiles' : 'catalogs';
    const newHref = `/api/documents/${stage}/${uuid}`;
    if (imports.some((imp: any) => imp.href === newHref)) {
      toast.error('This source is already imported.');
      return;
    }
    const newImport = {
      href: newHref,
      'include-all': {},
    };
    const filteredImports = imports.filter((imp: any) => imp.href !== '#placeholder');
    onChange([...filteredImports, newImport]);
  };

  const handleUpdateImport = (idx: number, updatedImp: any) => {
    const newImports = [...imports];
    newImports[idx] = updatedImp;
    onChange(newImports);
  };

  const handleRemoveImport = (idx: number) => {
    onChange(imports.filter((_, i) => i !== idx));
  };

  const getImportInfo = (href: string = '') => {
    const isProfile = href.toLowerCase().includes('profile');
    const uuidMatch = href.match(/([a-fA-F0-9-]{36})/);
    const uuid = uuidMatch ? uuidMatch[1] : null;
    
    if (isProfile && uuid) {
      const prof = availableProfiles.find((p: any) => (p.profile?.uuid || p.uuid) === uuid);
      return {
        type: 'profile',
        title: prof?.profile?.metadata?.title || prof?.title || `Profile (${uuid.substring(0, 8)})`,
        icon: '⚙️'
      };
    }
    
    if (uuid) {
      const cat = availableCatalogs.find((c: any) => (c.catalog?.uuid || c.uuid) === uuid);
      return {
        type: 'catalog',
        title: cat?.catalog?.metadata?.title || cat?.title || `Catalog (${uuid.substring(0, 8)})`,
        icon: '📖'
      };
    }
    
    return { type: 'unknown', title: href, icon: '🔗' };
  };

  const getSourceDoc = (href: string) => {
    const uuidMatch = href?.match(/([a-fA-F0-9-]{36})/);
    const uuid = uuidMatch ? uuidMatch[1] : null;
    if (!uuid) return null;

    const fromCache = typeof catalogCache?.get === 'function'
      ? (catalogCache.get(uuid) || catalogCache.get(uuid.toLowerCase()))
      : (catalogCache?.[uuid] || catalogCache?.[uuid.toLowerCase()]);

    const data = fromCache || fetchedDocs[uuid] || fetchedDocs[uuid.toLowerCase()];
    return data?.catalog || data?.profile || data?.data?.catalog || data?.data?.profile || data;
  };

  const getCatalogControlCount = (href: string): number => {
    const cat = getSourceDoc(href);
    if (!cat) return 0;
    let count = 0;
    const traverseControls = (controls: any[]) => {
      controls?.forEach(c => {
        if (c.id) count++;
        traverseControls(c.controls || []); // nested sub-controls (enhancements)
      });
    };
    const traverseGroups = (groups: any[]) => {
      groups?.forEach(g => {
        traverseControls(g.controls || []);
        traverseGroups(g.groups || []);
      });
    };
    traverseControls(cat.controls || []);
    traverseGroups(cat.groups || []);
    return count;
  };

  const getCatalogControls = (href: string): Array<{id: string, title: string}> => {
    const cat = getSourceDoc(href);
    if (!cat) return [];
    const list: Array<{id: string, title: string}> = [];
    const traverseControls = (controls: any[]) => {
      controls?.forEach(c => {
        if (c.id) list.push({ id: c.id, title: c.title || c.id });
        traverseControls(c.controls || []); // nested sub-controls (enhancements)
      });
    };
    const traverseGroups = (groups: any[]) => {
      groups?.forEach(g => {
        traverseControls(g.controls || []);
        traverseGroups(g.groups || []);
      });
    };
    traverseControls(cat.controls || []);
    traverseGroups(cat.groups || []);
    return list;
  };



  return (
    <div className="import-manager card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '15px' }}>📦 Imported Sources</h3>
          <span className="badge" style={{ fontSize: '11px', background: 'var(--color-surface-3)', color: 'var(--color-text)' }}>
            {imports.length}
          </span>
        </div>

        {isEditing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              data-testid="add-import-source-select"
              onChange={(e) => {
                if (!e.target.value) return;
                const [type, uuid] = e.target.value.split(':');
                handleAddImport(uuid, type);
                e.target.value = '';
              }}
              className="form-input"
              style={{
                height: '32px',
                fontSize: '12.5px',
                background: 'var(--color-surface-2)',
                borderColor: 'var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text)',
                cursor: 'pointer',
                minWidth: '240px'
              }}
            >
              <option value="">➕ Add Import Source...</option>
              {availableCatalogs.length > 0 && (
                <optgroup label="📖 Catalogs">
                  {availableCatalogs.map((cat: any) => {
                    const catDoc = cat.catalog || cat;
                    const catUuid = catDoc.uuid || catDoc.id;
                    return (
                      <option key={catUuid} value={`catalog:${catUuid}`}>
                        📖 {catDoc.metadata?.title || catDoc.title || 'Untitled'} ({catDoc.metadata?.version || '—'})
                      </option>
                    );
                  })}
                </optgroup>
              )}
              {availableProfiles.length > 0 && (
                <optgroup label="⚙️ Profiles">
                  {availableProfiles.map((prof: any) => {
                    const profDoc = prof.profile || prof;
                    const profUuid = profDoc.uuid || profDoc.id;
                    return (
                      <option key={profUuid} value={`profile:${profUuid}`}>
                        ⚙️ {profDoc.metadata?.title || profDoc.title || 'Untitled'} ({profDoc.metadata?.version || '—'})
                      </option>
                    );
                  })}
                </optgroup>
              )}
            </select>
          </div>
        )}
      </div>

      {/* Structuring Mode Configuration Bar */}
      <div
        style={{
          padding: '10px 14px',
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text)' }}>
              ⚙️ Merge:
            </span>
            <select
              data-testid="structuring-mode-select"
              value={mergeMode}
              onChange={(e) => onMergeModeChange && onMergeModeChange(e.target.value)}
              disabled={!isEditing}
              className="form-input"
              style={{
                height: '28px',
                fontSize: '12px',
                fontWeight: 500,
                padding: '0 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
                cursor: isEditing ? 'pointer' : 'default'
              }}
            >
              <option value="as-is">as-is (Keep Original Structure)</option>
              <option value="custom">custom (Define Own Groups)</option>
              <option value="flat">flat (No Groups, No Nesting)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text)' }}>
              Duplicates:
            </span>
            <select
              data-testid="combine-method-select"
              value={combineMethod}
              onChange={(e) => onCombineMethodChange && onCombineMethodChange(e.target.value)}
              disabled={!isEditing}
              className="form-input"
              style={{
                height: '28px',
                fontSize: '12px',
                fontWeight: 500,
                padding: '0 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
                cursor: isEditing ? 'pointer' : 'default'
              }}
            >
              <option value="use-first">use-first</option>
              <option value="keep">keep</option>
            </select>
          </div>
        </div>

        <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
          {mergeMode === 'as-is' && <span>💡 <strong>As-Is:</strong> Controls retain their original catalog group structure. Groups and nesting are preserved exactly as in the source catalog.</span>}
          {mergeMode === 'custom' && <span>💡 <strong>Custom:</strong> Define your own group structure and assign imported controls to custom groups. Use the Control Pool to drag controls into groups.</span>}
          {mergeMode === 'flat' && <span>💡 <strong>Flat:</strong> All controls are placed in a single flat list — no groups, no nesting, no enhancements hierarchy. Per OSCAL spec: "unstructured catalogs, with no grouping or nesting of controls."</span>}
        </div>
      </div>

      {/* List of current imports */}
      {imports.length === 0 ? (
        <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          No sources imported. Please add a catalog or a profile above.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {imports.map((imp: any, idx: number) => {
            const importInfo = getImportInfo(imp.href);
            const isIncludeAll = imp['include-all'] !== undefined;
            const totalControls = getCatalogControlCount(imp.href);
            
            let includedCount = 0;
            if (isIncludeAll) {
              const excluded = imp['exclude-controls']?.[0]?.['with-ids']?.length || 0;
              includedCount = totalControls - excluded;
            } else {
              includedCount = imp['include-controls']?.[0]?.['with-ids']?.length || 0;
            }
            
            const isAllActive = includedCount >= totalControls && totalControls > 0;

            return (
              <div
                key={idx}
                className="import-card"
                data-testid={`import-card-${idx}`}
                style={{
                  padding: '12px 16px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0, flex: 1, marginBottom: '8px' }}>
                  <strong 
                    style={{ fontSize: '14px', color: 'var(--color-text)', wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title={imp.href}
                  >
                    {importInfo.icon} {importInfo.title}
                  </strong>
                </div>

                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '13px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: isEditing ? 'pointer' : 'default' }}>
                      <input
                        type="radio"
                        name={`selection-mode-${idx}`}
                        data-testid={`selection-mode-include-all-${idx}`}
                        checked={isIncludeAll}
                        disabled={!isEditing}
                        onChange={() => {
                          const newImp = { ...imp };
                          delete newImp['include-controls'];
                          newImp['include-all'] = {};
                          handleUpdateImport(idx, newImp);
                        }}
                      />
                      Include All Controls
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: isEditing ? 'pointer' : 'default' }}>
                      <input
                        type="radio"
                        name={`selection-mode-${idx}`}
                        data-testid={`selection-mode-include-specific-${idx}`}
                        checked={!isIncludeAll}
                        disabled={!isEditing}
                        onChange={() => {
                          const newImp = { ...imp };
                          delete newImp['include-all'];
                          const allControlIds = getCatalogControls(imp.href).map(c => c.id);
                          newImp['include-controls'] = [{ 'with-ids': allControlIds }];
                          handleUpdateImport(idx, newImp);
                        }}
                      />
                      Include Specific Controls
                    </label>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '4px', flexWrap: 'wrap' }}>
                    <span 
                      data-testid={`control-count-${idx}`}
                      style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <span style={{ 
                        width: '10px', height: '10px', borderRadius: '50%', 
                        background: isAllActive ? 'var(--color-success)' : 'var(--color-warning)',
                        display: 'inline-block' 
                      }}></span>
                      {includedCount} / {totalControls} Controls active
                    </span>
                    
                    {onNavigateToPool && (
                      <button
                        type="button"
                        data-testid={`open-tree-workbench-btn-${idx}`}
                        onClick={onNavigateToPool}
                        style={{
                          padding: '3px 10px',
                          fontSize: '12px',
                          background: 'var(--color-surface-2)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          color: 'var(--color-primary, #3b82f6)',
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        🌳 Open Central Tree Workbench
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center', marginTop: '8px' }}>
                  {mergeMode === 'custom' && (
                    <button
                      type="button"
                      className={sharedStyles['btn-secondary']}
                      onClick={() => onCopyStructure && onCopyStructure(imp.href, 'all')}
                      style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      📥 Import Full Structure
                    </button>
                  )}
                  {isEditing && (
                    <button
                      type="button"
                      className={sharedStyles['btn-delete']}
                      onClick={() => handleRemoveImport(idx)}
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                    >
                      🗑️ Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
