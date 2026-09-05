import React, { useState } from 'react';
import styles from './SSPPage.module.css';
import StatusBadge from '../shared/status/StatusBadge';
import DiagramUploader from './DiagramUploader';

const generateUUID = () => crypto.randomUUID();

export interface SystemCharacteristicsEditorProps {
  systemChars: any;
  onUpdate?: (newSystemChars: any) => void;
  backMatter?: any;
  onBackMatterChange?: (newBackMatter: any) => void;
  onUploadDiagram?: (container: 'authorization-boundary' | 'network-architecture' | 'data-flow', diagram: any, resource: any) => void;
  onRemoveDiagram?: (container: 'authorization-boundary' | 'network-architecture' | 'data-flow', diagramUuid: string, resourceUuid?: string) => void;
  editMode?: boolean;
  metadataParties?: any[];
  metadataRoles?: any[];
}

export function calculateFipsHighWaterMark(infoTypes?: any[] | null) {
  if (!Array.isArray(infoTypes)) {
    return {
      confidentiality: 'fips-199-low',
      integrity: 'fips-199-low',
      availability: 'fips-199-low',
      overall: 'fips-199-low'
    };
  }

  const getRank = (val?: any) => {
    if (!val) return 0;
    const strVal = (typeof val === 'string' ? val : String(val ?? '')).toLowerCase();
    if (strVal.includes('high')) return 3;
    if (strVal.includes('moderate')) return 2;
    if (strVal.includes('low')) return 1;
    return 0;
  };

  const rankToString = (rank: number) => {
    if (rank === 3) return 'fips-199-high';
    if (rank === 2) return 'fips-199-moderate';
    if (rank === 1) return 'fips-199-low';
    return '';
  };

  let maxConf = 0;
  let maxInteg = 0;
  let maxAvail = 0;

  for (const it of infoTypes) {
    if (!it || typeof it !== 'object') continue;
    const cVal = typeof it['confidentiality-impact'] === 'string'
      ? it['confidentiality-impact']
      : (it['confidentiality-impact']?.selected || it['confidentiality-impact']?.base || '');
    const iVal = typeof it['integrity-impact'] === 'string'
      ? it['integrity-impact']
      : (it['integrity-impact']?.selected || it['integrity-impact']?.base || '');
    const aVal = typeof it['availability-impact'] === 'string'
      ? it['availability-impact']
      : (it['availability-impact']?.selected || it['availability-impact']?.base || '');

    maxConf = Math.max(maxConf, getRank(cVal));
    maxInteg = Math.max(maxInteg, getRank(iVal));
    maxAvail = Math.max(maxAvail, getRank(aVal));
  }

  const overallRank = Math.max(maxConf, maxInteg, maxAvail);

  return {
    confidentiality: rankToString(maxConf),
    integrity: rankToString(maxInteg),
    availability: rankToString(maxAvail),
    overall: rankToString(overallRank)
  };
}

export const SP_800_60_TEMPLATES = [
  {
    title: 'Personnel Management Information',
    description: 'Records related to personnel selection, employment, performance, and health (NIST SP 800-60 C.3.5.8).',
    categorizationId: 'C.3.5.8',
    confidentiality: 'fips-199-moderate',
    integrity: 'fips-199-moderate',
    availability: 'fips-199-low',
    privacy: 'yes'
  },
  {
    title: 'Financial Management Information',
    description: 'Financial operations, accounting, budgeting, and financial reporting records (NIST SP 800-60 C.3.5.1).',
    categorizationId: 'C.3.5.1',
    confidentiality: 'fips-199-moderate',
    integrity: 'fips-199-high',
    availability: 'fips-199-moderate',
    privacy: 'no'
  },
  {
    title: 'Public Information',
    description: 'Information authorized for public release and distribution (NIST SP 800-60 C.2.8.2).',
    categorizationId: 'C.2.8.2',
    confidentiality: 'fips-199-low',
    integrity: 'fips-199-moderate',
    availability: 'fips-199-low',
    privacy: 'no'
  },
  {
    title: 'Information Technology Infrastructure',
    description: 'Network configurations, system architecture, operational logs, and security controls data (NIST SP 800-60 C.3.5.7).',
    categorizationId: 'C.3.5.7',
    confidentiality: 'fips-199-moderate',
    integrity: 'fips-199-high',
    availability: 'fips-199-high',
    privacy: 'no'
  },
  {
    title: 'Customer Account & PII Information',
    description: 'Personally Identifiable Information (PII), customer account records, and authentication credentials (NIST SP 800-60 C.2.4.1).',
    categorizationId: 'C.2.4.1',
    confidentiality: 'fips-199-high',
    integrity: 'fips-199-high',
    availability: 'fips-199-moderate',
    privacy: 'yes'
  }
];

export const STANDARD_SSP_ROLES = [
  { id: 'authorizing-official', title: 'Authorizing Official (AO)' },
  { id: 'authorizing-official-poc', title: 'Authorizing Official POC (AO POC)' },
  { id: 'system-owner', title: 'System Owner (SO)' },
  { id: 'system-poc-management', title: 'System POC - Management' },
  { id: 'system-poc-technical', title: 'System POC - Technical' },
  { id: 'system-poc-other', title: 'System POC - Other' },
  { id: 'information-system-security-officer', title: 'Information System Security Officer (ISSO)' },
  { id: 'privacy-poc', title: 'Privacy Official / POC' },
  { id: 'security-operations', title: 'Security Operations (SecOps)' },
  { id: 'maintainer', title: 'System Maintainer' }
];

export const SYSTEM_ID_TYPE_PRESETS = [
  { label: 'FedRAMP System Identifier', value: 'http://fedramp.gov/ns/oscal' },
  { label: 'RFC 4122 UUID', value: 'http://datatracker.ietf.org/doc/html/rfc4122' },
  { label: 'Custom URI', value: 'custom' },
  { label: 'None / Unspecified', value: '' }
];

export default function SystemCharacteristicsEditor({
  systemChars,
  onUpdate,
  backMatter = {},
  onBackMatterChange = () => {},
  onUploadDiagram,
  onRemoveDiagram,
  editMode = false,
  metadataParties = [],
  metadataRoles = []
}: SystemCharacteristicsEditorProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['identity', 'status', 'impact', 'info-types', 'boundaries', 'parties', 'palette'])
  );

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSections(new Set(['identity', 'status', 'impact', 'info-types', 'boundaries', 'parties', 'palette']));
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  const handleChange = (field: string, value: any) => {
    if (!onUpdate) return;
    onUpdate({
      ...systemChars,
      [field]: value
    });
  };

  const infoTypes = systemChars?.['system-information']?.['information-types'] || [];
  const hwSuggestion = calculateFipsHighWaterMark(infoTypes);

  const currConf = systemChars?.['security-impact-level']?.['security-objective-confidentiality'] || '';
  const currInteg = systemChars?.['security-impact-level']?.['security-objective-integrity'] || '';
  const currAvail = systemChars?.['security-impact-level']?.['security-objective-availability'] || '';

  const isConflict =
    (hwSuggestion.confidentiality && currConf && currConf !== hwSuggestion.confidentiality) ||
    (hwSuggestion.integrity && currInteg && currInteg !== hwSuggestion.integrity) ||
    (hwSuggestion.availability && currAvail && currAvail !== hwSuggestion.availability);

  const applyHwmSuggestion = () => {
    if (!onUpdate) return;
    const overallSens = hwSuggestion.overall ? hwSuggestion.overall.replace('fips-199-', '') : 'low';
    onUpdate({
      ...systemChars,
      'security-sensitivity-level': overallSens,
      'security-impact-level': {
        ...(systemChars?.['security-impact-level'] || {}),
        'security-objective-confidentiality': hwSuggestion.confidentiality || 'fips-199-low',
        'security-objective-integrity': hwSuggestion.integrity || 'fips-199-low',
        'security-objective-availability': hwSuggestion.availability || 'fips-199-low'
      }
    });
  };

  const handleImpactChange = (type: string, value: string) => {
    if (!onUpdate) return;
    onUpdate({
      ...systemChars,
      'security-impact-level': {
        ...(systemChars?.['security-impact-level'] || {}),
        ['security-objective-' + type]: value
      }
    });
  };

  const getPropValue = (name: string) => {
    const props = systemChars?.props || [];
    const p = props.find((item: any) => item.name === name);
    return p ? p.value : '';
  };

  const setPropValue = (name: string, value: string, ns = 'https://fedramp.gov/ns/oscal') => {
    if (!onUpdate) return;
    const props = [...(systemChars?.props || [])];
    const idx = props.findIndex((p: any) => p.name === name);
    if (idx > -1) {
      if (value) {
        props[idx] = { ...props[idx], value };
      } else {
        props.splice(idx, 1);
      }
    } else if (value) {
      props.push({ name, value, ns });
    }
    onUpdate({ ...systemChars, props });
  };

  const getImpactColorClass = (val: string) => {
    const v = (val || '').toLowerCase();
    if (v.includes('high')) return styles['impact-card-high'];
    if (v.includes('moderate')) return styles['impact-card-moderate'];
    if (v.includes('low')) return styles['impact-card-low'];
    return styles['impact-card-neutral'];
  };

  // System IDs Management
  const systemIds = systemChars?.['system-ids'] || [];

  const updateSystemIds = (newIds: any[]) => {
    if (!onUpdate) return;
    onUpdate({
      ...systemChars,
      'system-ids': newIds
    });
  };

  const addSystemId = () => {
    const newId = { id: `SYS-${Date.now().toString(36).toUpperCase()}`, 'identifier-type': 'http://fedramp.gov/ns/oscal' };
    updateSystemIds([...systemIds, newId]);
  };

  const removeSystemId = (index: number) => {
    const updated = systemIds.filter((_: any, i: number) => i !== index);
    updateSystemIds(updated);
  };

  const updateSystemIdItem = (index: number, updates: Record<string, any>) => {
    const updated = systemIds.map((item: any, i: number) => {
      if (i === index) {
        return { ...item, ...updates };
      }
      return item;
    });
    updateSystemIds(updated);
  };

  // Information Types Management
  const updateInfoTypes = (newTypes: any[]) => {
    if (!onUpdate) return;
    onUpdate({
      ...systemChars,
      'system-information': {
        ...(systemChars?.['system-information'] || {}),
        'information-types': newTypes
      }
    });
  };

  const addPresetTemplate = (template: typeof SP_800_60_TEMPLATES[0]) => {
    const newType = {
      uuid: generateUUID(),
      title: template.title,
      description: template.description,
      categorizations: [
        {
          system: 'http://doi.org/10.6028/NIST.SP.800-60v2r1',
          'information-type-ids': [template.categorizationId]
        }
      ],
      'confidentiality-impact': { base: template.confidentiality },
      'integrity-impact': { base: template.integrity },
      'availability-impact': { base: template.availability },
      props: [{ name: 'privacy-designation', value: template.privacy, ns: 'https://fedramp.gov/ns/oscal' }]
    };
    updateInfoTypes([...infoTypes, newType]);
  };

  const addCustomInfoType = () => {
    const newType = {
      uuid: generateUUID(),
      title: 'New Information Type',
      description: '',
      categorizations: [
        {
          system: 'http://doi.org/10.6028/NIST.SP.800-60v2r1',
          'information-type-ids': ['C.3.5.8']
        }
      ],
      'confidentiality-impact': { base: 'fips-199-low' },
      'integrity-impact': { base: 'fips-199-low' },
      'availability-impact': { base: 'fips-199-low' },
      props: [{ name: 'privacy-designation', value: 'no', ns: 'https://fedramp.gov/ns/oscal' }]
    };
    updateInfoTypes([...infoTypes, newType]);
  };

  const deleteInfoType = (uuid: string) => {
    updateInfoTypes(infoTypes.filter((t: any) => t.uuid !== uuid));
  };

  const updateInfoTypeItem = (index: number, updates: any) => {
    const next = [...infoTypes];
    next[index] = { ...next[index], ...updates };
    updateInfoTypes(next);
  };

  return (
    <div className={styles['ssp-editor']}>
      {/* Accordion Toolbar */}
      <div className={styles['editor-toolbar']}>
        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>System Characteristics Sections</div>
        <div className={styles['toolbar-actions']}>
          <button type="button" className={styles['btn-secondary']} onClick={expandAll}>
            Expand All
          </button>
          <button type="button" className={styles['btn-secondary']} onClick={collapseAll}>
            Collapse All
          </button>
        </div>
      </div>

      {/* 1. System Identity */}
      <div className={styles['accordion-section']}>
        <div className={styles['accordion-header']} onClick={() => toggleSection('identity')}>
          <h3>System Identity & Identifiers</h3>
          <span className={styles['accordion-icon']}>{expandedSections.has('identity') ? '▼' : '▶'}</span>
        </div>
        {expandedSections.has('identity') && (
          <div className={styles['accordion-content']}>
            <div className={styles['form-group']}>
              <label className={styles['form-label']}>
                System Name <span className={styles['required']}>*</span>
              </label>
              <input
                type="text"
                className={styles['form-input']}
                value={systemChars?.['system-name'] || ''}
                onChange={(e) => handleChange('system-name', e.target.value)}
                readOnly={!editMode}
              />
              {editMode && !systemChars?.['system-name'] && (
                <div className={styles['validation-error']}>System Name is required.</div>
              )}
            </div>

            <div className={styles['form-group']}>
              <label className={styles['form-label']}>System Name Short (Acronym)</label>
              <input
                type="text"
                className={styles['form-input']}
                value={systemChars?.['system-name-short'] || ''}
                onChange={(e) => handleChange('system-name-short', e.target.value)}
                readOnly={!editMode}
              />
            </div>

            {/* System IDs Array Editor */}
            <div className={styles['form-group']}>
              <div className="flex justify-between items-center mb-1">
                <label className={styles['form-label']}>
                  System Identifiers (system-ids) <span className={styles['required']}>*</span>
                </label>
                {editMode && (
                  <button
                    type="button"
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-2 py-1 rounded"
                    onClick={addSystemId}
                  >
                    + Add System ID
                  </button>
                )}
              </div>
              {systemIds.length === 0 ? (
                <div className={styles['validation-warning']}>
                  At least one system identifier is required by NIST OSCAL SSP schema (minItems: 1).
                  {editMode && (
                    <button
                      type="button"
                      className="ml-2 text-blue-600 underline"
                      onClick={addSystemId}
                    >
                      Initialize System ID
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {systemIds.map((sid: any, sIdx: number) => {
                    const isKnownPreset = SYSTEM_ID_TYPE_PRESETS.some(
                      p => p.value === (sid['identifier-type'] || '') && p.value !== 'custom'
                    );
                    const selectedDropdownVal = isKnownPreset
                      ? (sid['identifier-type'] || '')
                      : sid['identifier-type']
                      ? 'custom'
                      : '';

                    return (
                      <div
                        key={sIdx}
                        className="flex flex-col md:flex-row gap-2 items-start md:items-center p-2 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                      >
                        <div className="flex-1 w-full">
                          <input
                            type="text"
                            placeholder="Identifier String (e.g. SYS-PROD-01)"
                            className={styles['form-input']}
                            value={sid.id || ''}
                            onChange={(e) => updateSystemIdItem(sIdx, { id: e.target.value })}
                            readOnly={!editMode}
                          />
                        </div>
                        <div className="w-full md:w-64">
                          {editMode ? (
                            <select
                              className={styles['form-select']}
                              value={selectedDropdownVal}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'custom') {
                                  updateSystemIdItem(sIdx, { 'identifier-type': 'https://' });
                                } else {
                                  updateSystemIdItem(sIdx, { 'identifier-type': val || undefined });
                                }
                              }}
                            >
                              {SYSTEM_ID_TYPE_PRESETS.map((p) => (
                                <option key={p.value} value={p.value}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="text-xs text-gray-500 truncate">
                              {sid['identifier-type'] || 'No type'}
                            </div>
                          )}
                        </div>
                        {selectedDropdownVal === 'custom' && editMode && (
                          <div className="flex-1 w-full">
                            <input
                              type="text"
                              placeholder="Custom Identifier URI (e.g. https://example.com/sys-id)"
                              className={styles['form-input']}
                              value={sid['identifier-type'] || ''}
                              onChange={(e) => updateSystemIdItem(sIdx, { 'identifier-type': e.target.value })}
                            />
                          </div>
                        )}
                        {editMode && systemIds.length > 1 && (
                          <button
                            type="button"
                            className="text-red-500 hover:text-red-700 text-xs px-2 py-1 border border-red-300 dark:border-red-800 rounded"
                            onClick={() => removeSystemId(sIdx)}
                            aria-label={`Remove system id ${sid.id}`}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={styles['form-group']}>
              <label className={styles['form-label']}>
                Description <span className={styles['required']}>*</span>
              </label>
              <textarea
                className={styles['form-textarea']}
                value={systemChars?.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                readOnly={!editMode}
                rows={4}
              />
              {editMode && !systemChars?.description && (
                <div className={styles['validation-error']}>Description is required.</div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={styles['form-group']}>
                <label className={styles['form-label']}>Security Sensitivity Level</label>
                {editMode ? (
                  <select
                    className={styles['form-select']}
                    value={systemChars?.['security-sensitivity-level'] || ''}
                    onChange={(e) => handleChange('security-sensitivity-level', e.target.value)}
                  >
                    <option value="">Select Level...</option>
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                ) : (
                  <div className={styles['read-only-text']}>
                    {systemChars?.['security-sensitivity-level'] || 'Not specified'}
                  </div>
                )}
              </div>

              <div className={styles['form-group']}>
                <label className={styles['form-label']}>Date Authorized</label>
                <input
                  type="date"
                  className={styles['form-input']}
                  value={systemChars?.['date-authorized'] || ''}
                  onChange={(e) => handleChange('date-authorized', e.target.value)}
                  readOnly={!editMode}
                />
              </div>
            </div>

            <div className={styles['form-group']}>
              <label className={styles['form-checkbox-label']}>
                <input
                  type="checkbox"
                  checked={getPropValue('privacy-sensitive') === 'yes'}
                  onChange={(e) => setPropValue('privacy-sensitive', e.target.checked ? 'yes' : 'no')}
                  disabled={!editMode}
                />
                <span>Is this a privacy sensitive system?</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* 2. Standard OSCAL Property Palette */}
      <div className={styles['accordion-section']}>
        <div className={styles['accordion-header']} onClick={() => toggleSection('palette')}>
          <h3>Standard OSCAL Property Palette (Cloud & Assurance)</h3>
          <span className={styles['accordion-icon']}>{expandedSections.has('palette') ? '▼' : '▶'}</span>
        </div>
        {expandedSections.has('palette') && (
          <div className={styles['accordion-content']}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={styles['form-group']}>
                <label className={styles['form-label']}>Cloud Deployment Model</label>
                {editMode ? (
                  <select
                    className={styles['form-select']}
                    value={getPropValue('cloud-deployment-model')}
                    onChange={(e) => setPropValue('cloud-deployment-model', e.target.value)}
                  >
                    <option value="">Select Deployment Model...</option>
                    <option value="public-cloud">Public Cloud</option>
                    <option value="private-cloud">Private Cloud</option>
                    <option value="community-cloud">Community Cloud</option>
                    <option value="government-only-cloud">Government-Only Cloud</option>
                    <option value="hybrid-cloud">Hybrid Cloud</option>
                    <option value="other">Other</option>
                  </select>
                ) : (
                  <div className={styles['read-only-text']}>
                    {getPropValue('cloud-deployment-model') || 'Not specified'}
                  </div>
                )}
              </div>

              <div className={styles['form-group']}>
                <label className={styles['form-label']}>Cloud Service Model</label>
                {editMode ? (
                  <select
                    className={styles['form-select']}
                    value={getPropValue('cloud-service-model')}
                    onChange={(e) => setPropValue('cloud-service-model', e.target.value)}
                  >
                    <option value="">Select Service Model...</option>
                    <option value="saas">Software as a Service (SaaS)</option>
                    <option value="paas">Platform as a Service (PaaS)</option>
                    <option value="iaas">Infrastructure as a Service (IaaS)</option>
                    <option value="other">Other</option>
                  </select>
                ) : (
                  <div className={styles['read-only-text']}>
                    {getPropValue('cloud-service-model') || 'Not specified'}
                  </div>
                )}
              </div>

              <div className={styles['form-group']}>
                <label className={styles['form-label']}>Identity Assurance Level (IAL - NIST SP 800-63-3)</label>
                {editMode ? (
                  <select
                    className={styles['form-select']}
                    value={getPropValue('identity-assurance-level')}
                    onChange={(e) => setPropValue('identity-assurance-level', e.target.value)}
                  >
                    <option value="">Select IAL...</option>
                    <option value="1">IAL 1 (No identity proofing)</option>
                    <option value="2">IAL 2 (Remote or in-person identity proofing)</option>
                    <option value="3">IAL 3 (In-person biometric proofing)</option>
                  </select>
                ) : (
                  <div className={styles['read-only-text']}>
                    {getPropValue('identity-assurance-level') ? `IAL ${getPropValue('identity-assurance-level')}` : 'Not specified'}
                  </div>
                )}
              </div>

              <div className={styles['form-group']}>
                <label className={styles['form-label']}>Authenticator Assurance Level (AAL - NIST SP 800-63-3)</label>
                {editMode ? (
                  <select
                    className={styles['form-select']}
                    value={getPropValue('authenticator-assurance-level')}
                    onChange={(e) => setPropValue('authenticator-assurance-level', e.target.value)}
                  >
                    <option value="">Select AAL...</option>
                    <option value="1">AAL 1 (Single-factor / password)</option>
                    <option value="2">AAL 2 (Multi-factor MFA)</option>
                    <option value="3">AAL 3 (Hardware crypto key / MFA)</option>
                  </select>
                ) : (
                  <div className={styles['read-only-text']}>
                    {getPropValue('authenticator-assurance-level') ? `AAL ${getPropValue('authenticator-assurance-level')}` : 'Not specified'}
                  </div>
                )}
              </div>

              <div className={styles['form-group']}>
                <label className={styles['form-label']}>Federation Assurance Level (FAL - NIST SP 800-63-3)</label>
                {editMode ? (
                  <select
                    className={styles['form-select']}
                    value={getPropValue('federation-assurance-level')}
                    onChange={(e) => setPropValue('federation-assurance-level', e.target.value)}
                  >
                    <option value="">Select FAL...</option>
                    <option value="1">FAL 1 (Bearer assertions / SAML / OIDC)</option>
                    <option value="2">FAL 2 (Encrypted assertions)</option>
                    <option value="3">FAL 3 (Holder-of-key assertions)</option>
                  </select>
                ) : (
                  <div className={styles['read-only-text']}>
                    {getPropValue('federation-assurance-level') ? `FAL ${getPropValue('federation-assurance-level')}` : 'Not specified'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. System Status */}
      <div className={styles['accordion-section']}>
        <div className={styles['accordion-header']} onClick={() => toggleSection('status')}>
          <h3>System Operational Status</h3>
          <span className={styles['accordion-icon']}>{expandedSections.has('status') ? '▼' : '▶'}</span>
        </div>
        {expandedSections.has('status') && (
          <div className={styles['accordion-content']}>
            <div className={styles['form-group']}>
              <label className={styles['form-label']}>State</label>
              {editMode ? (
                <select
                  className={styles['form-select']}
                  value={systemChars?.status?.state || ''}
                  onChange={(e) => {
                    const newStatus = { ...systemChars?.status, state: e.target.value };
                    handleChange('status', newStatus);
                  }}
                >
                  <option value="">Select State...</option>
                  <option value="operational">Operational</option>
                  <option value="under-development">Under Development</option>
                  <option value="under-major-modification">Under Major Modification</option>
                  <option value="disposition">Disposition</option>
                  <option value="other">Other</option>
                </select>
              ) : (
                <StatusBadge category="operational-status" status={systemChars?.status?.state || 'unknown'} />
              )}
            </div>
            {systemChars?.status?.state === 'other' && (
              <div className={styles['form-group']}>
                <label className={styles['form-label']}>
                  Remarks <span className={styles['required']}>* (Mandatory when state is 'other')</span>
                </label>
                <textarea
                  className={styles['form-textarea']}
                  value={systemChars?.status?.remarks || ''}
                  placeholder="Describe the operational lifecycle status..."
                  onChange={(e) => {
                    const newStatus = { ...systemChars?.status, remarks: e.target.value };
                    handleChange('status', newStatus);
                  }}
                  readOnly={!editMode}
                  rows={3}
                />
                {editMode && !systemChars?.status?.remarks && (
                  <div className={styles['validation-error']}>
                    Remarks are required by OSCAL Metaschema when status state is 'other'.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Security Impact Level */}
      <div className={styles['accordion-section']}>
        <div className={styles['accordion-header']} onClick={() => toggleSection('impact')}>
          <h3>Security Impact Level (FIPS-199)</h3>
          <span className={styles['accordion-icon']}>{expandedSections.has('impact') ? '▼' : '▶'}</span>
        </div>
        {expandedSections.has('impact') && (
          <div className={styles['accordion-content']}>
            {/* High-Water Mark Banner */}
            <div className={styles['hwm-banner']}>
              <div className={styles['hwm-hint']}>
                💡 <strong>FIPS 199 High-Water Mark Suggestion:</strong>{' '}
                {hwSuggestion.overall ? (
                  <span>
                    Confidentiality: <strong>{hwSuggestion.confidentiality.replace('fips-199-', '').toUpperCase()}</strong> |{' '}
                    Integrity: <strong>{hwSuggestion.integrity.replace('fips-199-', '').toUpperCase()}</strong> |{' '}
                    Availability: <strong>{hwSuggestion.availability.replace('fips-199-', '').toUpperCase()}</strong>
                  </span>
                ) : (
                  <span>Add Information Types to compute high-water mark suggestion.</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {isConflict && (
                  <span className={styles['conflict-badge']}>
                    ⚠️ Impact Level Conflict
                  </span>
                )}
                {editMode && hwSuggestion.overall && (
                  <button type="button" className={styles['btn-primary']} onClick={applyHwmSuggestion}>
                    Apply High-Water Mark Suggestion
                  </button>
                )}
              </div>
            </div>

            {/* Impact Cards Grid */}
            <div className={styles['fips-impact-grid']}>
              {(['confidentiality', 'integrity', 'availability'] as const).map((objective) => {
                const val = systemChars?.['security-impact-level']?.['security-objective-' + objective] || '';
                const colorClass = getImpactColorClass(val);
                return (
                  <div key={objective} className={`${styles['fips-impact-card']} ${colorClass}`}>
                    <h4>{objective}</h4>
                    {editMode ? (
                      <select
                        className={styles['form-select']}
                        value={val}
                        onChange={(e) => handleImpactChange(objective, e.target.value)}
                      >
                        <option value="">Select Level...</option>
                        <option value="fips-199-low">Low</option>
                        <option value="fips-199-moderate">Moderate</option>
                        <option value="fips-199-high">High</option>
                      </select>
                    ) : (
                      <StatusBadge
                        category="fips-impact"
                        status={val.replace('fips-199-', '') || 'unknown'}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 5. Information Types */}
      <div className={styles['accordion-section']}>
        <div className={styles['accordion-header']} onClick={() => toggleSection('info-types')}>
          <h3>Information Types & NIST SP 800-60 Categorization</h3>
          <span className={styles['accordion-icon']}>{expandedSections.has('info-types') ? '▼' : '▶'}</span>
        </div>
        {expandedSections.has('info-types') && (
          <div className={styles['accordion-content']}>
            {editMode && (
              <div className={styles['preset-bar']}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Presets:</span>
                <select
                  className={styles['form-select']}
                  style={{ maxWidth: '340px' }}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    if (!isNaN(idx) && SP_800_60_TEMPLATES[idx]) {
                      addPresetTemplate(SP_800_60_TEMPLATES[idx]);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>➕ Load Preset SP 800-60 Template...</option>
                  {SP_800_60_TEMPLATES.map((tmpl, idx) => (
                    <option key={idx} value={idx}>
                      {tmpl.title} ({tmpl.categorizationId})
                    </option>
                  ))}
                </select>
                <button type="button" className={styles['btn-secondary']} onClick={addCustomInfoType}>
                  + Add Custom Info Type
                </button>
              </div>
            )}

            {infoTypes.length === 0 && (
              <div className={styles['read-only-text']}>
                No Information Types defined yet. Add information types to configure NIST SP 800-60 categorization and calculate FIPS 199 impact levels.
              </div>
            )}

            {infoTypes.map((infoType: any, idx: number) => {
              const privacyProp = (infoType.props || []).find((p: any) => p.name === 'privacy-designation');
              const isPrivacy = privacyProp?.value === 'yes';

              const piaLink = (infoType.links || []).find((l: any) => l.rel === 'privacy-impact-assessment');
              const catId = infoType.categorizations?.[0]?.['information-type-ids']?.[0] || '';

              return (
                <div key={infoType.uuid || idx} className={styles['info-type-card']}>
                  <div className={styles['info-type-header']}>
                    <div className={styles['info-type-title']}>
                      {infoType.title || 'Unnamed Information Type'}
                      {catId && <span style={{ color: '#2563eb', marginLeft: '8px', fontSize: '0.85rem' }}>({catId})</span>}
                    </div>
                    {editMode && (
                      <button type="button" className={styles['btn-danger']} onClick={() => deleteInfoType(infoType.uuid)}>
                        Remove
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className={styles['form-group']}>
                      <label className={styles['form-label']}>Title</label>
                      <input
                        type="text"
                        className={styles['form-input']}
                        value={infoType.title || ''}
                        onChange={(e) => updateInfoTypeItem(idx, { title: e.target.value })}
                        readOnly={!editMode}
                      />
                    </div>
                    <div className={styles['form-group']}>
                      <label className={styles['form-label']}>SP 800-60 Categorization ID</label>
                      <input
                        type="text"
                        className={styles['form-input']}
                        value={catId}
                        placeholder="e.g. C.3.5.8"
                        onChange={(e) => {
                          const newCats = [
                            {
                              system: infoType.categorizations?.[0]?.system || 'http://doi.org/10.6028/NIST.SP.800-60v2r1',
                              'information-type-ids': [e.target.value]
                            }
                          ];
                          updateInfoTypeItem(idx, { categorizations: newCats });
                        }}
                        readOnly={!editMode}
                      />
                    </div>
                  </div>

                  <div className={styles['form-group']}>
                    <label className={styles['form-label']}>Description</label>
                    <textarea
                      className={styles['form-textarea']}
                      rows={2}
                      value={infoType.description || ''}
                      onChange={(e) => updateInfoTypeItem(idx, { description: e.target.value })}
                      readOnly={!editMode}
                    />
                  </div>

                  {/* Impact levels sub-grid */}
                  <div className={styles['impact-grid-mini']}>
                    {(['confidentiality', 'integrity', 'availability'] as const).map((obj) => {
                      const impactObj = infoType[`${obj}-impact`] || {};
                      const baseVal = impactObj.base || '';
                      const selectedVal = impactObj.selected || '';
                      const justification = impactObj['adjustment-justification'] || '';

                      return (
                        <div key={obj} className={styles['form-group']}>
                          <label className={styles['form-label']} style={{ textTransform: 'capitalize' }}>
                            {obj} Impact
                          </label>
                          {editMode ? (
                            <>
                              <select
                                className={styles['form-select']}
                                value={baseVal}
                                onChange={(e) => {
                                  updateInfoTypeItem(idx, {
                                    [`${obj}-impact`]: { ...impactObj, base: e.target.value }
                                  });
                                }}
                              >
                                <option value="">Base Level...</option>
                                <option value="fips-199-low">Low</option>
                                <option value="fips-199-moderate">Moderate</option>
                                <option value="fips-199-high">High</option>
                              </select>
                              <select
                                className={styles['form-select']}
                                value={selectedVal}
                                onChange={(e) => {
                                  updateInfoTypeItem(idx, {
                                    [`${obj}-impact`]: { ...impactObj, selected: e.target.value }
                                  });
                                }}
                              >
                                <option value="">Selected Level (Adjusted)...</option>
                                <option value="fips-199-low">Low</option>
                                <option value="fips-199-moderate">Moderate</option>
                                <option value="fips-199-high">High</option>
                              </select>
                              {selectedVal && selectedVal !== baseVal && (
                                <input
                                  type="text"
                                  className={styles['form-input']}
                                  placeholder="Adjustment justification..."
                                  value={justification}
                                  onChange={(e) => {
                                    updateInfoTypeItem(idx, {
                                      [`${obj}-impact`]: { ...impactObj, 'adjustment-justification': e.target.value }
                                    });
                                  }}
                                />
                              )}
                            </>
                          ) : (
                            <div className={styles['read-only-text']}>
                              Base: {baseVal || 'None'} {selectedVal ? `| Selected: ${selectedVal}` : ''}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Privacy & PIA */}
                  <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label className={styles['form-checkbox-label']}>
                      <input
                        type="checkbox"
                        checked={isPrivacy}
                        onChange={(e) => {
                          const val = e.target.checked ? 'yes' : 'no';
                          const props = [...(infoType.props || [])];
                          const pIdx = props.findIndex((p: any) => p.name === 'privacy-designation');
                          if (pIdx > -1) {
                            props[pIdx] = { ...props[pIdx], value: val };
                          } else {
                            props.push({ name: 'privacy-designation', value: val, ns: 'https://fedramp.gov/ns/oscal' });
                          }
                          updateInfoTypeItem(idx, { props });
                        }}
                        disabled={!editMode}
                      />
                      <span>Privacy Designation</span>
                    </label>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                      <span className={styles['form-label']} style={{ whiteSpace: 'nowrap' }}>PIA Link:</span>
                      <input
                        type="text"
                        className={styles['form-input']}
                        placeholder="Privacy Impact Assessment URL (e.g. https://...)"
                        value={piaLink?.href || ''}
                        onChange={(e) => {
                          const links = [...(infoType.links || [])];
                          const lIdx = links.findIndex((l: any) => l.rel === 'privacy-impact-assessment');
                          if (e.target.value) {
                            if (lIdx > -1) {
                              links[lIdx] = { ...links[lIdx], href: e.target.value };
                            } else {
                              links.push({ rel: 'privacy-impact-assessment', href: e.target.value });
                            }
                          } else if (lIdx > -1) {
                            links.splice(lIdx, 1);
                          }
                          updateInfoTypeItem(idx, { links });
                        }}
                        readOnly={!editMode}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Boundary Descriptions & Diagrams */}
      <div className={styles['accordion-section']}>
        <div className={styles['accordion-header']} onClick={() => toggleSection('boundaries')}>
          <h3>Boundary Descriptions & Diagrams</h3>
          <span className={styles['accordion-icon']}>{expandedSections.has('boundaries') ? '▼' : '▶'}</span>
        </div>
        {expandedSections.has('boundaries') && (
          <div className={styles['accordion-content']}>
            <div className={styles['form-group']}>
              <label className={styles['form-label']}>Authorization Boundary Narrative</label>
              <textarea
                className={styles['form-textarea']}
                rows={3}
                disabled={!editMode}
                value={systemChars['authorization-boundary']?.description || ''}
                placeholder="Narrative describing systems, services, components, and facilities inside the authorization boundary..."
                onChange={(e) =>
                  handleChange('authorization-boundary', {
                    ...systemChars['authorization-boundary'],
                    description: e.target.value
                  })
                }
              />
              <DiagramUploader
                diagrams={systemChars['authorization-boundary']?.diagrams || []}
                onDiagramsChange={(newDiagrams) =>
                  handleChange('authorization-boundary', {
                    ...systemChars['authorization-boundary'],
                    diagrams: newDiagrams
                  })
                }
                backMatter={backMatter}
                onBackMatterChange={onBackMatterChange}
                onUploadDiagram={(diagram, resource) => {
                  if (onUploadDiagram) {
                    onUploadDiagram('authorization-boundary', diagram, resource);
                  } else {
                    const newBackMatter = {
                      ...backMatter,
                      resources: [...(backMatter.resources || []), resource]
                    };
                    onBackMatterChange?.(newBackMatter);
                    handleChange('authorization-boundary', {
                      ...systemChars['authorization-boundary'],
                      diagrams: [...(systemChars['authorization-boundary']?.diagrams || []), diagram]
                    });
                  }
                }}
                onRemoveDiagram={(diagramUuid, resourceUuid) => {
                  if (onRemoveDiagram) {
                    onRemoveDiagram('authorization-boundary', diagramUuid, resourceUuid);
                  } else {
                    const newDiagrams = (systemChars['authorization-boundary']?.diagrams || []).filter((d: any) => d.uuid !== diagramUuid);
                    handleChange('authorization-boundary', {
                      ...systemChars['authorization-boundary'],
                      diagrams: newDiagrams
                    });
                    if (resourceUuid) {
                      const newResources = (backMatter.resources || []).filter((r: any) => r.uuid !== resourceUuid);
                      onBackMatterChange?.({ ...backMatter, resources: newResources });
                    }
                  }
                }}
                label="Authorization Boundary"
                editMode={editMode}
              />
            </div>

            <div className={styles['form-group']}>
              <label className={styles['form-label']}>Network Architecture Narrative</label>
              <textarea
                className={styles['form-textarea']}
                rows={3}
                disabled={!editMode}
                value={systemChars['network-architecture']?.description || ''}
                placeholder="Narrative describing logical and physical network topology, subnets, DMZs, and perimeter firewalls..."
                onChange={(e) =>
                  handleChange('network-architecture', {
                    ...systemChars['network-architecture'],
                    description: e.target.value
                  })
                }
              />
              <DiagramUploader
                diagrams={systemChars['network-architecture']?.diagrams || []}
                onDiagramsChange={(newDiagrams) =>
                  handleChange('network-architecture', {
                    ...systemChars['network-architecture'],
                    diagrams: newDiagrams
                  })
                }
                backMatter={backMatter}
                onBackMatterChange={onBackMatterChange}
                onUploadDiagram={(diagram, resource) => {
                  if (onUploadDiagram) {
                    onUploadDiagram('network-architecture', diagram, resource);
                  } else {
                    const newBackMatter = {
                      ...backMatter,
                      resources: [...(backMatter.resources || []), resource]
                    };
                    onBackMatterChange?.(newBackMatter);
                    handleChange('network-architecture', {
                      ...systemChars['network-architecture'],
                      diagrams: [...(systemChars['network-architecture']?.diagrams || []), diagram]
                    });
                  }
                }}
                onRemoveDiagram={(diagramUuid, resourceUuid) => {
                  if (onRemoveDiagram) {
                    onRemoveDiagram('network-architecture', diagramUuid, resourceUuid);
                  } else {
                    const newDiagrams = (systemChars['network-architecture']?.diagrams || []).filter((d: any) => d.uuid !== diagramUuid);
                    handleChange('network-architecture', {
                      ...systemChars['network-architecture'],
                      diagrams: newDiagrams
                    });
                    if (resourceUuid) {
                      const newResources = (backMatter.resources || []).filter((r: any) => r.uuid !== resourceUuid);
                      onBackMatterChange?.({ ...backMatter, resources: newResources });
                    }
                  }
                }}
                label="Network Architecture"
                editMode={editMode}
              />
            </div>

            <div className={styles['form-group']}>
              <label className={styles['form-label']}>Data Flow Narrative</label>
              <textarea
                className={styles['form-textarea']}
                rows={3}
                disabled={!editMode}
                value={systemChars['data-flow']?.description || ''}
                placeholder="Narrative describing information movement, ingress/egress points, protocols, and encryption in transit..."
                onChange={(e) =>
                  handleChange('data-flow', {
                    ...systemChars['data-flow'],
                    description: e.target.value
                  })
                }
              />
              <DiagramUploader
                diagrams={systemChars['data-flow']?.diagrams || []}
                onDiagramsChange={(newDiagrams) =>
                  handleChange('data-flow', {
                    ...systemChars['data-flow'],
                    diagrams: newDiagrams
                  })
                }
                backMatter={backMatter}
                onBackMatterChange={onBackMatterChange}
                onUploadDiagram={(diagram, resource) => {
                  if (onUploadDiagram) {
                    onUploadDiagram('data-flow', diagram, resource);
                  } else {
                    const newBackMatter = {
                      ...backMatter,
                      resources: [...(backMatter.resources || []), resource]
                    };
                    onBackMatterChange?.(newBackMatter);
                    handleChange('data-flow', {
                      ...systemChars['data-flow'],
                      diagrams: [...(systemChars['data-flow']?.diagrams || []), diagram]
                    });
                  }
                }}
                onRemoveDiagram={(diagramUuid, resourceUuid) => {
                  if (onRemoveDiagram) {
                    onRemoveDiagram('data-flow', diagramUuid, resourceUuid);
                  } else {
                    const newDiagrams = (systemChars['data-flow']?.diagrams || []).filter((d: any) => d.uuid !== diagramUuid);
                    handleChange('data-flow', {
                      ...systemChars['data-flow'],
                      diagrams: newDiagrams
                    });
                    if (resourceUuid) {
                      const newResources = (backMatter.resources || []).filter((r: any) => r.uuid !== resourceUuid);
                      onBackMatterChange?.({ ...backMatter, resources: newResources });
                    }
                  }
                }}
                label="Data Flow"
                editMode={editMode}
              />
            </div>
          </div>
        )}
      </div>

      {/* 7. Responsible Parties */}
      <div className={styles['accordion-section']}>
        <div className={styles['accordion-header']} onClick={() => toggleSection('parties')}>
          <h3>Responsible Parties</h3>
          <span className={styles['accordion-icon']}>{expandedSections.has('parties') ? '▼' : '▶'}</span>
        </div>
        {expandedSections.has('parties') && (
          <div className={styles['accordion-content']}>
            {(systemChars['responsible-parties'] || []).map((rp: any, i: number) => {
              const standardRole = STANDARD_SSP_ROLES.find(r => r.id === rp['role-id']);
              const isCustomRole = !standardRole && rp['role-id'];

              return (
                <div key={i} className="p-3 border rounded mb-3 bg-gray-50 dark:bg-gray-800 space-y-2">
                  <div className="flex gap-2 items-center">
                    <div className="w-1/2">
                      <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">Role</label>
                      {editMode ? (
                        <select
                          className={styles['form-select']}
                          value={isCustomRole ? 'custom' : (rp['role-id'] || '')}
                          onChange={(e) => {
                            const val = e.target.value;
                            const newRp = [...(systemChars['responsible-parties'] || [])];
                            if (val === 'custom') {
                              newRp[i] = { ...newRp[i], 'role-id': 'custom-role' };
                            } else {
                              newRp[i] = { ...newRp[i], 'role-id': val };
                            }
                            handleChange('responsible-parties', newRp);
                          }}
                        >
                          <option value="">Select Standard Role...</option>
                          {STANDARD_SSP_ROLES.map(role => (
                            <option key={role.id} value={role.id}>{role.title}</option>
                          ))}
                          <option value="custom">Custom Role ID...</option>
                        </select>
                      ) : (
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {standardRole ? standardRole.title : (rp['role-id'] || 'None')}
                        </div>
                      )}
                    </div>

                    {isCustomRole && editMode && (
                      <div className="flex-1">
                        <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">Custom Role ID</label>
                        <input
                          className={styles['form-input']}
                          placeholder="e.g. system-administrator"
                          value={rp['role-id'] || ''}
                          onChange={(e) => {
                            const newRp = [...(systemChars['responsible-parties'] || [])];
                            newRp[i] = { ...newRp[i], 'role-id': e.target.value };
                            handleChange('responsible-parties', newRp);
                          }}
                        />
                      </div>
                    )}

                    {editMode && (
                      <button
                        type="button"
                        className="self-end mb-1 text-red-500 hover:text-red-700 text-xs px-2 py-1.5 border border-red-300 dark:border-red-800 rounded"
                        onClick={() => {
                          const newRp = [...(systemChars['responsible-parties'] || [])];
                          newRp.splice(i, 1);
                          handleChange('responsible-parties', newRp);
                        }}
                      >
                        Remove Party
                      </button>
                    )}
                  </div>

                  {/* Party Picker */}
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">
                      Assigned Parties ({((rp['party-uuids'] || []).length)})
                    </label>
                    {editMode ? (
                      metadataParties && metadataParties.length > 0 ? (
                        <div className="flex flex-wrap gap-2 p-2 border rounded bg-white dark:bg-gray-900">
                          {metadataParties.map((p: any) => {
                            const isChecked = (rp['party-uuids'] || []).includes(p.uuid);
                            return (
                              <label key={p.uuid} className="inline-flex items-center gap-1.5 text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const currentUuids = rp['party-uuids'] || [];
                                    let nextUuids: string[];
                                    if (e.target.checked) {
                                      nextUuids = [...currentUuids, p.uuid];
                                    } else {
                                      nextUuids = currentUuids.filter((u: string) => u !== p.uuid);
                                    }
                                    const newRp = [...(systemChars['responsible-parties'] || [])];
                                    newRp[i] = { ...newRp[i], 'party-uuids': nextUuids };
                                    handleChange('responsible-parties', newRp);
                                  }}
                                />
                                <span className="font-medium text-gray-800 dark:text-gray-200">{p.name || p['short-name'] || p.uuid}</span>
                                <span className="text-gray-500 text-[10px]">({p.type || 'party'})</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <input
                          className={styles['form-input']}
                          placeholder="Party UUIDs (comma separated)"
                          value={(rp['party-uuids'] || []).join(', ')}
                          onChange={(e) => {
                            const newRp = [...(systemChars['responsible-parties'] || [])];
                            newRp[i] = {
                              ...newRp[i],
                              'party-uuids': e.target.value.split(',').filter(Boolean).map((s: string) => s.trim())
                            };
                            handleChange('responsible-parties', newRp);
                          }}
                        />
                      )
                    ) : (
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {(rp['party-uuids'] || []).map((u: string) => {
                          const matched = metadataParties.find((p: any) => p.uuid === u);
                          return (
                            <span key={u} className="inline-block mr-2 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                              {matched ? (matched.name || matched['short-name'] || u) : u}
                            </span>
                          );
                        })}
                        {(!rp['party-uuids'] || rp['party-uuids'].length === 0) && 'No party assigned'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {editMode && (
              <div>
                <button
                  type="button"
                  className={styles['btn-secondary']}
                  onClick={() => {
                    const newRp = [...(systemChars['responsible-parties'] || []), { 'role-id': 'system-owner', 'party-uuids': [] }];
                    handleChange('responsible-parties', newRp);
                  }}
                >
                  + Add Responsible Party
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
