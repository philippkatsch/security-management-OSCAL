import React from 'react';
import styles from '../../assessment-plan/APPage.module.css';

const generateUUID = () => crypto.randomUUID();

function PartNode({ part, onChange, onRemove, readOnly }) {
  const COMMON_PART_NAMES = ['rules-of-engagement', 'assumptions', 'methodology', 'disclosures', 'assessment-inclusions', 'assessment-exclusions'];
  const handleChildChange = (idx, newChild) => {
    const newParts = [...(part.parts || [])];
    newParts[idx] = newChild;
    onChange({ ...part, parts: newParts });
  };
  const handleAddChild = () => {
    const newParts = [...(part.parts || []), { id: generateUUID(), name: 'item', title: 'New Sub-part', prose: '' }];
    onChange({ ...part, parts: newParts });
  };
  const handleRemoveChild = (idx) => {
    const newParts = [...(part.parts || [])];
    newParts.splice(idx, 1);
    onChange({ ...part, parts: newParts });
  };

  return (
    <div className={styles['tc-part']}>
      <div className={styles['tc-part-header']}>
        <input 
          className={styles['tc-input']}
          value={part.title || ''} 
          onChange={e => onChange({ ...part, title: e.target.value })}
          readOnly={readOnly}
          placeholder="Part Title"
        />
        <select 
          className={styles['tc-select']}
          value={part.name || ''} 
          onChange={e => onChange({ ...part, name: e.target.value })}
          disabled={readOnly}
        >
          <option value="item">item</option>
          {COMMON_PART_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {!readOnly && <button className={styles['btn-remove']} onClick={onRemove}>Remove</button>}
      </div>
      <textarea 
        className={styles['tc-textarea']}
        value={part.prose || ''} 
        onChange={e => onChange({ ...part, prose: e.target.value })}
        readOnly={readOnly}
        placeholder="Prose (Markdown supported)..."
      />
      <div className={styles['tc-part-children']}>
        {(part.parts || []).map((child, i) => (
          <PartNode 
            key={child.id || i} 
            part={child} 
            onChange={(c) => handleChildChange(i, c)} 
            onRemove={() => handleRemoveChild(i)}
            readOnly={readOnly}
          />
        ))}
        {!readOnly && <button onClick={handleAddChild} className={styles['btn-add-child']}>+ Add Sub-part</button>}
      </div>
    </div>
  );
}

export function TermsAndConditionsEditor({ terms, onChange, readOnly }) {
  const parts = terms?.parts || [];
  
  const handlePartChange = (idx, newPart) => {
    const newParts = [...parts];
    newParts[idx] = newPart;
    onChange({ ...terms, parts: newParts });
  };
  
  const handleAddPart = () => {
    const newParts = [...parts, { id: generateUUID(), name: 'rules-of-engagement', title: 'New Rules', prose: '' }];
    onChange({ ...terms, parts: newParts });
  };

  const handleRemovePart = (idx) => {
    const newParts = [...parts];
    newParts.splice(idx, 1);
    onChange({ ...terms, parts: newParts });
  };

  return (
    <div className={styles['tc-editor']}>
      {parts.map((p, i) => (
        <PartNode 
          key={p.id || i} 
          part={p} 
          onChange={(newP) => handlePartChange(i, newP)} 
          onRemove={() => handleRemovePart(i)}
          readOnly={readOnly}
        />
      ))}
      {!readOnly && <button onClick={handleAddPart} className={styles['btn-add-part']}>+ Add Terms Part</button>}
    </div>
  );
}

