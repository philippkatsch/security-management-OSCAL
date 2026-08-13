import React from 'react';
import styles from './RiskAssessment.module.css';

export function OriginsEditor({ value, isEditMode, onChange }) {
  const origins = value || [];

  const updateOrigin = (index, updated) => {
    const next = [...origins];
    next[index] = updated;
    onChange(next);
  };

  const addOrigin = () => {
    onChange([...origins, { actors: [], 'related-tasks': [] }]);
  };

  const removeOrigin = (index) => {
    const next = [...origins];
    next.splice(index, 1);
    onChange(next);
  };

  if (!isEditMode) {
    if (origins.length === 0) return <div className={styles['read-only-val']}>No origins</div>;
    return (
      <div className={styles['oscal-editor-list']}>
        {origins.map((orig, i) => (
          <div key={i} className={styles['oscal-editor-item']}>
            {orig.actors?.length > 0 && (
              <div className={styles['oscal-editor-sublist']}>
                <h5>Actors</h5>
                {orig.actors.map((actor, j) => (
                  <div key={j} className={styles['read-only-val']}>
                    {actor.type}: {actor['actor-uuid']} {actor['role-id'] ? `(Role: ${actor['role-id']})` : ''}
                  </div>
                ))}
              </div>
            )}
            {orig['related-tasks']?.length > 0 && (
              <div className={styles['oscal-editor-sublist']}>
                <h5>Related Tasks</h5>
                <div className={styles['read-only-val']}>
                  {orig['related-tasks'].map(t => t['task-uuid']).join(', ')}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles['oscal-editor-section']}>
      <div className={styles['oscal-editor-list']}>
        {origins.map((orig, i) => (
          <div key={i} className={styles['oscal-editor-item']}>
            <div className={styles['oscal-editor-item-header']}>
              <span>Origin {i + 1}</span>
              <button className={styles['btn-remove']} onClick={() => removeOrigin(i)}>Remove</button>
            </div>
            
            <div className={styles['oscal-editor-sublist']}>
              <h5>Actors</h5>
              {(orig.actors || []).map((actor, j) => (
                <div key={j} className={styles['oscal-editor-row']}>
                  <select 
                    value={actor.type || ''} 
                    onChange={e => {
                      const newActors = [...(orig.actors || [])];
                      newActors[j] = { ...actor, type: e.target.value };
                      updateOrigin(i, { ...orig, actors: newActors });
                    }}
                  >
                    <option value="">Select Type</option>
                    <option value="tool">Tool</option>
                    <option value="assessment-platform">Platform</option>
                    <option value="party">Party</option>
                  </select>
                  <input 
                    type="text" 
                    placeholder="Actor UUID" 
                    value={actor['actor-uuid'] || ''}
                    onChange={e => {
                      const newActors = [...(orig.actors || [])];
                      newActors[j] = { ...actor, 'actor-uuid': e.target.value };
                      updateOrigin(i, { ...orig, actors: newActors });
                    }}
                  />
                  <input 
                    type="text" 
                    placeholder="Role ID (Optional)" 
                    value={actor['role-id'] || ''}
                    onChange={e => {
                      const newActors = [...(orig.actors || [])];
                      newActors[j] = { ...actor, 'role-id': e.target.value };
                      updateOrigin(i, { ...orig, actors: newActors });
                    }}
                  />
                  <button className={styles['btn-remove']} onClick={() => {
                    const newActors = [...(orig.actors || [])];
                    newActors.splice(j, 1);
                    updateOrigin(i, { ...orig, actors: newActors });
                  }}>X</button>
                </div>
              ))}
              <button className={styles['btn-add']} onClick={() => {
                const newActors = [...(orig.actors || []), { type: 'tool', 'actor-uuid': '' }];
                updateOrigin(i, { ...orig, actors: newActors });
              }}>+ Add Actor</button>
            </div>

            <div className={styles['oscal-editor-sublist']}>
              <h5>Related Tasks (UUIDs)</h5>
              <div className={styles['oscal-editor-tag-input']}>
                {(orig['related-tasks'] || []).map((t, j) => (
                  <span key={j} className={styles['oscal-editor-tag']}>
                    {t['task-uuid']}
                    <button onClick={() => {
                      const next = [...(orig['related-tasks'] || [])];
                      next.splice(j, 1);
                      updateOrigin(i, { ...orig, 'related-tasks': next });
                    }}>×</button>
                  </span>
                ))}
                <input 
                  type="text" 
                  placeholder="Type UUID and press Enter" 
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      e.preventDefault();
                      const next = [...(orig['related-tasks'] || []), { 'task-uuid': e.target.value.trim() }];
                      updateOrigin(i, { ...orig, 'related-tasks': next });
                      e.target.value = '';
                    }
                  }}
                />
              </div>
            </div>

          </div>
        ))}
      </div>
      <button className={styles['btn-add']} onClick={addOrigin}>+ Add Origin</button>
    </div>
  );
}
