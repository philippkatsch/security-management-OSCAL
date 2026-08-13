import React, { useState } from 'react';
import EntityDetailPanel from '../entity/EntityDetailPanel';
import { PropsEditor } from '../PropsEditor';

export const FindingEditor = ({ item, onSave, onClose, readOnly }) => {
  const [edited, setEdited] = useState(item);
  const updateField = (field, value) => setEdited(prev => ({ ...prev, [field]: value }));

  const updateTargetField = (field, value) => {
    const target = { ...(edited.target || {}) };
    target[field] = value;
    updateField('target', target);
  };

  return (
    <EntityDetailPanel
      isOpen={!!item}
      onClose={onClose}
      title="Finding Editor"
      actions={!readOnly ? [{ label: 'Save Changes', variant: 'primary', onClick: () => onSave(edited) }] : undefined}
    >
      <div className="form-content">
          <label>Title</label>
          <input type="text" value={edited.title || ''} onChange={e => updateField('title', e.target.value)} disabled={readOnly} />
          
          <label>Description</label>
          <textarea value={edited.description || ''} onChange={e => updateField('description', e.target.value)} disabled={readOnly} />
          
          <div className="inline-editor-section">
            <h3>Target</h3>
            <label>Type</label>
            <input type="text" value={edited.target?.type || ''} onChange={e => updateTargetField('type', e.target.value)} disabled={readOnly} />
            <label>Target ID</label>
            <input type="text" value={edited.target?.['target-id'] || ''} onChange={e => updateTargetField('target-id', e.target.value)} disabled={readOnly} />
            <label>Status State</label>
            <select value={edited.target?.status?.state || ''} onChange={e => updateTargetField('status', { state: e.target.value })} disabled={readOnly}>
              <option value="">Select...</option>
              <option value="satisfied">Satisfied</option>
              <option value="not-satisfied">Not Satisfied</option>
            </select>
          </div>

          <label>Implementation Statement UUID</label>
          <input type="text" value={edited['implementation-statement-uuid'] || ''} onChange={e => updateField('implementation-statement-uuid', e.target.value)} disabled={readOnly} />

          <div className="inline-editor-section">
             <h3>Related Observations</h3>
             <textarea placeholder="JSON..." value={JSON.stringify(edited['related-observations'] || [], null, 2)} onChange={e => {
               try { updateField('related-observations', JSON.parse(e.target.value)) } catch(e){} 
             }} disabled={readOnly} rows={3}/>
          </div>
          <div className="inline-editor-section">
             <h3>Related Risks</h3>
             <textarea placeholder="JSON..." value={JSON.stringify(edited['related-risks'] || [], null, 2)} onChange={e => {
               try { updateField('related-risks', JSON.parse(e.target.value)) } catch(e){} 
             }} disabled={readOnly} rows={3}/>
          </div>
        </div>
    </EntityDetailPanel>
  );
};

