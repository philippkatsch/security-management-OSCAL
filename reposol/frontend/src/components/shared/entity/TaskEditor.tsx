import React, { useState } from 'react';
import styles from './EntityTable.module.css';

export function TaskEditor({ task, onChange, readOnly, onClose }) {
  const update = (changes) => onChange({ ...task, ...changes });
  const timingType = task.timing?.['within-date-range'] ? 'range' :
                     task.timing?.['on-date'] ? 'date' :
                     task.timing?.['at-frequency'] ? 'frequency' : 'none';

  return (
    <div className="custom-detail-panel">
      <div className="panel-header">
        <h3>Task Details</h3>
        <button className={styles['btn-close']} onClick={onClose}>&times;</button>
      </div>
      <div className="panel-content">
        <div className="form-group">
          <label>Title</label>
          <input className="form-control" value={task.title || ''} onChange={e => update({ title: e.target.value })} disabled={readOnly} />
        </div>
        <div className="form-group">
          <label>Type</label>
          <select className="form-control" value={task.type || ''} onChange={e => update({ type: e.target.value })} disabled={readOnly}>
            <option value="milestone">Milestone</option>
            <option value="action">Action</option>
          </select>
        </div>
        <div className="form-group">
          <label>Timing</label>
          <select className="form-control" value={timingType} onChange={e => {
            const t = e.target.value;
            let newTiming = undefined;
            if (t === 'range') newTiming = { 'within-date-range': { start: '', end: '' } };
            if (t === 'date') newTiming = { 'on-date': { date: '' } };
            if (t === 'frequency') newTiming = { 'at-frequency': { period: 1, unit: 'days' } };
            update({ timing: newTiming });
          }} disabled={readOnly}>
            <option value="none">None</option>
            <option value="range">Date Range</option>
            <option value="date">Specific Date</option>
            <option value="frequency">Frequency</option>
          </select>
        </div>
        {timingType === 'range' && (
          <div className="timing-inputs">
            <input type="date" className="form-control mb-2" value={task.timing?.['within-date-range']?.start || ''} onChange={e => update({ timing: { ...task.timing, 'within-date-range': { ...task.timing?.['within-date-range'], start: e.target.value } } })} disabled={readOnly} />
            <input type="date" className="form-control" value={task.timing?.['within-date-range']?.end || ''} onChange={e => update({ timing: { ...task.timing, 'within-date-range': { ...task.timing?.['within-date-range'], end: e.target.value } } })} disabled={readOnly} />
          </div>
        )}
        {timingType === 'date' && (
          <input type="date" className="form-control" value={task.timing?.['on-date']?.date || ''} onChange={e => update({ timing: { 'on-date': { date: e.target.value } } })} disabled={readOnly} />
        )}
        {timingType === 'frequency' && (
          <div className="timing-inputs">
            <input type="number" className="form-control mb-2" value={task.timing?.['at-frequency']?.period || 1} onChange={e => update({ timing: { 'at-frequency': { ...task.timing?.['at-frequency'], period: parseInt(e.target.value, 10) } } })} disabled={readOnly} />
            <select className="form-control" value={task.timing?.['at-frequency']?.unit || 'days'} onChange={e => update({ timing: { 'at-frequency': { ...task.timing?.['at-frequency'], unit: e.target.value } } })} disabled={readOnly}>
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
              <option value="months">Months</option>
              <option value="years">Years</option>
            </select>
          </div>
        )}
        <div className="form-group">
          <label>Dependencies (Task UUIDs)</label>
          <input className="form-control" placeholder="Comma separated UUIDs" value={(task.dependencies || []).map(d => d['task-uuid']).join(', ')} onChange={e => {
            const uuids = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
            update({ dependencies: uuids.map(u => ({ 'task-uuid': u })) });
          }} disabled={readOnly} />
        </div>
        <div className="form-group">
          <label>Responsible Roles</label>
          <input className="form-control" placeholder="Comma separated role IDs" value={(task['responsible-roles'] || []).map(r => r['role-id']).join(', ')} onChange={e => {
            const roles = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
            update({ 'responsible-roles': roles.map(r => ({ 'role-id': r })) });
          }} disabled={readOnly} />
        </div>
      </div>
    </div>
  );
}
