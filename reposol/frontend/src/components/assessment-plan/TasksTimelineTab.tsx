import React, { useState, useMemo } from 'react';
import { AssessmentPlan, Task, LocalActivity, AssessmentSubject } from '../../lib/types/oscal';
import { DocumentAction } from '../../lib/document-actions/types';
import { addTask, updateTask, removeTask, addLocalActivity, updateLocalActivity, removeLocalActivity } from '../../lib/document-actions/assessment-plan-actions';
import { TaskEditorModal } from './TaskEditorModal';
import { ActivityEditorModal } from './ActivityEditorModal';

export interface TasksTimelineTabProps {
  document: AssessmentPlan;
  dispatch: (action: DocumentAction) => void;
  isEditing: boolean;
}

export const TasksTimelineTab: React.FC<TasksTimelineTabProps> = ({
  document: ap,
  dispatch,
  isEditing,
}) => {
  const tasks: Task[] = ap?.tasks || [];
  const localActivities: LocalActivity[] = ap?.['local-definitions']?.activities || [];
  const metadataRoles = ap?.metadata?.roles || [];
  const subjects: AssessmentSubject[] = ap?.['assessment-subjects'] || [];

  const [viewMode, setViewMode] = useState<'cards' | 'timeline'>('cards');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<LocalActivity | null>(null);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  const handleSaveActivity = (savedAct: LocalActivity) => {
    const exists = localActivities.some((a) => a.uuid === savedAct.uuid);
    if (exists) {
      dispatch(updateLocalActivity(savedAct.uuid, savedAct));
    } else {
      dispatch(addLocalActivity(savedAct));
    }
  };

  const handleSaveTask = (savedTask: Task) => {
    const exists = tasks.some((t) => t.uuid === savedTask.uuid);
    if (exists) {
      dispatch(updateTask(savedTask.uuid, savedTask));
    } else {
      dispatch(addTask(savedTask));
    }
  };

  const formatTiming = (timing: any): string => {
    if (!timing) return 'Unscheduled';
    if (timing['on-date']) {
      return `Date: ${timing['on-date'].date || '—'}`;
    }
    if (timing['within-date-range']) {
      return `${timing['within-date-range'].start || '?'} → ${timing['within-date-range'].end || '?'}`;
    }
    if (timing['at-frequency']) {
      return `Every ${timing['at-frequency'].period} ${timing['at-frequency'].unit}`;
    }
    return 'Unscheduled';
  };

  // Timeline date parsing for Gantt
  const timelineData = useMemo(() => {
    return tasks.map((t, idx) => {
      let start = new Date();
      let end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      let isMilestone = t.type === 'milestone';

      if (t.timing?.['on-date']?.date) {
        start = new Date(t.timing['on-date'].date);
        end = new Date(start);
      } else if (t.timing?.['within-date-range']) {
        if (t.timing['within-date-range'].start) {
          start = new Date(t.timing['within-date-range'].start);
        }
        if (t.timing['within-date-range'].end) {
          end = new Date(t.timing['within-date-range'].end);
        }
      }

      return {
        task: t,
        start,
        end,
        isMilestone,
        index: idx,
      };
    });
  }, [tasks]);

  return (
    <div className="space-y-6 p-6">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
        <div>
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <span>📋</span> Assessment Task Scheduler & Execution Timeline
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Defines scheduled audit activities, milestones, DAG dependencies, and timeline sequencing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Switcher */}
          <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'cards'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cards / List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📊 Interactive Gantt Timeline
            </button>
          </div>

          {isEditing && (
            <button
              type="button"
              onClick={() => {
                setSelectedTask(null);
                setIsTaskModalOpen(true);
              }}
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500 flex items-center gap-1.5"
            >
              <span>+</span> New Task
            </button>
          )}
        </div>
      </div>

      {viewMode === 'cards' ? (
        /* Task Cards List */
        <div className="space-y-3">
          <div className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <span>📋</span> Tasks
          </div>
          {tasks.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-500">
              No assessment tasks scheduled yet. Click "+ New Task" to schedule an audit activity or milestone.
            </div>
          ) : (
            tasks.map((task) => {
              const timingDisplay = formatTiming(task.timing);
              const isMilestone = task.type === 'milestone';
              const depCount = (task.dependencies || []).length;
              const actCount = (task['associated-activities'] || []).length;
              const assignedRoles = (task['responsible-roles'] || []).map((r) => r['role-id']);

              return (
                <div
                  key={task.uuid}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs space-y-3 hover:border-slate-700 transition-colors shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs ${
                          isMilestone ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-blue-950 text-blue-400 border border-blue-800'
                        }`}
                      >
                        {isMilestone ? '🚩' : '📋'}
                      </span>
                      <span
                        onClick={() => {
                          setSelectedTask(task);
                          setIsTaskModalOpen(true);
                        }}
                        className="font-semibold text-slate-100 text-sm cursor-pointer hover:underline"
                      >
                        {task.title}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          isMilestone
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-blue-950 text-blue-300 border border-blue-800'
                        }`}
                      >
                        {task.type || 'action'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTask(task);
                          setIsTaskModalOpen(true);
                        }}
                        className="rounded bg-slate-800 px-3 py-1 text-slate-300 hover:bg-slate-700"
                      >
                        {isEditing ? 'Edit Task' : 'View Details'}
                      </button>
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => dispatch(removeTask(task.uuid))}
                          className="rounded p-1 text-red-400 hover:bg-red-950/50 hover:text-red-300"
                          title="Delete Task"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {task.description && <p className="text-slate-400">{task.description}</p>}

                  {/* Task Meta Badges */}
                  <div className="flex flex-wrap items-center gap-3 border-t border-slate-900 pt-2.5 text-slate-400">
                    <div className="flex items-center gap-1 font-medium">
                      <span>⏱️</span>
                      <span className="text-slate-300">{timingDisplay}</span>
                    </div>

                    {depCount > 0 && (
                      <div className="flex items-center gap-1 rounded bg-slate-900 px-2 py-0.5 border border-slate-800 text-[11px] text-blue-300">
                        <span>🔗 Depends on:</span>
                        <span className="font-bold">{depCount} {depCount === 1 ? 'Task' : 'Tasks'}</span>
                      </div>
                    )}

                    {actCount > 0 && (
                      <div className="flex items-center gap-1 rounded bg-slate-900 px-2 py-0.5 border border-slate-800 text-[11px] text-purple-300">
                        <span>⚡ Activities:</span>
                        <span className="font-bold">{actCount}</span>
                      </div>
                    )}

                    {assignedRoles.length > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <span>👥 Roles:</span>
                        <span className="text-slate-300">{assignedRoles.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Activities Section */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4 mt-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <span>⚡</span>
                <span>Activities</span>
                <span className="text-xs text-slate-400">({localActivities.length})</span>
              </h4>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedActivity(null);
                    setIsActivityModalOpen(true);
                  }}
                  className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500"
                >
                  + New Activity
                </button>
              )}
            </div>

            {localActivities.length === 0 ? (
              <div className="text-xs text-slate-500">No activities defined yet.</div>
            ) : (
              <div className="space-y-2">
                {localActivities.map((act) => (
                  <div
                    key={act.uuid}
                    onClick={() => {
                      setSelectedActivity(act);
                      setIsActivityModalOpen(true);
                    }}
                    className="cursor-pointer rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs flex items-center justify-between hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{act.title || 'Untitled Activity'}</div>
                      {act.description && <div className="text-slate-400 mt-0.5">{act.description}</div>}
                    </div>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          dispatch(removeLocalActivity(act.uuid));
                        }}
                        className="rounded p-1 text-red-400 hover:bg-red-950/50 hover:text-red-300"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Visual Gantt Timeline View */
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <span>📊</span> Visual Gantt / Timeline Sequence
            </h4>
            <span className="text-xs text-slate-400">Milestones rendered as diamonds, actions as span bars</span>
          </div>

          {tasks.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">No tasks to display in timeline view.</div>
          ) : (
            <div className="space-y-4 pt-2">
              {timelineData.map(({ task, start, end, isMilestone, index }) => {
                const deps = task.dependencies || [];
                const acts = (task['associated-activities'] || []).length;
                return (
                  <div
                    key={task.uuid}
                    onClick={() => {
                      setSelectedTask(task);
                      setIsTaskModalOpen(true);
                    }}
                    className="cursor-pointer rounded-lg border border-slate-800 bg-slate-900/60 p-3 hover:border-blue-500/60 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {isMilestone ? (
                          <span className="text-amber-400 text-sm font-bold">◆</span>
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
                        )}
                        <span className="font-semibold text-slate-100">{task.title}</span>
                      </div>
                      <span className="text-slate-400 text-[11px] font-mono">
                        {start.toLocaleDateString()} {isMilestone ? '' : `→ ${end.toLocaleDateString()}`}
                      </span>
                    </div>

                    {/* Timeline bar representation */}
                    <div className="relative h-6 w-full rounded bg-slate-950 overflow-hidden border border-slate-800/80 flex items-center px-3">
                      {isMilestone ? (
                        <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-semibold">
                          <span>◆ Milestone Marker:</span>
                          <span className="text-slate-300 font-normal">{task.title}</span>
                        </div>
                      ) : (
                        <div className="h-4 rounded bg-gradient-to-r from-blue-600 to-indigo-600 w-full flex items-center px-2 text-[10px] text-white font-medium shadow-inner">
                          {task.title} {acts > 0 ? `(${acts} activities)` : ''}
                        </div>
                      )}
                    </div>

                    {deps.length > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <span className="text-blue-400">↳ Requires:</span>
                        {deps.map((d) => {
                          const match = tasks.find((t) => t.uuid === d['task-uuid']);
                          return (
                            <span key={d['task-uuid']} className="rounded bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-300">
                              {match?.title || d['task-uuid'].slice(0, 8)}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Task Editor Modal */}
      <TaskEditorModal
        isOpen={isTaskModalOpen}
        task={selectedTask}
        allTasks={tasks}
        availableActivities={localActivities}
        availableRoles={metadataRoles as any}
        availableSubjects={subjects}
        onSave={handleSaveTask}
        onClose={() => {
          setIsTaskModalOpen(false);
          setSelectedTask(null);
        }}
        readOnly={!isEditing}
      />

      {/* Activity Editor Modal */}
      <ActivityEditorModal
        isOpen={isActivityModalOpen}
        activity={selectedActivity}
        availableRoles={metadataRoles as any}
        availableSubjects={subjects}
        onSave={(savedAct) => {
          handleSaveActivity(savedAct);
          setIsActivityModalOpen(false);
          setSelectedActivity(null);
        }}
        onClose={() => {
          setIsActivityModalOpen(false);
          setSelectedActivity(null);
        }}
        readOnly={!isEditing}
      />
    </div>
  );
};
