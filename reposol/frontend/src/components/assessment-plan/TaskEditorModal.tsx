import React, { useState, useEffect } from 'react';
import {
  Task,
  TaskTiming,
  TaskDependency,
  AssociatedActivity,
  LocalActivity,
  AssessmentSubject,
  ResponsibleRole
} from '../../lib/types/oscal';
import { hasTaskCycle } from '../../lib/document-actions/assessment-plan-actions';
import { generateUUID } from '../../lib/oscal-utils';

export interface TaskEditorModalProps {
  isOpen: boolean;
  task: Partial<Task> | null;
  allTasks?: Task[];
  availableActivities?: LocalActivity[];
  availableRoles?: Array<{ id: string; title: string }>;
  availableSubjects?: AssessmentSubject[];
  onSave: (task: Task) => void;
  onClose: () => void;
  readOnly?: boolean;
}

export const TaskEditorModal: React.FC<TaskEditorModalProps> = ({
  isOpen,
  task,
  allTasks = [],
  availableActivities = [],
  availableRoles = [],
  availableSubjects = [],
  onSave,
  onClose,
  readOnly = false,
}) => {
  const isEditing = Boolean(task && (task.uuid || task.title));
  const [uuid, setUuid] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'action' | 'milestone'>('action');
  const [description, setDescription] = useState('');
  const [remarks, setRemarks] = useState('');

  // Timing state
  const [timingMode, setTimingMode] = useState<'none' | 'on-date' | 'within-date-range' | 'at-frequency'>('none');
  const [onDateVal, setOnDateVal] = useState('');
  const [startDateVal, setStartDateVal] = useState('');
  const [endDateVal, setEndDateVal] = useState('');
  const [freqPeriod, setFreqPeriod] = useState<number>(1);
  const [freqUnit, setFreqUnit] = useState<string>('days');

  // Dependencies state
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [depError, setDepError] = useState<string | null>(null);

  // Associated Activities
  const [selectedActivityUuids, setSelectedActivityUuids] = useState<string[]>([]);

  // Responsible roles
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  useEffect(() => {
    if (task) {
      const taskUuid = task.uuid || generateUUID();
      setUuid(taskUuid);
      setTitle(task.title || '');
      setType((task.type as 'action' | 'milestone') || 'action');
      setDescription(task.description || '');
      setRemarks(task.remarks || '');
      setDependencies(task.dependencies ? [...task.dependencies] : []);
      setDepError(null);

      // Associated activities
      const acts = (task['associated-activities'] || []).map((a) => a['activity-uuid']);
      setSelectedActivityUuids(acts);

      // Responsible roles
      const roles = (task['responsible-roles'] || []).map((r) => r['role-id']);
      setSelectedRoleIds(roles);

      // Parse timing
      if (task.timing?.['on-date']) {
        setTimingMode('on-date');
        setOnDateVal(task.timing['on-date'].date || '');
      } else if (task.timing?.['within-date-range']) {
        setTimingMode('within-date-range');
        setStartDateVal(task.timing['within-date-range'].start || '');
        setEndDateVal(task.timing['within-date-range'].end || '');
      } else if (task.timing?.['at-frequency']) {
        setTimingMode('at-frequency');
        setFreqPeriod(task.timing['at-frequency'].period || 1);
        setFreqUnit(task.timing['at-frequency'].unit || 'days');
      } else {
        setTimingMode('none');
      }
    } else {
      setUuid(generateUUID());
      setTitle('');
      setType('action');
      setDescription('');
      setRemarks('');
      setTimingMode('none');
      setOnDateVal('');
      setStartDateVal('');
      setEndDateVal('');
      setFreqPeriod(1);
      setFreqUnit('days');
      setDependencies([]);
      setSelectedActivityUuids([]);
      setSelectedRoleIds([]);
      setDepError(null);
    }
  }, [task, isOpen]);

  if (!isOpen) return null;

  // Prerequisite candidate tasks (exclude self)
  const candidateTasks = allTasks.filter((t) => t.uuid !== uuid);

  const handleToggleDependency = (targetTaskUuid: string) => {
    const exists = dependencies.some((d) => d['task-uuid'] === targetTaskUuid);
    if (exists) {
      setDependencies(dependencies.filter((d) => d['task-uuid'] !== targetTaskUuid));
      setDepError(null);
    } else {
      // Check for DAG cycle
      if (hasTaskCycle(allTasks, uuid, targetTaskUuid)) {
        const targetTask = allTasks.find((t) => t.uuid === targetTaskUuid);
        const name = targetTask?.title || targetTaskUuid;
        setDepError(`Circular dependency detected: Adding dependency on "${name}" creates a cycle.`);
        return;
      }
      setDependencies([...dependencies, { 'task-uuid': targetTaskUuid }]);
      setDepError(null);
    }
  };

  const handleToggleActivity = (actUuid: string) => {
    if (selectedActivityUuids.includes(actUuid)) {
      setSelectedActivityUuids(selectedActivityUuids.filter((id) => id !== actUuid));
    } else {
      setSelectedActivityUuids([...selectedActivityUuids, actUuid]);
    }
  };

  const handleToggleRole = (roleId: string) => {
    if (selectedRoleIds.includes(roleId)) {
      setSelectedRoleIds(selectedRoleIds.filter((r) => r !== roleId));
    } else {
      setSelectedRoleIds([...selectedRoleIds, roleId]);
    }
  };

  const ensureDateTimeWithTimezone = (dateStr: string): string => {
    const trimmed = (dateStr || '').trim();
    if (!trimmed) return '';
    if (!trimmed.includes('T')) {
      return `${trimmed}T00:00:00Z`;
    }
    if (!trimmed.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(trimmed)) {
      return `${trimmed}Z`;
    }
    return trimmed;
  };

  const handleSave = () => {
    if (!title.trim()) return;

    let timing: TaskTiming | undefined;
    if (timingMode === 'on-date' && onDateVal) {
      timing = {
        'on-date': { date: ensureDateTimeWithTimezone(onDateVal) },
      };
    } else if (timingMode === 'within-date-range' && (startDateVal || endDateVal)) {
      const rawStart = startDateVal || new Date().toISOString().split('T')[0];
      const rawEnd = endDateVal || startDateVal || new Date().toISOString().split('T')[0];
      timing = {
        'within-date-range': {
          start: ensureDateTimeWithTimezone(rawStart),
          end: ensureDateTimeWithTimezone(rawEnd),
        },
      };
    } else if (timingMode === 'at-frequency') {
      timing = {
        'at-frequency': {
          period: Math.max(1, freqPeriod),
          unit: freqUnit as any,
        },
      };
    }

    const associatedActivities: AssociatedActivity[] = selectedActivityUuids.map((actUuid) => ({
      'activity-uuid': actUuid,
      subjects: [{ type: 'component', 'include-all': {} }],
    }));

    const responsibleRoles: ResponsibleRole[] = selectedRoleIds.map((rId) => ({
      'role-id': rId,
    }));

    const finalTask: Task = {
      uuid: uuid || generateUUID(),
      title: title.trim(),
      type: type || 'action',
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
      ...(timing ? { timing } : {}),
      ...(dependencies.length > 0 ? { dependencies } : {}),
      ...(associatedActivities.length > 0 ? { 'associated-activities': associatedActivities } : {}),
      ...(responsibleRoles.length > 0 ? { 'responsible-roles': responsibleRoles } : {}),
    };

    onSave(finalTask);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-editor-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <span>{isEditing ? '✏️' : '➕'}</span>
            <span>{isEditing ? 'Task Details' : 'New Assessment Task'}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* General Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                Task Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={readOnly}
                placeholder="e.g. Vulnerability Scan & Static Code Analysis"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                Task Type *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'action' | 'milestone')}
                disabled={readOnly}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-60"
              >
                <option value="action">Action (Procedure / Test)</option>
                <option value="milestone">Milestone (Key Deliverable)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={readOnly}
              placeholder="Detailed description of what this task accomplishes and its evaluation goals..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-60"
            />
          </div>

          {/* Timing Section */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-200">⏱️ Execution Timing & Schedule</h4>
              <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
                {(['none', 'on-date', 'within-date-range', 'at-frequency'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => !readOnly && setTimingMode(mode)}
                    disabled={readOnly}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                      timingMode === mode
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mode === 'none' && 'No Timing'}
                    {mode === 'on-date' && 'Single Date'}
                    {mode === 'within-date-range' && 'Date Range'}
                    {mode === 'at-frequency' && 'Recurring'}
                  </button>
                ))}
              </div>
            </div>

            {timingMode === 'on-date' && (
              <div className="pt-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Execution Date (ISO Date / DateTime)
                </label>
                <input
                  type="date"
                  value={onDateVal ? onDateVal.split('T')[0] : ''}
                  onChange={(e) => setOnDateVal(e.target.value)}
                  disabled={readOnly}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-60"
                />
              </div>
            )}

            {timingMode === 'within-date-range' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDateVal ? startDateVal.split('T')[0] : ''}
                    onChange={(e) => setStartDateVal(e.target.value)}
                    disabled={readOnly}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDateVal ? endDateVal.split('T')[0] : ''}
                    onChange={(e) => setEndDateVal(e.target.value)}
                    disabled={readOnly}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-60"
                  />
                </div>
              </div>
            )}

            {timingMode === 'at-frequency' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Period (Count)</label>
                  <input
                    type="number"
                    min={1}
                    value={freqPeriod}
                    onChange={(e) => setFreqPeriod(parseInt(e.target.value, 10) || 1)}
                    disabled={readOnly}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Unit</label>
                  <select
                    value={freqUnit}
                    onChange={(e) => setFreqUnit(e.target.value)}
                    disabled={readOnly}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-60"
                  >
                    <option value="days">Days</option>
                    <option value="hours">Hours</option>
                    <option value="minutes">Minutes</option>
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Dependencies Section (DAG) */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-200">
                🔗 Prerequisite Dependencies ({dependencies.length})
              </h4>
              <span className="text-xs text-slate-400">Enforces DAG execution sequence</span>
            </div>

            {depError && (
              <div className="rounded-lg bg-red-950/50 p-2.5 text-xs text-red-400 border border-red-800 flex items-center gap-2">
                <span>⚠️</span>
                <span>{depError}</span>
              </div>
            )}

            {candidateTasks.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No other tasks available to depend on.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {candidateTasks.map((cand) => {
                  const isDep = dependencies.some((d) => d['task-uuid'] === cand.uuid);
                  return (
                    <label
                      key={cand.uuid}
                      className={`flex items-center gap-2.5 rounded-lg border p-2 text-xs transition-colors cursor-pointer ${
                        isDep
                          ? 'border-blue-500/60 bg-blue-950/20 text-slate-100'
                          : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isDep}
                        disabled={readOnly}
                        onChange={() => handleToggleDependency(cand.uuid)}
                        className="rounded border-slate-700 text-blue-600 focus:ring-0"
                      />
                      <span className="font-medium">{cand.title || 'Untitled Task'}</span>
                      <span className="text-slate-500">({cand.type || 'action'})</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Associated Activities */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-200">
              ⚡ Associated Procedural Activities ({selectedActivityUuids.length})
            </h4>
            {availableActivities.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                No procedural activities defined in Local Definitions yet.
              </p>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {availableActivities.map((act) => {
                  const isSelected = selectedActivityUuids.includes(act.uuid);
                  const methodProp = (act.props || []).find((p) => p.name === 'method')?.value;
                  return (
                    <label
                      key={act.uuid}
                      className={`flex items-center justify-between rounded-lg border p-2 text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-purple-500/60 bg-purple-950/20 text-slate-100'
                          : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={readOnly}
                          onChange={() => handleToggleActivity(act.uuid)}
                          className="rounded border-slate-700 text-purple-600 focus:ring-0"
                        />
                        <span className="font-medium">{act.title || act.description.slice(0, 40)}</span>
                      </div>
                      {methodProp && (
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-purple-300">
                          {methodProp}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Responsible Roles */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-200">
              👥 Assigned Responsible Roles ({selectedRoleIds.length})
            </h4>
            {availableRoles.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                No roles defined in Document Metadata yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableRoles.map((role) => {
                  const isSelected = selectedRoleIds.includes(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      disabled={readOnly}
                      onClick={() => handleToggleRole(role.id)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-950/40 text-blue-300'
                          : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {role.title || role.id} {isSelected && '✓'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700"
          >
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={handleSave}
              disabled={!title.trim()}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Task
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
