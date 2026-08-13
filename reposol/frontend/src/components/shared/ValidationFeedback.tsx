import React from 'react';

/**
 * Validation feedback box.
 */
export function ValidationFeedback({
  result,
  onClose
}) {
  if (!result) return null;

  const { valid, errors = [], error } = result;

  return (
    <div
      className={`validation-feedback-box ${valid ? 'valid' : 'invalid'}`}
      style={{
        margin: '12px 0',
        padding: '12px',
        borderRadius: 'var(--radius-md)',
        background: valid ? 'rgba(46, 160, 67, 0.15)' : 'rgba(248, 81, 73, 0.15)',
        border: valid ? '1px solid rgba(46, 160, 67, 0.4)' : '1px solid rgba(248, 81, 73, 0.4)',
        color: 'var(--color-text)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <strong style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {valid ? '✅ Dokument ist OSCAL-Schema-Konform' : '⚠️ Validierungsfehler im Dokument'}
        </strong>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--color-text)', cursor: 'pointer', fontSize: '14px' }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Root/Backend error */}
      {error && (
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}

      {/* Structured errors array */}
      {!valid && errors.length > 0 && (
        <div style={{ maxHeight: '180px', overflowY: 'auto', marginTop: '8px' }}>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {errors.map((err, idx) => (
              <li key={idx} style={{ color: 'var(--color-danger)' }}>
                {err.path && (
                  <code
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      marginRight: '6px',
                      fontFamily: 'monospace'
                    }}
                  >
                    {err.path}
                  </code>
                )}
                {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
