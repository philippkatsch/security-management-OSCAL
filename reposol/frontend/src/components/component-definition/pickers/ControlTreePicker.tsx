import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@lib/api';
import sharedStyles from '@components/shared/SharedComponents.module.css';

export interface ControlTreePickerProps {
  source: string;
  existingControlIds?: string[];
  onAddControls: (selectedControls: Array<{ controlId: string; title?: string }>) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface TreeControlItem {
  id: string;
  title: string;
  class?: string;
  groupId?: string;
  groupTitle?: string;
  depth?: number;
}

export const ControlTreePicker: React.FC<ControlTreePickerProps> = ({
  source = '',
  existingControlIds = [],
  onAddControls,
  isOpen,
  onClose
}) => {
  const [selectedGroup, setSelectedGroup] = useState<string>('__all__');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Reset state on modal open
  useEffect(() => {
    if (isOpen) {
      setSelectedGroup('__all__');
      setSearchQuery('');
      setSelectedIds(new Set());
    }
  }, [isOpen]);

  // Parse stage and docId from source URI
  const sourceParsed = useMemo(() => {
    if (!source) return null;
    const clean = source.trim();
    // Patterns: "catalogs/uuid", "profiles/uuid", "/api/documents/catalogs/uuid"
    const match = clean.match(/(?:catalogs|profiles)\/([0-9a-fA-F\-]+)/i);
    if (match) {
      const isProfile = clean.toLowerCase().includes('profile');
      return {
        stage: isProfile ? 'profiles' : 'catalogs',
        docId: match[1]
      };
    }
    // Pure UUID fallback
    if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(clean)) {
      return { stage: 'catalogs', docId: clean };
    }
    return null;
  }, [source]);

  // Fetch hierarchical control tree from backend
  const { data: treeData, isLoading, error } = useQuery({
    queryKey: ['resolve-tree', sourceParsed?.stage, sourceParsed?.docId],
    queryFn: async () => {
      if (!sourceParsed) throw new Error('Source URI is not a valid workspace catalog or profile reference.');
      const res = await authFetch(`/api/resolve/tree/${sourceParsed.stage}/${sourceParsed.docId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `Failed to load control tree (${res.status})`);
      }
      return res.json();
    },
    enabled: isOpen && !!sourceParsed
  });

  // Extract groups and flat control list
  const { groupsList, controlsList } = useMemo(() => {
    if (!treeData) return { groupsList: [], controlsList: [] };

    const groups: Array<{ id: string; title: string }> = [];
    const controls: TreeControlItem[] = [];

    const traverseGroup = (g: any) => {
      const gId = g.id || 'unassigned';
      const gTitle = g.title || gId;
      groups.push({ id: gId, title: gTitle });

      (g.controls || []).forEach((c: any) => {
        traverseControl(c, gId, gTitle);
      });

      (g.groups || []).forEach((subG: any) => {
        traverseGroup(subG);
      });
    };

    const traverseControl = (c: any, gId?: string, gTitle?: string) => {
      if (c.id) {
        controls.push({
          id: c.id,
          title: c.title || c.id,
          class: c.class,
          groupId: gId,
          groupTitle: gTitle
        });
      }
      (c.controls || []).forEach((subC: any) => {
        traverseControl(subC, gId, gTitle);
      });
    };

    (treeData.groups || []).forEach((g: any) => traverseGroup(g));
    (treeData.nodes || []).forEach((c: any) => traverseControl(c));

    // Dedup controls by ID
    const uniqueControlsMap = new Map<string, TreeControlItem>();
    controls.forEach(c => {
      if (!uniqueControlsMap.has(c.id)) {
        uniqueControlsMap.set(c.id, c);
      }
    });

    return {
      groupsList: groups,
      controlsList: Array.from(uniqueControlsMap.values())
    };
  }, [treeData]);

  // Existing set of control IDs (lowercased for case-insensitive matching)
  const existingSet = useMemo(() => new Set(existingControlIds.map(id => id.toLowerCase())), [existingControlIds]);

  // Filtered controls
  const filteredControls = useMemo(() => {
    let list = controlsList;
    if (selectedGroup !== '__all__') {
      list = list.filter(c => c.groupId === selectedGroup);
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter(c => 
      c.id.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q)
    );
  }, [controlsList, selectedGroup, searchQuery]);

  // Toggle selection
  const handleToggle = (ctrlId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(ctrlId)) {
        next.delete(ctrlId);
      } else {
        next.add(ctrlId);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const selectable = filteredControls.filter(c => !existingSet.has(c.id.toLowerCase()));
    if (selectedIds.size >= selectable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectable.map(c => c.id)));
    }
  };

  const handleConfirm = () => {
    const selected = controlsList
      .filter(c => selectedIds.has(c.id))
      .map(c => ({ controlId: c.id, title: c.title }));
    
    if (selected.length > 0) {
      onAddControls(selected);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--color-surface, #ffffff)',
          borderRadius: '8px',
          border: '1px solid var(--color-border, #e5e7eb)',
          width: '100%',
          maxWidth: '780px',
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border, #e5e7eb)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--color-text, #111827)' }}>
              Hierarchical Control Browser
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--color-text-muted, #6b7280)' }}>
              Source: <code>{source || 'None'}</code> — Select controls to bulk add to implemented requirements.
            </p>
          </div>
          <button
            type="button"
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--color-text-muted, #6b7280)' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Filter Bar */}
        <div style={{ padding: '12px 20px', background: 'var(--surface-alt, #f9fafb)', borderBottom: '1px solid var(--color-border, #e5e7eb)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {/* Group Filter */}
          <div style={{ flex: '1 1 200px' }}>
            <select
              className="form-input"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              style={{ fontSize: '13px' }}
            >
              <option value="__all__">📁 All Groups ({groupsList.length})</option>
              {groupsList.map(g => (
                <option key={g.id} value={g.id}>
                  {g.id.toUpperCase()} — {g.title}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div style={{ flex: '2 1 250px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search control ID (e.g. ac-7) or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: '13px' }}
            />
          </div>
        </div>

        {/* Control List Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {!sourceParsed ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-warning, #d97706)' }}>
              ⚠️ The selected source reference is not a local workspace catalog or profile. Custom external URIs cannot load live control trees.
            </div>
          ) : isLoading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted, #6b7280)' }}>
              Loading controls from source...
            </div>
          ) : error ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-danger, #ef4444)' }}>
              Error loading controls: {(error as any)?.message || String(error)}
            </div>
          ) : filteredControls.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted, #6b7280)' }}>
              No controls matching current filters.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '12px', color: 'var(--color-text-muted, #6b7280)' }}>
                <span>Showing {filteredControls.length} control(s)</span>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--color-accent, #3b82f6)', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={handleSelectAllFiltered}
                >
                  {selectedIds.size >= filteredControls.filter(c => !existingSet.has(c.id.toLowerCase())).length && selectedIds.size > 0 ? 'Deselect All' : 'Select All Filtered'}
                </button>
              </div>

              {filteredControls.map(ctrl => {
                const isAlreadyAdded = existingSet.has(ctrl.id.toLowerCase());
                const isSelected = selectedIds.has(ctrl.id);

                return (
                  <div
                    key={ctrl.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: isSelected ? '1px solid var(--color-accent, #3b82f6)' : '1px solid var(--color-border, #e5e7eb)',
                      background: isAlreadyAdded
                        ? 'var(--surface-alt, #f9fafb)'
                        : isSelected
                        ? 'rgba(59, 130, 246, 0.04)'
                        : 'var(--color-surface, #ffffff)',
                      opacity: isAlreadyAdded ? 0.65 : 1,
                      cursor: isAlreadyAdded ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onClick={() => {
                      if (!isAlreadyAdded) handleToggle(ctrl.id);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isAlreadyAdded}
                      onChange={() => handleToggle(ctrl.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ cursor: isAlreadyAdded ? 'not-allowed' : 'pointer' }}
                    />

                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', color: 'var(--color-accent, #2563eb)' }}>
                          {ctrl.id.toUpperCase()}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text, #111827)' }}>
                          {ctrl.title}
                        </span>
                        {isAlreadyAdded && (
                          <span style={{ fontSize: '10px', background: '#e5e7eb', color: '#374151', padding: '1px 6px', borderRadius: '4px' }}>
                            Already Implemented
                          </span>
                        )}
                      </div>
                      {ctrl.groupTitle && (
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted, #6b7280)' }}>
                          Group: {ctrl.groupTitle}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border, #e5e7eb)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-alt, #f9fafb)' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-muted, #6b7280)' }}>
            Selected: <strong>{selectedIds.size}</strong> control(s)
          </span>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className={['btn', sharedStyles['btn-secondary'], sharedStyles['btn-sm']].filter(Boolean).join(' ')}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className={['btn', sharedStyles['btn-primary'], sharedStyles['btn-sm']].filter(Boolean).join(' ')}
              disabled={selectedIds.size === 0}
              onClick={handleConfirm}
            >
              Bulk Add ({selectedIds.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlTreePicker;
