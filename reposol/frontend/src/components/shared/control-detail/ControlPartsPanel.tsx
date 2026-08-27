import React, { useState, useRef, useEffect } from 'react';
import styles from './ControlDetail.module.css';
import { PartsEditor } from '../PartsEditor';
import { ReadOnlyParts } from '../ReadOnlyParts';

const PROFILE_PART_NAMES = [
  'statement',
  'guidance',
  'discussion',
  'information',
  'overview',
  'item',
  'objective',
  'example',
  'custom'
];

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
  const [showAddMenu, setShowAddMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showAddMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddMenu]);

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
          {handleAddProfilePartAtEnd && (
            <div style={{ position: 'relative', marginTop: '12px' }} ref={menuRef}>
              <button
                type="button"
                onClick={() => setShowAddMenu(prev => !prev)}
                style={{
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
                ➕ Add Part {showAddMenu ? '▲' : '▼'}
              </button>
              {showAddMenu && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  bottom: '100%',
                  marginBottom: '4px',
                  background: 'var(--color-surface, #1e1e2e)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  zIndex: 50,
                  minWidth: '180px',
                  padding: '4px 0',
                  maxHeight: '260px',
                  overflowY: 'auto'
                }}>
                  {PROFILE_PART_NAMES.map(name => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        handleAddProfilePartAtEnd(name);
                        setShowAddMenu(false);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-text)',
                        padding: '6px 14px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'background 0.12s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover, rgba(255,255,255,0.08))')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {name === 'statement' ? '☵ Statement' :
                       name === 'guidance' ? '📖 Guidance' :
                       name === 'discussion' ? '💬 Discussion' :
                       name === 'information' ? 'ℹ️ Information' :
                       name === 'overview' ? '📋 Overview' :
                       name === 'item' ? '• Item' :
                       name === 'objective' ? '🎯 Objective' :
                       name === 'example' ? '💡 Example' :
                       name === 'custom' ? '⚙️ Custom' :
                       `📄 ${name.charAt(0).toUpperCase() + name.slice(1)}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
                modifiedPartIds={mode === 'profile' && getModifiedPartIds ? getModifiedPartIds() : undefined}
                onResetPart={mode === 'profile' && isEditing ? handleResetProse : undefined}
                isEditing={isEditing}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
