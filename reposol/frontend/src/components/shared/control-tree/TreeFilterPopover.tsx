import React, { useState, useRef, useEffect } from 'react';
import { TreeVisibilityFilter } from '../../../hooks/useControlTree';

export interface TreeFilterPopoverProps {
  filter: TreeVisibilityFilter;
  onChange: (filter: TreeVisibilityFilter) => void;
  align?: 'left' | 'right';
  className?: string;
  testId?: string;
  showUnassignedOption?: boolean;
}

export const TreeFilterPopover: React.FC<TreeFilterPopoverProps> = ({
  filter,
  onChange,
  align = 'right',
  testId = 'tree-filter-popover',
  showUnassignedOption = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside or Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const hasModifiedFilter = !filter.showActive || !filter.showExcluded || filter.showWithdrawn || Boolean(filter.showUnassigned);

  const handleToggle = (key: keyof TreeVisibilityFilter) => {
    onChange({
      ...filter,
      [key]: !filter[key]
    });
  };

  const handleReset = () => {
    onChange({
      showActive: true,
      showExcluded: true,
      showWithdrawn: false,
      showUnassigned: false
    });
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        data-testid={`${testId}-btn`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Filter visibility options"
        title="Filter visible control types (Active, Excluded, Withdrawn)"
        style={{
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isOpen || hasModifiedFilter ? 'rgba(59, 130, 246, 0.15)' : 'var(--color-surface-2)',
          border: `1px solid ${hasModifiedFilter ? 'var(--color-primary, #3b82f6)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-sm)',
          color: hasModifiedFilter ? 'var(--color-primary, #3b82f6)' : 'var(--color-text-muted)',
          cursor: 'pointer',
          padding: 0,
          position: 'relative',
          transition: 'all var(--transition-fast)'
        }}
      >
        {/* Filter funnel icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>

        {/* Active badge dot when filters are non-default */}
        {hasModifiedFilter && (
          <span
            style={{
              position: 'absolute',
              top: '3px',
              right: '3px',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--color-primary, #3b82f6)'
            }}
          />
        )}
      </button>

      {isOpen && (
        <div
          data-testid={`${testId}-menu`}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            [align]: 0,
            zIndex: 100,
            minWidth: '220px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '6px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text)' }}>
              Display Filter
            </span>
            {hasModifiedFilter && (
              <button
                type="button"
                onClick={handleReset}
                style={{
                  fontSize: '11px',
                  color: 'var(--color-primary, #3b82f6)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Reset
              </button>
            )}
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: 'var(--color-text)',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <input
              type="checkbox"
              data-testid={`${testId}-checkbox-active`}
              checked={filter.showActive}
              onChange={() => handleToggle('showActive')}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'var(--color-success, #22c55e)' }}>✓</span> Active Controls
            </span>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: 'var(--color-text)',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <input
              type="checkbox"
              data-testid={`${testId}-checkbox-excluded`}
              checked={filter.showExcluded}
              onChange={() => handleToggle('showExcluded')}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'var(--color-danger, #ef4444)' }}>⊘</span> Excluded Controls
            </span>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <input
              type="checkbox"
              data-testid={`${testId}-checkbox-withdrawn`}
              checked={filter.showWithdrawn}
              onChange={() => handleToggle('showWithdrawn')}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>⛔</span> Withdrawn in Catalog
            </span>
          </label>

          {showUnassignedOption && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                userSelect: 'none',
                borderTop: '1px solid var(--color-border-subtle)',
                paddingTop: '6px',
                marginTop: '2px'
              }}
            >
              <input
                type="checkbox"
                data-testid={`${testId}-checkbox-unassigned`}
                checked={Boolean(filter.showUnassigned)}
                onChange={() => handleToggle('showUnassigned')}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>📥</span> Show Unassigned Node
              </span>
            </label>
          )}
        </div>
      )}
    </div>
  );
};
