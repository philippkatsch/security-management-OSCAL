import React, { useState } from 'react';

/**
 * Shared accordion for control enhancements.
 * Used by both CatalogPage (ControlDetail) and ProfilePage (ProfileDetailPanel).
 *
 * US 1.15: Enhancements shown as compact accordion, collapsed by default.
 */
export function EnhancementsAccordion({
  enhancements = [],
  isEditing = false,
  onSelectEnhancement,
  onAddEnhancement,
  onRemoveEnhancement,
  showNavArrow = true,
  renderEnhancementContent
}) {
  const [enhancementsOpen, setEnhancementsOpen] = useState(false);
  const [expandedItemIds, setExpandedItemIds] = useState({});

  const toggleExpandItem = (itemId, ev) => {
    if (ev) ev.stopPropagation();
    setExpandedItemIds(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleRowClick = (e, itemId) => {
    if (showNavArrow) {
      if (onSelectEnhancement) {
        onSelectEnhancement(e.id);
      }
    } else {
      setExpandedItemIds(prev => ({
        ...prev,
        [itemId]: !prev[itemId]
      }));
    }
  };

  return (
    <div>
      {/* Accordion Header */}
      <div
        onClick={() => setEnhancementsOpen(!enhancementsOpen)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          padding: '6px 0',
          marginBottom: enhancementsOpen ? '12px' : '0'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '9px',
            color: 'var(--color-text-muted)',
            transition: 'transform 0.15s ease',
            transform: enhancementsOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            display: 'inline-block'
          }}>
            ▶
          </span>
          <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Control Enhancements (Sub-controls)
          </h4>
          <span
            className="badge"
            style={{
              background: enhancements.length > 0 ? 'var(--color-primary)' : 'var(--color-surface-3)',
              color: enhancements.length > 0 ? '#fff' : 'var(--color-text-muted)',
              fontSize: '10px',
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 'bold'
            }}
          >
            {enhancements.length}
          </span>
        </div>
        {isEditing && onAddEnhancement && (
          <button
            type="button"
            className="btn-soft"
            onClick={(e) => {
              e.stopPropagation();
              onAddEnhancement();
              setEnhancementsOpen(true);
            }}
            style={{ padding: '4px 10px', fontSize: '11px' }}
          >
            ➕ Add Enhancement
          </button>
        )}
      </div>

      {/* Accordion Body */}
      {enhancementsOpen && (
        <div style={{ animation: 'fadeIn 0.15s ease-in' }}>
          {enhancements.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px', margin: '4px 0', paddingLeft: '16px' }}>
              No enhancements defined.
            </p>
          ) : (
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', overflow: 'hidden' }}>
              {enhancements.map((e, idx) => {
                const itemId = e.id || idx;
                const isExpanded = !!expandedItemIds[itemId];
                return (
                  <div key={itemId} style={{ borderBottom: idx < enhancements.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <div
                      onClick={() => handleRowClick(e, itemId)}
                      className="sidebar-item-like"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 20px',
                        cursor: (showNavArrow && onSelectEnhancement) || !showNavArrow || renderEnhancementContent ? 'pointer' : 'default',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {(renderEnhancementContent || !showNavArrow) && (
                          <span
                            onClick={(ev) => toggleExpandItem(itemId, ev)}
                            style={{
                              fontSize: '9px',
                              color: 'var(--color-text-muted)',
                              cursor: 'pointer',
                              display: 'inline-block',
                              width: '12px',
                              textAlign: 'center'
                            }}
                            title={isExpanded ? 'Collapse details' : 'Expand details'}
                          >
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        )}
                        <span style={{ color: 'var(--color-accent)', fontSize: '14px' }}>⬡</span>
                        <strong style={{ fontSize: '13px', color: 'var(--color-text)' }}>
                          <span style={{ color: 'var(--color-text-muted)', marginRight: '8px', fontWeight: '500' }}>{e.id}</span>
                          {e.title || 'Untitled Enhancement'}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isEditing && onRemoveEnhancement && (
                          <button
                            type="button"
                            className="btn-soft-delete"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              onRemoveEnhancement(idx, ev);
                            }}
                            title="Remove enhancement"
                            style={{ padding: '2px 6px', fontSize: '11px', marginRight: '6px' }}
                          >
                            🗑
                          </button>
                        )}
                        {showNavArrow && (
                          <span
                            onClick={(ev) => {
                              if (onSelectEnhancement) {
                                ev.stopPropagation();
                                onSelectEnhancement(e.id);
                              }
                            }}
                            style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}
                          >
                            ➔
                          </span>
                        )}
                      </div>
                    </div>
                    {isExpanded && renderEnhancementContent && (
                      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border-subtle)', background: 'var(--color-surface-2)' }}>
                        {renderEnhancementContent(e, idx)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
