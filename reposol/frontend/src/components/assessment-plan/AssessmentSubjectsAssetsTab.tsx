import React, { useState, useEffect } from 'react';
import {
  AssessmentPlan,
  AssessmentSubject,
  AssessmentSubjectType,
  AssessmentPlatform,
  SystemComponent,
  SelectSubjectById
} from '../../lib/types/oscal';
import { DocumentAction } from '../../lib/document-actions/types';
import {
  addAssessmentSubject,
  removeAssessmentSubject,
  addSubjectReference,
  removeSubjectReference,
  addAssessmentSubjectPlaceholder,
  removeAssessmentSubjectPlaceholder,
  addAssetComponent,
  removeAssetComponent,
  addAssessmentPlatform,
  removeAssessmentPlatform,
  addPlatformComponent,
  removePlatformComponent
} from '../../lib/document-actions/assessment-plan-actions';
import { generateUUID } from '../../lib/oscal-utils';
import { fetchDocument } from '../../lib/api';

export interface AssessmentSubjectsAssetsTabProps {
  document: AssessmentPlan;
  dispatch: (action: DocumentAction) => void;
  isEditing: boolean;
  initialSection?: 'subjects' | 'assets';
}

const SUBJECT_TYPES: AssessmentSubjectType[] = [
  'component',
  'inventory-item',
  'location',
  'party',
  'user',
];

export const AssessmentSubjectsAssetsTab: React.FC<AssessmentSubjectsAssetsTabProps> = ({
  document: ap,
  dispatch,
  isEditing,
  initialSection = 'subjects',
}) => {
  const subjects = ap?.['assessment-subjects'] || [];
  const assets: any = ap?.['assessment-assets'] || {};
  const assetComponents = assets.components || [];
  const assetPlatforms = assets['assessment-platforms'] || [];

  const [activeSection, setActiveSection] = useState<'subjects' | 'assets'>(initialSection);
  const [selectedSubject, setSelectedSubject] = useState<AssessmentSubject | null>(null);

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  // New subject form
  const [newSubjType, setNewSubjType] = useState<AssessmentSubjectType>('component');
  const [newSubjDesc, setNewSubjDesc] = useState('');
  const [newSubjIncludeAll, setNewSubjIncludeAll] = useState(true);

  // New asset component form
  const [newToolTitle, setNewToolTitle] = useState('');
  const [newToolType, setNewToolType] = useState('software');
  const [newToolDesc, setNewToolDesc] = useState('');

  // New platform form
  const [newPlatTitle, setNewPlatTitle] = useState('');

  // SSP Resolved items for subject linking
  const [sspEntities, setSspEntities] = useState<{
    components: Array<{ uuid: string; title: string }>;
    inventory: Array<{ uuid: string; description: string }>;
    users: Array<{ uuid: string; title: string }>;
  }>({ components: [], inventory: [], users: [] });

  useEffect(() => {
    const sspHref = ap?.['import-ssp']?.href;
    const uuidMatch = sspHref?.match(/([0-9a-fA-F-]{36})/);
    if (uuidMatch) {
      fetchDocument('ssps', uuidMatch[1])
        .then((doc: any) => {
          const ssp = doc?.['system-security-plan'] || doc;
          const comps = (ssp?.['system-implementation']?.components || []).map((c: any) => ({
            uuid: c.uuid,
            title: c.title || 'Component',
          }));
          const invs = (ssp?.['system-implementation']?.['inventory-items'] || []).map((i: any) => ({
            uuid: i.uuid,
            description: i.description || 'Inventory Item',
          }));
          const usrs = (ssp?.['system-implementation']?.users || []).map((u: any) => ({
            uuid: u.uuid,
            title: u.title || 'User',
          }));
          setSspEntities({ components: comps, inventory: invs, users: usrs });
        })
        .catch(() => {});
    }
  }, [ap?.['import-ssp']?.href]);

  const handleAutoPopulateSubjects = () => {
    if (sspEntities.components.length > 0) {
      dispatch(
        addAssessmentSubject({
          type: 'component',
          description: 'All Target SSP System Components',
          includeAll: true,
        })
      );
    }
    if (sspEntities.inventory.length > 0) {
      dispatch(
        addAssessmentSubject({
          type: 'inventory-item',
          description: 'All Target SSP Inventory Items',
          includeAll: true,
        })
      );
    }
    if (sspEntities.users.length > 0) {
      dispatch(
        addAssessmentSubject({
          type: 'user',
          description: 'All Target SSP System Users',
          includeAll: true,
        })
      );
    }
  };

  const handleAddSubject = () => {
    dispatch(
      addAssessmentSubject({
        type: newSubjType,
        description: newSubjDesc.trim() || undefined,
        includeAll: newSubjIncludeAll,
      })
    );
    setNewSubjDesc('');
  };

  const handleAddTool = () => {
    if (newToolTitle.trim()) {
      dispatch(
        addAssetComponent({
          uuid: generateUUID(),
          title: newToolTitle.trim(),
          type: newToolType,
          description: newToolDesc.trim() || 'Assessment testing software / tool',
          status: { state: 'operational' },
        })
      );
      setNewToolTitle('');
      setNewToolDesc('');
    }
  };

  const handleAddPlatform = () => {
    if (newPlatTitle.trim()) {
      dispatch(
        addAssessmentPlatform({
          uuid: generateUUID(),
          title: newPlatTitle.trim(),
          'uses-components': [],
        })
      );
      setNewPlatTitle('');
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Top Toggle */}
      <div className="flex rounded-xl border border-slate-800 bg-slate-900/60 p-1.5">
        <button
          type="button"
          onClick={() => setActiveSection('subjects')}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
            activeSection === 'subjects'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          🎯 Assessment Subjects Scope ({subjects.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('assets')}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
            activeSection === 'assets'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          🏷️ Assessment Assets & Platforms ({assetPlatforms.length})
        </button>
      </div>

      {activeSection === 'subjects' ? (
        <div className="space-y-6">
          {/* Subjects Header & Actions */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <span>🎯</span> Assessment Subjects
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Physical and logical entities undergoing audit evaluation (components, servers, users, locations).
                </p>
              </div>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleAutoPopulateSubjects}
                  className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                >
                  📥 Auto-Populate Subjects from SSP
                </button>
              )}
            </div>

            {/* Subjects List */}
            {subjects.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-6 text-center text-xs text-slate-500">
                No assessment subjects defined yet. Click "Auto-Populate" or add a subject below.
              </div>
            ) : (
              <div className="space-y-3">
                {subjects.map((subj, idx) => {
                  const isAll = (subj['include-all'] as any) !== undefined && (subj['include-all'] as any) !== false;
                  const incSubjs = subj['include-subjects'] || [];

                  return (
                    <div
                      key={(subj as any).uuid || idx}
                      onClick={() => setSelectedSubject(subj)}
                      className="cursor-pointer rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs space-y-3 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-blue-950 px-2 py-0.5 text-xs font-bold uppercase text-blue-400 border border-blue-800">
                            {subj.type}
                          </span>
                          <span className="font-semibold text-slate-200">
                            {subj.description || `Assessment Subject Group ${idx + 1}`}
                          </span>
                        </div>
                        {isEditing && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              dispatch(removeAssessmentSubject(idx));
                            }}
                            className="rounded p-1 text-red-400 hover:bg-red-950/50 hover:text-red-300"
                            title="Remove Subject Group"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className="text-slate-400">
                        {isAll ? (
                          <span className="text-emerald-400 font-medium">
                            ✓ Includes all instances of type <code>{subj.type}</code> from target system
                          </span>
                        ) : (
                          <div>
                            <div className="font-semibold text-slate-300 mb-1">
                              Included Subjects ({incSubjs.length}):
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {incSubjs.map((s, sIdx) => (
                                <span
                                  key={s['subject-uuid'] || sIdx}
                                  className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-300"
                                >
                                  {s['subject-uuid']}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Add specific entity reference */}
                      {isEditing && !isAll && sspEntities.components.length > 0 && subj.type === 'component' && (
                        <div className="border-t border-slate-900 pt-2 flex flex-wrap gap-1.5 items-center">
                          <span className="text-[11px] text-slate-500">Pick from SSP:</span>
                          {sspEntities.components.map((c) => {
                            const isInc = incSubjs.some((s) => s['subject-uuid'] === c.uuid);
                            return (
                              <button
                                key={c.uuid}
                                type="button"
                                onClick={() => {
                                  if (isInc) {
                                    dispatch(removeSubjectReference(idx, c.uuid));
                                  } else {
                                    dispatch(addSubjectReference(idx, { 'subject-uuid': c.uuid, type: 'component' }));
                                  }
                                }}
                                className={`rounded px-2 py-0.5 text-[10px] ${
                                  isInc ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                              >
                                {c.title} {isInc ? '✓' : '+'}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Subject Group Form */}
            {isEditing && (
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 space-y-3">
                <div className="text-xs font-semibold text-slate-300">Add New Subject Group:</div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Subject Type</label>
                    <select
                      value={newSubjType}
                      onChange={(e) => setNewSubjType(e.target.value as AssessmentSubjectType)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                    >
                      {SUBJECT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Production Database Cluster Nodes"
                      value={newSubjDesc}
                      onChange={(e) => setNewSubjDesc(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddSubject}
                      className="w-full rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500"
                    >
                      + Add Subject Scope
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Assessment Tools / Components */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <span>🛠️</span> Assessment Tools & Asset Components ({assetComponents.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Authorized audit software, vulnerability scanners, and analysis tools.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {assetComponents.length === 0 ? (
                <div className="col-span-2 rounded-lg border border-slate-800 bg-slate-950 p-4 text-center text-xs text-slate-500">
                  No specialized assessment tools declared.
                </div>
              ) : (
                assetComponents.map((comp) => (
                  <div
                    key={comp.uuid}
                    className="flex items-start justify-between rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{comp.title}</div>
                      <div className="text-slate-400 mt-0.5">{comp.description}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1">UUID: {comp.uuid}</div>
                    </div>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => dispatch(removeAssetComponent(comp.uuid))}
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
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 space-y-2">
                <div className="text-xs font-semibold text-slate-300">Add Assessment Tool:</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Tool Title (e.g. Nessus Scanner)"
                    value={newToolTitle}
                    onChange={(e) => setNewToolTitle(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Description / Purpose"
                    value={newToolDesc}
                    onChange={(e) => setNewToolDesc(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddTool}
                    disabled={!newToolTitle.trim()}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
                  >
                    + Add Tool
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Assessment Platforms */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <span>🖥️</span>
                  <span>Assessment Platforms</span>
                  <span className="text-xs text-slate-400 font-normal">({assetPlatforms.length})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Platform configurations linking tools with authorized audit team operators.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {assetPlatforms.length === 0 ? (
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-center text-xs text-slate-500">
                  No assessment platforms defined.
                </div>
              ) : (
                assetPlatforms.map((plat) => {
                  const usedComps = plat['uses-components'] || [];
                  return (
                    <div
                      key={plat.uuid}
                      className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-slate-100 text-sm">{plat.title || 'Platform'}</div>
                        {isEditing && (
                          <button
                            type="button"
                            onClick={() => dispatch(removeAssessmentPlatform(plat.uuid))}
                            className="rounded p-1 text-red-400 hover:bg-red-950/50 hover:text-red-300"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div>
                        <div className="font-semibold text-slate-300 mb-1">
                          Linked Tools ({usedComps.length}):
                        </div>
                        {usedComps.length === 0 ? (
                          <p className="text-slate-500 italic">No tools linked to this platform.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {usedComps.map((uc) => {
                              const match = assetComponents.find((c) => c.uuid === uc['component-uuid']);
                              return (
                                <span
                                  key={uc['component-uuid']}
                                  className="inline-flex items-center gap-1.5 rounded bg-slate-900 border border-slate-800 px-2.5 py-1 text-slate-200"
                                >
                                  <span>{match?.title || uc['component-uuid']}</span>
                                  {isEditing && (
                                    <button
                                      type="button"
                                      onClick={() => dispatch(removePlatformComponent(plat.uuid, uc['component-uuid']))}
                                      className="text-red-400 hover:text-red-300 font-bold"
                                    >
                                      ×
                                    </button>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Tool linking picker */}
                      {isEditing && assetComponents.length > 0 && (
                        <div className="border-t border-slate-900 pt-2 flex flex-wrap gap-1.5 items-center">
                          <span className="text-[11px] text-slate-500">Link tool:</span>
                          {assetComponents.map((tool) => {
                            const isLinked = usedComps.some((uc) => uc['component-uuid'] === tool.uuid);
                            return (
                              <button
                                key={tool.uuid}
                                type="button"
                                onClick={() => {
                                  if (!isLinked) {
                                    dispatch(addPlatformComponent(plat.uuid, tool.uuid));
                                  }
                                }}
                                disabled={isLinked}
                                className={`rounded px-2 py-0.5 text-[10px] ${
                                  isLinked
                                    ? 'bg-purple-900/60 text-purple-300 opacity-60'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                              >
                                {tool.title} {isLinked ? '✓' : '+'}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {isEditing && (
              <div className="flex gap-2 pt-2 border-t border-slate-800/60">
                <input
                  type="text"
                  placeholder="Platform Title (e.g. Automated Scanning Platform Alpha)"
                  value={newPlatTitle}
                  onChange={(e) => setNewPlatTitle(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddPlatform}
                  disabled={!newPlatTitle.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
                >
                  + Add Platform
                </button>
              </div>
            )}
          </div>

          {/* Assessment Team (if present) */}
          {((assets as any)?.['assessment-team'] || []).length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <span>👥</span> Assessment Team
              </h3>
              <div className="space-y-2">
                {((assets as any)['assessment-team'] as any[]).map((team, tIdx) => (
                  <div key={team.uuid || tIdx} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs">
                    <div className="font-semibold text-slate-200">{team.title}</div>
                    {team['role-ids'] && (
                      <div className="text-slate-400 mt-1">Roles: {team['role-ids'].join(', ')}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subject Details Modal */}
      {selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <span>🎯</span> Subject Details
              </h3>
              <button
                type="button"
                onClick={() => setSelectedSubject(null)}
                className="text-slate-400 hover:text-slate-200 text-lg leading-none"
                aria-label="close"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Type:</span>
                <span className="ml-2 rounded bg-blue-950 px-2 py-0.5 font-bold uppercase text-blue-300 border border-blue-800">
                  {selectedSubject.type}
                </span>
              </div>
              {selectedSubject.description && (
                <div>
                  <span className="text-slate-400 font-medium">Description:</span>
                  <p className="mt-1 text-slate-200">{selectedSubject.description}</p>
                </div>
              )}
              <div>
                <span className="text-slate-400 font-medium">Scope Mode:</span>
                <span className="ml-2 text-slate-300">
                  {selectedSubject['include-all'] ? 'All instances in target system' : 'Explicit selected instances'}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedSubject(null)}
                className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
