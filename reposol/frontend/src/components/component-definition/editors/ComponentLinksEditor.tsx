import React, { useState, useMemo, useEffect } from 'react';
import { Link, DefinedComponent, Resource } from '@lib/types/oscal';
import { DebouncedInput } from '@components/shared/DebouncedInput';
import styles from '../ComponentPage.module.css';
import sharedStyles from '@components/shared/SharedComponents.module.css';

export interface StandardRelDef {
  rel: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  appliesTo?: string[];
}

export const OSCAL_STANDARD_RELS: StandardRelDef[] = [
  {
    rel: 'depends-on',
    label: 'Depends On',
    description: 'A reference to another component that this component has an operational dependency on.',
    icon: '📦',
    color: '#b45309',
    badgeBg: 'rgba(245, 158, 11, 0.1)',
    badgeBorder: 'rgba(245, 158, 11, 0.35)'
  },
  {
    rel: 'uses-service',
    label: 'Uses Service',
    description: 'This component consumes the referenced service component.',
    icon: '☁️',
    color: '#1d4ed8',
    badgeBg: 'rgba(59, 130, 246, 0.1)',
    badgeBorder: 'rgba(59, 130, 246, 0.35)'
  },
  {
    rel: 'uses-network',
    label: 'Uses Network',
    description: 'Component communicates through or depends on the referenced network segment/interconnection.',
    icon: '🌐',
    color: '#6d28d9',
    badgeBg: 'rgba(139, 92, 246, 0.1)',
    badgeBorder: 'rgba(139, 92, 246, 0.35)'
  },
  {
    rel: 'validation',
    label: 'Validation Record',
    description: 'A reference to a component of type=validation (e.g., FIPS 140-2 certificate) certifying this asset.',
    icon: '🛡️',
    color: '#047857',
    badgeBg: 'rgba(16, 185, 129, 0.1)',
    badgeBorder: 'rgba(16, 185, 129, 0.35)'
  },
  {
    rel: 'proof-of-compliance',
    label: 'Proof of Compliance',
    description: 'A pointer to an audit report, attestation, or compliance evidence file in back-matter resources.',
    icon: '📜',
    color: '#0f766e',
    badgeBg: 'rgba(20, 184, 166, 0.1)',
    badgeBorder: 'rgba(20, 184, 166, 0.35)'
  },
  {
    rel: 'baseline-template',
    label: 'Baseline Template',
    description: 'A reference to the baseline configuration template used to deploy/configure the asset.',
    icon: '📐',
    color: '#0369a1',
    badgeBg: 'rgba(14, 165, 233, 0.1)',
    badgeBorder: 'rgba(14, 165, 233, 0.35)'
  },
  {
    rel: 'system-security-plan',
    label: 'System Security Plan',
    description: 'A link to an external SSP that incorporates this component.',
    icon: '📋',
    color: '#374151',
    badgeBg: 'rgba(107, 114, 128, 0.1)',
    badgeBorder: 'rgba(107, 114, 128, 0.35)'
  },
  {
    rel: 'provided-by',
    label: 'Provided By (Service)',
    description: 'This service is provided by the referenced component identifier.',
    icon: '🤝',
    color: '#2563eb',
    badgeBg: 'rgba(37, 99, 235, 0.1)',
    badgeBorder: 'rgba(37, 99, 235, 0.35)',
    appliesTo: ['service']
  },
  {
    rel: 'used-by',
    label: 'Used By (Service)',
    description: 'This service is used by the referenced component identifier.',
    icon: '👥',
    color: '#2563eb',
    badgeBg: 'rgba(37, 99, 235, 0.1)',
    badgeBorder: 'rgba(37, 99, 235, 0.35)',
    appliesTo: ['service']
  },
  {
    rel: 'reference',
    label: 'General Reference',
    description: 'A generic reference link.',
    icon: '🔗',
    color: '#4b5563',
    badgeBg: 'rgba(107, 114, 128, 0.08)',
    badgeBorder: 'rgba(107, 114, 128, 0.25)'
  }
];

export interface ComponentLinksEditorProps {
  links?: Link[];
  components?: DefinedComponent[];
  resources?: Resource[];
  currentComponentUuid?: string;
  componentType?: string;
  onChange: (links: Link[]) => void;
  editMode?: boolean;
  isReadOnly?: boolean;
}

export function ComponentLinksEditor({
  links = [],
  components = [],
  resources = [],
  currentComponentUuid,
  componentType = '',
  onChange,
  editMode = false,
  isReadOnly = false
}: ComponentLinksEditorProps) {
  const isEditing = editMode && !isReadOnly;
  const [showAdvancedIndex, setShowAdvancedIndex] = useState<Record<number, boolean>>({});

  // Sibling components for internal link picker
  const siblingComponents = useMemo(() => {
    return (components || []).filter(c => c.uuid !== currentComponentUuid);
  }, [components, currentComponentUuid]);

  // Component lookup map for rendering internal link titles
  const compMap = useMemo(() => {
    const map = new Map<string, DefinedComponent>();
    (components || []).forEach(c => map.set(c.uuid, c));
    return map;
  }, [components]);

  // Resource lookup map for rendering back-matter references
  const resMap = useMemo(() => {
    const map = new Map<string, Resource>();
    (resources || []).forEach(r => map.set(r.uuid, r));
    return map;
  }, [resources]);

  const linksRef = React.useRef(links);
  useEffect(() => {
    linksRef.current = links;
  }, [links]);

  const handleLinkChange = (index: number, patch: Partial<Link>) => {
    if (!isEditing) return;
    const updated = linksRef.current.map((l, i) => {
      if (i === index) {
        const item = { ...l, ...patch };
        if (!item.text) delete item.text;
        if (!item.rel) delete item.rel;
        if (!item['media-type']) delete item['media-type'];
        if (!item['resource-fragment']) delete item['resource-fragment'];
        return item;
      }
      return l;
    });
    linksRef.current = updated;
    onChange(updated);
  };

  const handleAddLink = () => {
    if (!isEditing) return;
    const next = [
      ...linksRef.current,
      {
        href: siblingComponents.length > 0 ? `#${siblingComponents[0].uuid}` : '',
        rel: 'depends-on',
        text: siblingComponents.length > 0 ? siblingComponents[0].title : ''
      }
    ];
    linksRef.current = next;
    onChange(next);
  };

  const handleRemoveLink = (index: number) => {
    if (!isEditing) return;
    const next = linksRef.current.filter((_, i) => i !== index);
    linksRef.current = next;
    onChange(next);
  };

  const toggleAdvanced = (index: number) => {
    setShowAdvancedIndex(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const getRelDef = (rel?: string) => {
    return OSCAL_STANDARD_RELS.find(r => r.rel === rel) || {
      rel: rel || 'custom',
      label: rel || 'Link',
      description: 'Custom relationship',
      icon: '🔗',
      color: 'var(--color-primary, #3b82f6)',
      badgeBg: 'var(--surface-alt, #f3f4f6)',
      badgeBorder: 'var(--border-color, #d1d5db)'
    };
  };

  return (
    <div className={styles['component-links-editor']} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Read-Only Presentation */}
      {!isEditing ? (
        links.length === 0 ? (
          <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted, #6b7280)', fontSize: '13px', margin: '4px 0' }}>
            No links or dependencies declared for this component.
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {links.map((link, idx) => {
              const relDef = getRelDef(link.rel);
              const isInternalComp = link.href?.startsWith('#') && compMap.has(link.href.slice(1));
              const isBackMatterRes = link.href?.startsWith('#') && resMap.has(link.href.slice(1));
              const targetComp = isInternalComp ? compMap.get(link.href.slice(1)) : null;
              const targetRes = isBackMatterRes ? resMap.get(link.href.slice(1)) : null;

              const displayLabel = link.text || targetComp?.title || targetRes?.title || link.href;

              return (
                <div
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: relDef.badgeBg,
                    border: `1px solid ${relDef.badgeBorder}`,
                    borderRadius: '16px',
                    fontSize: '12px',
                    color: relDef.color
                  }}
                  title={`${relDef.label}: ${relDef.description} (Target: ${link.href})`}
                >
                  <span>{relDef.icon}</span>
                  <span style={{ fontWeight: 600 }}>{relDef.label}:</span>
                  <span style={{ color: 'var(--color-text, #111827)' }}>{displayLabel}</span>
                  {link['media-type'] && (
                    <span style={{ fontSize: '10px', opacity: 0.8, background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: '4px' }}>
                      {link['media-type']}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Edit Mode Presentation */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {links.length === 0 ? (
            <div
              style={{
                padding: '14px',
                textAlign: 'center',
                background: 'var(--surface-alt, #f8f9fa)',
                border: '1px dashed var(--border-color, #d1d5db)',
                borderRadius: '6px',
                color: 'var(--color-text-muted, #6b7280)',
                fontSize: '13px'
              }}
            >
              No relationships or links defined. Click below to declare dependencies, consumed services, or compliance evidence.
            </div>
          ) : (
            links.map((link, idx) => {
              const isCustomRel = !OSCAL_STANDARD_RELS.some(r => r.rel === link.rel) && Boolean(link.rel);
              
              // Target type detection
              const isInternalFragment = (link.href || '').startsWith('#');
              const fragmentId = isInternalFragment ? (link.href || '').slice(1) : '';
              const isCompTarget = isInternalFragment && compMap.has(fragmentId);
              const isResTarget = isInternalFragment && resMap.has(fragmentId);

              let targetMode: 'component' | 'resource' | 'url' = 'url';
              if (isCompTarget || (siblingComponents.length > 0 && isInternalFragment && !isResTarget)) {
                targetMode = 'component';
              } else if (isResTarget || (resources.length > 0 && isInternalFragment)) {
                targetMode = 'resource';
              }

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '12px',
                    background: 'var(--surface-alt, #fafafa)',
                    border: '1px solid var(--border-color, #e0e0e0)',
                    borderRadius: '6px',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Relation Selector */}
                    <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #4b5563)' }}>
                        Relationship (rel)
                      </label>
                      <select
                        className="form-input"
                        value={isCustomRel ? '__custom__' : (link.rel || 'depends-on')}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            handleLinkChange(idx, { rel: 'custom-rel' });
                          } else {
                            handleLinkChange(idx, { rel: e.target.value });
                          }
                        }}
                      >
                        <optgroup label="Standard Component Relationships">
                          {OSCAL_STANDARD_RELS.filter(r => !r.appliesTo || r.appliesTo.includes(componentType)).map(r => (
                            <option key={r.rel} value={r.rel}>
                              {r.icon} {r.label} ({r.rel})
                            </option>
                          ))}
                        </optgroup>
                        <option value="__custom__">✏️ Other / Custom Relation...</option>
                      </select>
                    </div>

                    {/* Target Selector Mode & Href Input */}
                    <div style={{ flex: '2 1 280px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #4b5563)' }}>
                          Target Reference (href) <span style={{ color: 'var(--color-danger, #ef4444)' }}>*</span>
                        </label>
                        <div style={{ display: 'flex', gap: '4px', fontSize: '10px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const firstComp = siblingComponents[0];
                              handleLinkChange(idx, {
                                href: firstComp ? `#${firstComp.uuid}` : '#',
                                text: link.text || firstComp?.title || ''
                              });
                            }}
                            style={{
                              border: 'none',
                              background: targetMode === 'component' ? 'var(--color-accent, #3b82f6)' : 'transparent',
                              color: targetMode === 'component' ? '#fff' : 'var(--color-accent-hover, #0969da)',
                              padding: '1px 6px',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          >
                            🧱 Component
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const firstRes = resources[0];
                              handleLinkChange(idx, {
                                href: firstRes ? `#${firstRes.uuid}` : '#',
                                text: link.text || firstRes?.title || ''
                              });
                            }}
                            style={{
                              border: 'none',
                              background: targetMode === 'resource' ? 'var(--color-accent, #3b82f6)' : 'transparent',
                              color: targetMode === 'resource' ? '#fff' : 'var(--color-accent-hover, #0969da)',
                              padding: '1px 6px',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          >
                            📁 Resource
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLinkChange(idx, { href: 'https://' })}
                            style={{
                              border: 'none',
                              background: targetMode === 'url' ? 'var(--color-accent, #3b82f6)' : 'transparent',
                              color: targetMode === 'url' ? '#fff' : 'var(--color-accent-hover, #0969da)',
                              padding: '1px 6px',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          >
                            🌐 URI/URL
                          </button>
                        </div>
                      </div>

                      {targetMode === 'component' && siblingComponents.length > 0 ? (
                        <select
                          className="form-input"
                          value={link.href || ''}
                          onChange={(e) => {
                            const compUuid = e.target.value.replace(/^#/, '');
                            const chosen = compMap.get(compUuid);
                            handleLinkChange(idx, {
                              href: e.target.value,
                              text: chosen?.title || ''
                            });
                          }}
                        >
                          <option value="" disabled>-- Select Target Component --</option>
                          {siblingComponents.map(c => (
                            <option key={c.uuid} value={`#${c.uuid}`}>
                              {c.title} ({c.type}) — #{c.uuid.substring(0, 8)}
                            </option>
                          ))}
                        </select>
                      ) : targetMode === 'resource' && resources.length > 0 ? (
                        <select
                          className="form-input"
                          value={link.href || ''}
                          onChange={(e) => {
                            const resUuid = e.target.value.replace(/^#/, '');
                            const chosen = resMap.get(resUuid);
                            handleLinkChange(idx, {
                              href: e.target.value,
                              text: chosen?.title || ''
                            });
                          }}
                        >
                          <option value="" disabled>-- Select Back-Matter Resource --</option>
                          {resources.map(r => (
                            <option key={r.uuid} value={`#${r.uuid}`}>
                              {r.title || 'Untitled Resource'} (#{r.uuid.substring(0, 8)})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <DebouncedInput
                          value={link.href || ''}
                          onChange={(val) => handleLinkChange(idx, { href: String(val) })}
                          placeholder="href (e.g. #component-uuid, #resource-uuid, or https://...)"
                          className="form-input"
                        />
                      )}
                    </div>

                    {/* Label / Description Text */}
                    <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #4b5563)' }}>
                        Label / Link Text
                      </label>
                      <DebouncedInput
                        value={link.text || ''}
                        onChange={(val) => handleLinkChange(idx, { text: String(val) })}
                        placeholder="Link label (optional)"
                        className="form-input"
                      />
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '16px' }}>
                      <button
                        type="button"
                        className={styles['switch-mode-btn']}
                        onClick={() => toggleAdvanced(idx)}
                        title="Toggle MIME media-type and resource-fragment"
                      >
                        ⚙️
                      </button>
                      <button
                        type="button"
                        className={['btn', 'btn-danger', sharedStyles['btn-sm']].filter(Boolean).join(' ')}
                        onClick={() => handleRemoveLink(idx)}
                        title="Remove link"
                      >
                        🗑
                      </button>
                    </div>
                  </div>

                  {/* Advanced Media Type and Resource Fragment */}
                  {showAdvancedIndex[idx] && (
                    <div
                      style={{
                        marginTop: '4px',
                        padding: '8px 12px',
                        background: 'var(--surface-color, #ffffff)',
                        border: '1px solid var(--border-color, #e5e7eb)',
                        borderRadius: '4px',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '10px'
                      }}
                    >
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #6b7280)', display: 'block', marginBottom: '2px' }}>
                          MIME Media Type
                        </label>
                        <DebouncedInput
                          value={link['media-type'] || ''}
                          onChange={(val) => handleLinkChange(idx, { 'media-type': String(val) })}
                          placeholder="e.g. application/pdf, text/html"
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #6b7280)', display: 'block', marginBottom: '2px' }}>
                          Resource Fragment
                        </label>
                        <DebouncedInput
                          value={link['resource-fragment'] || ''}
                          onChange={(val) => handleLinkChange(idx, { 'resource-fragment': String(val) })}
                          placeholder="e.g. section-3.2, clause-5"
                          className="form-input"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          <button
            type="button"
            className={['btn', sharedStyles['btn-primary'], sharedStyles['btn-sm']].filter(Boolean).join(' ')}
            onClick={handleAddLink}
            style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            + Add Link / Dependency
          </button>
        </div>
      )}
    </div>
  );
}

export default ComponentLinksEditor;
