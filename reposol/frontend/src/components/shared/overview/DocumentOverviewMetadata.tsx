import React from 'react';
import { MetadataEditor } from '../MetadataEditor';

export interface DocumentOverviewMetadataProps {
  mode?: string;
  document?: any;
  isEditingState?: boolean;
  baselineStats?: any;
  onChange?: (updated: any) => void;
  onNavigateToProperties?: () => void;
}

export function DocumentOverviewMetadata({ mode, document: rawDocument, isEditingState, baselineStats, onChange = () => {}, onNavigateToProperties }: DocumentOverviewMetadataProps) {
  const document = rawDocument || {};
  const badgeStyle: React.CSSProperties = {
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border-subtle)',
    padding: '4px 10px',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 'var(--radius-sm)'
  };

  const badgeLabelStyle: React.CSSProperties = {
    fontSize: '9px',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  };

  const handleMetadataChange = (updatedMetadata) => {
    onChange({ ...document, metadata: updatedMetadata });
  };

  return (
    <div style={{ padding: '20px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {mode === 'profile' && baselineStats && (
        <div style={{
          border: '1px solid var(--color-border-subtle)',
          background: 'var(--color-surface-2)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-text)' }}>
            📋 Baseline Statistics
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <div className="badge" style={badgeStyle}>
              <span style={badgeLabelStyle}>Controls</span>
              <strong style={{ fontSize: '13px', color: 'var(--color-primary)' }}>{baselineStats.controlsCount}</strong>
            </div>
            <div className="badge" style={badgeStyle}>
              <span style={badgeLabelStyle}>Groups</span>
              <strong style={{ fontSize: '13px', color: 'var(--color-primary)' }}>{baselineStats.groupsCount}</strong>
            </div>
            <div className="badge" style={badgeStyle}>
              <span style={badgeLabelStyle}>Merge</span>
              <strong style={{ fontSize: '13px', color: 'var(--color-text)' }}>{baselineStats.mergeMode}</strong>
            </div>
            <div className="badge" style={badgeStyle}>
              <span style={badgeLabelStyle}>Params</span>
              <strong style={{ fontSize: '13px', color: 'var(--color-accent, var(--color-text))' }}>{baselineStats.paramsCount}</strong>
            </div>
            <div className="badge" style={badgeStyle}>
              <span style={badgeLabelStyle}>Alters</span>
              <strong style={{ fontSize: '13px', color: 'var(--color-accent, var(--color-text))' }}>{baselineStats.altersCount}</strong>
            </div>
          </div>
        </div>
      )}

      <MetadataEditor
        metadata={document.metadata || {}}
        onChange={handleMetadataChange}
        readOnly={!isEditingState}
        onNavigateToProperties={onNavigateToProperties}
      />
    </div>
  );
}
