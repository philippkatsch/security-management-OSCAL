import React from 'react';

export interface ConflictBannerProps {
  conflicts: {
    has_conflicts: boolean;
    orphaned_alters?: Array<{ 'control-id': string; adds_count: number; removes_count: number }>;
    orphaned_params?: Array<{ 'param-id': string }>;
    orphaned_custom_refs?: Array<{ 'group-id': string; 'control-id': string }>;
  } | null;
  onDismiss?: () => void;
  /** If provided, shows a "Remove now" button so the user can proactively clean up orphaned modifications. */
  onRemoveOrphans?: () => void;
  isEditing?: boolean;
}

/**
 * Sticky warning banner shown when modify directives reference controls/params
 * that are no longer in the resolved import set.
 * Per NIST OSCAL spec: orphaned alters are inoperative (not errors).
 */
export function ConflictBanner({ conflicts, onDismiss, onRemoveOrphans, isEditing }: ConflictBannerProps) {
  if (!conflicts?.has_conflicts) return null;

  const orphanedAlters = conflicts.orphaned_alters || [];
  const orphanedParams = conflicts.orphaned_params || [];
  const orphanedCustomRefs = conflicts.orphaned_custom_refs || [];
  const totalOrphans = orphanedAlters.length + orphanedParams.length + orphanedCustomRefs.length;

  return (
    <div
      data-testid="conflict-banner"
      style={{
      background: '#fff3cd',
      border: '1px solid #ffc107',
      borderRadius: '6px',
      padding: '8px 14px',
      margin: '8px 0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      fontSize: '13px',
      color: '#856404'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '15px' }}>⚠️</span>
        <strong>{totalOrphans} orphaned modification{totalOrphans !== 1 ? 's' : ''} / assignment{totalOrphans !== 1 ? 's' : ''}</strong>
        <span style={{ opacity: 0.8 }}>
          — targeting controls/params no longer imported.
          {orphanedAlters.length > 0 && (
            <> Alters: {orphanedAlters.map(a => a['control-id']).join(', ')}.</>
          )}
          {orphanedParams.length > 0 && (
            <> Params: {orphanedParams.map(p => p['param-id']).join(', ')}.</>
          )}
          {orphanedCustomRefs.length > 0 && (
            <> Custom Groups: {orphanedCustomRefs.map(c => c['control-id']).join(', ')}.</>
          )}
          {' '}
          {isEditing
            ? 'Remove them now to keep your profile clean.'
            : 'These will be cleaned up automatically when you next edit and save.'
          }
        </span>
      </div>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
        {isEditing && onRemoveOrphans && (
          <button
            data-testid="remove-orphans-btn"
            onClick={onRemoveOrphans}
            style={{
              background: '#856404',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: '4px',
              fontWeight: 600,
              whiteSpace: 'nowrap'
            }}
            title="Remove orphaned modifications from the profile"
          >
            🗑️ Remove now
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              opacity: 0.6,
              padding: '2px 4px'
            }}
            title="Dismiss"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
