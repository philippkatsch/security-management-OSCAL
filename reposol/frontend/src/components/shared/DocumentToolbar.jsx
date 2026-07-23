import React from 'react';

/**
 * Unified Document Toolbar — replaces both CatalogToolbar and ProfileToolbar.
 *
 * mode='catalog': Shows Copy button, badge color = primary (blue).
 * mode='profile': Shows resolving indicator, badge color = success (green).
 */
export function DocumentToolbar({
  title = 'Untitled Document',
  isEditing = false,
  onToggleEdit,
  onCopy,
  onExport,
  onBack,
  onSaveVersion,
  versions = [],
  editMode = 'visual',
  onToggleEditMode,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  saving = false,
  validating = false,
  mode = 'catalog',
  // Profile-specific:
  resolving = false
}) {
  const activeVersion = versions.find(v => v.is_active)?.version || '—';

  const badgeColor = mode === 'catalog'
    ? { bg: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }
    : { bg: 'var(--color-success-subtle)', color: 'var(--color-success)' };
  const badgeLabel = mode === 'catalog' ? 'OSCAL Catalog' : 'OSCAL Profile';

  return (
    <div
      className="document-toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'var(--color-surface-2)',
        borderBottom: '1px solid var(--color-border)',
        gap: '12px',
        flexWrap: 'wrap'
      }}
    >
      {/* Title Area */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={onBack}
          data-testid="back-btn"
          style={{ padding: '6px 12px', fontSize: '13px' }}
        >
          ⬅ Back
        </button>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge" style={{ background: badgeColor.bg, color: badgeColor.color, fontSize: '10px' }}>
              {badgeLabel}
            </span>
            <span className="badge" style={{ background: 'var(--color-surface-3)', fontSize: '10px' }}>
              v{activeVersion}
            </span>
            {mode === 'profile' && resolving && (
              <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                ⚙️ Live Resolving...
              </span>
            )}
          </div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{title}</h2>
        </div>
      </div>

      {/* Editor & Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* Undo / Redo */}
        {isEditing && (
          <div style={{ display: 'flex', gap: '4px', marginRight: '8px' }}>
            <button
              type="button"
              className="btn-secondary"
              disabled={editMode === 'visual' ? !canUndo : false}
              onClick={onUndo}
              title="Undo (Ctrl+Z)"
              style={{ padding: '6px 10px', fontSize: '12px' }}
            >
              ↩️
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={editMode === 'visual' ? !canRedo : false}
              onClick={onRedo}
              title="Redo (Ctrl+Y)"
              style={{ padding: '6px 10px', fontSize: '12px' }}
            >
              ↪️
            </button>
          </div>
        )}

        {/* Visual / JSON Switch */}
        {isEditing && (
          <div style={{ display: 'flex', marginRight: '8px' }}>
            <button
              type="button"
              className={editMode === 'visual' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => onToggleEditMode('visual')}
              style={{
                borderTopRightRadius: 0,
                borderBottomRightRadius: 0,
                padding: '6px 12px',
                fontSize: '12px',
                borderTop: `1px solid ${editMode === 'visual' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                borderBottom: `1px solid ${editMode === 'visual' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                borderLeft: `1px solid ${editMode === 'visual' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                borderRight: 'none',
                background: editMode === 'visual' ? 'var(--color-accent)' : undefined,
                color: editMode === 'visual' ? '#fff' : undefined
              }}
            >
              🎨 Visual
            </button>
            <button
              type="button"
              className={editMode === 'json' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => onToggleEditMode('json')}
              style={{
                borderTopLeftRadius: 0,
                borderBottomLeftRadius: 0,
                padding: '6px 12px',
                fontSize: '12px',
                border: `1px solid ${editMode === 'json' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: editMode === 'json' ? 'var(--color-accent)' : undefined,
                color: editMode === 'json' ? '#fff' : undefined
              }}
            >
              💻 JSON
            </button>
          </div>
        )}

        {/* Action Controls based on Edit Mode */}
        {isEditing ? (
          <>
            <button
              type="button"
              className="btn-primary"
              onClick={onSaveVersion}
              style={{ 
                padding: '6px 12px', 
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              Publish Version
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={onToggleEdit}
              disabled={saving || validating}
              style={{ 
                padding: '6px 12px', 
                fontSize: '13px',
                borderColor: 'var(--color-primary)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {saving ? 'Speichert...' : validating ? 'Validiert...' : 'Exit'}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={onSaveVersion}
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              📜 Version History
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={onToggleEdit}
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              ✏️ Edit
            </button>
          </>
        )}
      </div>
    </div>
  );
}
