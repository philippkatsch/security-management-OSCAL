import React, { useState } from 'react';
import EntityDetailPanel from '../entity/EntityDetailPanel';
import { EntityEditor, FieldConfig } from '../form';
import { CharacterizationsEditor } from '../risk-assessment/CharacterizationsEditor';
import { RiskLogEditor } from '../risk-assessment/RiskLogEditor';
import { RelevantEvidenceEditor } from '../risk-assessment/RelevantEvidenceEditor';
import { RemediationsEditor } from '../risk-assessment/RemediationsEditor';
import StatusBadge from '../status/StatusBadge';

export const RiskEditor = ({ item, onSave, onClose, readOnly }) => {
  const [edited, setEdited] = useState(item || {});
  
  const updateField = (field, value) => setEdited(prev => ({ ...prev, [field]: value }));

  const riskStatuses = [
    { value: 'open', label: 'Open' },
    { value: 'investigating', label: 'Investigating' },
    { value: 'remediating', label: 'Remediating' },
    { value: 'deviation-requested', label: 'Deviation Requested' },
    { value: 'deviation-approved', label: 'Deviation Approved' },
    { value: 'closed', label: 'Closed' }
  ];

  const fields: FieldConfig[] = [
    { path: 'title', type: 'text', label: 'Title', required: true },
    { path: 'status', type: 'select', label: 'Status', options: riskStatuses },
    { path: 'description', type: 'markdown', label: 'Description' }
  ];

  return (
    <EntityDetailPanel
      isOpen={!!item}
      onClose={onClose}
      title="Risk Editor"
      actions={!readOnly ? [{ label: 'Save Changes', variant: 'primary', onClick: () => onSave(edited) }] : undefined}
    >
      <div className="form-content">
        <EntityEditor
          entity={edited}
          onChange={setEdited}
          fields={fields}
          readOnly={readOnly}
        />
        
        <div style={{ marginTop: '8px', marginBottom: '16px' }}>
          <StatusBadge status={edited.status || 'open'} category="risk-status" />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Threat IDs (comma separated)</label>
          <input 
            type="text" 
            className="w-full border rounded p-2 dark:bg-gray-700"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: '4px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
            value={(edited['threat-ids'] || []).join(', ')} 
            onChange={e => updateField('threat-ids', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} 
            disabled={readOnly} 
          />
        </div>
        
        <div className="inline-editor-section" style={{ marginTop: '16px' }}>
           <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--color-border)', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>Characterizations</h3>
           <CharacterizationsEditor 
             value={edited.characterizations || []} 
             isEditMode={!readOnly} 
             onChange={newChars => updateField('characterizations', newChars)} 
           />
        </div>
        
        <div className="inline-editor-section" style={{ marginTop: '16px' }}>
           <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--color-border)', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>Risk Log</h3>
           <RiskLogEditor 
             value={edited['risk-log'] || { entries: [] }} 
             isEditMode={!readOnly} 
             onChange={newLog => updateField('risk-log', newLog)} 
           />
        </div>

        <div className="inline-editor-section" style={{ marginTop: '16px' }}>
           <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--color-border)', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>Remediations</h3>
           <RemediationsEditor 
             value={edited.remediations || []} 
             isEditMode={!readOnly} 
             onChange={newRems => updateField('remediations', newRems)} 
           />
        </div>
      </div>
    </EntityDetailPanel>
  );
};

