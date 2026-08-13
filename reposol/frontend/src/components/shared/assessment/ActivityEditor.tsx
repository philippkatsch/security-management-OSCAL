import React from 'react';
import styles from '../../assessment-plan/APPage.module.css';

const generateUUID = () => crypto.randomUUID();

export function ActivityEditor({ activity, onChange, readOnly, onClose }) {
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

