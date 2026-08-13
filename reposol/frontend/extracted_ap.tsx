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

function TermsAndConditionsEditor({ terms, onChange, readOnly }) {
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

function ActivityEditor({ activity, onChange, readOnly, onClose }) {
  const update = (changes) => onChange({ ...activity, ...changes });
  const methodProps = (activity.props || []).filter(p => p.name === 'method');
  const method = methodProps.length > 0 ? methodProps[0].value : '';

  const handleMethodChange = (newMethod) => {
    const otherProps = (activity.props || []).filter(p => p.name !== 'method');
    const newProps = newMethod ? [...otherProps, { name: 'method', value: newMethod }] : otherProps;
    update({ props: newProps });
  };

  const handleStepChange = (idx, newStep) => {
    const newSteps = [...(activity.steps || [])];
    newSteps[idx] = newStep;
    update({ steps: newSteps });
  };
  const handleAddStep = () => {
    const newSteps = [...(activity.steps || []), { uuid: generateUUID(), title: 'New Step', description: '' }];
    update({ steps: newSteps });
  };
  const handleRemoveStep = (idx) => {
    const newSteps = [...(activity.steps || [])];
    newSteps.splice(idx, 1);
    update({ steps: newSteps });
  };

  return (
    <div className={styles['custom-detail-panel']}>
      <div className={styles['panel-header']}>
        <h3>Activity Details</h3>
        <button className={styles['btn-close']} onClick={onClose}>&times;</button>
      </div>
      <div className={styles['panel-content']}>
        <div className={styles['form-group']}>
          <label>Title</label>
          <input className={styles['form-control']} value={activity.title || ''} onChange={e => update({ title: e.target.value })} disabled={readOnly} />
        </div>
        <div className={styles['form-group']}>
          <label>Description</label>
          <textarea className={styles['form-control']} value={activity.description || ''} onChange={e => update({ description: e.target.value })} disabled={readOnly} />
        </div>
        <div className={styles['form-group']}>
          <label>Method</label>
          <select className={styles['form-control']} value={method} onChange={e => handleMethodChange(e.target.value)} disabled={readOnly}>
            <option value="">None</option>
            <option value="INTERVIEW">INTERVIEW</option>
            <option value="EXAMINE">EXAMINE</option>
            <option value="TEST">TEST</option>
          </select>
        </div>
        <div className={styles['form-group']}>
          <label>Responsible Roles</label>
          <input className={styles['form-control']} placeholder="Comma separated role IDs" value={(activity['responsible-roles'] || []).map(r => r['role-id']).join(', ')} onChange={e => {
            const roles = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
            update({ 'responsible-roles': roles.map(r => ({ 'role-id': r })) });
          }} disabled={readOnly} />
        </div>
        <div className={styles['form-group']}>
          <label>Steps</label>
          <div className={styles['steps-list']}>
            {(activity.steps || []).map((step, i) => (
              <div key={step.uuid || i} className={styles['step-item']}>
                <input className={[styles['form-control'], styles['mb-2']].filter(Boolean).join(' ')} value={step.title || ''} onChange={e => handleStepChange(i, { ...step, title: e.target.value })} placeholder="Step Title" disabled={readOnly} />
                <textarea className={[styles['form-control'], styles['mb-2']].filter(Boolean).join(' ')} value={step.description || ''} onChange={e => handleStepChange(i, { ...step, description: e.target.value })} placeholder="Step Description" disabled={readOnly} />
                {!readOnly && <button className={styles['btn-remove']} onClick={() => handleRemoveStep(i)}>Remove Step</button>}
              </div>
            ))}
            {!readOnly && <button className={styles['btn-add-part']} onClick={handleAddStep}>+ Add Step</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

