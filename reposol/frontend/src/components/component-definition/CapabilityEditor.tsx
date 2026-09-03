import React, { useState } from 'react';
import styles from './ComponentPage.module.css';
import sharedStyles from '@components/shared/SharedComponents.module.css';
import { PropsEditor } from '@components/shared/PropsEditor';

const Accordion = ({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className={styles['component-editor__section']}>
      <div 
        className={styles['component-editor__section-header']} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <h4 className={styles['section-title']}>{title}</h4>
        <span className={`${styles['chevron']} ${isOpen ? styles['open'] : ''}`}>▼</span>
      </div>
      {isOpen && <div className={styles['component-editor__section-content']}>{children}</div>}
    </div>
  );
};

export interface CapabilityEditorProps {
  capability: any;
  components?: any[];
  onUpdate?: (capability: any) => void;
  onClose?: () => void;
  editMode?: boolean;
}

export default function CapabilityEditor({ 
  capability, 
  components = [], 
  onUpdate = () => {}, 
  onClose, 
  editMode = false 
}: CapabilityEditorProps) {
  if (!capability) return null;

  const handleChange = (field: string, value: any) => {
    if (!editMode) return;
    onUpdate({ ...capability, [field]: value });
  };

  const addIncorporatedComponent = (componentUuid: string) => {
    if (!editMode || !componentUuid) return;
    const targetComp = (components as any[]).find((c: any) => c.uuid === componentUuid);
    const defaultDescription = targetComp?.description || targetComp?.title || 'Incorporated component';
    const newComps = [
      ...(capability['incorporates-components'] || []), 
      { 
        'component-uuid': componentUuid,
        description: defaultDescription
      }
    ];
    handleChange('incorporates-components', newComps);
  };

  const updateIncorporatedComponent = (index: number, field: string, value: any) => {
    if (!editMode) return;
    const newComps = [...(capability['incorporates-components'] || [])];
    newComps[index] = { ...newComps[index], [field]: value };
    handleChange('incorporates-components', newComps);
  };

  const removeIncorporatedComponent = (index: number) => {
    if (!editMode) return;
    const newComps = [...(capability['incorporates-components'] || [])];
    newComps.splice(index, 1);
    handleChange('incorporates-components', newComps);
  };

  const getComponentTitle = (uuid: string) => {
    const comp = (components as any[]).find((c: any) => c.uuid === uuid);
    return comp ? comp.title : uuid;
  };

  const incorporatedUuids = (capability['incorporates-components'] || []).map((c: any) => c['component-uuid']);
  const availableComponents = (components as any[]).filter((c: any) => !incorporatedUuids.includes(c.uuid));

  const addControlImplementation = () => {
    if (!editMode) return;
    const newImpls = [...(capability['control-implementations'] || []), { source: '', description: '', 'implemented-requirements': [] }];
    handleChange('control-implementations', newImpls);
  };

  return (
    <div className={`${styles['component-editor']} ${styles['capability-editor']}`}>
      <div className={styles['panel-body']}>
        
        {/* 1. Basic Info */}
        <Accordion title="Basic Info" defaultOpen={true}>
          <div className={styles['form-group']}>
            <label className="form-label">Name</label>
            <input 
              type="text" 
              className="form-input" 
              value={capability.name || ''} 
              onChange={(e) => handleChange('name', e.target.value)}
              disabled={!editMode}
            />
          </div>
          <div className={styles['form-group']}>
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
          <div className={styles['component-linker']}>
            {(capability['incorporates-components'] || []).length === 0 ? (
              <p className={styles['empty-state']}>No components linked to this capability</p>
            ) : (
              <ul className={styles['linked-components-list']}>
                {(capability['incorporates-components'] || []).map((inc: any, idx: number) => (
                  <li key={idx} className={styles['linked-component-item']}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', marginRight: '8px' }}>
                      <strong>{getComponentTitle(inc['component-uuid'])}</strong>
                      {editMode ? (
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Description of role in capability"
                          value={inc.description || ''}
                          onChange={(e) => updateIncorporatedComponent(idx, 'description', e.target.value)}
                        />
                      ) : (
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                          {inc.description || 'No description provided.'}
                        </span>
                      )}
                    </div>
                    {editMode && (
                      <button className={['btn', 'btn-danger', sharedStyles['btn-sm']].filter(Boolean).join(' ')} onClick={() => removeIncorporatedComponent(idx)}>Remove</button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {editMode && availableComponents.length > 0 && (
              <div className={styles['add-component-row']}>
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
          <div className={styles['control-impl-list']}>
            {(capability['control-implementations'] || []).map((impl: any, iIdx: number) => (
              <div key={iIdx} className={styles['impl-item']}>
                <div className={styles['form-group']}>
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
                <div className={styles['form-group']}>
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
                <div className={styles['reqs-header']}>
                  <h5>Implemented Requirements</h5>
                  <span className="badge badge-info">{(impl['implemented-requirements'] || []).length} reqs</span>
                </div>
                <div className={styles['impl-requirements-table']}>
                  {(impl['implemented-requirements'] || []).map((req: any, rIdx: number) => (
                    <div key={rIdx} className={styles['req-row']}>
                      <div className={styles['req-summary']}>
                        <strong>{req['control-id']}</strong>
                        <span className={styles['req-desc']}>{req.description?.substring(0, 50)}...</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {editMode && (
              <button className={['btn', sharedStyles['btn-primary'], sharedStyles['btn-sm']].filter(Boolean).join(' ')} onClick={addControlImplementation}>+ Add Control Implementation</button>
            )}
          </div>
        </Accordion>

        {/* 4. Properties */}
        <Accordion title="Properties">
          <PropsEditor 
            props={capability.props || []} 
            onChange={(props) => handleChange('props', props)}
            readOnly={!editMode}
          />
        </Accordion>

      </div>
    </div>
  );
}
