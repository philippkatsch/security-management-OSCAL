import React, { useState } from 'react';
import styles from './SharedComponents.module.css';
import VersionDropdown from './version/VersionDropdown';
import { StageHelpModal } from './ui/StageHelpModal';

/**
 * Badge color mapping for all OSCAL document types.
 */
const MODE_CONFIG = {
  'catalog':               { bg: 'rgba(99, 102, 241, 0.18)', color: '#818cf8', label: 'OSCAL Catalog' },
  'catalogs':              { bg: 'rgba(99, 102, 241, 0.18)', color: '#818cf8', label: 'OSCAL Catalog' },
  'profile':               { bg: 'rgba(236, 72, 153, 0.18)', color: '#f472b6', label: 'OSCAL Profile' },
  'profiles':              { bg: 'rgba(236, 72, 153, 0.18)', color: '#f472b6', label: 'OSCAL Profile' },
  'component-definition':  { bg: 'rgba(245, 158, 11, 0.18)', color: '#fbbf24', label: 'Component Definition' },
  'component-definitions': { bg: 'rgba(245, 158, 11, 0.18)', color: '#fbbf24', label: 'Component Definition' },
  'ssp':                   { bg: 'rgba(168, 85, 247, 0.18)', color: '#c084fc', label: 'System Security Plan' },
  'ssps':                  { bg: 'rgba(168, 85, 247, 0.18)', color: '#c084fc', label: 'System Security Plan' },
  'assessment-plan':       { bg: 'rgba(14, 165, 233, 0.18)', color: '#38bdf8', label: 'Assessment Plan' },
  'assessment-plans':      { bg: 'rgba(14, 165, 233, 0.18)', color: '#38bdf8', label: 'Assessment Plan' },
  'assessment-results':    { bg: 'rgba(34, 197, 94, 0.18)',  color: '#4ade80', label: 'Assessment Results' },
  'poam':                  { bg: 'rgba(239, 68, 68, 0.18)',  color: '#f87171', label: 'POA&M' },
  'poams':                 { bg: 'rgba(239, 68, 68, 0.18)',  color: '#f87171', label: 'POA&M' },
  'control-mappings':      { bg: 'rgba(234, 179, 8, 0.18)',  color: '#facc15', label: 'Control Mappings' },
  'mappings':              { bg: 'rgba(234, 179, 8, 0.18)',  color: '#facc15', label: 'Control Mappings' },
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
export interface DocumentToolbarProps {
  title?: string;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  onBack?: () => void;
  onSaveVersion?: () => void;
  onShowVersions?: () => void;
  onSelectVersion?: (version: any) => void;
  versions?: any[];
  version?: string;
  editMode?: string;
  onToggleEditMode?: (mode: string) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  saving?: boolean;
  validating?: boolean;
  isSaving?: boolean;
  mode?: string;
  typeLabel?: string;
  documentType?: string;
  stage?: string;
  resolving?: boolean;
  onCopy?: () => void;
  onExport?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  isDirty?: boolean;
  hasDraft?: boolean;
  saveStatus?: string;
  oscalVersion?: string;
  documentId?: string;
  documentTitle?: string;
  doc?: any;
  [key: string]: any;
}

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
}: DocumentToolbarProps) {
  const effectiveTitle = title !== 'Untitled Document' ? title : (documentTitle || title);
  // ── Handlers & Fallbacks ──
  // Minimal fallback for missing handlers if someone was relying on aliases
  const handleToggleEdit = onToggleEdit || rest.onEdit;
  const handleBack = onBack || rest.onClose;
  const handleSaveVersion = onSaveVersion || rest.onSaveVersion || onSave || rest.onSave;
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
  const activeVersion = activeVersionStr || (versions as any[]).find(v => v.is_active)?.version || '1.0.0';

  // ── Guide Modal State ──
  const [showGuideModal, setShowGuideModal] = useState(false);

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
        flexWrap: 'wrap',
        position: 'relative',
        zIndex: 10,
        flexShrink: 0
      }}
    >
      {/* Title Area */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {handleBack && (
          <button
            type="button"
            className={styles['btn-secondary']}
            onClick={handleBack}
            disabled={isBusy}
            data-testid="back-btn"
            style={{ padding: '6px 12px', fontSize: '13px' }}
          >
            ⬅ Back
          </button>
        )}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ background: badgeColor.bg, color: badgeColor.color, fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', display: 'inline-block' }}>
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
              className={styles['btn-secondary']}
              disabled={isBusy || (editMode === 'visual' ? !canUndo : false)}
              onClick={onUndo}
              title="Undo (Ctrl+Z)"
              data-testid="undo-btn"
              style={{ padding: '6px 10px', fontSize: '12px' }}
            >
              ↩️
            </button>
            <button
              type="button"
              className={styles['btn-secondary']}
              disabled={isBusy || (editMode === 'visual' ? !canRedo : false)}
              onClick={onRedo}
              title="Redo (Ctrl+Y)"
              data-testid="redo-btn"
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
              className={editMode === 'visual' ? styles['btn-primary'] : styles['btn-secondary']}
              onClick={() => onToggleEditMode('visual')}
              disabled={isBusy}
              data-testid="visual-mode-btn"
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
                color: editMode === 'visual' ? '#fff' : undefined,
                opacity: isBusy ? 0.6 : 1,
                cursor: isBusy ? 'not-allowed' : 'pointer'
              }}
            >
              🎨 Visual
            </button>
            <button
              type="button"
              className={editMode === 'json' ? styles['btn-primary'] : styles['btn-secondary']}
              onClick={() => onToggleEditMode('json')}
              disabled={isBusy}
              data-testid="json-mode-btn"
              style={{
                borderTopLeftRadius: 0,
                borderBottomLeftRadius: 0,
                padding: '6px 12px',
                fontSize: '12px',
                border: `1px solid ${editMode === 'json' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: editMode === 'json' ? 'var(--color-accent)' : undefined,
                color: editMode === 'json' ? '#fff' : undefined,
                opacity: isBusy ? 0.6 : 1,
                cursor: isBusy ? 'not-allowed' : 'pointer'
              }}
            >
              💻 JSON
            </button>
          </div>
        )}

        {/* Saving / Validating Status Indicator */}
        {isBusy && (
          <span
            data-testid="save-status-indicator"
            style={{
              fontSize: '12px',
              color: 'var(--color-text-muted)',
              fontStyle: 'italic',
              marginRight: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span style={{ display: 'inline-block' }}>⏳</span>
            {saving || isSaving ? 'Saving...' : 'Validating...'}
          </span>
        )}

        {/* Guide Button */}
        <button
          type="button"
          className={styles['btn-secondary']}
          onClick={() => setShowGuideModal(true)}
          data-testid="document-guide-btn"
          title={`View ${badgeLabel} guide & documentation`}
          style={{ padding: '6px 12px', fontSize: '13px' }}
        >
          💡 Guide
        </button>

        {/* Export Button */}
        {onExport && (
          <button
            type="button"
            className={styles['btn-secondary']}
            onClick={onExport}
            data-testid="export-btn"
            title="Export Document as JSON"
            style={{ padding: '6px 14px', fontSize: '13px' }}
          >
            📥 Export
          </button>
        )}

        {/* Save Button — Edit mode only when onSave handler provided */}
        {isEditing && onSave && (
          <button
            type="button"
            className={styles['btn-primary']}
            onClick={onSave}
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
              className={!isEditing ? styles['btn-primary'] : styles['btn-secondary']}
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
              className={isEditing ? styles['btn-primary'] : styles['btn-secondary']}
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

      {showGuideModal && (
        <StageHelpModal
          isOpen={showGuideModal}
          stage={resolvedMode}
          onClose={() => setShowGuideModal(false)}
        />
      )}
    </div>
  );
}
