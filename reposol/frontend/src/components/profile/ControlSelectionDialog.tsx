import React, { useEffect, useRef, useState, useMemo } from 'react';

interface ControlSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (selectedIds: string[], patterns: string[]) => void;
  catalogTitle: string;
  controls: Array<{id: string, title: string}>;
  initialSelectedIds: string[];
  initialPatterns: string[];
}

export function ControlSelectionDialog({
  isOpen,
  onClose,
  onApply,
  catalogTitle,
  controls,
  initialSelectedIds,
  initialPatterns,
}: ControlSelectionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [patterns, setPatterns] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(initialSelectedIds));
      setPatterns(initialPatterns.join(', '));
      setSearch('');
    }
  }, [isOpen, initialSelectedIds, initialPatterns]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const filteredControls = useMemo(() => {
    if (!search.trim()) return controls;
    const q = search.toLowerCase();
    return controls.filter(c => 
      c.id.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)
    );
  }, [controls, search]);

  const handleSelectAll = () => {
    const newSelected = new Set(selectedIds);
    filteredControls.forEach(c => newSelected.add(c.id));
    setSelectedIds(newSelected);
  };

  const handleDeselectAll = () => {
    const newSelected = new Set(selectedIds);
    filteredControls.forEach(c => newSelected.delete(c.id));
    setSelectedIds(newSelected);
  };

  const handleToggle = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleApply = () => {
    const pats = patterns.split(',').map(p => p.trim()).filter(p => p);
    onApply(Array.from(selectedIds), pats);
  };

  const handleCancel = (e: React.MouseEvent | React.SyntheticEvent) => {
    e.preventDefault();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      style={{
        padding: '0',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        width: '600px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        boxShadow: 'var(--shadow-lg)'
      }}
      data-testid="control-selection-dialog"
    >
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '90vh' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>Select Controls: {catalogTitle}</h3>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span className="badge" style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}>
            {selectedIds.size} / {controls.length} selected
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={handleSelectAll} style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-text)' }}>Select All</button>
            <button type="button" onClick={handleDeselectAll} style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-text)' }}>Deselect All</button>
          </div>
        </div>

        <input
          type="text"
          placeholder="Search by ID or title..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '8px', marginBottom: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)', color: 'var(--color-text)' }}
        />

        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
          {filteredControls.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--color-border-subtle)', gap: '10px' }}>
              <input
                type="checkbox"
                checked={selectedIds.has(c.id)}
                onChange={() => handleToggle(c.id)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 600, fontSize: '13px' }}>{c.id}</span>
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{c.title}</span>
            </div>
          ))}
          {filteredControls.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>No controls match search.</div>
          )}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>Optional: Include by pattern (comma-separated)</label>
          <input
            type="text"
            placeholder="e.g. APP.*, AC-1.*"
            value={patterns}
            onChange={e => setPatterns(e.target.value)}
            style={{ width: '100%', padding: '8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)', color: 'var(--color-text)' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: 'var(--color-surface-3)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--color-text)' }}>
            Cancel
          </button>
          <button type="button" onClick={handleApply} style={{ padding: '8px 16px', background: 'var(--color-primary)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'white' }}>
            Apply ({selectedIds.size + (patterns.split(',').filter(p=>p.trim()).length ? ' + patterns' : '')})
          </button>
        </div>
      </div>
    </dialog>
  );
}
