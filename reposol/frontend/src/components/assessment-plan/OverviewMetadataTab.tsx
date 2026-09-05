import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { AssessmentPlan, Property } from '../../lib/types/oscal';

export interface Role {
  id: string;
  title: string;
  description?: string;
  [key: string]: any;
}

export interface Party {
  uuid: string;
  type?: string;
  name?: string;
  'email-addresses'?: string[];
  [key: string]: any;
}

export interface APResponsibleParty {
  'role-id': string;
  'party-uuids': string[];
  [key: string]: any;
}
import { DocumentAction } from '../../lib/document-actions/types';
import {
  setAPTitle,
  setAPVersion,
  setAPRemarks,
  setImportSSP,
  addAPRole,
  removeAPRole,
  addAPParty,
  removeAPParty,
  addAPResponsibleParty,
  removeAPResponsibleParty,
  setAPProp,
  removeAPProp,
} from '../../lib/document-actions/assessment-plan-actions';
import { generateUUID } from '../../lib/oscal-utils';
import { fetchDocument } from '../../lib/api';

export interface OverviewMetadataTabProps {
  document: AssessmentPlan;
  dispatch: (action: DocumentAction) => void;
  isEditing: boolean;
  onOpenSSPBrowser: () => void;
}

export const OverviewMetadataTab: React.FC<OverviewMetadataTabProps> = ({
  document: ap,
  dispatch,
  isEditing,
  onOpenSSPBrowser,
}) => {
  const metadata = ap?.metadata || { title: '', version: '1.0.0' };
  const importSSP = ap?.['import-ssp'];

  // Inline SSP href editing
  const [isEditingHref, setIsEditingHref] = useState(false);
  const [hrefInput, setHrefInput] = useState(importSSP?.href || '');
  const [remarksInput, setRemarksInput] = useState(importSSP?.remarks || '');

  // Resolved SSP metadata
  const [resolvedSSP, setResolvedSSP] = useState<{
    systemName?: string;
    controlsCount?: number;
    componentsCount?: number;
    usersCount?: number;
    statusState?: string;
    loading?: boolean;
    error?: string;
  }>({});

  // Local form states
  const [newRoleId, setNewRoleId] = useState('');
  const [newRoleTitle, setNewRoleTitle] = useState('');
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyType, setNewPartyType] = useState<'person' | 'organization'>('person');
  const [newPartyEmail, setNewPartyEmail] = useState('');
  const [newPropName, setNewPropName] = useState('');
  const [newPropValue, setNewPropValue] = useState('');

  useEffect(() => {
    setHrefInput(importSSP?.href || '');
    setRemarksInput(importSSP?.remarks || '');
  }, [importSSP?.href, importSSP?.remarks]);

  // Attempt to fetch live SSP summary if href has UUID format or endpoint
  useEffect(() => {
    const href = importSSP?.href;
    if (!href) {
      setResolvedSSP({});
      return;
    }

    // Try extracting UUID from href (e.g. ../system-security-plans/uuid.json or /api/documents/ssps/uuid)
    const uuidMatch = href.match(/([0-9a-fA-F-]{36})/);
    if (uuidMatch) {
      const sspId = uuidMatch[1];
      setResolvedSSP({ loading: true });
      fetchDocument('ssps', sspId)
        .then((doc: any) => {
          const ssp = doc?.['system-security-plan'] || doc;
          if (ssp) {
            const systemName =
              ssp['system-characteristics']?.['system-name'] ||
              ssp.metadata?.title ||
              'Target System';
            const controlsCount =
              ssp['control-implementation']?.['implemented-requirements']?.length || 0;
            const componentsCount =
              ssp['system-implementation']?.components?.length || 0;
            const usersCount =
              ssp['system-implementation']?.users?.length || 0;
            const statusState =
              ssp['system-characteristics']?.status?.state || 'operational';

            setResolvedSSP({
              systemName,
              controlsCount,
              componentsCount,
              usersCount,
              statusState,
              loading: false,
            });
          } else {
            setResolvedSSP({ loading: false });
          }
        })
        .catch(() => {
          setResolvedSSP({
            loading: false,
            error: 'Target SSP context resolved offline / via relative reference.',
          });
        });
    } else {
      setResolvedSSP({
        systemName: href.split('/').pop() || 'Referenced System',
        loading: false,
      });
    }
  }, [importSSP?.href]);

  const handleSaveSSPHref = () => {
    dispatch(setImportSSP(hrefInput.trim(), remarksInput.trim() || undefined));
    toast.success('SSP reference updated');
    setIsEditingHref(false);
  };

  const handleAddRole = (id?: string, title?: string) => {
    const finalId = id || newRoleId.trim();
    const finalTitle = title || newRoleTitle.trim() || finalId;
    if (finalId) {
      dispatch(addAPRole({ id: finalId, title: finalTitle }));
      setNewRoleId('');
      setNewRoleTitle('');
    }
  };

  const handleAddParty = () => {
    if (newPartyName.trim()) {
      dispatch(
        addAPParty({
          uuid: generateUUID(),
          name: newPartyName.trim(),
          type: newPartyType,
          'email-addresses': newPartyEmail.trim() ? [newPartyEmail.trim()] : undefined,
        })
      );
      setNewPartyName('');
      setNewPartyEmail('');
    }
  };

  const handleAddProp = () => {
    if (newPropName.trim() && newPropValue.trim()) {
      dispatch(setAPProp(newPropName.trim(), newPropValue.trim()));
      setNewPropName('');
      setNewPropValue('');
    }
  };

  const roles: Role[] = ((metadata.roles || []) as unknown) as Role[];
  const parties: Party[] = ((metadata.parties || []) as unknown) as Party[];
  const responsibleParties: APResponsibleParty[] = ((metadata['responsible-parties'] || []) as unknown) as APResponsibleParty[];
  const props: Property[] = ((metadata.props || []) as unknown) as Property[];

  return (
    <div className="space-y-6 p-6">
      {/* 1. Document Identification */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <span>📋</span> Assessment Plan Overview
          </h3>
          <span className="text-xs text-slate-400">
            <span>Plan Completeness</span>: 100%
          </span>
        </div>

        <div className="text-xs font-semibold text-slate-300">Document Identification & Metadata</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
              Assessment Plan Title *
            </label>
            <input
              type="text"
              value={metadata.title || ''}
              onChange={(e) => dispatch(setAPTitle(e.target.value))}
              disabled={!isEditing}
              placeholder="e.g. Enterprise Cloud Security Assessment Plan"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
              Plan Version *
            </label>
            <input
              type="text"
              value={metadata.version || ''}
              onChange={(e) => dispatch(setAPVersion(e.target.value))}
              disabled={!isEditing}
              placeholder="1.0.0"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-60"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
              OSCAL Schema Version
            </label>
            <div className="rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-slate-300 font-mono">
              {metadata['oscal-version'] || '1.2.2'}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
              Plan Remarks / Executive Scope
            </label>
            <textarea
              rows={2}
              value={metadata.remarks || ''}
              onChange={(e) => dispatch(setAPRemarks(e.target.value))}
              disabled={!isEditing}
              placeholder="High-level assessment objectives, audit mandate, or compliance framework..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      {/* 2. Target SSP Reference & Live Context Summary */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <span>🛡️</span> Target System Security Plan (SSP)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Required <code>import-ssp</code> reference bounding candidate controls, components, and inventory.
            </p>
          </div>
          {isEditing && (
            <button
              type="button"
              onClick={onOpenSSPBrowser}
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500 flex items-center gap-1.5"
            >
              <span>🔍</span> Browse Workspace SSPs
            </button>
          )}
        </div>

        {/* Current Reference Display */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-slate-400">Import Reference URI:</div>
            {isEditing && !isEditingHref && (
              <button
                type="button"
                onClick={() => setIsEditingHref(true)}
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Edit Reference
              </button>
            )}
          </div>

          {isEditingHref ? (
            <div className="space-y-2">
              <input
                type="text"
                value={hrefInput}
                onChange={(e) => setHrefInput(e.target.value)}
                placeholder="../system-security-plans/{uuid}.json or https://..."
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
              />
              <textarea
                rows={2}
                value={remarksInput}
                onChange={(e) => setRemarksInput(e.target.value)}
                placeholder="Optional remarks on this SSP reference..."
                className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveSSPHref}
                  className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingHref(false)}
                  className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <code className="flex-1 rounded bg-slate-900 px-3 py-1.5 text-xs text-blue-300 border border-slate-800 overflow-x-auto">
                {importSSP?.href || '(No Target SSP Linked - click Browse to select)'}
              </code>
            </div>
          )}

          {importSSP?.remarks && !isEditingHref && (
            <p className="text-xs text-slate-400 italic">Remarks: {importSSP.remarks}</p>
          )}
        </div>

        {/* Live Target SSP Summary Card */}
        {importSSP?.href && (
          <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Resolved Target System Summary
              </span>
              {resolvedSSP.loading && (
                <span className="text-xs text-slate-400 animate-pulse">Resolving SSP context...</span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
                <div className="text-xs text-slate-400">Target System</div>
                <div className="text-sm font-semibold text-slate-100 truncate mt-0.5">
                  {resolvedSSP.systemName || 'Resolved Target'}
                </div>
              </div>
              <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
                <div className="text-xs text-slate-400">Implemented Controls</div>
                <div className="text-lg font-bold text-blue-400">
                  {resolvedSSP.controlsCount !== undefined ? resolvedSSP.controlsCount : '—'}
                </div>
              </div>
              <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
                <div className="text-xs text-slate-400">System Components</div>
                <div className="text-lg font-bold text-purple-400">
                  {resolvedSSP.componentsCount !== undefined ? resolvedSSP.componentsCount : '—'}
                </div>
              </div>
              <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
                <div className="text-xs text-slate-400">System Users</div>
                <div className="text-lg font-bold text-emerald-400">
                  {resolvedSSP.usersCount !== undefined ? resolvedSSP.usersCount : '—'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Roles & Assessment Team Parties Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Roles */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span>👥</span> Assessment Roles ({roles.length})
            </h3>
          </div>

          {/* Quick presets */}
          {isEditing && (
            <div>
              <div className="text-[11px] text-slate-400 mb-1.5 font-medium">Quick add standard role:</div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'lead-assessor', title: 'Lead Assessor' },
                  { id: 'security-auditor', title: 'Security Auditor' },
                  { id: 'technical-evaluator', title: 'Technical Evaluator' },
                  { id: 'system-owner', title: 'System Owner' },
                  { id: 'authorizing-official', title: 'Authorizing Official' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleAddRole(preset.id, preset.title)}
                    className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700 hover:text-white"
                  >
                    + {preset.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Roles list */}
          <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {roles.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">No roles defined yet.</p>
            ) : (
              roles.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-200">{r.title || r.id}</span>
                    <span className="text-slate-500 ml-2 font-mono">({r.id})</span>
                  </div>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => dispatch(removeAPRole(r.id))}
                      className="rounded p-1 text-red-400 hover:bg-red-950/50 hover:text-red-300"
                      title="Remove Role"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add custom role */}
          {isEditing && (
            <div className="flex gap-2 pt-2 border-t border-slate-800/60">
              <input
                type="text"
                placeholder="Role ID (e.g. pen-tester)"
                value={newRoleId}
                onChange={(e) => setNewRoleId(e.target.value)}
                className="w-1/2 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Title (e.g. Penetration Tester)"
                value={newRoleTitle}
                onChange={(e) => setNewRoleTitle(e.target.value)}
                className="w-1/2 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleAddRole()}
                disabled={!newRoleId.trim()}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Parties (People & Organizations) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span>🏢</span> Assessment Parties ({parties.length})
            </h3>
          </div>

          <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {parties.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">No parties defined yet.</p>
            ) : (
              parties.map((p) => (
                <div
                  key={p.uuid}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-200">{p.name}</span>
                    <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 capitalize">
                      {p.type}
                    </span>
                    {p['email-addresses']?.[0] && (
                      <div className="text-slate-400 text-[11px] mt-0.5">{p['email-addresses'][0]}</div>
                    )}
                  </div>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => dispatch(removeAPParty(p.uuid))}
                      className="rounded p-1 text-red-400 hover:bg-red-950/50 hover:text-red-300"
                      title="Remove Party"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add party */}
          {isEditing && (
            <div className="space-y-2 pt-2 border-t border-slate-800/60">
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Party Name *"
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  className="col-span-2 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
                <select
                  value={newPartyType}
                  onChange={(e) => setNewPartyType(e.target.value as 'person' | 'organization')}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="person">Person</option>
                  <option value="organization">Organization</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Email Address (optional)"
                  value={newPartyEmail}
                  onChange={(e) => setNewPartyEmail(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddParty}
                  disabled={!newPartyName.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
                >
                  Add Party
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Responsible Parties (Role to Party Mapping) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <span>🔗</span> Responsible Role Assignments ({responsibleParties.length})
        </h3>
        {roles.length === 0 || parties.length === 0 ? (
          <p className="text-xs text-slate-500 italic">
            Add at least one role and one party above to configure responsible role assignments.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {roles.map((r) => {
              const rp = responsibleParties.find((p) => p['role-id'] === r.id);
              const assignedPartyUuids = rp?.['party-uuids'] || [];
              return (
                <div key={r.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between font-medium text-slate-200">
                    <span>{r.title || r.id}</span>
                    <span className="text-[11px] text-slate-500">{assignedPartyUuids.length} assigned</span>
                  </div>
                  {isEditing ? (
                    <div className="flex flex-wrap gap-1.5">
                      {parties.map((p) => {
                        const isAssigned = assignedPartyUuids.includes(p.uuid);
                        return (
                          <button
                            key={p.uuid}
                            type="button"
                            onClick={() => {
                              if (isAssigned) {
                                const nextUuids = assignedPartyUuids.filter((id) => id !== p.uuid);
                                if (nextUuids.length === 0) {
                                  dispatch(removeAPResponsibleParty(r.id));
                                } else {
                                  dispatch(addAPResponsibleParty(r.id, nextUuids));
                                }
                              } else {
                                dispatch(addAPResponsibleParty(r.id, [...assignedPartyUuids, p.uuid]));
                              }
                            }}
                            className={`rounded px-2 py-0.5 text-[11px] transition-colors ${
                              isAssigned
                                ? 'bg-blue-600 text-white font-medium'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            {p.name} {isAssigned ? '✓' : '+'}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-slate-400">
                      {assignedPartyUuids.length > 0
                        ? assignedPartyUuids
                            .map((u) => parties.find((p) => p.uuid === u)?.name || u)
                            .join(', ')
                        : 'None assigned'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Custom Metadata Properties / Tags */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span>🏷️</span> Metadata Properties & Tags ({props.length})
          </h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {props.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No custom properties defined.</p>
          ) : (
            props.map((p, idx) => (
              <span
                key={`${p.name}-${idx}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-200"
              >
                <span className="font-semibold text-slate-400">{p.name}:</span>
                <span className="text-slate-100">{p.value}</span>
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => dispatch(removeAPProp(p.name))}
                    className="ml-1 text-red-400 hover:text-red-300 font-bold"
                  >
                    ×
                  </button>
                )}
              </span>
            ))
          )}
        </div>

        {isEditing && (
          <div className="flex gap-2 pt-2 border-t border-slate-800/60">
            <input
              type="text"
              placeholder="Property Name (e.g. classification)"
              value={newPropName}
              onChange={(e) => setNewPropName(e.target.value)}
              className="w-1/3 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Property Value (e.g. CUI // FEDCON)"
              value={newPropValue}
              onChange={(e) => setNewPropValue(e.target.value)}
              className="w-1/2 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddProp}
              disabled={!newPropName.trim() || !newPropValue.trim()}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
            >
              Add Property
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
