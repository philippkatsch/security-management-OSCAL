import React, { useState } from 'react';
import EntityDetailPanel from '../entity/EntityDetailPanel';
import { EntityEditor, FieldConfig } from '../form';
import { RelevantEvidenceEditor } from '../risk-assessment/RelevantEvidenceEditor';

export const ObservationEditor = ({ item, onSave, onClose, readOnly }) => {
  const [edited, setEdited] = useState(item || {});
  const updateField = (field, value) => setEdited(prev => ({ ...prev, [field]: value }));

  const methodOptions = [
    { value: 'EXAMINE', label: 'EXAMINE' },
    { value: 'INTERVIEW', label: 'INTERVIEW' },
    { value: 'TEST', label: 'TEST' }
  ];

  const fields: FieldConfig[] = [
    { path: 'title', type: 'text', label: 'Title' },
    { path: 'description', type: 'markdown', label: 'Description' },
    { path: 'methods', type: 'select', label: 'Methods', options: methodOptions, multiple: true },
    { path: 'collected', type: 'datetime', label: 'Collected Date' },
    { path: 'expires', type: 'datetime', label: 'Expires Date' }
  ];

  return (
    <EntityDetailPanel
      isOpen={!!item}
      onClose={onClose}
      title="Observation Editor"
      actions={!readOnly ? [{ label: 'Save Changes', variant: 'primary', onClick: () => onSave(edited) }] : undefined}
    >
      <div className="form-content">
        <EntityEditor
          entity={edited}
          onChange={setEdited}
          fields={fields}
          readOnly={readOnly}
        />
        
        <div style={{ marginBottom: '16px', marginTop: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Types (comma separated)</label>
          <input 
            type="text" 
            className="w-full border rounded p-2 dark:bg-gray-700"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: '4px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
            value={(edited.types || []).join(', ')} 
            onChange={e => updateField('types', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} 
            disabled={readOnly} 
          />
        </div>

        <div className="inline-editor-section" style={{ marginTop: '16px' }}>
           <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--color-border)', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>Subjects</h3>
           <textarea 
             placeholder="JSON representing subjects..." 
             className="w-full border rounded p-2 dark:bg-gray-700"
             style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: '4px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontFamily: 'monospace' }}
             value={JSON.stringify(edited.subjects || [], null, 2)} 
             onChange={e => {
               try { updateField('subjects', JSON.parse(e.target.value)) } catch(e){} 
             }} 
             disabled={readOnly} 
             rows={5}
           />
        </div>
        
        <div className="inline-editor-section" style={{ marginTop: '16px' }}>
           <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--color-border)', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>Relevant Evidence</h3>
           <RelevantEvidenceEditor 
             value={edited['relevant-evidence'] || []} 
             isEditMode={!readOnly} 
             onChange={newEv => updateField('relevant-evidence', newEv)} 
           />
        </div>
      </div>
    </EntityDetailPanel>
  );
};

