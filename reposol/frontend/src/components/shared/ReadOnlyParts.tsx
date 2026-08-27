import React from 'react';

/**
 * Generates an automatic list label based on index and depth of nesting.
 * Depth 1: a., b., c.
 * Depth 2: 1., 2., 3.
 * Depth 3: (a), (b), (c)
 * Depth 4: (1), (2), (3)
 */
export const getAutoLabel = (index, depth) => {
  const getLetter = (idx) => String.fromCharCode(97 + (idx % 26));
  const getNumber = (idx) => String(idx + 1);
  if (depth === 1) return `${getLetter(index)}.`;
  if (depth === 2) return `${getNumber(index)}.`;
  if (depth === 3) return `(${getLetter(index)})`;
  if (depth === 4) return `(${getNumber(index)})`;
  return `•`;
};

export interface ReadOnlyPartsProps {
  parts?: any[];
  renderProse?: (txt: any) => any;
  modifiedPartIds?: string[];
  onResetPart?: (partId: string) => void;
  isEditing?: boolean;
  depth?: number;
}

export const ReadOnlyParts: React.FC<ReadOnlyPartsProps> = ({
  parts,
  renderProse = (txt: any) => txt,
  modifiedPartIds = [],
  onResetPart,
  isEditing = false,
  depth = 0
}) => {
  if (!parts || !parts.length) return null;

  // Filter out assessment method and objective parts from the main statement list.
  // In view mode (isEditing === false), also filter out parts that have been removed.
  const displayParts = parts.filter((p: any) => {
    const name = p.name?.toLowerCase();
    const isExcludedType = name === 'objective' || name === 'assessment-method' || name === 'examine' || name === 'interview' || name === 'test';
    if (isExcludedType) return false;
    if (!isEditing && p.isRemoved) return false;
    return true;
  });

  if (!displayParts.length) return null;

  return (
    <>
      {displayParts.map((p: any, idx: number) => {
        const isModified = Boolean(
          p.isModified ||
          (modifiedPartIds && modifiedPartIds.length > 0 && (
            (p.id && modifiedPartIds.some((mid: string) => mid === p.id || mid.toLowerCase() === p.id.toLowerCase())) ||
            (p.originalId && modifiedPartIds.some((mid: string) => mid === p.originalId || mid.toLowerCase() === p.originalId.toLowerCase()))
          ))
        );
        const isAdded = Boolean(p.isAdded && !isModified);
        const subparts = p.parts || [];
        const isTopLevel = depth === 0;

        const iconMap: Record<string, string> = {
          statement: '☵',
          guidance: '📖',
          guideline: '📖',
          discussion: '💬',
        };
        const icon = iconMap[p.name?.toLowerCase()] || '📄';
        const nameTitle = p.name ? p.name.charAt(0).toUpperCase() + p.name.slice(1) : '';

        // If top-level, render as a card
        if (isTopLevel) {
          const cardStyle: React.CSSProperties = {
            background: 'var(--color-surface)',
            border: `1px solid ${isModified ? 'rgba(245, 158, 11, 0.4)' : isAdded ? 'rgba(34, 197, 94, 0.4)' : 'var(--color-border)'}`,
            borderLeft: `4px solid ${isModified ? '#f59e0b' : isAdded ? '#22c55e' : p.name?.toLowerCase() === 'statement' ? 'var(--color-primary)' : 'var(--color-accent, var(--color-primary))'}`,
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '16px',
            opacity: p.isRemoved ? 0.6 : 1
          };

          return (
            <div key={p.id || p.prose} style={cardStyle}>
              {/* Header Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px', color: 'var(--color-primary)' }}>{icon}</span>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--color-text)', letterSpacing: '0.3px', textDecoration: p.isRemoved ? 'line-through' : 'none' }}>{nameTitle}</span>
                  {isModified && !p.isRemoved && <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>Modified</span>}
                  {isAdded && <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)', fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>Added</span>}
                  {p.isRemoved && <span style={{ background: 'var(--color-border)', color: 'var(--color-text-muted)', fontSize: '10px', padding: '2px 8px', borderRadius: '10px' }}>Removed</span>}
                </div>
                {(isModified || p.isAdded) && onResetPart && (
                  <button 
                    type="button"
                    onClick={() => onResetPart(p.originalId || p.id)} 
                    title={p.isAdded ? "Remove added statement" : "Revert to original catalog baseline"}
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      background: p.isAdded ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: p.isAdded ? '#f87171' : '#fbbf24',
                      border: `1px solid ${p.isAdded ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 600
                    }}
                  >
                    {p.isAdded ? '🗑️ Remove' : '↩ Revert to Baseline'}
                  </button>
                )}
              </div>
              {/* Prose Content */}
              {p.prose && (
                <div style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--color-text)', textDecoration: p.isRemoved ? 'line-through' : 'none', marginBottom: subparts.length > 0 ? '12px' : '0' }}>
                  {renderProse(p.prose)}
                </div>
              )}
              {/* Original Baseline Diff / Comparison Box */}
              {isModified && p.originalProse && p.originalProse !== p.prose && (
                <div style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  background: 'rgba(245, 158, 11, 0.05)',
                  border: '1px dashed rgba(245, 158, 11, 0.3)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: 'var(--color-text-muted)'
                }}>
                  <div style={{ fontWeight: 700, fontSize: '11px', color: '#fbbf24', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>📋 Original Catalog Baseline:</span>
                  </div>
                  <div style={{ fontStyle: 'italic', textDecoration: 'line-through', opacity: 0.85 }}>
                    {renderProse(p.originalProse)}
                  </div>
                </div>
              )}
              {/* Recursive sub-parts (list items) */}
              {subparts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <ReadOnlyParts 
                    parts={subparts} 
                    renderProse={renderProse} 
                    modifiedPartIds={modifiedPartIds} 
                    onResetPart={onResetPart} 
                    isEditing={isEditing} 
                    depth={depth + 1} 
                  />
                </div>
              )}
            </div>
          );
        }

        // If nested list item, render with left vertical border and label
        const label = getAutoLabel(idx, depth);

        const itemStyle: React.CSSProperties = {
          display: 'flex',
          gap: '12px',
          marginBottom: '10px',
          marginLeft: depth > 1 ? '16px' : '0', // Indent child levels
          position: 'relative',
          opacity: p.isRemoved ? 0.6 : 1
        };

        const verticalLineStyle: React.CSSProperties = {
          borderLeft: '2px solid var(--color-primary-light, var(--color-primary))',
          opacity: 0.5,
          marginRight: '2px',
          flexShrink: 0
        };

        const proseStyle: React.CSSProperties = {
          fontSize: '14px',
          lineHeight: '1.6',
          color: 'var(--color-text)',
          flex: 1
        };

        return (
          <div key={p.id || p.prose} style={itemStyle}>
            {/* Left vertical border line */}
            <div style={verticalLineStyle}></div>
            
            {/* Label */}
            {label && (
              <span style={{ fontWeight: '800', color: 'var(--color-primary)', minWidth: '24px', flexShrink: 0, textDecoration: p.isRemoved ? 'line-through' : 'none' }}>
                {label}
              </span>
            )}
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isModified && !p.isRemoved && <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '10px', padding: '1px 6px', borderRadius: '8px', fontWeight: 600 }}>Modified</span>}
                  {p.isAdded && <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)', fontSize: '10px', padding: '1px 6px', borderRadius: '8px', fontWeight: 600 }}>Added</span>}
                  {p.isRemoved && <span style={{ background: 'var(--color-border)', color: 'var(--color-text-muted)', fontSize: '10px', padding: '1px 6px', borderRadius: '8px' }}>Removed</span>}
                </div>
                {(isModified || p.isAdded) && onResetPart && (
                  <button 
                    type="button"
                    onClick={() => onResetPart(p.originalId || p.id)} 
                    title={p.isAdded ? "Remove added part" : "Revert to original catalog baseline"}
                    style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      background: p.isAdded ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: p.isAdded ? '#f87171' : '#fbbf24',
                      border: `1px solid ${p.isAdded ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                      fontWeight: 600
                    }}
                  >
                    {p.isAdded ? '🗑️ Remove' : '↩ Revert'}
                  </button>
                )}
              </div>
              {p.prose && (
                <div style={{ ...proseStyle, textDecoration: p.isRemoved ? 'line-through' : 'none' }}>
                  {renderProse(p.prose)}
                </div>
              )}
              {isModified && p.originalProse && p.originalProse !== p.prose && (
                <div style={{
                  marginTop: '6px',
                  padding: '6px 10px',
                  background: 'rgba(245, 158, 11, 0.05)',
                  border: '1px dashed rgba(245, 158, 11, 0.3)',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: 'var(--color-text-muted)'
                }}>
                  <div style={{ fontWeight: 600, fontSize: '10px', color: '#fbbf24', marginBottom: '2px' }}>
                    Baseline:
                  </div>
                  <div style={{ fontStyle: 'italic', textDecoration: 'line-through', opacity: 0.85 }}>
                    {renderProse(p.originalProse)}
                  </div>
                </div>
              )}
              {/* Recursive sub-parts */}
              {subparts.length > 0 && (
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <ReadOnlyParts 
                    parts={subparts} 
                    renderProse={renderProse} 
                    modifiedPartIds={modifiedPartIds} 
                    onResetPart={onResetPart} 
                    isEditing={isEditing} 
                    depth={depth + 1} 
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
};
