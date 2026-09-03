import React, { useState, useMemo, useEffect } from 'react';
import { ResponsibleRole } from '@lib/types/oscal';
import { PropsEditor } from '@components/shared/PropsEditor';
import { LinksEditor } from '@components/shared/LinksEditor';
import styles from '../ComponentPage.module.css';
import sharedStyles from '@components/shared/SharedComponents.module.css';

export interface StandardRoleDef {
  id: string;
  label: string;
  category: 'operational' | 'production';
  description: string;
  icon: string;
}

export const OSCAL_STANDARD_ROLES: StandardRoleDef[] = [
  {
    id: 'asset-owner',
    label: 'Asset Owner',
    category: 'operational',
    description: 'Accountable for ensuring the asset is managed in accordance with organizational policies and procedures.',
    icon: '👑'
  },
  {
    id: 'asset-administrator',
    label: 'Asset Administrator',
    category: 'operational',
    description: 'Responsible for administering a set of assets.',
    icon: '🛠️'
  },
  {
    id: 'security-operations',
    label: 'Security Operations',
    category: 'operational',
    description: 'Members of the security operations center (SOC).',
    icon: '🛡️'
  },
  {
    id: 'network-operations',
    label: 'Network Operations',
    category: 'operational',
    description: 'Members of the network operations center (NOC).',
    icon: '🌐'
  },
  {
    id: 'incident-response',
    label: 'Incident Response',
    category: 'operational',
    description: "Responsible for responding to an event that could lead to loss of, or disruption to, an organization's operations, services or functions.",
    icon: '🚨'
  },
  {
    id: 'help-desk',
    label: 'Help Desk',
    category: 'operational',
    description: 'Responsible for providing information and support to users.',
    icon: '🎧'
  },
  {
    id: 'configuration-management',
    label: 'Configuration Management',
    category: 'operational',
    description: 'Responsible for the configuration management processes governing changes to the asset.',
    icon: '⚙️'
  },
  {
    id: 'maintainer',
    label: 'Maintainer',
    category: 'production',
    description: 'Responsible for the creation and maintenance of a component.',
    icon: '🔧'
  },
  {
    id: 'provider',
    label: 'Provider',
    category: 'production',
    description: 'Organization responsible for providing the component, if this is different from the maintainer (e.g., a reseller).',
    icon: '🏢'
  }
];

export interface ComponentRolesEditorProps {
  roles?: ResponsibleRole[];
  parties?: any[]; // From metadata.parties[]
  onChange: (roles: ResponsibleRole[]) => void;
  editMode?: boolean;
  isReadOnly?: boolean;
  compact?: boolean;
}

export function ComponentRolesEditor({
  roles = [],
  parties = [],
  onChange,
  editMode = false,
  isReadOnly = false,
  compact = false
}: ComponentRolesEditorProps) {
  const isEditing = editMode && !isReadOnly;
  const [expandedAdvanced, setExpandedAdvanced] = useState<Record<number, boolean>>({});
  const [customRoleInputs, setCustomRoleInputs] = useState<Record<number, string>>({});

  // Map of party uuid to friendly display name and details
  const partyMap = useMemo(() => {
    const map = new Map<string, { name: string; type: 'person' | 'organization'; email?: string }>();
    (parties || []).forEach((p: any) => {
      if (p.uuid) {
        map.set(p.uuid, {
          name: p.name || p['organization-name'] || p.title || 'Unnamed Party',
          type: p.type === 'organization' ? 'organization' : 'person',
          email: Array.isArray(p['email-addresses']) ? p['email-addresses'][0] : undefined
        });
      }
    });
    return map;
  }, [parties]);

  // Set of assigned role-ids for uniqueness check
  const assignedRoleIds = useMemo(() => {
    return new Set(roles.map(r => r['role-id']).filter(Boolean));
  }, [roles]);

  const rolesRef = React.useRef(roles);
  useEffect(() => {
    rolesRef.current = roles;
  }, [roles]);

  const handleRoleChange = (index: number, patch: Partial<ResponsibleRole>) => {
    if (!isEditing) return;
    const nextRoles = rolesRef.current.map((r, i) => {
      if (i === index) {
        const updated = { ...r, ...patch };
        // Purge empty remarks or party arrays
        if (updated.remarks === '') delete updated.remarks;
        if (updated['party-uuids'] && updated['party-uuids'].length === 0) delete updated['party-uuids'];
        if (updated.props && updated.props.length === 0) delete updated.props;
        if (updated.links && updated.links.length === 0) delete updated.links;
        return updated;
      }
      return r;
    });
    rolesRef.current = nextRoles;
    onChange(nextRoles);
  };

  const handleAddRole = () => {
    if (!isEditing) return;
    const currentRoles = rolesRef.current;
    const currentAssigned = new Set(currentRoles.map(r => r['role-id']).filter(Boolean));
    const firstUnassigned = OSCAL_STANDARD_ROLES.find(sr => !currentAssigned.has(sr.id));
    const initialRoleId = firstUnassigned ? firstUnassigned.id : `custom-role-${currentRoles.length + 1}`;
    
    const next = [
      ...currentRoles,
      {
        'role-id': initialRoleId,
        'party-uuids': []
      }
    ];
    rolesRef.current = next;
    onChange(next);
  };

  const handleRemoveRole = (index: number) => {
    if (!isEditing) return;
    const next = rolesRef.current.filter((_, i) => i !== index);
    rolesRef.current = next;
    onChange(next);
  };

  const handleToggleParty = (roleIndex: number, partyUuid: string) => {
    if (!isEditing) return;
    const currentRoles = [...rolesRef.current];
    if (!currentRoles[roleIndex]) return;
    const currentPartyUuids = currentRoles[roleIndex]?.['party-uuids'] || [];
    const exists = currentPartyUuids.includes(partyUuid);
    const nextPartyUuids = exists
      ? currentPartyUuids.filter(id => id !== partyUuid)
      : [...currentPartyUuids, partyUuid];

    handleRoleChange(roleIndex, { 'party-uuids': nextPartyUuids });
  };

  const toggleAdvanced = (index: number) => {
    setExpandedAdvanced(prev => ({ ...prev, [index]: !prev[index] }));
  };

  // Helper to find standard role def
  const getStandardRoleDef = (roleId: string) => {
    return OSCAL_STANDARD_ROLES.find(sr => sr.id === roleId);
  };

  return (
    <div className={styles['roles-editor-container']} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Read-Only Mode Presentation */}
      {!isEditing ? (
        roles.length === 0 ? (
          <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted, #6b7280)', fontSize: '13px', margin: '4px 0' }}>
            No responsible roles assigned to this component.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {roles.map((role, idx) => {
              const stdDef = getStandardRoleDef(role['role-id']);
              const partyUuids = role['party-uuids'] || [];
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '10px 14px',
                    background: 'var(--surface-alt, #f8f9fa)',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    borderRadius: '6px',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>{stdDef?.icon || '👤'}</span>
                      <strong style={{ fontSize: '14px', color: 'var(--color-text, #111827)' }}>
                        {stdDef ? stdDef.label : role['role-id']}
                      </strong>
                      <span
                        style={{
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          padding: '2px 6px',
                          background: 'var(--surface-color, #ffffff)',
                          border: '1px solid var(--border-color, #d1d5db)',
                          borderRadius: '4px',
                          color: 'var(--color-text-muted, #6b7280)'
                        }}
                      >
                        {role['role-id']}
                      </span>
                    </div>

                    {stdDef && (
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #6b7280)', fontStyle: 'italic' }}>
                        {stdDef.description}
                      </span>
                    )}
                  </div>

                  {/* Assigned Parties */}
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted, #4b5563)' }}>
                      Assigned Parties:
                    </span>
                    {partyUuids.length === 0 ? (
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #9ca3af)', fontStyle: 'italic' }}>
                        None specified
                      </span>
                    ) : (
                      partyUuids.map(uuid => {
                        const partyInfo = partyMap.get(uuid);
                        return (
                          <span
                            key={uuid}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              background: 'var(--surface-color, #ffffff)',
                              border: '1px solid var(--border-color, #d1d5db)',
                              borderRadius: '12px',
                              fontSize: '12px',
                              color: 'var(--color-text, #111827)'
                            }}
                          >
                            <span>{partyInfo?.type === 'organization' ? '🏢' : '👤'}</span>
                            <span>{partyInfo ? partyInfo.name : `UUID: ${uuid.substring(0, 8)}...`}</span>
                          </span>
                        );
                      })
                    )}
                  </div>

                  {role.remarks && (
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted, #6b7280)', marginTop: '4px' }}>
                      <strong>Remarks:</strong> {role.remarks}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Edit Mode Presentation */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {roles.length === 0 ? (
            <div
              style={{
                padding: '16px',
                textAlign: 'center',
                background: 'var(--surface-alt, #f8f9fa)',
                border: '1px dashed var(--border-color, #d1d5db)',
                borderRadius: '6px',
                color: 'var(--color-text-muted, #6b7280)',
                fontSize: '13px'
              }}
            >
              No responsible roles assigned yet. Click below to add operational or production responsibilities.
            </div>
          ) : (
            roles.map((role, idx) => {
              const currentRoleId = role['role-id'] || '';
              const stdDef = getStandardRoleDef(currentRoleId);
              const isCustom = !stdDef && currentRoleId !== '';
              const partyUuids = role['party-uuids'] || [];
              const isDuplicate = roles.filter((r, i) => i !== idx && r['role-id'] === currentRoleId).length > 0;

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '14px',
                    background: 'var(--surface-alt, #fafafa)',
                    border: isDuplicate ? '1px solid var(--color-danger, #ef4444)' : '1px solid var(--border-color, #e0e0e0)',
                    borderRadius: '6px',
                    gap: '10px'
                  }}
                >
                  {/* Role Header & Selection Row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text, #111827)' }}>
                        Role Type <span style={{ color: 'var(--color-danger, #ef4444)' }}>*</span>
                      </label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select
                          className="form-input"
                          value={isCustom ? '__custom__' : currentRoleId}
                          onChange={(e) => {
                            if (e.target.value === '__custom__') {
                              const customVal = customRoleInputs[idx] || 'custom-role';
                              handleRoleChange(idx, { 'role-id': customVal });
                            } else {
                              handleRoleChange(idx, { 'role-id': e.target.value });
                            }
                          }}
                          style={{ flex: 1, minWidth: '220px' }}
                        >
                          <optgroup label="Operational Roles">
                            {OSCAL_STANDARD_ROLES.filter(r => r.category === 'operational').map(r => (
                              <option key={r.id} value={r.id}>
                                {r.icon} {r.label} ({r.id})
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Production / Supply Roles">
                            {OSCAL_STANDARD_ROLES.filter(r => r.category === 'production').map(r => (
                              <option key={r.id} value={r.id}>
                                {r.icon} {r.label} ({r.id})
                              </option>
                            ))}
                          </optgroup>
                          <option value="__custom__">✏️ Custom Role (Other...)</option>
                        </select>

                        {isCustom && (
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Enter custom role ID (e.g. cloud-custodian)"
                            value={currentRoleId}
                            onChange={(e) => {
                              const cleanVal = e.target.value.toLowerCase().replace(/[^a-z0-9_\-]/g, '-');
                              setCustomRoleInputs(prev => ({ ...prev, [idx]: cleanVal }));
                              handleRoleChange(idx, { 'role-id': cleanVal });
                            }}
                            style={{ flex: 1 }}
                          />
                        )}
                      </div>

                      {stdDef && (
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #6b7280)', lineHeight: '1.4' }}>
                          💡 <em>{stdDef.description}</em>
                        </div>
                      )}

                      {isDuplicate && (
                        <div style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', fontWeight: 600 }}>
                          ⚠️ Duplicate role ID: "{currentRoleId}" is already assigned to this component. Each role must be unique per OSCAL schema.
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        className={styles['switch-mode-btn']}
                        onClick={() => toggleAdvanced(idx)}
                        title="Toggle remarks, props, and links"
                      >
                        {expandedAdvanced[idx] ? '▲ Less' : '▼ More'}
                      </button>
                      <button
                        type="button"
                        className={['btn', 'btn-danger', sharedStyles['btn-sm']].filter(Boolean).join(' ')}
                        onClick={() => handleRemoveRole(idx)}
                        title="Remove this role assignment"
                      >
                        🗑 Remove
                      </button>
                    </div>
                  </div>

                  {/* Party Picker Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '8px', borderTop: '1px dashed var(--border-color, #e5e7eb)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted, #4b5563)' }}>
                        Assigned Parties ({parties.length} available in document metadata):
                      </label>
                      {parties.length === 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--color-warning, #d97706)' }}>
                          ℹ️ No parties defined in metadata. Define parties in the Metadata tab.
                        </span>
                      )}
                    </div>

                    {parties.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {parties.map((p: any) => {
                          const isSelected = partyUuids.includes(p.uuid);
                          const pTypeIcon = p.type === 'organization' ? '🏢' : '👤';
                          const pName = p.name || p['organization-name'] || p.title || 'Unnamed Party';
                          const pEmail = Array.isArray(p['email-addresses']) ? p['email-addresses'][0] : '';

                          return (
                            <button
                              key={p.uuid}
                              type="button"
                              onClick={() => handleToggleParty(idx, p.uuid)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 10px',
                                borderRadius: '16px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                background: isSelected ? 'var(--color-accent, #3b82f6)' : 'var(--surface-color, #ffffff)',
                                color: isSelected ? '#ffffff' : 'var(--color-text, #111827)',
                                border: isSelected ? '1px solid var(--color-accent, #3b82f6)' : '1px solid var(--border-color, #d1d5db)',
                                fontWeight: isSelected ? 600 : 400
                              }}
                              title={`${pName} ${pEmail ? `(${pEmail})` : ''} — Click to ${isSelected ? 'unassign' : 'assign'}`}
                            >
                              <span>{pTypeIcon}</span>
                              <span>{pName}</span>
                              {isSelected && <span>✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Manual Party UUIDs (comma-separated)"
                          value={partyUuids.join(', ')}
                          onChange={(e) => {
                            const uuids = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                            handleRoleChange(idx, { 'party-uuids': uuids });
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Advanced Collapsible Section (Remarks, Props, Links) */}
                  {expandedAdvanced[idx] && (
                    <div
                      style={{
                        marginTop: '6px',
                        padding: '10px 12px',
                        background: 'var(--surface-color, #ffffff)',
                        border: '1px solid var(--border-color, #e5e7eb)',
                        borderRadius: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #6b7280)', display: 'block', marginBottom: '4px' }}>
                          Remarks / Implementation Notes
                        </label>
                        <textarea
                          className="form-textarea"
                          rows={2}
                          placeholder="Optional remarks regarding this role assignment..."
                          value={role.remarks || ''}
                          onChange={(e) => handleRoleChange(idx, { remarks: e.target.value })}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #6b7280)', display: 'block', marginBottom: '4px' }}>
                          Role Properties
                        </label>
                        <PropsEditor
                          props={role.props || []}
                          onChange={(newProps) => handleRoleChange(idx, { props: newProps })}
                          readOnly={false}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #6b7280)', display: 'block', marginBottom: '4px' }}>
                          Role Links
                        </label>
                        <LinksEditor
                          links={role.links || []}
                          onChange={(newLinks) => handleRoleChange(idx, { links: newLinks })}
                          readOnly={false}
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
            onClick={handleAddRole}
            style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            + Add Responsible Role
          </button>
        </div>
      )}
    </div>
  );
}

export default ComponentRolesEditor;
