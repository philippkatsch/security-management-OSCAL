import React, { useState } from 'react';
import StatusBadge from '../shared/status/StatusBadge';
import DiagramUploader from './DiagramUploader';
import './SSPEditor.css';

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

  return (
    <div className="ssp-editor system-characteristics-editor">
      {/* 1. System Identity */}
      <div className={`accordion-section ${expandedSection === 'identity' ? 'expanded' : ''}`}>
        <div className="accordion-header" onClick={() => toggleSection('identity')}>
          <h3>System Identity</h3>
          <span className="accordion-icon">{expandedSection === 'identity' ? '▼' : '▶'}</span>
        </div>
        {expandedSection === 'identity' && (
          <div className="accordion-content">
            <div className="form-group">
              <label className="form-label">System Name <span className="required">*</span></label>
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
              <label className="form-label">Description <span className="required">*</span></label>
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
          </div>
        )}
      </div>

      {/* 2. System Status */}
      <div className={`accordion-section ${expandedSection === 'status' ? 'expanded' : ''}`}>
        <div className="accordion-header" onClick={() => toggleSection('status')}>
          <h3>System Status</h3>
          <span className="accordion-icon">{expandedSection === 'status' ? '▼' : '▶'}</span>
        </div>
        {expandedSection === 'status' && (
          <div className="accordion-content">
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
            {systemChars?.status?.state !== 'operational' && (
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
        <div className="accordion-header" onClick={() => toggleSection('impact')}>
          <h3>Security Impact Level (FIPS-199)</h3>
          <span className="accordion-icon">{expandedSection === 'impact' ? '▼' : '▶'}</span>
        </div>
        {expandedSection === 'impact' && (
          <div className="accordion-content">
            <div className="fips-impact-grid">
              {['confidentiality', 'integrity', 'availability'].map((objective) => {
                const val = systemChars?.['security-impact-level']?.['security-objective-' + objective] || '';
                return (
                  <div key={objective} className="fips-impact-card">
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
        <div className="accordion-header" onClick={() => toggleSection('info-types')}>
          <h3>Information Types</h3>
          <span className="accordion-icon">{expandedSection === 'info-types' ? '▼' : '▶'}</span>
        </div>
        {expandedSection === 'info-types' && (
          <div className="accordion-content">
             <div className="read-only-text">Information Types implementation...</div>
          </div>
        )}
      </div>

      {/* 5. Boundary Descriptions */}
      <div className={`accordion-section ${expandedSection === 'boundaries' ? 'expanded' : ''}`}>
        <div className="accordion-header" onClick={() => toggleSection('boundaries')}>
          <h3>Boundary Descriptions</h3>
          <span className="accordion-icon">{expandedSection === 'boundaries' ? '▼' : '▶'}</span>
        </div>
        {expandedSection === 'boundaries' && (
          <div className="accordion-content space-y-4">
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
        <div className="accordion-header" onClick={() => toggleSection('parties')}>
          <h3>Responsible Parties</h3>
          <span className="accordion-icon">{expandedSection === 'parties' ? '▼' : '▶'}</span>
        </div>
        {expandedSection === 'parties' && (
          <div className="accordion-content">
             <div className="read-only-text">Responsible parties implementation...</div>
          </div>
        )}
      </div>

    </div>
  );
}
