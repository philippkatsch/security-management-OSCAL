import React from 'react';
import VersionDropdown from './version/VersionDropdown';

/**
 * Badge color mapping for all OSCAL document types.
 */
const MODE_CONFIG = {
  'catalog':            { bg: 'var(--color-primary-subtle)',  color: 'var(--color-primary)',  label: 'OSCAL Catalog' },
  'profile':            { bg: 'var(--color-success-subtle)',  color: 'var(--color-success)',  label: 'OSCAL Profile' },
  'component-definition': { bg: '#fff3e0', color: '#e65100', label: 'Component Definition' },
  'ssp':                { bg: '#f3e5f5', color: '#7b1fa2', label: 'System Security Plan' },
  'assessment-plan':    { bg: '#e0f2f1', color: '#00695c', label: 'Assessment Plan' },
  'assessment-results': { bg: '#e8eaf6', color: '#283593', label: 'Assessment Results' },
  'poam':               { bg: '#fce4ec', color: '#c62828', label: 'POA&M' },
  'control-mappings':   { bg: '#fff8e1', color: '#f57f17', label: 'Control Mappings' },
};

/**
 * Unified Document Toolbar for all OSCAL document types.
 *
 * Provides a consistent toolbar with:
 * - Back button
 * - Document type badge + VersionDropdown (handles Draft & Version History)
 * - Undo/Redo (edit mode only)
 * - Visual/JSON mode switch (edit mode only)
 * - Segmented View/Edit mode toggle
 *
 * Props are normalized: accepts common aliases so all page components
 * work with a single consistent API.
 */
export function DocumentToolbar({
  title = 'Untitled Document',
  isEditing = false,
  onToggleEdit,
  onBack,
  onSaveVersion,
  onShowVersions,
  onSelectVersion,
  versions = [],
  version: activeVersionStr,
  editMode = 'visual',
  onToggleEditMode,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  saving = false,
  validating = false,
  isSaving = false,
  status,
  onStatusChange,
  mode = 'catalog',
  typeLabel,
  documentType,
  stage,
  resolving = false,
  onCopy,
  onExport,
  onSave,
  onCancel,
  isDirty = false,
  hasDraft = false,
  saveStatus,
  oscalVersion: _oscalVersion,
  documentId: _documentId,
  documentTitle,
  doc: _doc,
  ...rest
}) {
  const effectiveTitle = title !== 'Untitled Document' ? title : (documentTitle || title);
  // ── Handlers & Fallbacks ──
  // Minimal fallback for missing handlers if someone was relying on aliases
  const handleToggleEdit = onToggleEdit || rest.onEdit;
  const handleBack = onBack || rest.onClose;
  const handleSaveVersion = onSaveVersion || rest.onSaveVersion;
  const handleSelectVersion = onSelectVersion || rest.onSelectVersion || rest.onVersionSelect || rest.onSwitchVersion;
  const handleDeleteDraft = rest.onDeleteDraft || rest.onDiscardDraft;

  // ── Normalize: saving state ──
  const isBusy = saving || validating || isSaving;

  // ── Normalize: document type & badge ──
  const resolvedMode = stage || mode || 'catalog';
  const modeConfig = MODE_CONFIG[resolvedMode] || MODE_CONFIG['catalog'];
  const badgeLabel = typeLabel || documentType || modeConfig.label;
  const badgeColor = { bg: modeConfig.bg, color: modeConfig.color };

  // ── Normalize: version display ──
  const activeVersion = activeVersionStr || versions.find(v => v.is_active)?.version || '1.0.0';

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
        {handleBack && (
          <button
            type="button"
            className="btn-secondary"
            onClick={handleBack}
            data-testid="back-btn"
            style={{ padding: '6px 12px', fontSize: '13px' }}
          >
            ⬅ Back
          </button>
        )}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge" style={{ background: badgeColor.bg, color: badgeColor.color, fontSize: '10px' }}>
              {badgeLabel}
            </span>
            <VersionDropdown
              activeVersion={activeVersion}
              versions={versions}
              hasDraft={hasDraft || isDirty}
              isDirty={isDirty}
              isEditing={isEditing}
              onSelectVersion={handleSelectVersion}
              onSaveVersion={handleSaveVersion}
              onDeleteDraft={handleDeleteDraft}
              documentTitle={title}
            />
            {resolvedMode === 'profile' && resolving && (
              <span style={{ fontSize: '10.5px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                ⚙️ Live Resolving...
              </span>
            )}
          </div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{effectiveTitle}</h2>
        </div>
      </div>

      {/* Editor & Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* Undo / Redo — Edit mode only */}
        {isEditing && (onUndo || onRedo) && (
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

        {/* Visual / JSON Switch — Edit mode only, only if handler provided */}
        {isEditing && onToggleEditMode && (
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

        {/* Saving / Validating Status Indicator */}
        {isEditing && isBusy && (
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic', marginRight: '8px' }}>
            {saving || isSaving ? 'Saving...' : 'Validating...'}
          </span>
        )}

        {/* Save Button — Edit mode only when onSave handler provided */}
        {isEditing && onSave && (
          <button
            type="button"
            className="btn-primary"
            onClick={(e) => {
              console.log('[DocumentToolbar] Save button clicked! isBusy:', isBusy);
              onSave(e);
            }}
            disabled={isBusy}
            data-testid="save-btn"
            style={{ padding: '6px 14px', fontSize: '13px' }}
          >
            💾 Save
          </button>
        )}

        {/* Segmented View / Edit Mode Toggle — Always on far right */}
        {handleToggleEdit && (
          <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            <button
              type="button"
              className={!isEditing ? 'btn-primary' : 'btn-secondary'}
              onClick={() => { if (isEditing) handleToggleEdit(); }}
              disabled={isBusy}
              data-testid="mode-view-btn"
              style={{
                borderRadius: 0,
                padding: '6px 12px',
                fontSize: '13px',
                border: 'none',
                background: !isEditing ? 'var(--color-primary)' : 'var(--color-surface-2)',
                color: !isEditing ? '#fff' : 'var(--color-text)',
                fontWeight: !isEditing ? 'bold' : 'normal',
                cursor: isEditing ? 'pointer' : 'default'
              }}
            >
              👁️ View
            </button>
            <button
              type="button"
              className={isEditing ? 'btn-primary' : 'btn-secondary'}
              onClick={() => { if (!isEditing) handleToggleEdit(); }}
              disabled={isBusy}
              data-testid="mode-edit-btn"
              style={{
                borderRadius: 0,
                padding: '6px 12px',
                fontSize: '13px',
                border: 'none',
                borderLeft: '1px solid var(--color-border)',
                background: isEditing ? 'var(--color-primary)' : 'var(--color-surface-2)',
                color: isEditing ? '#fff' : 'var(--color-text)',
                fontWeight: isEditing ? 'bold' : 'normal',
                cursor: !isEditing ? 'pointer' : 'default'
              }}
            >
              ✏️ Edit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
