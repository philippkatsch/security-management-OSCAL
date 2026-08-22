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
  editMode?: boolean;
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
  }
];

export default function SystemCharacteristicsEditor({
  systemChars,
  onUpdate,
  backMatter = {},
  onBackMatterChange = () => {},
  editMode = false
}: SystemCharacteristicsEditorProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['identity', 'status', 'impact', 'info-types', 'boundaries', 'parties'])
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
    setExpandedSections(new Set(['identity', 'status', 'impact', 'info-types', 'boundaries', 'parties']));
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
    onUpdate({
      ...systemChars,
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
          <h3>System Identity</h3>
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
              <label className={styles['form-label']}>System Name Short</label>
              <input
                type="text"
                className={styles['form-input']}
                value={systemChars?.['system-name-short'] || ''}
                onChange={(e) => handleChange('system-name-short', e.target.value)}
                readOnly={!editMode}
              />
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

      {/* 2. System Status */}
      <div className={styles['accordion-section']}>
        <div className={styles['accordion-header']} onClick={() => toggleSection('status')}>
          <h3>System Status</h3>
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
                <label className={styles['form-label']}>Remarks</label>
                <textarea
                  className={styles['form-textarea']}
                  value={systemChars?.status?.remarks || ''}
                  onChange={(e) => {
                    const newStatus = { ...systemChars?.status, remarks: e.target.value };
                    handleChange('status', newStatus);
                  }}
                  readOnly={!editMode}
                  rows={3}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Security Impact Level */}
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

      {/* 4. Information Types */}
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
                  style={{ maxWidth: '320px' }}
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

      {/* 5. Boundary Descriptions */}
      <div className={styles['accordion-section']}>
        <div className={styles['accordion-header']} onClick={() => toggleSection('boundaries')}>
          <h3>Boundary Descriptions & Diagrams</h3>
          <span className={styles['accordion-icon']}>{expandedSections.has('boundaries') ? '▼' : '▶'}</span>
        </div>
        {expandedSections.has('boundaries') && (
          <div className={styles['accordion-content']}>
            <div className={styles['form-group']}>
              <label className={styles['form-label']}>Authorization Boundary</label>
              <textarea
                className={styles['form-textarea']}
                rows={3}
                disabled={!editMode}
                value={systemChars['authorization-boundary']?.description || ''}
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
                label="Authorization Boundary"
                editMode={editMode}
              />
            </div>

            <div className={styles['form-group']}>
              <label className={styles['form-label']}>Network Architecture</label>
              <textarea
                className={styles['form-textarea']}
                rows={3}
                disabled={!editMode}
                value={systemChars['network-architecture']?.description || ''}
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
                label="Network Architecture"
                editMode={editMode}
              />
            </div>

            <div className={styles['form-group']}>
              <label className={styles['form-label']}>Data Flow</label>
              <textarea
                className={styles['form-textarea']}
                rows={3}
                disabled={!editMode}
                value={systemChars['data-flow']?.description || ''}
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
                label="Data Flow"
                editMode={editMode}
              />
            </div>
          </div>
        )}
      </div>

      {/* 6. Responsible Parties */}
      <div className={styles['accordion-section']}>
        <div className={styles['accordion-header']} onClick={() => toggleSection('parties')}>
          <h3>Responsible Parties</h3>
          <span className={styles['accordion-icon']}>{expandedSections.has('parties') ? '▼' : '▶'}</span>
        </div>
        {expandedSections.has('parties') && (
          <div className={styles['accordion-content']}>
            {(systemChars['responsible-parties'] || []).map((rp: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  className={styles['form-input']}
                  style={{ width: '30%' }}
                  placeholder="Role ID"
                  value={rp['role-id'] || ''}
                  disabled={!editMode}
                  onChange={(e) => {
                    const newRp = [...(systemChars['responsible-parties'] || [])];
                    newRp[i] = { ...newRp[i], 'role-id': e.target.value };
                    handleChange('responsible-parties', newRp);
                  }}
                />
                <input
                  className={styles['form-input']}
                  style={{ flex: 1 }}
                  placeholder="Party UUIDs (comma separated)"
                  value={(rp['party-uuids'] || []).join(', ')}
                  disabled={!editMode}
                  onChange={(e) => {
                    const newRp = [...(systemChars['responsible-parties'] || [])];
                    newRp[i] = {
                      ...newRp[i],
                      'party-uuids': e.target.value.split(',').filter(Boolean).map((s: string) => s.trim())
                    };
                    handleChange('responsible-parties', newRp);
                  }}
                />
                {editMode && (
                  <button
                    type="button"
                    className={styles['btn-danger']}
                    onClick={() => {
                      const newRp = [...(systemChars['responsible-parties'] || [])];
                      newRp.splice(i, 1);
                      handleChange('responsible-parties', newRp);
                    }}
                  >
                    X
                  </button>
                )}
              </div>
            ))}
            {editMode && (
              <div>
                <button
                  type="button"
                  className={styles['btn-secondary']}
                  onClick={() => {
                    const newRp = [...(systemChars['responsible-parties'] || []), { 'role-id': '', 'party-uuids': [] }];
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
