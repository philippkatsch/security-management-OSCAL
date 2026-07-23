import React from 'react';

/**
 * Reusable Confirmation Dialog Modal.
 */
export function ConfirmDialog({
  open = false,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false
}) {
  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onCancel}
    >
      <div
        className="modal-panel shadow-2xl"
        style={{
          width: '400px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{title}</h3>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
          {message}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'btn-delete' : 'btn-primary'}
            onClick={onConfirm}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
