import React, { useState } from 'react';
import EntityDetailPanel from '../entity/EntityDetailPanel';
import { PropsEditor } from '../PropsEditor';

export const ComponentEditor = ({ item, onSave, onClose, readOnly }) => {
  const [edited, setEdited] = useState(item);
  const updateField = (field, value) => setEdited(prev => ({ ...prev, [field]: value }));

  return (
    <EntityDetailPanel
      isOpen={!!item}
      onClose={onClose}
      title="Component Editor"
      actions={!readOnly ? [{ label: 'Save Changes', variant: 'primary', onClick: () => onSave(edited) }] : undefined}
    >
      <div className="form-content">
          <label>Title</label>
          <input type="text" value={edited.title || ''} onChange={e => updateField('title', e.target.value)} disabled={readOnly} />
          
          <label>Type</label>
          <input type="text" value={edited.type || ''} onChange={e => updateField('type', e.target.value)} disabled={readOnly} />
          
          <label>Description</label>
          <textarea value={edited.description || ''} onChange={e => updateField('description', e.target.value)} disabled={readOnly} />
          
          <label>Status (State)</label>
          <select value={edited.status?.state || ''} onChange={e => updateField('status', { state: e.target.value })} disabled={readOnly}>
            <option value="">Select...</option>
            <option value="operational">Operational</option>
            <option value="under-development">Under Development</option>
            <option value="under-major-modification">Under Major Modification</option>
            <option value="disposition">Disposition</option>
            <option value="other">Other</option>
          </select>

          <div className="inline-editor-section">
            <h3>Properties</h3>
            <PropsEditor props={edited.props || []} onChange={p => updateField('props', p)} readOnly={readOnly} />
          </div>
        </div>
    </EntityDetailPanel>
  );
};

export const InventoryItemEditor = ({ item, onSave, onClose, readOnly }) => {
  const [edited, setEdited] = useState(item);
  const updateField = (field, value) => setEdited(prev => ({ ...prev, [field]: value }));

  return (
    <EntityDetailPanel
      isOpen={!!item}
      onClose={onClose}
      title="Inventory Item Editor"
      actions={!readOnly ? [{ label: 'Save Changes', variant: 'primary', onClick: () => onSave(edited) }] : undefined}
    >
      <div className="form-content">
          <label>Description</label>
          <textarea value={edited.description || ''} onChange={e => updateField('description', e.target.value)} disabled={readOnly} />
          
          <label>Asset ID</label>
          <input type="text" value={edited['asset-id'] || ''} onChange={e => updateField('asset-id', e.target.value)} disabled={readOnly} />
          
          <div className="inline-editor-section">
            <h3>Properties</h3>
            <PropsEditor props={edited.props || []} onChange={p => updateField('props', p)} readOnly={readOnly} />
          </div>

          <div className="inline-editor-section">
             <h3>Implemented Components (JSON)</h3>
             <textarea placeholder="JSON representing implemented components..." value={JSON.stringify(edited['implemented-components'] || [], null, 2)} onChange={e => {
               try { updateField('implemented-components', JSON.parse(e.target.value)) } catch(e){} 
             }} disabled={readOnly} rows={5}/>
          </div>
        </div>
    </EntityDetailPanel>
  );
};

export const UserEditor = ({ item, onSave, onClose, readOnly }) => {
  const [edited, setEdited] = useState(item);
  const updateField = (field, value) => setEdited(prev => ({ ...prev, [field]: value }));

  return (
    <EntityDetailPanel
      isOpen={!!item}
      onClose={onClose}
      title="User Editor"
      actions={!readOnly ? [{ label: 'Save Changes', variant: 'primary', onClick: () => onSave(edited) }] : undefined}
    >
      <div className="form-content">
          <label>Title</label>
          <input type="text" value={edited.title || ''} onChange={e => updateField('title', e.target.value)} disabled={readOnly} />
          
          <label>Role IDs (comma separated)</label>
          <input type="text" value={(edited['role-ids'] || []).join(', ')} onChange={e => updateField('role-ids', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} disabled={readOnly} />
          
          <div className="inline-editor-section">
             <h3>Authorized Privileges (JSON)</h3>
             <textarea placeholder="JSON representing authorized privileges..." value={JSON.stringify(edited['authorized-privileges'] || [], null, 2)} onChange={e => {
               try { updateField('authorized-privileges', JSON.parse(e.target.value)) } catch(e){} 
             }} disabled={readOnly} rows={5}/>
          </div>
        </div>
    </EntityDetailPanel>
  );
};

