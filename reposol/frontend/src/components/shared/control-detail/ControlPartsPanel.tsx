import React from 'react';
import styles from './ControlDetail.module.css';
import { PartsEditor } from '../PartsEditor';
import { ReadOnlyParts } from '../ReadOnlyParts';

export function ControlPartsPanel({
  mode,
  isEditing,
  parts,
  handleFieldChange,
  combinedParams,
  handleDefineNewParam,
  originalControl,
  renderEditPart,
  handleAddProfilePartAtEnd,
  getModifiedPartIds,
  handleResetProse,
  renderProseToReact,
  infoTooltip
}) {
  return (
    <div className={styles['section-container']} style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>Statements / Prose Parts</h4>
        {infoTooltip}
      </div>
      {mode === 'catalog' && isEditing ? (
        <PartsEditor
          parts={parts}
          onChange={(updatedParts) => handleFieldChange('parts', updatedParts)}
          params={combinedParams}
          readOnly={false}
          onDefineNewParam={handleDefineNewParam}
        />
      ) : mode === 'profile' && isEditing ? (
        <div>
          {parts.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px' }}>No prose statements.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {parts.map((p, i) => renderEditPart ? renderEditPart(p, originalControl?.parts?.[i], 0, i) : null)}
            </div>
          )}
          <button
            type="button"
            onClick={handleAddProfilePartAtEnd}
            style={{
              marginTop: '12px',
              background: 'transparent',
              border: 'none',
              color: 'var(--color-accent-hover)',
              fontSize: '12px',
              cursor: 'pointer',
              padding: '4px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ➕ Add Statement
          </button>
        </div>
      ) : (
        <div>
          {parts.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px' }}>No prose statements.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <ReadOnlyParts
                parts={parts}
                renderProse={renderProseToReact}
                modifiedPartIds={mode === 'profile' ? getModifiedPartIds() : undefined}
                onResetPart={mode === 'profile' ? handleResetProse : undefined}
                isEditing={isEditing}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
