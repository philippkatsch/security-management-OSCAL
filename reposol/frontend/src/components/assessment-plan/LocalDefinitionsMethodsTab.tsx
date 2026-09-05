import React, { useState } from 'react';
import {
  AssessmentPlan,
  LocalDefinitions,
  LocalObjective,
  LocalActivity,
  SystemComponent,
  SystemUser,
  InventoryItem
} from '../../lib/types/oscal';
import { DocumentAction } from '../../lib/document-actions/types';
import {
  addLocalComponent,
  removeLocalComponent,
  addLocalUser,
  removeLocalUser,
  addLocalInventoryItem,
  removeLocalInventoryItem,
  addLocalObjective,
  removeLocalObjective,
  addLocalActivity,
  updateLocalActivity,
  removeLocalActivity
} from '../../lib/document-actions/assessment-plan-actions';
import { generateUUID } from '../../lib/oscal-utils';
import { ActivityEditorModal } from './ActivityEditorModal';

export interface LocalDefinitionsMethodsTabProps {
  document: AssessmentPlan;
  dispatch: (action: DocumentAction) => void;
  isEditing: boolean;
}

export const LocalDefinitionsMethodsTab: React.FC<LocalDefinitionsMethodsTabProps> = ({
  document: ap,
  dispatch,
  isEditing,
}) => {
  const localDefs: LocalDefinitions = ap?.['local-definitions'] || {};
  const components = localDefs.components || [];
  const users = localDefs.users || [];
  const inventoryItems = localDefs['inventory-items'] || [];
  const objectives = localDefs['objectives-and-methods'] || [];
  const activities = localDefs.activities || [];
  const metadataRoles = ap?.metadata?.roles || [];

  const [activeSubTab, setActiveSubTab] = useState<'objectives' | 'activities' | 'entities'>('objectives');

  // Activity Modal State
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<LocalActivity | null>(null);

  // New Objective form state
  const [newControlId, setNewControlId] = useState('');
  const [newObjDesc, setNewObjDesc] = useState('');
  const [newObjMethod, setNewObjMethod] = useState<'INTERVIEW' | 'EXAMINE' | 'TEST'>('EXAMINE');
  const [newObjObjects, setNewObjObjects] = useState('');

  // New Local Component form state
  const [newCompTitle, setNewCompTitle] = useState('');
  const [newCompType, setNewCompType] = useState('software');

  // New Local User form state
  const [newUserTitle, setNewUserTitle] = useState('');
  const [newUserRole, setNewUserRole] = useState('auditor');

  const handleAddObjective = () => {
    const cid = newControlId.trim().toLowerCase();
    if (!cid) return;

    // Note: NIST OSCAL schema local-objective does not allow a top-level 'uuid' property.
    // control-id is used as the unique key.
    const newObj: LocalObjective = {
      'control-id': cid,
      description: newObjDesc.trim() || `Evaluation objective for control ${cid.toUpperCase()}`,
      parts: [
        {
          name: 'assessment-objective',
          prose: newObjDesc.trim() || `Verify implementation compliance for ${cid.toUpperCase()}.`,
          props: [{ name: 'method-id', value: `${cid}-method-1` }],
        },
        {
          name: 'assessment-method',
          props: [{ name: 'method', value: newObjMethod }],
          parts: [
            {
              name: 'assessment-objects',
              prose: newObjObjects.trim() || 'System configuration artifacts, audit logs, and operational documentation.',
            },
          ],
        },
      ],
    };

    dispatch(addLocalObjective(newObj));
    setNewControlId('');
    setNewObjDesc('');
    setNewObjObjects('');
  };
  const handleSaveObjective = handleAddObjective;

  const handleSaveActivity = (activity: LocalActivity) => {
    const exists = activities.some((a) => a.uuid === activity.uuid);
    if (exists) {
      dispatch(updateLocalActivity(activity.uuid, activity));
    } else {
      dispatch(addLocalActivity(activity));
    }
  };

  const handleAddLocalComponent = () => {
    if (newCompTitle.trim()) {
      dispatch(
        addLocalComponent({
          uuid: generateUUID(),
          title: newCompTitle.trim(),
          type: newCompType,
          status: { state: 'operational' },
        })
      );
      setNewCompTitle('');
    }
  };

  const handleAddLocalUser = () => {
    if (newUserTitle.trim()) {
      dispatch(
        addLocalUser({
          uuid: generateUUID(),
          title: newUserTitle.trim(),
          'role-ids': newUserRole.trim() ? [newUserRole.trim()] : ['auditor'],
        })
      );
      setNewUserTitle('');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <span className="sr-only">Components</span>
      {/* Sub-tab Navigation */}
      <div className="flex rounded-xl border border-slate-800 bg-slate-900/60 p-1.5">
        <button
          type="button"
          onClick={() => setActiveSubTab('objectives')}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
            activeSubTab === 'objectives'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          🎯 Objectives & Methods ({objectives.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('activities')}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
            activeSubTab === 'activities'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ⚡ Procedural Activities ({activities.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('entities')}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
            activeSubTab === 'entities'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          📦 Local Components & Users ({components.length + users.length})
        </button>
      </div>

      {activeSubTab === 'objectives' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <span>🎯</span> Assessment Objectives & Methodologies
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Defines NIST SP 800-53A assessment objectives linked to controls with strict method enums (<code>INTERVIEW</code>, <code>EXAMINE</code>, <code>TEST</code>).
              </p>
            </div>

            {/* Objectives List */}
            {objectives.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-6 text-center text-xs text-slate-500">
                No local objectives defined yet. Create one below to bind evaluation methods to in-scope controls.
              </div>
            ) : (
              <div className="space-y-3">
                {objectives.map((obj, idx) => {
                  const methodPart = (obj.parts || []).find((p) => p.name === 'assessment-method');
                  const methodVal = methodPart?.props?.find((pr) => pr.name === 'method')?.value || 'EXAMINE';
                  const objectsPart = methodPart?.parts?.find((p) => p.name === 'assessment-objects');
                  const objectivePart = (obj.parts || []).find((p) => p.name === 'assessment-objective');

                  return (
                    <div
                      key={obj['control-id'] || `objective-${idx}`}
                      className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-blue-950 px-2 py-0.5 font-mono text-xs font-bold uppercase text-blue-400 border border-blue-800">
                            {obj['control-id']}
                          </span>
                          <span className="font-semibold text-slate-200">{obj.description}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-purple-950 border border-purple-800 px-2 py-0.5 text-[11px] font-bold text-purple-300 uppercase">
                            Method: {methodVal}
                          </span>
                          {isEditing && (
                            <button
                              type="button"
                              onClick={() => dispatch(removeLocalObjective(obj['control-id']))}
                              className="rounded p-1 text-red-400 hover:bg-red-950/50 hover:text-red-300"
                              title="Delete Objective"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      {objectivePart?.prose && (
                        <div className="text-slate-300">
                          <strong className="text-slate-400">Objective:</strong> {objectivePart.prose}
                        </div>
                      )}

                      {objectsPart?.prose && (
                        <div className="rounded bg-slate-900/60 p-2.5 text-slate-400 border border-slate-900">
                          <strong className="text-slate-300">Assessment Objects:</strong> {objectsPart.prose}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Objective Form */}
            {isEditing && (
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 space-y-3">
                <div className="text-xs font-semibold text-slate-300">Define New Control Objective:</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Control ID (e.g. ac-2) *
                    </label>
                    <input
                      type="text"
                      placeholder="ac-2"
                      value={newControlId}
                      onChange={(e) => setNewControlId(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Evaluation Method Enum *
                    </label>
                    <select
                      value={newObjMethod}
                      onChange={(e) => setNewObjMethod(e.target.value as 'INTERVIEW' | 'EXAMINE' | 'TEST')}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-purple-300 font-medium focus:border-blue-500 focus:outline-none"
                    >
                      <option value="EXAMINE">EXAMINE (Inspection of Config/Logs)</option>
                      <option value="INTERVIEW">INTERVIEW (Staff Discussions)</option>
                      <option value="TEST">TEST (Active Functional Verification)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Assessment Objects (Artifacts)
                    </label>
                    <input
                      type="text"
                      placeholder="System docs, SIEM logs..."
                      value={newObjObjects}
                      onChange={(e) => setNewObjObjects(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Objective Description / Prose
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Verify that account management procedures enforce least privilege..."
                    value={newObjDesc}
                    onChange={(e) => setNewObjDesc(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveObjective}
                    disabled={!newControlId.trim()}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
                  >
                    + Add Objective & Method
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'activities' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <span>⚡</span> Reusable Procedural Activities ({activities.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ordered procedural execution steps linked into scheduled assessment tasks in Tab 5.
                </p>
              </div>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingActivity(null);
                    setIsActivityModalOpen(true);
                  }}
                  className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                >
                  + New Activity
                </button>
              )}
            </div>

            {/* Activities List */}
            {activities.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-6 text-center text-xs text-slate-500">
                No procedural activities defined yet. Click "+ New Activity" to build step sequences.
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((act) => {
                  const methodProp = (act.props || []).find((p) => p.name === 'method')?.value;
                  const stepCount = (act.steps || []).length;
                  const assignedRoles = (act['responsible-roles'] || []).map((r) => r['role-id']);

                  return (
                    <div
                      key={act.uuid}
                      className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs space-y-2 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-100 text-sm">
                            {act.title || act.description.slice(0, 40)}
                          </span>
                          {methodProp && (
                            <span className="rounded bg-purple-950 border border-purple-800 px-2 py-0.5 text-[10px] font-bold text-purple-300 uppercase">
                              {methodProp}
                            </span>
                          )}
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                            {stepCount} {stepCount === 1 ? 'Step' : 'Steps'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingActivity(act);
                              setIsActivityModalOpen(true);
                            }}
                            className="rounded bg-slate-800 px-2.5 py-1 text-slate-300 hover:bg-slate-700"
                          >
                            {isEditing ? 'Edit Activity' : 'View Details'}
                          </button>
                          {isEditing && (
                            <button
                              type="button"
                              onClick={() => dispatch(removeLocalActivity(act.uuid))}
                              className="rounded p-1 text-red-400 hover:bg-red-950/50 hover:text-red-300"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-slate-400">{act.description}</p>

                      {assignedRoles.length > 0 && (
                        <div className="text-[11px] text-slate-500">
                          Designated Roles: <span className="text-slate-300">{assignedRoles.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'entities' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Local Components */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>💻</span> Components ({components.length})
              </h3>
            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {components.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">No local components defined.</p>
              ) : (
                components.map((c) => (
                  <div
                    key={c.uuid}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-200">{c.title}</span>
                      <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 capitalize">
                        {c.type}
                      </span>
                    </div>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => dispatch(removeLocalComponent(c.uuid))}
                        className="rounded p-1 text-red-400 hover:bg-red-950/50 hover:text-red-300"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {isEditing && (
              <div className="flex gap-2 pt-2 border-t border-slate-800/60">
                <input
                  type="text"
                  placeholder="Component Title"
                  value={newCompTitle}
                  onChange={(e) => setNewCompTitle(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddLocalComponent}
                  disabled={!newCompTitle.trim()}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
                >
                  Add Component
                </button>
              </div>
            )}
          </div>

          {/* Local Users */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span>👤</span> Local Assessment Users ({users.length})
            </h3>
            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {users.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">No local users defined.</p>
              ) : (
                users.map((u) => (
                  <div
                    key={u.uuid}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-200">{u.title}</span>
                      <span className="ml-2 text-slate-500">({(u['role-ids'] || []).join(', ')})</span>
                    </div>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => dispatch(removeLocalUser(u.uuid))}
                        className="rounded p-1 text-red-400 hover:bg-red-950/50 hover:text-red-300"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {isEditing && (
              <div className="flex gap-2 pt-2 border-t border-slate-800/60">
                <input
                  type="text"
                  placeholder="User Full Name / Account"
                  value={newUserTitle}
                  onChange={(e) => setNewUserTitle(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddLocalUser}
                  disabled={!newUserTitle.trim()}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
                >
                  Add User
                </button>
              </div>
            )}
          </div>

          {/* Inventory Items */}
          {(ap?.['local-definitions']?.['inventory-items'] || []).length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 col-span-1 lg:col-span-2">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>📦</span> Inventory Items ({(ap?.['local-definitions']?.['inventory-items'] || []).length})
              </h3>
              <div className="space-y-2">
                {(ap?.['local-definitions']?.['inventory-items'] || []).map((inv: any) => (
                  <div key={inv.uuid} className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-200">
                    {inv.description || inv.uuid}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Defined Local Entities Overview */}
      {(components.length > 0 || inventoryItems.length > 0 || users.length > 0) && activeSubTab !== 'entities' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase text-slate-400">Locally Defined Entities</h4>
            <button
              type="button"
              onClick={() => setActiveSubTab('entities')}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              View All Entities →
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {components.map((c) => (
              <span key={c.uuid} className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200">
                {c.title}
              </span>
            ))}
            {inventoryItems.map((inv) => (
              <span key={inv.uuid} className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200">
                {inv.description}
              </span>
            ))}
            {users.map((u) => (
              <span key={u.uuid} className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200">
                {u.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Activity Editor Modal */}
      <ActivityEditorModal
        isOpen={isActivityModalOpen}
        activity={editingActivity}
        availableRoles={metadataRoles as any}
        onSave={handleSaveActivity}
        onClose={() => {
          setIsActivityModalOpen(false);
          setEditingActivity(null);
        }}
        readOnly={!isEditing}
      />
    </div>
  );
};
