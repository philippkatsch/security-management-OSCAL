import React, { useState } from 'react';
import { ComponentStatement, Parameter } from '@lib/types/oscal';
import { generateUUID } from '@lib/oscal-utils';
import { ProseWithParams } from '@components/shared/ProseWithParams';
import { PropsEditor } from '@components/shared/PropsEditor';
import { LinksEditor } from '@components/shared/LinksEditor';
import sharedStyles from '@components/shared/SharedComponents.module.css';
import styles from '../ComponentPage.module.css';

export interface StatementsEditorProps {
  statements?: ComponentStatement[];
  controlId?: string;
  availableParams?: Parameter[];
  availableStatementParts?: Array<{ id: string; label?: string; prose?: string }>;
  onChange: (statements: ComponentStatement[]) => void;
  editMode?: boolean;
}

export const StatementsEditor: React.FC<StatementsEditorProps> = ({
  statements = [],
  controlId = 'control',
  availableParams = [],
  availableStatementParts = [],
  onChange,
  editMode = false
}) => {
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({});

  const toggleDetails = (idx: number) => {
    setExpandedIndices(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const addStatement = (prefillId?: string) => {
    if (!editMode) return;
    const count = statements.length;
    const letter = String.fromCharCode(97 + (count % 26)); // 'a', 'b', 'c', ...
    const defaultId = prefillId || `${controlId}_smt_${letter}`;

    const newStmt: ComponentStatement = {
      'statement-id': defaultId,
      uuid: generateUUID(),
      description: '',
      props: [],
      links: [],
      'responsible-roles': []
    };

    onChange([...statements, newStmt]);
    setExpandedIndices(prev => ({ ...prev, [statements.length]: true }));
  };

  const updateStatement = (idx: number, patch: Partial<ComponentStatement>) => {
    if (!editMode) return;
    const updated = [...statements];
    updated[idx] = { ...updated[idx], ...patch };
    onChange(updated);
  };

  const removeStatement = (idx: number) => {
    if (!editMode) return;
    const updated = statements.filter((_, i) => i !== idx);
    onChange(updated);
  };

  // Statement-ID uniqueness check
  const duplicateIds = React.useMemo(() => {
    const counts: Record<string, number> = {};
    statements.forEach(s => {
      const id = (s['statement-id'] || '').trim().toLowerCase();
      if (id) counts[id] = (counts[id] || 0) + 1;
    });
    return new Set(Object.keys(counts).filter(k => counts[k] > 1));
  }, [statements]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h6 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--color-text, #111827)' }}>
          Statement-Level Implementations ({statements.length})
        </h6>
        {editMode && (
          <button
            type="button"
            className={['btn', sharedStyles['btn-secondary'], sharedStyles['btn-sm']].filter(Boolean).join(' ')}
            onClick={() => addStatement()}
          >
            + Add Statement
          </button>
        )}
      </div>

      {/* Suggested Source Parts */}
      {editMode && availableStatementParts.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '12px' }}>
          <span style={{ color: 'var(--color-text-muted, #6b7280)', fontWeight: 500 }}>Quick Add Part:</span>
          {availableStatementParts.map(part => {
            const isPresent = statements.some(s => s['statement-id'] === part.id);
            if (isPresent) return null;
            return (
              <button
                key={part.id}
                type="button"
                style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border, #d1d5db)',
                  background: 'var(--surface-color, #ffffff)',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
                onClick={() => addStatement(part.id)}
                title={part.prose || part.label}
              >
                + {part.id}
              </button>
            );
          })}
        </div>
      )}

      {statements.length === 0 ? (
        <div style={{ padding: '12px', background: 'var(--surface-alt, #f9fafb)', border: '1px dashed var(--color-border, #e5e7eb)', borderRadius: '6px', fontSize: '12px', color: 'var(--color-text-muted, #6b7280)', textAlign: 'center' }}>
          {editMode ? 'No statement-level details added. Click "+ Add Statement" for fine-grained multi-part control narratives.' : 'No statement-level details configured.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {statements.map((stmt, idx) => {
            const isDup = duplicateIds.has((stmt['statement-id'] || '').trim().toLowerCase());
            const isOpen = expandedIndices[idx] || false;

            return (
              <div
                key={stmt.uuid || idx}
                style={{
                  border: isDup ? '1px solid var(--color-danger, #ef4444)' : '1px solid var(--color-border, #e5e7eb)',
                  borderRadius: '6px',
                  background: 'var(--color-surface, #ffffff)',
                  overflow: 'hidden'
                }}
              >
                {/* Statement Card Header */}
                <div
                  style={{
                    padding: '8px 12px',
                    background: 'var(--surface-alt, #f9fafb)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--color-border, #e5e7eb)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted, #4b5563)' }}>
                      Statement ID:
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        className="form-input"
                        style={{ maxWidth: '200px', padding: '2px 8px', fontSize: '12px', fontFamily: 'monospace' }}
                        value={stmt['statement-id'] || ''}
                        onChange={(e) => updateStatement(idx, { 'statement-id': e.target.value })}
                        placeholder="e.g. ac-7_smt_a"
                      />
                    ) : (
                      <code style={{ fontSize: '12px', fontWeight: 600 }}>{stmt['statement-id']}</code>
                    )}
                    {isDup && (
                      <span style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', fontWeight: 500 }}>
                        ⚠️ Duplicate ID
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', fontSize: '11px', color: 'var(--color-accent, #3b82f6)', cursor: 'pointer' }}
                      onClick={() => toggleDetails(idx)}
                    >
                      {isOpen ? '▲ Less' : '▼ Metadata'}
                    </button>
                    {editMode && (
                      <button
                        type="button"
                        className={['btn', 'btn-danger', sharedStyles['btn-sm']].filter(Boolean).join(' ')}
                        style={{ padding: '2px 6px', fontSize: '11px' }}
                        onClick={() => removeStatement(idx)}
                        title="Remove this statement"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Statement Narrative Editor */}
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted, #6b7280)' }}>
                    Statement Implementation Narrative:
                  </label>
                  {editMode ? (
                    <ProseWithParams
                      value={stmt.description || ''}
                      onChange={(val) => updateStatement(idx, { description: val })}
                      params={availableParams}
                      placeholder="Describe how this specific statement/sub-requirement is fulfilled..."
                      rows={2}
                    />
                  ) : (
                    <div className={styles['prose-readonly']} style={{ fontSize: '13px' }}>
                      <ProseWithParams value={stmt.description || ''} onChange={() => {}} disabled rows={2} />
                    </div>
                  )}

                  {/* Optional Statement Metadata Drawer */}
                  {isOpen && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--color-border, #e5e7eb)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <h6 style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #6b7280)' }}>
                          Statement Properties
                        </h6>
                        <PropsEditor
                          props={stmt.props || []}
                          onChange={(props) => updateStatement(idx, { props })}
                          isEditing={editMode}
                          readOnly={!editMode}
                        />
                      </div>

                      <div>
                        <h6 style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #6b7280)' }}>
                          Statement Links
                        </h6>
                        <LinksEditor
                          links={stmt.links || []}
                          onChange={(links) => updateStatement(idx, { links })}
                          readOnly={!editMode}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StatementsEditor;
