import React, { useState } from 'react';
import styles from './SSPPage.module.css';
import StatusBadge from '@components/shared/status/StatusBadge';
import DiagramUploader from './DiagramUploader';

export default function SystemCharacteristicsEditor({ systemChars, onUpdate, editMode }) {
  const [expandedSection, setExpandedSection] = useState('identity');

  const handleChange = (field, value) => {
    if (!onUpdate) return;
    onUpdate({
      ...systemChars,
      [field]: value
    });
  };

  const handleImpactChange = (type, value) => {
    if (!onUpdate) return;
    onUpdate({
      ...systemChars,
      'security-impact-level': {
        ...(systemChars?.['security-impact-level'] || {}),
        ['security-objective-' + type]: value
      }
    });
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const impactLevelValue = (fullLevel) => {
    if (!fullLevel) return '';
    return fullLevel.replace('fips-199-', '');
  };

  const getPropValue = (name) => {
    const props = systemChars?.props || [];
    const p = props.find(p => p.name === name);
    return p ? p.value : '';
  };

  const setPropValue = (name, value, ns = 'https://fedramp.gov/ns/oscal') => {
    if (!onUpdate) return;
    const props = [...(systemChars?.props || [])];
    const idx = props.findIndex(p => p.name === name);
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

  return (
    <div className={[styles['ssp-editor'], 'system-characteristics-editor'].filter(Boolean).join(' ')}>
      {/* 1. System Identity */}
      <div className={`accordion-section ${expandedSection === 'identity' ? 'expanded' : ''}`}>
        <div className={styles['accordion-header']} onClick={() => toggleSection('identity')}>
          <h3>System Identity</h3>
          <span className={styles['accordion-icon']}>{expandedSection === 'identity' ? '▼' : '▶'}</span>
        </div>
        {expandedSection === 'identity' && (
          <div className={styles['accordion-content']}>
            <div className="form-group">
              <label className="form-label">System Name <span className={styles['required']}>*</span></label>
              <input 
                type="text" 
                className="form-input"
                value={systemChars?.['system-name'] || ''}
                onChange={(e) => handleChange('system-name', e.target.value)}
                readOnly={!editMode}
              />
            </div>
            <div className="form-group">
              <label className="form-label">System Name Short</label>
              <input 
                type="text" 
                className="form-input"
                value={systemChars?.['system-name-short'] || ''}
                onChange={(e) => handleChange('system-name-short', e.target.value)}
                readOnly={!editMode}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description <span className={styles['required']}>*</span></label>
              <textarea 
                className="form-input"
                value={systemChars?.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                readOnly={!editMode}
                rows={4}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Security Sensitivity Level</label>
              {editMode ? (
                <select 
                  className="form-input"
                  value={systemChars?.['security-sensitivity-level'] || ''}
                  onChange={(e) => handleChange('security-sensitivity-level', e.target.value)}
                >
                  <option value="">Select Level...</option>
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              ) : (
                <div className="read-only-text">{systemChars?.['security-sensitivity-level'] || 'Not specified'}</div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Date Authorized</label>
              <input 
                type="date" 
                className="form-input"
                value={systemChars?.['date-authorized'] || ''}
                onChange={(e) => handleChange('date-authorized', e.target.value)}
                readOnly={!editMode}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Privacy Sensitive System</label>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={getPropValue('privacy-sensitive') === 'yes'}
                  onChange={(e) => setPropValue('privacy-sensitive', e.target.checked ? 'yes' : 'no')}
                  disabled={!editMode}
                />
                <span>Is this a privacy sensitive system?</span>
              </div>
            </div>

            <div className="form-group mt-4 border-t pt-4">
              <h4 className="font-semibold mb-2">Cloud Properties</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Cloud Deployment Model</label>
                  {editMode ? (
                    <select 
                      className="form-input"
                      value={getPropValue('cloud-deployment-model')}
                      onChange={(e) => setPropValue('cloud-deployment-model', e.target.value)}
                    >
                      <option value="">Select Model...</option>
                      <option value="public-cloud">Public Cloud</option>
                      <option value="private-cloud">Private Cloud</option>
                      <option value="community-cloud">Community Cloud</option>
                      <option value="hybrid-cloud">Hybrid Cloud</option>
                      <option value="government-only-cloud">Government Only Cloud</option>
                      <option value="other">Other</option>
                    </select>
                  ) : (
                    <div className="read-only-text">{getPropValue('cloud-deployment-model') || 'Not specified'}</div>
                  )}
                </div>
                <div>
                  <label className="form-label">Cloud Service Model</label>
                  {editMode ? (
                    <select 
                      className="form-input"
                      value={getPropValue('cloud-service-model')}
                      onChange={(e) => setPropValue('cloud-service-model', e.target.value)}
                    >
                      <option value="">Select Model...</option>
                      <option value="iaas">IaaS</option>
                      <option value="paas">PaaS</option>
                      <option value="saas">SaaS</option>
                      <option value="other">Other</option>
                    </select>
                  ) : (
                    <div className="read-only-text">{getPropValue('cloud-service-model') || 'Not specified'}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="form-group mt-4 border-t pt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold">System IDs</h4>
                {editMode && (
                  <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => {
                    const newIds = [...(systemChars?.['system-ids'] || []), { id: '', 'identifier-type': '' }];
                    handleChange('system-ids', newIds);
                  }}>+ Add System ID</button>
                )}
              </div>
              {(systemChars?.['system-ids'] || []).map((sysId, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input 
                    className="form-input flex-1" 
                    placeholder="ID"
                    value={sysId.id || ''} 
                    onChange={e => {
                      const newIds = [...(systemChars['system-ids'] || [])];
                      newIds[i] = { ...newIds[i], id: e.target.value };
                      handleChange('system-ids', newIds);
                    }}
                    disabled={!editMode}
                  />
                  <input 
                    className="form-input flex-1" 
                    placeholder="Identifier Type (URI/text)"
                    value={sysId['identifier-type'] || ''} 
                    onChange={e => {
                      const newIds = [...(systemChars['system-ids'] || [])];
                      newIds[i] = { ...newIds[i], 'identifier-type': e.target.value };
                      handleChange('system-ids', newIds);
                    }}
                    disabled={!editMode}
                  />
                  {editMode && (
                    <button type="button" className="text-red-500 px-2" onClick={() => {
                      const newIds = [...(systemChars['system-ids'] || [])];
                      newIds.splice(i, 1);
                      handleChange('system-ids', newIds);
                    }}>X</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. System Status */}
      <div className={`accordion-section ${expandedSection === 'status' ? 'expanded' : ''}`}>
        <div className={styles['accordion-header']} onClick={() => toggleSection('status')}>
          <h3>System Status</h3>
          <span className={styles['accordion-icon']}>{expandedSection === 'status' ? '▼' : '▶'}</span>
        </div>
        {expandedSection === 'status' && (
          <div className={styles['accordion-content']}>
            <div className="form-group">
              <label className="form-label">State</label>
              {editMode ? (
                <select 
                  className="form-input"
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
                <StatusBadge 
                  category="operational-status" 
                  status={systemChars?.status?.state || 'unknown'} 
                />
              )}
            </div>
            {systemChars?.status?.state === 'other' && (
              <div className="form-group">
                <label className="form-label">Remarks</label>
                <textarea 
                  className="form-input"
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
      <div className={`accordion-section ${expandedSection === 'impact' ? 'expanded' : ''}`}>
        <div className={styles['accordion-header']} onClick={() => toggleSection('impact')}>
          <h3>Security Impact Level (FIPS-199)</h3>
          <span className={styles['accordion-icon']}>{expandedSection === 'impact' ? '▼' : '▶'}</span>
        </div>
        {expandedSection === 'impact' && (
          <div className={styles['accordion-content']}>
            <div className={styles['fips-impact-grid']}>
              {['confidentiality', 'integrity', 'availability'].map((objective) => {
                const val = systemChars?.['security-impact-level']?.['security-objective-' + objective] || '';
                return (
                  <div key={objective} className={styles['fips-impact-card']}>
                    <h4>{objective.charAt(0).toUpperCase() + objective.slice(1)}</h4>
                    {editMode ? (
                      <select 
                        className="form-input"
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
                        status={impactLevelValue(val) || 'unknown'} 
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
      <div className={`accordion-section ${expandedSection === 'info-types' ? 'expanded' : ''}`}>
        <div className={styles['accordion-header']} onClick={() => toggleSection('info-types')}>
          <h3>Information Types</h3>
          <span className={styles['accordion-icon']}>{expandedSection === 'info-types' ? '▼' : '▶'}</span>
        </div>
        {expandedSection === 'info-types' && (
          <div className={styles['accordion-content']}>
             {(systemChars?.['system-information']?.['information-types'] || []).map((infoType, idx) => {
               const pProp = (infoType.props || []).find(p => p.name === 'privacy-designation');
               const pValue = pProp ? pProp.value : 'no';
               return (
                 <div key={infoType.uuid || idx} className="mb-4 p-4 border rounded bg-gray-50 dark:bg-gray-800">
                   <div className="font-medium">{infoType.title || 'Unnamed Info Type'}</div>
                   <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{infoType.description}</div>
                   <div className="flex items-center gap-2">
                     <input 
                       type="checkbox" 
                       checked={pValue === 'yes'}
                       onChange={(e) => {
                         if (!onUpdate) return;
                         const newTypes = [...(systemChars?.['system-information']?.['information-types'] || [])];
                         const targetType = { ...newTypes[idx] };
                         const targetProps = [...(targetType.props || [])];
                         const pIdx = targetProps.findIndex(p => p.name === 'privacy-designation');
                         const val = e.target.checked ? 'yes' : 'no';
                         
                         if (pIdx > -1) {
                           targetProps[pIdx] = { ...targetProps[pIdx], value: val };
                         } else {
                           targetProps.push({ name: 'privacy-designation', value: val, ns: 'https://fedramp.gov/ns/oscal' });
                         }
                         targetType.props = targetProps;
                         newTypes[idx] = targetType;
                         
                         onUpdate({
                           ...systemChars,
                           'system-information': {
                             ...(systemChars['system-information'] || {}),
                             'information-types': newTypes
                           }
                         });
                       }}
                       disabled={!editMode}
                     />
                     <span className="text-sm">Privacy Designation</span>
                   </div>
                 </div>
               );
             })}
             {(!systemChars?.['system-information']?.['information-types'] || systemChars?.['system-information']?.['information-types'].length === 0) && (
               <div className="read-only-text">No Information Types defined.</div>
             )}
          </div>
        )}
      </div>

      {/* 5. Boundary Descriptions */}
      <div className={`accordion-section ${expandedSection === 'boundaries' ? 'expanded' : ''}`}>
        <div className={styles['accordion-header']} onClick={() => toggleSection('boundaries')}>
          <h3>Boundary Descriptions</h3>
          <span className={styles['accordion-icon']}>{expandedSection === 'boundaries' ? '▼' : '▶'}</span>
        </div>
        {expandedSection === 'boundaries' && (
          <div className={[styles['accordion-content'], 'space-y-4'].filter(Boolean).join(' ')}>
            <div className="form-group">
              <label className="form-label">Authorization Boundary</label>
              <textarea className="form-input mb-2" rows="3" disabled={!editMode}
                        value={systemChars['authorization-boundary']?.description || ''}
                        onChange={e => handleChange('authorization-boundary', { ...systemChars['authorization-boundary'], description: e.target.value })} />
              <DiagramUploader 
                diagrams={systemChars['authorization-boundary']?.diagrams || []}
                onDiagramsChange={(newDiagrams) => handleChange('authorization-boundary', { ...systemChars['authorization-boundary'], diagrams: newDiagrams })}
                backMatter={{}} // Note: SystemCharacteristicsEditor doesn't have direct access to backMatter here, assuming it's passed or handled via onUpdate ideally. For now, empty.
                onBackMatterChange={() => {}}
                label="Authorization Boundary"
                editMode={editMode}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Network Architecture</label>
              <textarea className="form-input mb-2" rows="3" disabled={!editMode}
                        value={systemChars['network-architecture']?.description || ''}
                        onChange={e => handleChange('network-architecture', { ...systemChars['network-architecture'], description: e.target.value })} />
              <DiagramUploader 
                diagrams={systemChars['network-architecture']?.diagrams || []}
                onDiagramsChange={(newDiagrams) => handleChange('network-architecture', { ...systemChars['network-architecture'], diagrams: newDiagrams })}
                backMatter={{}}
                onBackMatterChange={() => {}}
                label="Network Architecture"
                editMode={editMode}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Data Flow</label>
              <textarea className="form-input mb-2" rows="3" disabled={!editMode}
                        value={systemChars['data-flow']?.description || ''}
                        onChange={e => handleChange('data-flow', { ...systemChars['data-flow'], description: e.target.value })} />
              <DiagramUploader 
                diagrams={systemChars['data-flow']?.diagrams || []}
                onDiagramsChange={(newDiagrams) => handleChange('data-flow', { ...systemChars['data-flow'], diagrams: newDiagrams })}
                backMatter={{}}
                onBackMatterChange={() => {}}
                label="Data Flow"
                editMode={editMode}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* 6. Responsible Parties */}
      <div className={`accordion-section ${expandedSection === 'parties' ? 'expanded' : ''}`}>
        <div className={styles['accordion-header']} onClick={() => toggleSection('parties')}>
          <h3>Responsible Parties</h3>
          <span className={styles['accordion-icon']}>{expandedSection === 'parties' ? '▼' : '▶'}</span>
        </div>
        {expandedSection === 'parties' && (
          <div className={styles['accordion-content']}>
             <div className="read-only-text">Responsible parties implementation...</div>
          </div>
        )}
      </div>

    </div>
  );
}
