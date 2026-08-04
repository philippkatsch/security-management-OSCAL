import React from 'react';
import './OscalEditors.css';
import StatusBadge from '../status/StatusBadge';
import { OriginsEditor } from './OriginsEditor';

export function RemediationsEditor({ value, isEditMode, onChange }) {
  const remediations = value || [];

  const updateRem = (index, updated) => {
    const next = [...remediations];
    next[index] = updated;
    onChange(next);
  };

  const addRem = () => {
    onChange([...remediations, { uuid: crypto.randomUUID(), lifecycle: 'recommendation', title: '', description: '', 'required-assets': [], tasks: [], origins: [] }]);
  };

  const removeRem = (index) => {
    const next = [...remediations];
    next.splice(index, 1);
    onChange(next);
  };

  if (!isEditMode) {
    if (remediations.length === 0) return <div className="read-only-val">No remediations</div>;
    return (
      <div className="oscal-editor-list">
        {remediations.map((rem, i) => (
          <div key={i} className="oscal-editor-item">
            <div className="oscal-editor-item-header">
              <span>{rem.title || 'Untitled'}</span>
              <StatusBadge status={rem.lifecycle || 'recommendation'} category="remediation-lifecycle" />
            </div>
            {rem.description && <div className="read-only-val">{rem.description}</div>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="oscal-editor-section">
      <div className="oscal-editor-list">
        {remediations.map((rem, i) => (
          <div key={i} className="oscal-editor-item">
            <div className="oscal-editor-item-header">
              <span>Remediation {i + 1}</span>
              <button className="btn-remove" onClick={() => removeRem(i)}>Remove</button>
            </div>
            
            <div className="oscal-editor-row">
              <input 
                type="text" 
                placeholder="Title" 
                value={rem.title || ''}
                onChange={e => updateRem(i, { ...rem, title: e.target.value })}
              />
              <select 
                value={rem.lifecycle || ''}
                onChange={e => updateRem(i, { ...rem, lifecycle: e.target.value })}
              >
                <option value="recommendation">Recommendation</option>
                <option value="planned">Planned</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <textarea 
              placeholder="Description" 
              value={rem.description || ''}
              onChange={e => updateRem(i, { ...rem, description: e.target.value })}
              rows={2}
            />

            <div className="oscal-editor-sublist">
              <h5>Origins</h5>
              <OriginsEditor 
                value={rem.origins || []} 
                isEditMode={true} 
                onChange={newOrigins => updateRem(i, { ...rem, origins: newOrigins })} 
              />
            </div>

            <div className="oscal-editor-sublist">
              <h5>Required Assets</h5>
              {(rem['required-assets'] || []).map((asset, j) => (
                <div key={j} className="oscal-editor-row">
                  <input 
                    type="text" 
                    placeholder="Asset UUID" 
                    value={asset.uuid || ''}
                    onChange={e => {
                      const newAssets = [...(rem['required-assets'] || [])];
                      newAssets[j] = { ...asset, uuid: e.target.value };
                      updateRem(i, { ...rem, 'required-assets': newAssets });
                    }}
                  />
                  <input 
                    type="text" 
                    placeholder="Description" 
                    value={asset.description || ''}
                    onChange={e => {
                      const newAssets = [...(rem['required-assets'] || [])];
                      newAssets[j] = { ...asset, description: e.target.value };
                      updateRem(i, { ...rem, 'required-assets': newAssets });
                    }}
                  />
                  <button className="btn-remove" onClick={() => {
                    const newAssets = [...(rem['required-assets'] || [])];
                    newAssets.splice(j, 1);
                    updateRem(i, { ...rem, 'required-assets': newAssets });
                  }}>X</button>
                </div>
              ))}
              <button className="btn-add" onClick={() => {
                const newAssets = [...(rem['required-assets'] || []), { uuid: '', description: '' }];
                updateRem(i, { ...rem, 'required-assets': newAssets });
              }}>+ Add Required Asset</button>
            </div>

            <div className="oscal-editor-sublist">
              <h5>Tasks (UUIDs)</h5>
              <div className="oscal-editor-tag-input">
                {(rem.tasks || []).map((t, j) => (
                  <span key={j} className="oscal-editor-tag">
                    {t['task-uuid']}
                    <button onClick={() => {
                      const next = [...(rem.tasks || [])];
                      next.splice(j, 1);
                      updateRem(i, { ...rem, tasks: next });
                    }}>×</button>
                  </span>
                ))}
                <input 
                  type="text" 
                  placeholder="Type UUID and press Enter" 
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      e.preventDefault();
                      const next = [...(rem.tasks || []), { 'task-uuid': e.target.value.trim() }];
                      updateRem(i, { ...rem, tasks: next });
                      e.target.value = '';
                    }
                  }}
                />
              </div>
            </div>

          </div>
        ))}
      </div>
      <button className="btn-add" onClick={addRem}>+ Add Remediation</button>
    </div>
  );
}
