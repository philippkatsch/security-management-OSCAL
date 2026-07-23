import React from 'react';
import { DebouncedInput } from './DebouncedInput';

/**
 * Shared header component for control detail views.
 * Used by both CatalogPage (ControlDetail) and ProfilePage (ProfileDetailPanel).
 * Structured to maintain identical visual hierarchy between read-only and edit modes.
 */
export function ControlHeader({
  id,
  title,
  controlClass,
  isEditing,
  onIdChange,
  onTitleChange,
  onClassChange,
  showClass = true,
  typeBadge
}) {
  if (isEditing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        {/* Main Title Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
          <span style={{ fontSize: '24px', color: 'var(--color-primary)' }}>⬡</span>
          <DebouncedInput
            value={title || ''}
            onChange={onTitleChange}
            placeholder="Control Title"
            className="form-input form-input-plain form-input-title"
            style={{
              fontSize: '22px',
              fontWeight: '800',
              color: 'var(--color-text)',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px dashed var(--color-border)',
              padding: '2px 4px',
              width: '100%',
              maxWidth: '600px'
            }}
          />
        </div>

        {/* Sub-row: ID and Class */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>ID:</span>
            <DebouncedInput
              value={id || ''}
              onChange={onIdChange}
              placeholder="id"
              className="form-input form-input-plain form-input-badge"
              style={{
                fontFamily: 'monospace',
                fontSize: '13px',
                fontWeight: 'bold',
                color: 'var(--color-text-muted)',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px dashed var(--color-border)',
                padding: '2px 4px',
                width: `${Math.max((id || '').length, 3) + 3}ch`
              }}
            />
          </div>

          {showClass && (
            <div className="badge" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: '12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px' }}>
              <span>Class:</span>
              <DebouncedInput
                value={controlClass || ''}
                onChange={onClassChange}
                placeholder="category"
                className="form-input form-input-plain form-input-class"
                style={{
                  width: `${Math.max((controlClass || '').length, 8) + 3}ch`,
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  padding: 0,
                  fontSize: 'inherit',
                  fontWeight: 'inherit'
                }}
              />
            </div>
          )}

          {typeBadge && (
            <span className="badge" style={{ background: 'var(--color-surface-3)', color: 'var(--color-primary)', fontSize: '11px' }}>
              {typeBadge}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '24px', color: 'var(--color-primary)' }}>⬡</span>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: 'var(--color-text)' }}>
          {id && !title?.toUpperCase().startsWith(id.toUpperCase()) ? `${id.toUpperCase()} ` : ''}
          {title || 'Untitled Control'}
        </h1>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <strong style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{id}</strong>
        {showClass && controlClass && (
          <span className="badge" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: '12px', fontSize: '11px', padding: '2px 8px' }}>
            {controlClass}
          </span>
        )}
        {typeBadge && (
          <span className="badge" style={{ background: 'var(--color-surface-3)', color: 'var(--color-primary)', fontSize: '11px' }}>
            {typeBadge}
          </span>
        )}
      </div>
    </div>
  );
}
