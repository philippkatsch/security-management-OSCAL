import React from 'react';
import styles from './ControlDetail.module.css';
import { PartsEditor } from '../PartsEditor';
import { ReadOnlyParts } from '../ReadOnlyParts';

export interface ControlPartsPanelProps {
  mode?: any;
  isEditing?: boolean;
  parts?: any[];
  handleFieldChange?: any;
  combinedParams?: any;
  handleDefineNewParam?: any;
  originalControl?: any;
  renderEditPart?: any;
  handleAddProfilePartAtEnd?: any;
  getModifiedPartIds?: any;
  handleResetProse?: any;
  renderProseToReact?: any;
  infoTooltip?: any;
  controlId?: string;
  [key: string]: any;
}

export function ControlPartsPanel({
  mode,
  isEditing,
  parts = [],
  handleFieldChange = () => {},
  combinedParams,
  handleDefineNewParam,
  originalControl,
  renderEditPart,
  handleAddProfilePartAtEnd,
  getModifiedPartIds,
  handleResetProse,
  renderProseToReact,
  infoTooltip,
  controlId: _controlId
}: ControlPartsPanelProps) {
  return (
    <div className={styles['section-container']}>
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
          ) : renderEditPart ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {parts.map((p, i) => renderEditPart(p, originalControl?.parts?.[i], 0, i))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <ReadOnlyParts
                parts={parts}
                renderProse={renderProseToReact}
                modifiedPartIds={getModifiedPartIds ? getModifiedPartIds() : undefined}
                onResetPart={handleResetProse}
                isEditing={isEditing}
              />
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
