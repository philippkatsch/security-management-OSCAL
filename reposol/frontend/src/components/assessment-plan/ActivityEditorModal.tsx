import React, { useState, useEffect } from 'react';
import { LocalActivity, ActivityStep, ResponsibleRole, Property, AssessmentSubject } from '../../lib/types/oscal';
import { generateUUID } from '../../lib/oscal-utils';

export interface Role {
  id: string;
  title: string;
  description?: string;
}

export interface ActivityEditorModalProps {
  isOpen: boolean;
  activity: Partial<LocalActivity> | null;
  availableRoles?: Array<{ id: string; title: string }>;
  availableSubjects?: AssessmentSubject[];
  onSave: (activity: LocalActivity) => void;
  onClose: () => void;
  readOnly?: boolean;
}

export const ActivityEditorModal: React.FC<ActivityEditorModalProps> = ({
  isOpen,
  activity,
  availableRoles = [],
  onSave,
  onClose,
  readOnly = false,
}) => {
  const [uuid, setUuid] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [remarks, setRemarks] = useState('');
  const [method, setMethod] = useState<'INTERVIEW' | 'EXAMINE' | 'TEST'>('EXAMINE');
  const [steps, setSteps] = useState<ActivityStep[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  // Step adding sub-state
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepDesc, setNewStepDesc] = useState('');

  useEffect(() => {
    if (activity) {
      setUuid(activity.uuid || generateUUID());
      setTitle(activity.title || '');
      setDescription(activity.description || '');
      setRemarks(activity.remarks || '');
      setSteps(activity.steps ? [...activity.steps] : []);

      const methodProp = (activity.props || []).find((p) => p.name === 'method')?.value;
      if (methodProp && ['INTERVIEW', 'EXAMINE', 'TEST'].includes(methodProp)) {
        setMethod(methodProp as 'INTERVIEW' | 'EXAMINE' | 'TEST');
      } else {
        setMethod('EXAMINE');
      }

      const roles = (activity['responsible-roles'] || []).map((r) => r['role-id']);
      setSelectedRoleIds(roles);
    } else {
      setUuid(generateUUID());
      setTitle('');
      setDescription('');
      setRemarks('');
      setMethod('EXAMINE');
      setSteps([]);
      setSelectedRoleIds([]);
    }
    setNewStepTitle('');
    setNewStepDesc('');
  }, [activity, isOpen]);

  if (!isOpen) return null;

  const handleAddStep = () => {
    if (!newStepDesc.trim()) return;
    const newStep: ActivityStep = {
      uuid: generateUUID(),
      title: newStepTitle.trim() || `Step ${steps.length + 1}`,
      description: newStepDesc.trim(),
    };
    setSteps([...steps, newStep]);
    setNewStepTitle('');
    setNewStepDesc('');
  };

  const handleRemoveStep = (stepUuid: string) => {
    setSteps(steps.filter((s) => s.uuid !== stepUuid));
  };

  const handleMoveStep = (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= steps.length || toIndex >= steps.length) return;
    const nextSteps = [...steps];
    const [moved] = nextSteps.splice(fromIndex, 1);
    nextSteps.splice(toIndex, 0, moved);
    setSteps(nextSteps);
  };

  const handleToggleRole = (roleId: string) => {
    if (selectedRoleIds.includes(roleId)) {
      setSelectedRoleIds(selectedRoleIds.filter((r) => r !== roleId));
    } else {
      setSelectedRoleIds([...selectedRoleIds, roleId]);
    }
  };

  const handleSave = () => {
    if (!description.trim() && !title.trim()) return;

    const props: Property[] = [
      ...(activity?.props || []).filter((p) => p.name !== 'method'),
      { name: 'method', value: method },
    ];

    const responsibleRoles: ResponsibleRole[] = selectedRoleIds.map((rId) => ({
      'role-id': rId,
    }));

    const finalActivity: LocalActivity = {
      uuid: uuid || generateUUID(),
      title: title.trim() || undefined,
      description: description.trim() || title.trim() || 'Procedural Assessment Activity',
      props,
      ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
      ...(steps.length > 0 ? { steps } : {}),
      ...(responsibleRoles.length > 0 ? { 'responsible-roles': responsibleRoles } : {}),
    };

    onSave(finalActivity);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-editor-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <h3 id="activity-editor-title" className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <span>{activity ? 'Edit Assessment Activity' : 'New Assessment Activity'}</span>
              {activity && <span className="text-xs text-slate-400 font-normal">Activity Details</span>}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 text-lg leading-none"
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* General info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                Activity Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={readOnly}
                placeholder="e.g. Database Authentication & Audit Log Review"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                Evaluation Method *
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as 'INTERVIEW' | 'EXAMINE' | 'TEST')}
                disabled={readOnly}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none font-medium text-purple-300 disabled:opacity-60"
              >
                <option value="EXAMINE">EXAMINE (Inspection / Review)</option>
                <option value="INTERVIEW">INTERVIEW (Discussions / Inquiries)</option>
                <option value="TEST">TEST (Active Verification / Scans)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
              Description *
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={readOnly}
              placeholder="Detailed description of the procedural evaluation methodology..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-60"
            />
          </div>

          {/* Sequential Steps Section */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-200">
                🔢 Sequential Execution Steps ({steps.length})
              </h4>
              <span className="text-xs text-slate-400">Ordered execution procedure</span>
            </div>

            {steps.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">No sequential steps defined yet.</p>
            ) : (
              <div className="space-y-2">
                {steps.map((step, idx) => (
                  <div
                    key={step.uuid}
                    className="flex items-start justify-between rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-semibold text-slate-200">{step.title || `Step ${idx + 1}`}</div>
                        <div className="text-slate-400 mt-0.5">{step.description}</div>
                      </div>
                    </div>
                    {!readOnly && (
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => handleMoveStep(idx, idx - 1)}
                          disabled={idx === 0}
                          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
                          title="Move Up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveStep(idx, idx + 1)}
                          disabled={idx === steps.length - 1}
                          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
                          title="Move Down"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(step.uuid)}
                          className="rounded p-1 text-red-400 hover:bg-red-950/50 hover:text-red-300"
                          title="Delete Step"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!readOnly && (
              <div className="border-t border-slate-800/80 pt-3 space-y-2">
                <div className="text-xs font-semibold text-slate-300">Add New Step:</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Step Title (optional)"
                    value={newStepTitle}
                    onChange={(e) => setNewStepTitle(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Step Description *"
                    value={newStepDesc}
                    onChange={(e) => setNewStepDesc(e.target.value)}
                    className="md:col-span-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddStep}
                  disabled={!newStepDesc.trim()}
                  className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-40"
                >
                  + Append Step
                </button>
              </div>
            )}
          </div>

          {/* Responsible Roles */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-200">
              👥 Designated Executor Roles ({selectedRoleIds.length})
            </h4>
            {availableRoles.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No roles defined in Document Metadata yet.</p>
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
              disabled={!description.trim() && !title.trim()}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Activity
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
