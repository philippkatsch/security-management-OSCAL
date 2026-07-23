import React, { useState } from 'react';
import { DebouncedInput } from './DebouncedInput';
import { generateUUID, isValidIsoDateTime } from '../../lib/oscal-utils';
import { PropsEditor } from './PropsEditor';
import { LinksEditor } from './LinksEditor';

/**
 * Metadata Editor for title, version, parties, locations, roles, responsible-parties, revisions, props, and links.
 */
export function MetadataEditor({
  metadata = {},
  onChange,
  readOnly = false
}) {
  const [expandedSections, setExpandedSections] = useState({
    general: true,
    documentIds: false,
    roles: false,
    parties: false,
    locations: false,
    responsibleParties: false,
    revisions: false,
    props: false,
    links: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleFieldChange = (field, val) => {
    const updated = { ...metadata };
    if (val === '' || val === null || val === undefined) {
      if (field !== 'title' && field !== 'version') {
        delete updated[field];
      } else {
        updated[field] = val;
      }
    } else {
      updated[field] = val;
    }
    onChange(updated);
  };

  // --- Document IDs CRUD ---
  const handleAddDocId = () => {
    const docIds = metadata['document-ids'] ? [...metadata['document-ids']] : [];
    handleFieldChange('document-ids', [...docIds, { scheme: '', identifier: '' }]);
  };

  const handleDocIdChange = (idx, field, val) => {
    const docIds = metadata['document-ids'].map((item, i) => i === idx ? { ...item, [field]: val } : item);
    handleFieldChange('document-ids', docIds);
  };

  const handleRemoveDocId = (idx) => {
    handleFieldChange('document-ids', metadata['document-ids'].filter((_, i) => i !== idx));
  };

  // --- Roles CRUD ---
  const handleAddRole = () => {
    const roles = metadata.roles ? [...metadata.roles] : [];
    handleFieldChange('roles', [...roles, { id: `role_${Date.now().toString().slice(-4)}`, title: 'New Role' }]);
  };

  const handleRoleChange = (idx, field, val) => {
    const roles = metadata.roles.map((item, i) => i === idx ? { ...item, [field]: val } : item);
    handleFieldChange('roles', roles);
  };

  const handleRemoveRole = (idx) => {
    handleFieldChange('roles', metadata.roles.filter((_, i) => i !== idx));
  };

  // --- Parties CRUD ---
  const handleAddParty = () => {
    const parties = metadata.parties ? [...metadata.parties] : [];
    handleFieldChange('parties', [...parties, {
      uuid: generateUUID(),
      type: 'person',
      name: 'New Person'
    }]);
  };

  const handlePartyChange = (idx, field, val) => {
    const parties = metadata.parties.map((item, i) => {
      if (i === idx) {
        if (field === 'email-addresses' || field === 'telephone-numbers' || field === 'member-of-organizations') {
          // values input is comma separated
          const arr = val.split(',').map(s => s.trim()).filter(s => s.length > 0);
          return { ...item, [field]: arr };
        }
        if (field === 'address-city') {
          const addr = item.addresses?.[0] || {};
          return { ...item, addresses: [{ ...addr, city: val }] };
        }
        if (field === 'address-state') {
          const addr = item.addresses?.[0] || {};
          return { ...item, addresses: [{ ...addr, state: val }] };
        }
        if (field === 'address-postal-code') {
          const addr = item.addresses?.[0] || {};
          return { ...item, addresses: [{ ...addr, 'postal-code': val }] };
        }
        if (field === 'address-country') {
          const addr = item.addresses?.[0] || {};
          return { ...item, addresses: [{ ...addr, country: val }] };
        }
        if (field === 'address-lines') {
          const addr = item.addresses?.[0] || {};
          const arr = val.split(',').map(s => s.trim()).filter(s => s.length > 0);
          return { ...item, addresses: [{ ...addr, 'addr-lines': arr }] };
        }
        if (field === 'external-id-scheme') {
          const extId = item['external-ids']?.[0] || {};
          return { ...item, 'external-ids': [{ ...extId, scheme: val }] };
        }
        if (field === 'external-id-value') {
          const extId = item['external-ids']?.[0] || {};
          return { ...item, 'external-ids': [{ ...extId, id: val }] };
        }
        if (field === 'location-uuid') {
          return { ...item, 'location-uuids': val ? [val] : [] };
        }
        return { ...item, [field]: val };
      }
      return item;
    });
    handleFieldChange('parties', parties);
  };

  const handleRemoveParty = (idx) => {
    handleFieldChange('parties', metadata.parties.filter((_, i) => i !== idx));
  };

  // --- Locations CRUD ---
  const handleAddLocation = () => {
    const locations = metadata.locations ? [...metadata.locations] : [];
    handleFieldChange('locations', [...locations, {
      uuid: generateUUID(),
      title: 'New Location'
    }]);
  };

  const handleLocationChange = (idx, field, val) => {
    const locations = metadata.locations.map((item, i) => {
      if (i === idx) {
        if (field === 'email-addresses' || field === 'telephone-numbers' || field === 'urls') {
          const arr = val.split(',').map(s => s.trim()).filter(s => s.length > 0);
          return { ...item, [field]: arr };
        }
        if (field === 'address-city') {
          const addr = item.address || {};
          return { ...item, address: { ...addr, city: val } };
        }
        if (field === 'address-state') {
          const addr = item.address || {};
          return { ...item, address: { ...addr, state: val } };
        }
        if (field === 'address-postal-code') {
          const addr = item.address || {};
          return { ...item, address: { ...addr, 'postal-code': val } };
        }
        if (field === 'address-country') {
          const addr = item.address || {};
          return { ...item, address: { ...addr, country: val } };
        }
        if (field === 'address-lines') {
          const addr = item.address || {};
          const arr = val.split(',').map(s => s.trim()).filter(s => s.length > 0);
          return { ...item, address: { ...addr, 'addr-lines': arr } };
        }
        return { ...item, [field]: val };
      }
      return item;
    });
    handleFieldChange('locations', locations);
  };

  const handleRemoveLocation = (idx) => {
    handleFieldChange('locations', metadata.locations.filter((_, i) => i !== idx));
  };

  // --- Responsible Parties CRUD ---
  const handleAddResponsibleParty = () => {
    const respParties = metadata['responsible-parties'] ? [...metadata['responsible-parties']] : [];
    const defaultRoleId = metadata.roles?.[0]?.id || 'contact';
    handleFieldChange('responsible-parties', [...respParties, { 'role-id': defaultRoleId, 'party-uuids': [] }]);
  };

  const handleResponsiblePartyChange = (idx, field, val) => {
    const respParties = (metadata['responsible-parties'] || []).map((item, i) => {
      if (i === idx) {
        return { ...item, [field]: val };
      }
      return item;
    });
    handleFieldChange('responsible-parties', respParties);
  };

  const handleRemoveResponsibleParty = (idx) => {
    handleFieldChange('responsible-parties', (metadata['responsible-parties'] || []).filter((_, i) => i !== idx));
  };

  const handleTogglePartyForRole = (idx, partyUuid) => {
    const respParties = [...(metadata['responsible-parties'] || [])];
    const target = respParties[idx];
    const currentUuids = target['party-uuids'] || [];
    const exists = currentUuids.includes(partyUuid);
    const updatedUuids = exists ? currentUuids.filter(u => u !== partyUuid) : [...currentUuids, partyUuid];
    respParties[idx] = { ...target, 'party-uuids': updatedUuids };
    handleFieldChange('responsible-parties', respParties);
  };

  // --- Revisions CRUD ---
  const handleAddRevision = () => {
    const revisions = metadata.revisions ? [...metadata.revisions] : [];
    handleFieldChange('revisions', [...revisions, {
      title: 'Revision',
      version: metadata.version || '1.0.0',
      published: new Date().toISOString(),
      'oscal-version': metadata['oscal-version'] || '1.1.2'
    }]);
  };

  const handleRevisionChange = (idx, field, val) => {
    const revisions = (metadata.revisions || []).map((item, i) => i === idx ? { ...item, [field]: val } : item);
    handleFieldChange('revisions', revisions);
  };

  const handleRemoveRevision = (idx) => {
    handleFieldChange('revisions', (metadata.revisions || []).filter((_, i) => i !== idx));
  };

  return (
    <div className="metadata-editor" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      
      {/* 1. General Info */}
      <div className="metadata-section" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-primary)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div
          onClick={() => toggleSection('general')}
          style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '800', fontSize: '14px', color: 'var(--color-text)', borderBottom: expandedSections.general ? '1px solid var(--color-border)' : 'none' }}
        >
          <span>General Metadata</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{expandedSections.general ? '▼' : '▶'}</span>
        </div>
        {expandedSections.general && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Document Title</label>
              <DebouncedInput
                value={metadata.title || ''}
                onChange={(val) => handleFieldChange('title', val)}
                className="form-input"
                style={{ width: '100%', height: '32px' }}
                disabled={readOnly}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Version</label>
                <DebouncedInput
                  value={metadata.version || ''}
                  onChange={(val) => handleFieldChange('version', val)}
                  className="form-input"
                  style={{ width: '100%', height: '32px' }}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>OSCAL Version</label>
                <DebouncedInput
                  value={metadata['oscal-version'] || '1.1.2'}
                  onChange={(val) => handleFieldChange('oscal-version', val)}
                  className="form-input"
                  style={{ width: '100%', height: '32px' }}
                  disabled={readOnly}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Published Date</label>
                {(() => {
                  const isPubValid = isValidIsoDateTime(metadata.published);
                  return (
                    <>
                      <DebouncedInput
                        value={metadata.published || ''}
                        onChange={(val) => handleFieldChange('published', val)}
                        placeholder="YYYY-MM-DDTHH:MM:SSZ"
                        className="form-input"
                        style={{
                          width: '100%',
                          height: '32px',
                          border: !isPubValid ? '1px solid var(--color-danger, #ef4444)' : '1px solid var(--color-border)',
                          boxShadow: !isPubValid ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : 'none'
                        }}
                        disabled={readOnly}
                      />
                      {!isPubValid && (
                        <div style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>⚠️ Must be ISO 8601 format (e.g. 2026-07-22T18:00:00Z)</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Last Modified</label>
                <input
                  type="text"
                  value={metadata['last-modified'] || ''}
                  className="form-input"
                  style={{ width: '100%', height: '32px' }}
                  disabled={true}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Remarks</label>
              <DebouncedInput
                value={metadata.remarks || ''}
                onChange={(val) => handleFieldChange('remarks', val)}
                className="form-input"
                style={{ width: '100%', height: '32px' }}
                disabled={readOnly}
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Document IDs */}
      <div className="metadata-section" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-accent)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div
          onClick={() => toggleSection('documentIds')}
          style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '800', fontSize: '14px', color: 'var(--color-text)', borderBottom: expandedSections.documentIds ? '1px solid var(--color-border)' : 'none' }}
        >
          <span>Document Identifiers ({metadata['document-ids']?.length || 0})</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{expandedSections.documentIds ? '▼' : '▶'}</span>
        </div>
        {expandedSections.documentIds && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(!metadata['document-ids'] || metadata['document-ids'].length === 0) ? (
              <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>No document IDs defined.</p>
            ) : (
              metadata['document-ids'].map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <DebouncedInput
                    value={item.scheme || ''}
                    onChange={(val) => handleDocIdChange(idx, 'scheme', val)}
                    placeholder="Scheme (e.g. doi)"
                    className="form-input"
                    style={{ flex: 1, height: '30px' }}
                    disabled={readOnly}
                  />
                  <DebouncedInput
                    value={item.identifier || ''}
                    onChange={(val) => handleDocIdChange(idx, 'identifier', val)}
                    placeholder="Identifier"
                    className="form-input"
                    style={{ flex: 2, height: '30px' }}
                    disabled={readOnly}
                  />
                  {!readOnly && (
                    <button type="button" className="btn-delete" onClick={() => handleRemoveDocId(idx)} style={{ padding: '4px 8px' }}>🗑</button>
                  )}
                </div>
              ))
            )}
            {!readOnly && (
              <button type="button" className="btn-secondary btn-sm" onClick={handleAddDocId} style={{ marginTop: '4px' }}>➕ Add ID</button>
            )}
          </div>
        )}
      </div>

      {/* 3. Roles */}
      <div className="metadata-section" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-primary)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div
          onClick={() => toggleSection('roles')}
          style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '800', fontSize: '14px', color: 'var(--color-text)', borderBottom: expandedSections.roles ? '1px solid var(--color-border)' : 'none' }}
        >
          <span>Roles ({metadata.roles?.length || 0})</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{expandedSections.roles ? '▼' : '▶'}</span>
        </div>
        {expandedSections.roles && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(!metadata.roles || metadata.roles.length === 0) ? (
              <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>No roles defined.</p>
            ) : (
              metadata.roles.map((item, idx) => (
                <div key={idx} style={{ padding: '10px', background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                    <DebouncedInput
                      value={item.id}
                      onChange={(val) => handleRoleChange(idx, 'id', val)}
                      placeholder="Role ID"
                      className="form-input"
                      style={{ flex: 1, height: '28px', fontSize: '12px' }}
                      disabled={readOnly}
                    />
                    <DebouncedInput
                      value={item.title}
                      onChange={(val) => handleRoleChange(idx, 'title', val)}
                      placeholder="Role Title"
                      className="form-input"
                      style={{ flex: 2, height: '28px', fontSize: '12px' }}
                      disabled={readOnly}
                    />
                    {!readOnly && (
                      <button type="button" className="btn-delete" onClick={() => handleRemoveRole(idx)} style={{ padding: '2px 6px' }}>🗑</button>
                    )}
                  </div>
                  <DebouncedInput
                    value={item.description || ''}
                    onChange={(val) => handleRoleChange(idx, 'description', val)}
                    placeholder="Role Description"
                    className="form-input"
                    style={{ width: '100%', height: '28px', fontSize: '12px' }}
                    disabled={readOnly}
                  />
                  <DebouncedInput
                    value={item.remarks || ''}
                    onChange={(val) => handleRoleChange(idx, 'remarks', val || undefined)}
                    placeholder="Role remarks / notes..."
                    className="form-input"
                    style={{ width: '100%', height: '26px', fontSize: '11px', marginTop: '4px' }}
                    disabled={readOnly}
                  />
                  <div style={{ borderTop: '1px dashed var(--color-border-subtle)', paddingTop: '6px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <PropsEditor
                      props={item.props || []}
                      onChange={(props) => handleRoleChange(idx, 'props', props.length > 0 ? props : undefined)}
                      readOnly={readOnly}
                    />
                    <LinksEditor
                      links={item.links || []}
                      onChange={(links) => handleRoleChange(idx, 'links', links.length > 0 ? links : undefined)}
                      readOnly={readOnly}
                    />
                  </div>
                </div>
              ))
            )}
            {!readOnly && (
              <button type="button" className="btn-secondary btn-sm" onClick={handleAddRole}>➕ Add Role</button>
            )}
          </div>
        )}
      </div>

      {/* 4. Parties */}
      <div className="metadata-section" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-accent)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div
          onClick={() => toggleSection('parties')}
          style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '800', fontSize: '14px', color: 'var(--color-text)', borderBottom: expandedSections.parties ? '1px solid var(--color-border)' : 'none' }}
        >
          <span>Parties ({metadata.parties?.length || 0})</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{expandedSections.parties ? '▼' : '▶'}</span>
        </div>
        {expandedSections.parties && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(!metadata.parties || metadata.parties.length === 0) ? (
              <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>No parties defined.</p>
            ) : (
              metadata.parties.map((item, idx) => (
                <div key={idx} style={{ padding: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                      value={item.type}
                      onChange={(e) => handlePartyChange(idx, 'type', e.target.value)}
                      className="form-input"
                      style={{ height: '28px', fontSize: '12px', width: '100px' }}
                      disabled={readOnly}
                    >
                      <option value="person">Person</option>
                      <option value="organization">Organization</option>
                    </select>
                    <DebouncedInput
                      value={item.name}
                      onChange={(val) => handlePartyChange(idx, 'name', val)}
                      placeholder="Name"
                      className="form-input"
                      style={{ flex: 1, height: '28px', fontSize: '12px' }}
                      disabled={readOnly}
                    />
                    {!readOnly && (
                      <button type="button" className="btn-delete" onClick={() => handleRemoveParty(idx)} style={{ padding: '2px 6px' }}>🗑</button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Short Name</label>
                      <DebouncedInput
                        value={item['short-name'] || ''}
                        onChange={(val) => handlePartyChange(idx, 'short-name', val)}
                        className="form-input"
                        style={{ width: '100%', height: '26px', fontSize: '11px' }}
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Emails (comma-separated)</label>
                      <DebouncedInput
                        value={item['email-addresses'] ? item['email-addresses'].join(', ') : ''}
                        onChange={(val) => handlePartyChange(idx, 'email-addresses', val)}
                        placeholder="test@example.com"
                        className="form-input"
                        style={{ width: '100%', height: '26px', fontSize: '11px' }}
                        disabled={readOnly}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Phone Numbers</label>
                      <DebouncedInput
                        value={item['telephone-numbers'] ? item['telephone-numbers'].join(', ') : ''}
                        onChange={(val) => handlePartyChange(idx, 'telephone-numbers', val)}
                        placeholder="+49..."
                        className="form-input"
                        style={{ width: '100%', height: '26px', fontSize: '11px' }}
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Member of (Org UUID)</label>
                      <DebouncedInput
                        value={item['member-of-organizations'] ? item['member-of-organizations'].join(', ') : ''}
                        onChange={(val) => handlePartyChange(idx, 'member-of-organizations', val)}
                        className="form-input"
                        style={{ width: '100%', height: '26px', fontSize: '11px' }}
                        disabled={readOnly}
                      />
                    </div>
                  </div>

                  {/* Address Section */}
                  <div style={{ borderTop: '1px dashed var(--color-border-subtle)', paddingTop: '6px', marginTop: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Address</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                      <div>
                        <DebouncedInput
                          value={item.addresses?.[0]?.['addr-lines']?.join(', ') || ''}
                          onChange={(val) => handlePartyChange(idx, 'address-lines', val)}
                          placeholder="Street, No"
                          className="form-input"
                          style={{ width: '100%', height: '24px', fontSize: '10px' }}
                          disabled={readOnly}
                        />
                      </div>
                      <div>
                        <DebouncedInput
                          value={item.addresses?.[0]?.city || ''}
                          onChange={(val) => handlePartyChange(idx, 'address-city', val)}
                          placeholder="City"
                          className="form-input"
                          style={{ width: '100%', height: '24px', fontSize: '10px' }}
                          disabled={readOnly}
                        />
                      </div>
                      <div>
                        <DebouncedInput
                          value={item.addresses?.[0]?.['postal-code'] || ''}
                          onChange={(val) => handlePartyChange(idx, 'address-postal-code', val)}
                          placeholder="Zip"
                          className="form-input"
                          style={{ width: '100%', height: '24px', fontSize: '10px' }}
                          disabled={readOnly}
                        />
                      </div>
                      <div>
                        <DebouncedInput
                          value={item.addresses?.[0]?.country || ''}
                          onChange={(val) => handlePartyChange(idx, 'address-country', val)}
                          placeholder="Country"
                          className="form-input"
                          style={{ width: '100%', height: '24px', fontSize: '10px' }}
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  </div>

                  {/* External ID and Location Link */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>External ID Scheme / ID</label>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <DebouncedInput
                          value={item['external-ids']?.[0]?.scheme || ''}
                          onChange={(val) => handlePartyChange(idx, 'external-id-scheme', val)}
                          placeholder="Scheme"
                          className="form-input"
                          style={{ flex: 1, height: '24px', fontSize: '10px' }}
                          disabled={readOnly}
                        />
                        <DebouncedInput
                          value={item['external-ids']?.[0]?.id || ''}
                          onChange={(val) => handlePartyChange(idx, 'external-id-value', val)}
                          placeholder="ID"
                          className="form-input"
                          style={{ flex: 1, height: '24px', fontSize: '10px' }}
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Location Link</label>
                      <select
                        value={item['location-uuids']?.[0] || ''}
                        onChange={(e) => handlePartyChange(idx, 'location-uuid', e.target.value)}
                        className="form-input"
                        style={{ width: '100%', height: '24px', fontSize: '10px', padding: '0 4px' }}
                        disabled={readOnly}
                      >
                        <option value="">-- Select Location --</option>
                        {metadata.locations?.map(loc => (
                          <option key={loc.uuid} value={loc.uuid}>{loc.title || loc.uuid.slice(0, 8)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <DebouncedInput
                    value={item.remarks || ''}
                    onChange={(val) => handlePartyChange(idx, 'remarks', val || undefined)}
                    placeholder="Party remarks / notes..."
                    className="form-input"
                    style={{ width: '100%', height: '24px', fontSize: '10px' }}
                    disabled={readOnly}
                  />
                  <div style={{ borderTop: '1px dashed var(--color-border-subtle)', paddingTop: '6px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <PropsEditor
                      props={item.props || []}
                      onChange={(props) => handlePartyChange(idx, 'props', props.length > 0 ? props : undefined)}
                      readOnly={readOnly}
                    />
                    <LinksEditor
                      links={item.links || []}
                      onChange={(links) => handlePartyChange(idx, 'links', links.length > 0 ? links : undefined)}
                      readOnly={readOnly}
                    />
                  </div>
                </div>
              ))
            )}
            {!readOnly && (
              <button type="button" className="btn-secondary btn-sm" onClick={handleAddParty}>➕ Add Party</button>
            )}
          </div>
        )}
      </div>

      {/* 5. Locations */}
      <div className="metadata-section" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-primary)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div
          onClick={() => toggleSection('locations')}
          style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '800', fontSize: '14px', color: 'var(--color-text)', borderBottom: expandedSections.locations ? '1px solid var(--color-border)' : 'none' }}
        >
          <span>Locations ({metadata.locations?.length || 0})</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{expandedSections.locations ? '▼' : '▶'}</span>
        </div>
        {expandedSections.locations && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(!metadata.locations || metadata.locations.length === 0) ? (
              <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>No locations defined.</p>
            ) : (
              metadata.locations.map((item, idx) => (
                <div key={idx} style={{ padding: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <DebouncedInput
                      value={item.title}
                      onChange={(val) => handleLocationChange(idx, 'title', val)}
                      placeholder="Location Title"
                      className="form-input"
                      style={{ flex: 1, height: '28px', fontSize: '12px' }}
                      disabled={readOnly}
                    />
                    {!readOnly && (
                      <button type="button" className="btn-delete" onClick={() => handleRemoveLocation(idx)} style={{ padding: '2px 6px' }}>🗑</button>
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>URLs (comma-separated)</label>
                    <DebouncedInput
                      value={item.urls ? item.urls.join(', ') : ''}
                      onChange={(val) => handleLocationChange(idx, 'urls', val)}
                      placeholder="http://..."
                      className="form-input"
                      style={{ width: '100%', height: '26px', fontSize: '11px' }}
                      disabled={readOnly}
                    />
                  </div>

                  {/* Address Section */}
                  <div style={{ borderTop: '1px dashed var(--color-border-subtle)', paddingTop: '6px', marginTop: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Address</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '6px' }}>
                      <div>
                        <DebouncedInput
                          value={item.address?.['addr-lines']?.join(', ') || ''}
                          onChange={(val) => handleLocationChange(idx, 'address-lines', val)}
                          placeholder="Street, No"
                          className="form-input"
                          style={{ width: '100%', height: '24px', fontSize: '10px' }}
                          disabled={readOnly}
                        />
                      </div>
                      <div>
                        <DebouncedInput
                          value={item.address?.city || ''}
                          onChange={(val) => handleLocationChange(idx, 'address-city', val)}
                          placeholder="City"
                          className="form-input"
                          style={{ width: '100%', height: '24px', fontSize: '10px' }}
                          disabled={readOnly}
                        />
                      </div>
                      <div>
                        <DebouncedInput
                          value={item.address?.['postal-code'] || ''}
                          onChange={(val) => handleLocationChange(idx, 'address-postal-code', val)}
                          placeholder="Zip"
                          className="form-input"
                          style={{ width: '100%', height: '24px', fontSize: '10px' }}
                          disabled={readOnly}
                        />
                      </div>
                      <div>
                        <DebouncedInput
                          value={item.address?.country || ''}
                          onChange={(val) => handleLocationChange(idx, 'address-country', val)}
                          placeholder="Country"
                          className="form-input"
                          style={{ width: '100%', height: '24px', fontSize: '10px' }}
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  </div>

                  <DebouncedInput
                    value={item.remarks || ''}
                    onChange={(val) => handleLocationChange(idx, 'remarks', val || undefined)}
                    placeholder="Location remarks / notes..."
                    className="form-input"
                    style={{ width: '100%', height: '24px', fontSize: '10px' }}
                    disabled={readOnly}
                  />
                  <div style={{ borderTop: '1px dashed var(--color-border-subtle)', paddingTop: '6px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <PropsEditor
                      props={item.props || []}
                      onChange={(props) => handleLocationChange(idx, 'props', props.length > 0 ? props : undefined)}
                      readOnly={readOnly}
                    />
                    <LinksEditor
                      links={item.links || []}
                      onChange={(links) => handleLocationChange(idx, 'links', links.length > 0 ? links : undefined)}
                      readOnly={readOnly}
                    />
                  </div>

                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Assigned Parties:</label>
                    {(!metadata.parties || metadata.parties.length === 0) ? (
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Please define parties in the Parties section first.</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', background: 'var(--color-surface-2)', padding: '6px', borderRadius: '4px', border: '1px solid var(--color-border-subtle)' }}>
                        {metadata.parties.map(party => {
                          const isAssigned = (item['party-uuids'] || []).includes(party.uuid);
                          return (
                            <label key={party.uuid} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer', background: isAssigned ? 'var(--color-primary-light, rgba(99, 102, 241, 0.15))' : 'transparent', color: isAssigned ? 'var(--color-primary)' : 'inherit', border: isAssigned ? '1px solid var(--color-primary)' : '1px solid transparent', padding: '2px 6px', borderRadius: '4px' }}>
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                disabled={readOnly}
                                onChange={() => handleTogglePartyForRole(idx, party.uuid)}
                              />
                              <span>{party.name || party.uuid.slice(0, 8)} ({party.type})</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                </div>
              ))
            )}
            {!readOnly && (
              <button type="button" className="btn-secondary btn-sm" onClick={handleAddResponsibleParty}>➕ Add Responsible Party</button>
            )}
          </div>
        )}
      </div>

      {/* 7. Revision History */}
      <div className="metadata-section" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-primary)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div
          onClick={() => toggleSection('revisions')}
          style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '800', fontSize: '14px', color: 'var(--color-text)', borderBottom: expandedSections.revisions ? '1px solid var(--color-border)' : 'none' }}
        >
          <span>Revision History ({metadata.revisions?.length || 0})</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{expandedSections.revisions ? '▼' : '▶'}</span>
        </div>
        {expandedSections.revisions && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(!metadata.revisions || metadata.revisions.length === 0) ? (
              <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>No formal revision entries defined.</p>
            ) : (
              metadata.revisions.map((rev, idx) => (
                <div key={idx} style={{ padding: '10px', background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <DebouncedInput
                      value={rev.title || ''}
                      onChange={(val) => handleRevisionChange(idx, 'title', val)}
                      placeholder="Revision Title"
                      className="form-input"
                      style={{ flex: 2, height: '28px', fontSize: '12px' }}
                      disabled={readOnly}
                    />
                    <DebouncedInput
                      value={rev.version || ''}
                      onChange={(val) => handleRevisionChange(idx, 'version', val)}
                      placeholder="Version"
                      className="form-input"
                      style={{ flex: 1, height: '28px', fontSize: '12px' }}
                      disabled={readOnly}
                    />
                    {!readOnly && (
                      <button type="button" className="btn-delete" onClick={() => handleRemoveRevision(idx)} style={{ padding: '2px 6px' }}>🗑</button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Published Date</label>
                      <DebouncedInput
                        value={rev.published || ''}
                        onChange={(val) => handleRevisionChange(idx, 'published', val)}
                        placeholder="ISO Date"
                        className="form-input"
                        style={{ width: '100%', height: '26px', fontSize: '11px' }}
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>OSCAL Version</label>
                      <DebouncedInput
                        value={rev['oscal-version'] || ''}
                        onChange={(val) => handleRevisionChange(idx, 'oscal-version', val)}
                        placeholder="1.1.2"
                        className="form-input"
                        style={{ width: '100%', height: '26px', fontSize: '11px' }}
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                  <DebouncedInput
                    value={rev.remarks || ''}
                    onChange={(val) => handleRevisionChange(idx, 'remarks', val)}
                    placeholder="Revision remarks / change notes..."
                    className="form-input"
                    style={{ width: '100%', height: '26px', fontSize: '11px' }}
                    disabled={readOnly}
                  />
                </div>
              ))
            )}
            {!readOnly && (
              <button type="button" className="btn-secondary btn-sm" onClick={handleAddRevision}>➕ Add Revision Entry</button>
            )}
          </div>
        )}
      </div>

      {/* 8. Global Properties */}
      <div className="metadata-section" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-accent)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div
          onClick={() => toggleSection('props')}
          style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '800', fontSize: '14px', color: 'var(--color-text)', borderBottom: expandedSections.props ? '1px solid var(--color-border)' : 'none' }}
        >
          <span>Global Document Properties ({metadata.props?.length || 0})</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{expandedSections.props ? '▼' : '▶'}</span>
        </div>
        {expandedSections.props && (
          <div style={{ padding: '20px' }}>
            <PropsEditor
              props={metadata.props || []}
              onChange={(props) => handleFieldChange('props', props.length > 0 ? props : undefined)}
              readOnly={readOnly}
            />
          </div>
        )}
      </div>

      {/* 9. Global Links */}
      <div className="metadata-section" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-primary)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div
          onClick={() => toggleSection('links')}
          style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '800', fontSize: '14px', color: 'var(--color-text)', borderBottom: expandedSections.links ? '1px solid var(--color-border)' : 'none' }}
        >
          <span>Global Document Links ({metadata.links?.length || 0})</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{expandedSections.links ? '▼' : '▶'}</span>
        </div>
        {expandedSections.links && (
          <div style={{ padding: '20px' }}>
            <LinksEditor
              links={metadata.links || []}
              onChange={(links) => handleFieldChange('links', links.length > 0 ? links : undefined)}
              readOnly={readOnly}
            />
          </div>
        )}
      </div>

    </div>
  );
}
