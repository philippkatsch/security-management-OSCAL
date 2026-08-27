import React, { useState, useEffect } from 'react';
import styles from '@components/shared/SharedComponents.module.css';

export interface TargetGroupOption {
  id: string;
  title: string;
  depth?: number;
}

export interface DeleteCustomGroupDialogProps {
  isOpen: boolean;
  group: {
    id: string;
    title?: string;
    controls?: Array<{ id: string; title?: string }>;
    groups?: Array<{ id: string; title?: string }>;
    'insert-controls'?: Array<any>;
  } | null;
  availableTargetGroups?: TargetGroupOption[];
  onConfirm: (options: {
    deleteChildren: boolean;
    reassignToGroupId: string | null;
  }) => void;
  onCancel: () => void;
}

export const DeleteCustomGroupDialog: React.FC<DeleteCustomGroupDialogProps> = ({
  isOpen,
  group,
  availableTargetGroups = [],
  onConfirm,
  onCancel
}) => {
  const [controlHandling, setControlHandling] = useState<'unassigned' | 'reassign'>('unassigned');
  const [targetGroupId, setTargetGroupId] = useState<string>('');
  const [subgroupHandling, setSubgroupHandling] = useState<'promote' | 'delete'>('promote');

  // Filter available target groups to exclude the current group
  const filteredTargets = (availableTargetGroups || []).filter(g => g.id !== group?.id);

  useEffect(() => {
    if (isOpen) {
      setControlHandling('unassigned');
      setSubgroupHandling('promote');
      if (filteredTargets.length > 0) {
        setTargetGroupId(filteredTargets[0].id);
      } else {
        setTargetGroupId('');
      }
    }
  }, [isOpen, group?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen || !group) return null;

  // Compute control count
  let controlsCount = 0;
  if (Array.isArray(group.controls)) {
    controlsCount = group.controls.length;
  } else if (Array.isArray(group['insert-controls'])) {
    for (const ic of group['insert-controls']) {
      if (ic['include-controls']) {
        for (const inc of ic['include-controls']) {
          if (Array.isArray(inc['with-ids'])) {
            controlsCount += inc['with-ids'].length;
          }
        }
      }
    }
  }

  const subGroupsCount = (group.groups || []).length;

  const handleConfirm = () => {
    onConfirm({
      deleteChildren: subgroupHandling === 'delete',
      reassignToGroupId: controlHandling === 'reassign' && targetGroupId ? targetGroupId : null
    });
  };

  const groupTitleOrId = group.title || group.id;

  return (
    <div
      data-testid="delete-custom-group-dialog-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        data-testid="delete-custom-group-dialog"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg, 8px)',
          width: '540px',
          maxWidth: '100%',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-surface-2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🗑️</span>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--color-text)' }}>
              Delete Custom Group
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            data-testid="close-delete-group-dialog-btn"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: 'var(--color-text-muted)'
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text)' }}>
            Are you sure you want to delete custom group <strong>"{groupTitleOrId}"</strong>?
          </p>

          {/* Group Summary Box */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md, 6px)',
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>
              📊 Group Summary
            </div>
            <div style={{ color: 'var(--color-text)' }}>
              • <strong>{controlsCount}</strong> Assigned Control{controlsCount !== 1 ? 's' : ''}
            </div>
            <div style={{ color: 'var(--color-text)' }}>
              • <strong>{subGroupsCount}</strong> Child Sub-group{subGroupsCount !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Controls Handling Options */}
          {controlsCount > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text)' }}>
                📥 Contained Controls ({controlsCount}) Handling:
              </div>
              
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  fontSize: '13px',
                  color: 'var(--color-text)',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name="controlHandling"
                  value="unassigned"
                  checked={controlHandling === 'unassigned'}
                  onChange={() => setControlHandling('unassigned')}
                  data-testid="radio-control-unassigned"
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <strong>Return controls to Unassigned Pool (Default)</strong>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Controls remain available in the Control Pool.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  fontSize: '13px',
                  color: 'var(--color-text)',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name="controlHandling"
                  value="reassign"
                  checked={controlHandling === 'reassign'}
                  onChange={() => setControlHandling('reassign')}
                  disabled={filteredTargets.length === 0}
                  data-testid="radio-control-reassign"
                  style={{ marginTop: '2px' }}
                />
                <div style={{ flex: 1 }}>
                  <strong>Reassign controls to another custom group:</strong>
                  {filteredTargets.length > 0 ? (
                    <select
                      data-testid="select-reassign-target-group"
                      value={targetGroupId}
                      onChange={(e) => {
                        setTargetGroupId(e.target.value);
                        setControlHandling('reassign');
                      }}
                      disabled={controlHandling !== 'reassign'}
                      style={{
                        display: 'block',
                        width: '100%',
                        marginTop: '6px',
                        padding: '6px 8px',
                        fontSize: '13px',
                        background: 'var(--color-surface-2)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm, 4px)',
                        color: 'var(--color-text)'
                      }}
                    >
                      {filteredTargets.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.title || t.id}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                      No other custom groups available for reassignment.
                    </div>
                  )}
                </div>
              </label>
            </div>
          )}

          {/* Sub-groups Handling Options */}
          {subGroupsCount > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--color-border-subtle, #333)', paddingTop: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text)' }}>
                📁 Child Sub-groups ({subGroupsCount}) Handling:
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  fontSize: '13px',
                  color: 'var(--color-text)',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name="subgroupHandling"
                  value="promote"
                  checked={subgroupHandling === 'promote'}
                  onChange={() => setSubgroupHandling('promote')}
                  data-testid="radio-subgroup-promote"
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <strong>Promote child sub-groups up one level (Preserve)</strong>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Sub-groups are retained and moved to parent / root level.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  fontSize: '13px',
                  color: 'var(--color-text)',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name="subgroupHandling"
                  value="delete"
                  checked={subgroupHandling === 'delete'}
                  onChange={() => setSubgroupHandling('delete')}
                  data-testid="radio-subgroup-delete"
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <strong style={{ color: 'var(--color-danger, #ef4444)' }}>Delete child sub-groups and their contents</strong>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    All child groups and their control inclusions will be permanently removed.
                  </div>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            background: 'var(--color-surface-2)'
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            className={styles['button-secondary']}
            data-testid="cancel-delete-group-btn"
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={styles['button-danger']}
            data-testid="confirm-delete-group-btn"
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              cursor: 'pointer',
              background: 'var(--color-danger, #dc2626)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm, 4px)',
              fontWeight: '600'
            }}
          >
            Delete Group
          </button>
        </div>
      </div>
    </div>
  );
};