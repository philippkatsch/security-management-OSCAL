import React from 'react';
import { DebouncedInput } from './DebouncedInput';
import styles from './SharedComponents.module.css';

export function ParameterConstraints({ constraints, onAdd, onUpdate, onRemove, isEditing }) {
  if (!isEditing && (!constraints || constraints.length === 0)) return null;

  return (
    <div style={{ background: 'var(--color-surface)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
      <h4 style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 0, marginBottom: '8px' }}>Constraints & Validation</h4>
      {(!constraints || constraints.length === 0) && (
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No constraints defined.</span>
      )}
      {constraints && constraints.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {constraints.map((c, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', width: '80px' }}>Description:</span>
                {isEditing ? (
                  <DebouncedInput value={c.description || ''} onChange={(v) => onUpdate(idx, 'description', v)} placeholder="Description (e.g. Must be a valid integer)" className={styles['form-input-plain']} style={{ flex: 1, fontSize: '12px', borderBottom: '1px dashed var(--color-border)' }} />
                ) : (
                  <span style={{ fontSize: '12px' }}>{c.description}</span>
                )}
                {isEditing && (
                  <button type="button" onClick={() => onRemove(idx)} className={styles['btn-soft-delete']} style={{ padding: '2px 6px', fontSize: '10px', color: '#ff4d4f' }}>🗑</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', width: '80px' }}>Regex Test:</span>
                {isEditing ? (
                  <DebouncedInput value={c.tests?.[0]?.expression || ''} onChange={(v) => onUpdate(idx, 'expression', v)} placeholder="Regex expression (e.g. ^[0-9]+$)" className={styles['form-input-plain']} style={{ flex: 1, fontSize: '12px', fontFamily: 'monospace', borderBottom: '1px dashed var(--color-border)' }} />
                ) : (
                  <code style={{ fontSize: '11px', background: 'var(--color-surface-3)', padding: '2px 6px', borderRadius: '4px' }}>{c.tests?.[0]?.expression || '(none)'}</code>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', width: '80px' }}>Error Msg:</span>
                {isEditing ? (
                  <DebouncedInput value={c.tests?.[0]?.remarks || c.remarks || ''} onChange={(v) => onUpdate(idx, 'remarks', v)} placeholder="Validation Error Note / Remarks" className={styles['form-input-plain']} style={{ flex: 1, fontSize: '12px', borderBottom: '1px dashed var(--color-border)' }} />
                ) : (
                  <span style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>{c.tests?.[0]?.remarks || '(default)'}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {isEditing && (
        <button type="button" onClick={onAdd} className={styles['btn-secondary']} style={{ marginTop: '8px', padding: '4px 8px', fontSize: '11px' }}>
          ➕ Add Constraint
        </button>
      )}
    </div>
  );
}
