import React, { useState, useEffect } from 'react';
import EntityDetailPanel from '../shared/entity/EntityDetailPanel';
import StatusBadge from '../shared/status/StatusBadge';
import { PropsEditor } from '../shared/PropsEditor';
import { OriginsEditor } from '../shared/risk-assessment/OriginsEditor';
import { EntityEditor, FieldConfig } from '../shared/form';
import styles from './POAMPage.module.css';

export function POAMItemsEditor({ item, onSave, onClose, readOnly, doc }) {
  const [edited, setEdited] = useState(item || {});

  useEffect(() => {
    if (item) setEdited(item);
  }, [item]);
  
  const updateField = (field, value) => setEdited(prev => ({ ...prev, [field]: value }));
  const updateProp = (name, value) => {
    const props = [...(edited.props || [])];
    const idx = props.findIndex(p => p.name === name);
    if (idx >= 0) props[idx].value = value;
    else props.push({ name, value });
    updateField('props', props);
  };
  const getProp = (name) => {
    const p = (edited.props || []).find(p => p.name === name);
    return p ? p.value : '';
  };
  
  const handleRelatedMultiSelect = (field, entityList, e) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map(o => o.value);
    const updated = selectedOptions.map(uuid => {
      if (field === 'related-findings') return { 'finding-uuid': uuid };
      if (field === 'related-risks') return { 'risk-uuid': uuid };
      if (field === 'related-observations') return { 'observation-uuid': uuid };
      return {};
    });
    updateField(field, updated);
  };
  
  const getSelected = (field) => {
    const arr = edited[field] || [];
    if (field === 'related-findings') return arr.map(a => a['finding-uuid']);
    if (field === 'related-risks') return arr.map(a => a['risk-uuid']);
    if (field === 'related-observations') return arr.map(a => a['observation-uuid']);
    return [];
  };

  const fields: FieldConfig[] = [
    { path: 'title', type: 'text', label: 'Title', required: true },
    { path: 'description', type: 'markdown', label: 'Description' },
    { path: 'remarks', type: 'markdown', label: 'Remarks' }
  ];

  return (
    <EntityDetailPanel
      isOpen={!!item}
      onClose={onClose}
      title="POA&M Item Editor"
      actions={!readOnly ? [{ label: 'Save Changes', variant: 'primary', onClick: () => onSave(edited) }] : undefined}
    >
      <div className="form-content space-y-4">
        <EntityEditor
          entity={edited}
          onChange={setEdited}
          fields={fields}
          readOnly={readOnly}
        />
        
        <div>
          <label className="block text-sm font-medium">Priority</label>
          <select className="w-full border rounded p-2 dark:bg-gray-700" value={getProp('priority')} onChange={e => updateProp('priority', e.target.value)} disabled={readOnly}>
            <option value="">Select Priority...</option>
            <option value="1">1 - Critical</option>
            <option value="2">2 - High</option>
            <option value="3">3 - Medium</option>
            <option value="4">4 - Low</option>
          </select>
          <div style={{marginTop: '8px'}}>
            {getProp('priority') && <StatusBadge status={"P"+getProp('priority')} category={getProp('priority') === '1' ? 'critical' : getProp('priority') === '2' ? 'high' : getProp('priority') === '3' ? 'medium' : 'low'} />}
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium">Related Observations</label>
          <select multiple value={getSelected('related-observations')} onChange={e => handleRelatedMultiSelect('related-observations', doc?.observations || [], e)} disabled={readOnly} className={`w-full border rounded p-2 dark:bg-gray-700 ${styles['multi-select']}`}>
            {(doc?.observations || []).map(o => <option key={o.uuid} value={o.uuid}>{o.title}</option>)}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium">Related Risks</label>
          <select multiple value={getSelected('related-risks')} onChange={e => handleRelatedMultiSelect('related-risks', doc?.risks || [], e)} disabled={readOnly} className={`w-full border rounded p-2 dark:bg-gray-700 ${styles['multi-select']}`}>
            {(doc?.risks || []).map(r => <option key={r.uuid} value={r.uuid}>{r.title}</option>)}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium">Related Findings</label>
          <select multiple value={getSelected('related-findings')} onChange={e => handleRelatedMultiSelect('related-findings', doc?.findings || [], e)} disabled={readOnly} className={`w-full border rounded p-2 dark:bg-gray-700 ${styles['multi-select']}`}>
            {(doc?.findings || []).map(f => <option key={f.uuid} value={f.uuid}>{f.title}</option>)}
          </select>
        </div>

        <div className={styles['inline-editor-section']}>
          <h3 className="font-semibold border-b pb-1 mb-2">Properties</h3>
          <PropsEditor props={edited.props || []} onChange={p => updateField('props', p)} isEditing={!readOnly} />
        </div>
        
        <div className={styles['inline-editor-section']}>
          <h3 className="font-semibold border-b pb-1 mb-2">Origins</h3>
          <OriginsEditor value={edited.origins || []} isEditMode={!readOnly} onChange={newOrigins => updateField('origins', newOrigins)} />
        </div>
      </div>
    </EntityDetailPanel>
  );
}
