import React from 'react';
import './OscalEditors.css';
import { PropsEditor } from '../PropsEditor';

export function RelevantEvidenceEditor({ value, isEditMode, onChange }) {
  const evidence = value || [];

  const updateEv = (index, updated) => {
    const next = [...evidence];
    next[index] = updated;
    onChange(next);
  };

  const addEv = () => {
    onChange([...evidence, { href: '', description: '' }]);
  };

  const removeEv = (index) => {
    const next = [...evidence];
    next.splice(index, 1);
    onChange(next);
  };

  if (!isEditMode) {
    if (evidence.length === 0) return <div className="read-only-val">No relevant evidence</div>;
    return (
      <div className="oscal-editor-list">
        {evidence.map((ev, i) => (
          <div key={i} className="oscal-editor-item">
            <div className="oscal-editor-item-header">
              <a href={ev.href} target="_blank" rel="noreferrer">{ev.href || 'Unnamed Evidence'}</a>
            </div>
            {ev.description && <div className="read-only-val">{ev.description}</div>}
            {ev.remarks && <div className="read-only-val" style={{fontStyle: 'italic'}}>Remarks: {ev.remarks}</div>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="oscal-editor-section">
      <div className="oscal-editor-list">
        {evidence.map((ev, i) => (
          <div key={i} className="oscal-editor-item">
            <div className="oscal-editor-item-header">
              <span>Evidence {i + 1}</span>
              <button className="btn-remove" onClick={() => removeEv(i)}>Remove</button>
            </div>
            
            <input 
              type="text" 
              placeholder="HREF (URL to evidence)" 
              value={ev.href || ''}
              onChange={e => updateEv(i, { ...ev, href: e.target.value })}
            />
            
            <textarea 
              placeholder="Description" 
              value={ev.description || ''}
              onChange={e => updateEv(i, { ...ev, description: e.target.value })}
              rows={2}
            />

            <textarea 
              placeholder="Remarks (Optional)" 
              value={ev.remarks || ''}
              onChange={e => updateEv(i, { ...ev, remarks: e.target.value })}
              rows={2}
            />

            <div className="oscal-editor-sublist">
              <h5>Properties</h5>
              <PropsEditor 
                properties={ev.props || []} 
                isEditMode={true} 
                onChange={newProps => updateEv(i, { ...ev, props: newProps })} 
              />
            </div>
          </div>
        ))}
      </div>
      <button className="btn-add" onClick={addEv}>+ Add Relevant Evidence</button>
    </div>
  );
}
