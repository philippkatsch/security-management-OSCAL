import React, { useState } from 'react';
import { PropsEditor } from '../shared/PropsEditor';
import './ComponentEditor.css';

const Accordion = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="component-editor__section">
      <div 
        className="component-editor__section-header" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <h4 className="section-title">{title}</h4>
        <span className={`chevron ${isOpen ? 'open' : ''}`}>▼</span>
      </div>
      {isOpen && <div className="component-editor__section-content">{children}</div>}
    </div>
  );
};

export default function CapabilityEditor({ capability, components = [], onUpdate, onClose, editMode }) {
  if (!capability) return null;

  const handleChange = (field, value) => {
    if (!editMode) return;
    onUpdate({ ...capability, [field]: value });
  };

  const addIncorporatedComponent = (componentUuid) => {
    if (!editMode || !componentUuid) return;
    const newComps = [...(capability['incorporates-components'] || []), { 'component-uuid': componentUuid }];
    handleChange('incorporates-components', newComps);
  };

  const removeIncorporatedComponent = (index) => {
    if (!editMode) return;
    const newComps = [...(capability['incorporates-components'] || [])];
    newComps.splice(index, 1);
    handleChange('incorporates-components', newComps);
  };

  const getComponentTitle = (uuid) => {
    const comp = components.find(c => c.uuid === uuid);
    return comp ? comp.title : uuid;
  };

  const incorporatedUuids = (capability['incorporates-components'] || []).map(c => c['component-uuid']);
  const availableComponents = components.filter(c => !incorporatedUuids.includes(c.uuid));

  const addControlImplementation = () => {
    if (!editMode) return;
    const newImpls = [...(capability['control-implementations'] || []), { source: '', description: '', 'implemented-requirements': [] }];
    handleChange('control-implementations', newImpls);
  };

  return (
    <div className="component-editor capability-editor">
      <div className="panel-body">
        
        {/* 1. Basic Info */}
        <Accordion title="Basic Info" defaultOpen={true}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input 
              type="text" 
              className="form-input" 
              value={capability.name || ''} 
              onChange={(e) => handleChange('name', e.target.value)}
              disabled={!editMode}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea 
              className="form-textarea" 
              value={capability.description || ''} 
              onChange={(e) => handleChange('description', e.target.value)}
              disabled={!editMode}
            />
          </div>
        </Accordion>

        {/* 2. Incorporated Components */}
        <Accordion title="Incorporated Components">
          <div className="component-linker">
            {(capability['incorporates-components'] || []).length === 0 ? (
              <p className="empty-state">No components linked to this capability</p>
            ) : (
              <ul className="linked-components-list">
                {(capability['incorporates-components'] || []).map((inc, idx) => (
                  <li key={idx} className="linked-component-item">
                    <span>{getComponentTitle(inc['component-uuid'])}</span>
                    {editMode && (
                      <button className="btn btn-danger btn-sm" onClick={() => removeIncorporatedComponent(idx)}>Remove</button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {editMode && availableComponents.length > 0 && (
              <div className="add-component-row">
                <select 
                  className="form-input" 
                  onChange={(e) => {
                    addIncorporatedComponent(e.target.value);
                    e.target.value = ""; 
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Add Component...</option>
                  {availableComponents.map(c => (
                    <option key={c.uuid} value={c.uuid}>{c.title || c.uuid}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </Accordion>

        {/* 3. Control Implementations */}
        <Accordion title="Control Implementations">
          <div className="control-impl-list">
            {(capability['control-implementations'] || []).map((impl, iIdx) => (
              <div key={iIdx} className="impl-item">
                <div className="form-group">
                  <label>Source (Catalog/Profile URI)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={impl.source || ''} 
                    onChange={(e) => {
                      if (!editMode) return;
                      const newImpls = [...capability['control-implementations']];
                      newImpls[iIdx].source = e.target.value;
                      handleChange('control-implementations', newImpls);
                    }}
                    disabled={!editMode}
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea 
                    className="form-textarea" 
                    value={impl.description || ''} 
                    onChange={(e) => {
                      if (!editMode) return;
                      const newImpls = [...capability['control-implementations']];
                      newImpls[iIdx].description = e.target.value;
                      handleChange('control-implementations', newImpls);
                    }}
                    disabled={!editMode}
                  />
                </div>
                <div className="reqs-header">
                  <h5>Implemented Requirements</h5>
                  <span className="badge badge-info">{(impl['implemented-requirements'] || []).length} reqs</span>
                </div>
                <div className="impl-requirements-table">
                  {(impl['implemented-requirements'] || []).map((req, rIdx) => (
                    <div key={rIdx} className="req-row">
                      <div className="req-summary">
                        <strong>{req['control-id']}</strong>
                        <span className="req-desc">{req.description?.substring(0, 50)}...</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {editMode && (
              <button className="btn btn-primary btn-sm" onClick={addControlImplementation}>+ Add Control Implementation</button>
            )}
          </div>
        </Accordion>

        {/* 4. Properties */}
        <Accordion title="Properties">
          <PropsEditor 
            properties={capability.props || []} 
            onChange={(props) => handleChange('props', props)}
            editMode={editMode}
          />
        </Accordion>

      </div>
    </div>
  );
}
