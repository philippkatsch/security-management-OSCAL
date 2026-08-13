import React from 'react';
import { useAtomValue } from 'jotai';
import { editModeAtom } from '@stores/uiAtoms';
import styles from './SharedComponents.module.css';
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
  isEditing: isEditingProp,
  onIdChange,
  onTitleChange,
  onClassChange,
  showClass = true,
  typeBadge,
  control,
  onSelectControl,
  onRestoreControl,
  onChange,
  ...rest
}: any) {
  const globalEditMode = useAtomValue(editModeAtom);
  const isEditing = isEditingProp !== undefined ? isEditingProp : globalEditMode;

  const isWithdrawn = control?.status === 'withdrawn' || control?.props?.some((p: any) => (p.name === 'status' || p.name === 'state') && p.value === 'withdrawn');
  const replacementLink = control?.links?.find((l: any) => l.rel === 'incorporated-into' || l.rel === 'moved-to' || l.rel === 'replacement' || (l.href && l.href.includes('#')));
  const targetId = replacementLink?.href
    ? (replacementLink.href.includes('#') ? replacementLink.href.split('#').pop()! : replacementLink.href).trim().replace(/^#/, '')
    : null;

  const handleRestore = () => {
    if (window.confirm('Restore this control?')) {
      if (onRestoreControl) {
        onRestoreControl();
      } else if (onChange && control) {
        const newProps = (control.props || []).filter((p: any) => p.name !== 'status' && p.name !== 'state');
        const newLinks = (control.links || []).filter((l: any) => l.rel !== 'incorporated-into');
        onChange({
          ...control,
          status: 'active',
          props: newProps,
          links: newLinks
        });
      }
    }
  };

  const withdrawalBanner = isWithdrawn ? (
    <div
      className="withdrawal-banner"
      data-testid="withdrawal-banner"
      style={{
        padding: '12px 16px',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid var(--color-error, #ef4444)',
        borderRadius: '6px',
        color: 'var(--color-error-text, #f87171)',
        marginBottom: '12px',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        flexWrap: 'wrap'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span>
          ⚠️ Control Withdrawn: This control is deprecated.
          {targetId && (
            <span style={{ marginLeft: '8px' }}>
              Replaced by:{' '}
              <strong
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectControl) {
                    onSelectControl(targetId);
                  }
                  const el = document.querySelector(`[data-testid="tree-node-${targetId}"], [data-dnd-id="${targetId}"], [data-node-id="${targetId}"]`) as HTMLElement;
                  if (el) el.click();
                }}
              >
                {targetId}
              </strong>
            </span>
          )}
        </span>
      </div>
      <button
        type="button"
        className="btn-restore-control"
        onClick={handleRestore}
        style={{
          padding: '4px 12px',
          background: 'var(--color-primary, #3b82f6)',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        Restore Control
      </button>
    </div>
  ) : null;

  if (isEditing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        {withdrawalBanner}
        {/* Main Title Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
          <span style={{ fontSize: '24px', color: 'var(--color-primary)' }}>⬡</span>
          <DebouncedInput
            value={title || ''}
            onChange={onTitleChange}
            placeholder="Control Title"
            className={['form-input', styles['form-input-plain'], styles['form-input-title']].filter(Boolean).join(' ')}
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
              className={['form-input', styles['form-input-plain'], styles['form-input-badge']].filter(Boolean).join(' ')}
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
                className={['form-input', styles['form-input-plain'], styles['form-input-class']].filter(Boolean).join(' ')}
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
      {withdrawalBanner}
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
