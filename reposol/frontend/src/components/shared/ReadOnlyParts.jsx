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

export const ReadOnlyParts = ({
  parts,
  renderProse = (txt) => txt,
  modifiedPartIds,
  onResetPart,
  isEditing = false,
  depth = 0
}) => {
  if (!parts || !parts.length) return null;

  // Filter out assessment method and objective parts from the main statement list.
  // In view mode (isEditing === false), also filter out parts that have been removed.
  const displayParts = parts.filter(p => {
    const name = p.name?.toLowerCase();
    const isExcludedType = name === 'objective' || name === 'assessment-method' || name === 'examine' || name === 'interview' || name === 'test';
    if (isExcludedType) return false;
    if (!isEditing && p.isRemoved) return false;
    return true;
  });

  if (!displayParts.length) return null;

  return (
    <>
      {displayParts.map((p, idx) => {
        const isModified = modifiedPartIds?.includes(p.id);
        const subparts = p.parts || [];
        const isTopLevel = depth === 0;

        const iconMap = {
          statement: '☵',
          guidance: '📖',
          guideline: '📖',
          discussion: '💬',
        };
        const icon = iconMap[p.name?.toLowerCase()] || '📄';
        const nameTitle = p.name ? p.name.charAt(0).toUpperCase() + p.name.slice(1) : '';

        // If top-level, render as a card
        if (isTopLevel) {
          const cardStyle = {
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderLeft: `4px solid ${p.name?.toLowerCase() === 'statement' ? 'var(--color-primary)' : 'var(--color-accent, var(--color-primary))'}`,
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '16px',
            opacity: p.isRemoved ? 0.6 : 1
          };

          return (
            <div key={p.id || p.prose} style={cardStyle}>
              {/* Header Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px', color: 'var(--color-primary)' }}>{icon}</span>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--color-text)', letterSpacing: '0.3px', textDecoration: p.isRemoved ? 'line-through' : 'none' }}>{nameTitle}</span>
                </div>
                {isModified && !p.isRemoved && <span style={{ background: 'var(--color-warning)', color: '#000', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', marginLeft: 'auto' }}>Modified</span>}
                {p.isRemoved && <span style={{ background: 'var(--color-border)', color: 'var(--color-text-muted)', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', marginLeft: 'auto' }}>Removed</span>}
                {isEditing && isModified && onResetPart && (
                  <button 
                    onClick={() => onResetPart(p.id)} 
                    style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--color-surface-3)', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: isModified ? '8px' : 'auto' }}
                  >
                    ↺ Reset
                  </button>
                )}
              </div>
              {/* Prose Content */}
              {p.prose && (
                <div style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--color-text)', textDecoration: p.isRemoved ? 'line-through' : 'none', marginBottom: subparts.length > 0 ? '12px' : '0' }}>
                  {renderProse(p.prose)}
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

        const itemStyle = {
          display: 'flex',
          gap: '12px',
          marginBottom: '10px',
          marginLeft: depth > 1 ? '16px' : '0', // Indent child levels
          position: 'relative',
          opacity: p.isRemoved ? 0.6 : 1
        };

        const verticalLineStyle = {
          borderLeft: '2px solid var(--color-primary-light, var(--color-primary))',
          opacity: 0.5,
          marginRight: '2px',
          flexShrink: 0
        };

        const proseStyle = {
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
              {p.prose && (
                <div style={{ ...proseStyle, textDecoration: p.isRemoved ? 'line-through' : 'none' }}>
                  {renderProse(p.prose)}
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
