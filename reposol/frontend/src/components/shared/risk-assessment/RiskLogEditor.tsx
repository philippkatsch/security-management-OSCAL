import React from 'react';
import styles from './RiskAssessment.module.css';
import StatusBadge from '../status/StatusBadge';

export function RiskLogEditor({ value, isEditMode, onChange }) {
  const riskLog = value || { entries: [] };
  const entries = [...(riskLog.entries || [])].sort((a, b) => new Date(a.start || 0) - new Date(b.start || 0));

  const updateEntry = (index, updated) => {
    const nextEntries = [...entries];
    nextEntries[index] = updated;
    onChange({ ...riskLog, entries: nextEntries });
  };

  const addEntry = () => {
    onChange({
      ...riskLog, 
      entries: [...entries, { uuid: crypto.randomUUID(), title: '', start: new Date().toISOString(), description: '' }]
    });
  };

  const removeEntry = (index) => {
    const nextEntries = [...entries];
    nextEntries.splice(index, 1);
    onChange({ ...riskLog, entries: nextEntries });
  };

  if (!isEditMode) {
    if (entries.length === 0) return <div className={styles['read-only-val']}>No risk log entries</div>;
    return (
      <div className={styles['timeline-container']}>
        {entries.map((entry, i) => (
          <div key={i} className={styles['timeline-card']}>
            <div className={styles['oscal-editor-item-header']}>
              <span>{entry.title || 'Untitled'}</span>
              {entry['status-change'] && <StatusBadge status={entry['status-change']} category="risk-status" />}
            </div>
            <div className={styles['read-only-val']} style={{ fontSize: '12px' }}>
              {new Date(entry.start).toLocaleString()} {entry.end ? `- ${new Date(entry.end).toLocaleString()}` : ''}
            </div>
            {entry.description && <div className={styles['read-only-val']}>{entry.description}</div>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles['oscal-editor-section']}>
      <div className={styles['timeline-container']}>
        {entries.map((entry, i) => (
          <div key={i} className={styles['timeline-card']}>
            <div className={styles['oscal-editor-item-header']}>
              <span>Entry {i + 1}</span>
              <button className={styles['btn-remove']} onClick={() => removeEntry(i)}>Remove</button>
            </div>
            
            <div className={styles['oscal-editor-row']}>
              <input 
                type="text" 
                placeholder="Title" 
                value={entry.title || ''}
                onChange={e => updateEntry(i, { ...entry, title: e.target.value })}
              />
              <select 
                value={entry['status-change'] || ''}
                onChange={e => updateEntry(i, { ...entry, 'status-change': e.target.value })}
              >
                <option value="">No Status Change</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="remediating">Remediating</option>
                <option value="deviation-requested">Deviation Requested</option>
                <option value="deviation-approved">Deviation Approved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className={styles['oscal-editor-row']}>
              <input 
                type="datetime-local" 
                value={(entry.start || '').slice(0, 16)}
                onChange={e => updateEntry(i, { ...entry, start: new Date(e.target.value).toISOString() })}
                title="Start Date"
              />
              <input 
                type="datetime-local" 
                value={(entry.end || '').slice(0, 16)}
                onChange={e => updateEntry(i, { ...entry, end: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                title="End Date (Optional)"
              />
            </div>

            <textarea 
              placeholder="Description" 
              value={entry.description || ''}
              onChange={e => updateEntry(i, { ...entry, description: e.target.value })}
              rows={2}
            />

            <div className={styles['oscal-editor-sublist']}>
              <h5>Related Responses (UUIDs)</h5>
              <div className={styles['oscal-editor-tag-input']}>
                {(entry['related-responses'] || []).map((r, j) => (
                  <span key={j} className={styles['oscal-editor-tag']}>
                    {r['response-uuid']}
                    <button onClick={() => {
                      const next = [...(entry['related-responses'] || [])];
                      next.splice(j, 1);
                      updateEntry(i, { ...entry, 'related-responses': next });
                    }}>×</button>
                  </span>
                ))}
                <input 
                  type="text" 
                  placeholder="Type UUID and press Enter" 
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      e.preventDefault();
                      const next = [...(entry['related-responses'] || []), { 'response-uuid': e.target.value.trim() }];
                      updateEntry(i, { ...entry, 'related-responses': next });
                      e.target.value = '';
                    }
                  }}
                />
              </div>
            </div>

          </div>
        ))}
      </div>
      <button className={styles['btn-add']} onClick={addEntry}>+ Add Log Entry</button>
    </div>
  );
}
