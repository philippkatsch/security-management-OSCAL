import React, { useState, useMemo, useEffect } from 'react';
import { AssessmentPlan, ControlSelection, SelectControlById, ControlObjectiveSelection } from '../../lib/types/oscal';
import { DocumentAction } from '../../lib/document-actions/types';
import {
  setIncludeAllControls,
  addIncludeControl,
  removeIncludeControl,
  toggleIncludeControl,
  toggleExcludeControl,
  setStatementIDs,
  populateControlsFromSSP,
  setControlObjectiveSelections,
  addControlObjectiveSelection,
  removeControlObjectiveSelection,
  setReviewedControlsDescription,
} from '../../lib/document-actions/assessment-plan-actions';
import { fetchDocument } from '../../lib/api';

export interface ReviewedControlsTabProps {
  document: AssessmentPlan;
  dispatch: (action: DocumentAction) => void;
  isEditing: boolean;
}

interface CandidateControl {
  id: string;
  title: string;
  family: string;
  statementIds: string[];
}

const DEFAULT_FAMILIES = [
  'AC', 'AT', 'AU', 'CA', 'CM', 'CP', 'IA', 'IR', 'MA', 'MP', 'PE', 'PL', 'PS', 'RA', 'SA', 'SC', 'SI', 'SR'
];

const FALLBACK_CANDIDATE_CONTROLS: CandidateControl[] = [
  { id: 'ac-1', title: 'Policy and Procedures', family: 'AC', statementIds: ['ac-1_smt_a', 'ac-1_smt_b'] },
  { id: 'ac-2', title: 'Account Management', family: 'AC', statementIds: ['ac-2_smt_a', 'ac-2_smt_b', 'ac-2_smt_c', 'ac-2_smt_d'] },
  { id: 'ac-3', title: 'Access Enforcement', family: 'AC', statementIds: ['ac-3_smt'] },
  { id: 'ac-6', title: 'Least Privilege', family: 'AC', statementIds: ['ac-6_smt_a', 'ac-6_smt_b'] },
  { id: 'au-2', title: 'Event Logging', family: 'AU', statementIds: ['au-2_smt_a', 'au-2_smt_b', 'au-2_smt_c', 'au-2_smt_d'] },
  { id: 'au-6', title: 'Audit Record Review, Analysis, and Reporting', family: 'AU', statementIds: ['au-6_smt_a', 'au-6_smt_b'] },
  { id: 'ca-2', title: 'Control Assessments', family: 'CA', statementIds: ['ca-2_smt_a', 'ca-2_smt_b'] },
  { id: 'cm-2', title: 'Baseline Configuration', family: 'CM', statementIds: ['cm-2_smt_a', 'cm-2_smt_b'] },
  { id: 'cm-8', title: 'Information System Component Inventory', family: 'CM', statementIds: ['cm-8_smt_a', 'cm-8_smt_b'] },
  { id: 'ia-2', title: 'Identification and Authentication (Organizational Users)', family: 'IA', statementIds: ['ia-2_smt_a', 'ia-2_smt_b'] },
  { id: 'ia-5', title: 'Authenticator Management', family: 'IA', statementIds: ['ia-5_smt_a', 'ia-5_smt_b'] },
  { id: 'sc-7', title: 'Boundary Protection', family: 'SC', statementIds: ['sc-7_smt_a', 'sc-7_smt_b', 'sc-7_smt_c'] },
  { id: 'si-2', title: 'Flaw Remediation', family: 'SI', statementIds: ['si-2_smt_a', 'si-2_smt_b', 'si-2_smt_c'] },
  { id: 'si-4', title: 'Information System Monitoring', family: 'SI', statementIds: ['si-4_smt_a', 'si-4_smt_b'] },
];

export const ReviewedControlsTab: React.FC<ReviewedControlsTabProps> = ({
  document: ap,
  dispatch,
  isEditing,
}) => {
  const reviewedControls = ap?.['reviewed-controls'] || { 'control-selections': [{ 'include-all': {} }] };
  const controlSelections = reviewedControls['control-selections'] || [];
  const objectiveSelections = reviewedControls['control-objective-selections'] || [];

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<string>('ALL');
  const [candidateControls, setCandidateControls] = useState<CandidateControl[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [expandedControlId, setExpandedControlId] = useState<string | null>(null);

  // Load candidate controls from referenced SSP or provide standard NIST baseline controls
  useEffect(() => {
    const sspHref = ap?.['import-ssp']?.href;
    const uuidMatch = sspHref?.match(/([0-9a-fA-F-]{36})/);

    if (uuidMatch) {
      setLoadingCandidates(true);
      fetchDocument('ssps', uuidMatch[1])
        .then((doc: any) => {
          const ssp = doc?.['system-security-plan'] || doc;
          const reqs = ssp?.['control-implementation']?.['implemented-requirements'] || [];
          if (reqs.length > 0) {
            const list: CandidateControl[] = reqs.map((r: any) => {
              const cid = r['control-id'] || 'ac-1';
              const fam = cid.split('-')[0].toUpperCase();
              const reqStmts = (r.statements || []).map((s: any) => s['statement-id'] || s.statement_id).filter(Boolean);
              const paramStmts = (r['set-parameters'] || []).map((sp: any) => sp['param-id']).filter(Boolean);
              const fallbackStmts = FALLBACK_CANDIDATE_CONTROLS.find(f => f.id === cid)?.statementIds || [`${cid}_smt_a`, `${cid}_smt_b`];
              const dynamicStmts = reqStmts.length > 0 ? reqStmts : (paramStmts.length > 0 ? paramStmts : fallbackStmts);
              return {
                id: cid,
                title: r.description ? r.description.slice(0, 60) : `Control ${cid.toUpperCase()}`,
                family: fam,
                statementIds: dynamicStmts,
              };
            });
            setCandidateControls(list);
          } else {
            setCandidateControls(FALLBACK_CANDIDATE_CONTROLS);
          }
        })
        .catch(() => {
          setCandidateControls(FALLBACK_CANDIDATE_CONTROLS);
        })
        .finally(() => {
          setLoadingCandidates(false);
        });
    } else {
      setCandidateControls(FALLBACK_CANDIDATE_CONTROLS);
    }
  }, [ap?.['import-ssp']?.href]);

  const primarySelection = controlSelections[0] || {};
  const isIncludeAll = !!primarySelection['include-all'];
  const includedControls: SelectControlById[] = primarySelection['include-controls'] || [];
  const excludedControls: SelectControlById[] = primarySelection['exclude-controls'] || [];

  // Scoping metrics computation
  const scopingMetrics = useMemo(() => {
    const totalCandidates = candidateControls.length;
    let inScopeCount = 0;
    let excludedCount = excludedControls.length;

    if (isIncludeAll) {
      inScopeCount = Math.max(0, totalCandidates - excludedCount);
    } else {
      inScopeCount = includedControls.length;
    }

    const percentage = totalCandidates > 0 ? Math.round((inScopeCount / totalCandidates) * 100) : 100;

    // Family breakdown
    const familyCounts: Record<string, { total: number; inScope: number }> = {};
    for (const c of candidateControls) {
      if (!familyCounts[c.family]) {
        familyCounts[c.family] = { total: 0, inScope: 0 };
      }
      familyCounts[c.family].total += 1;

      const isControlInScope = isIncludeAll
        ? !excludedControls.some((e) => e['control-id'] === c.id)
        : includedControls.some((inc) => inc['control-id'] === c.id);

      if (isControlInScope) {
        familyCounts[c.family].inScope += 1;
      }
    }

    return {
      totalCandidates,
      inScopeCount,
      excludedCount,
      percentage,
      familyCounts,
    };
  }, [candidateControls, isIncludeAll, includedControls, excludedControls]);

  // Filtered candidate controls
  const filteredControls = useMemo(() => {
    return candidateControls.filter((c) => {
      const matchSearch =
        c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchFamily = selectedFamily === 'ALL' || c.family === selectedFamily;
      return matchSearch && matchFamily;
    });
  }, [candidateControls, searchTerm, selectedFamily]);

  const handleAutoPopulate = () => {
    const allIds = candidateControls.map((c) => c.id);
    dispatch(populateControlsFromSSP(allIds));
  };

  const isControlSelected = (controlId: string): boolean => {
    if (isIncludeAll) {
      return !excludedControls.some((e) => e['control-id'] === controlId);
    }
    return includedControls.some((c) => c['control-id'] === controlId);
  };

  const getStatementIdsForControl = (controlId: string): string[] => {
    const item = isIncludeAll
      ? excludedControls.find((c) => c['control-id'] === controlId)
      : includedControls.find((c) => c['control-id'] === controlId);
    return item?.['statement-ids'] || [];
  };

  const handleToggleStatement = (controlId: string, statementId: string) => {
    const current = getStatementIdsForControl(controlId);
    let next: string[];
    if (current.includes(statementId)) {
      next = current.filter((id) => id !== statementId);
    } else {
      next = [...current, statementId];
    }
    dispatch(setStatementIDs(controlId, next, 0));
  };

  return (
    <div className="space-y-6 p-6">
      {/* 1. Live Scoping Summary Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <span>📊</span> Assessment Scoping & Coverage Matrix
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live gap analysis comparing candidate baseline controls with scoped audit controls.
            </p>
          </div>
          {isEditing && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAutoPopulate}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
              >
                📥 Auto-Populate from SSP ({candidateControls.length})
              </button>
              <button
                type="button"
                onClick={() => dispatch(setIncludeAllControls(0))}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isIncludeAll
                    ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {isIncludeAll ? '✓ All Controls Included' : 'Include All Controls'}
              </button>
            </div>
          )}
        </div>

        {/* Coverage Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
            <div className="text-xs text-slate-400">Candidate Baseline</div>
            <div className="text-xl font-bold text-slate-100 mt-0.5">{scopingMetrics.totalCandidates}</div>
          </div>
          <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
            <div className="text-xs text-slate-400">In-Scope Controls</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">{scopingMetrics.inScopeCount}</div>
          </div>
          <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
            <div className="text-xs text-slate-400">Excluded Controls</div>
            <div className="text-xl font-bold text-amber-400 mt-0.5">{scopingMetrics.excludedCount}</div>
          </div>
          <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
            <div className="text-xs text-slate-400">Scope Coverage</div>
            <div className="text-xl font-bold text-blue-400 mt-0.5">{scopingMetrics.percentage}%</div>
          </div>
        </div>

        {/* Family Breakdown Chips */}
        <div className="pt-2">
          <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Coverage by Family:</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(scopingMetrics.familyCounts).map(([fam, counts]) => {
              const fullCoverage = counts.inScope === counts.total && counts.total > 0;
              return (
                <div
                  key={fam}
                  className={`rounded border px-2 py-0.5 text-xs font-mono flex items-center gap-1.5 ${
                    fullCoverage
                      ? 'border-emerald-800 bg-emerald-950/30 text-emerald-300'
                      : counts.inScope > 0
                      ? 'border-blue-800 bg-blue-950/30 text-blue-300'
                      : 'border-slate-800 bg-slate-950 text-slate-500'
                  }`}
                >
                  <span className="font-bold">{fam}</span>
                  <span className="text-[10px] opacity-80">
                    {counts.inScope}/{counts.total}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Interactive Control Tree Picker & Statement Tailoring */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <span>🛡️</span>
            <span>Reviewed Controls Tree & Statement Tailoring</span>
            <span className="sr-only">Reviewed Controls</span>
          </h3>

          {/* Search and Family Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Filter by ID (ac-2) or title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <select
              value={selectedFamily}
              onChange={(e) => setSelectedFamily(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
            >
              <option value="ALL">All Families</option>
              {DEFAULT_FAMILIES.map((fam) => (
                <option key={fam} value={fam}>
                  {fam} Family
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Controls Tree List */}
        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {loadingCandidates ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading candidate controls...</div>
          ) : filteredControls.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 italic">
              No controls matching the current filter.
            </div>
          ) : (
            filteredControls.map((ctrl) => {
              const inScope = isControlSelected(ctrl.id);
              const isExpanded = expandedControlId === ctrl.id;
              const activeStatementIds = getStatementIdsForControl(ctrl.id);

              return (
                <div
                  key={ctrl.id}
                  className={`rounded-lg border transition-all ${
                    inScope
                      ? 'border-blue-900/60 bg-blue-950/20'
                      : 'border-slate-800/80 bg-slate-950/40 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      {isEditing ? (
                        <input
                          type="checkbox"
                          checked={inScope}
                          onChange={() => {
                            if (isIncludeAll) {
                              dispatch(toggleExcludeControl(ctrl.id, 0));
                            } else {
                              dispatch(toggleIncludeControl(ctrl.id, 0));
                            }
                          }}
                          className="h-4 w-4 rounded border-slate-700 text-blue-600 focus:ring-0"
                        />
                      ) : (
                        <span className={`text-xs ${inScope ? 'text-emerald-400' : 'text-slate-600'}`}>
                          {inScope ? '✓' : '—'}
                        </span>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-100 uppercase">
                            {ctrl.id}
                          </span>
                          <span className="text-xs text-slate-300 font-medium">{ctrl.title}</span>
                          {activeStatementIds.length > 0 && (
                            <span className="rounded bg-blue-900/60 px-1.5 py-0.2 text-[10px] text-blue-300">
                              {activeStatementIds.length} statement parts tailored
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedControlId(isExpanded ? null : ctrl.id)}
                      className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    >
                      {isExpanded ? 'Hide Statements ▲' : 'Statement Tailoring ▼'}
                    </button>
                  </div>

                  {/* Statement Part Tailoring Sub-panel */}
                  {isExpanded && (
                    <div className="border-t border-slate-800/80 bg-slate-900/40 p-3.5 space-y-2 text-xs">
                      <div className="font-semibold text-slate-300">Statement Sub-Parts Scoping:</div>
                      <p className="text-[11px] text-slate-400">
                        Tailor evaluation to specific control statement items (<code>statement-ids</code>):
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {ctrl.statementIds.map((smtId) => {
                          const isStmtSelected = activeStatementIds.includes(smtId);
                          return (
                            <button
                              key={smtId}
                              type="button"
                              disabled={!isEditing}
                              onClick={() => handleToggleStatement(ctrl.id, smtId)}
                              className={`rounded border px-2.5 py-1 text-[11px] font-mono transition-colors ${
                                isStmtSelected
                                  ? 'border-blue-500 bg-blue-900/40 text-blue-200 font-semibold'
                                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              {smtId} {isStmtSelected ? '✓' : '+'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Control Objective Selections */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <span>🎯</span> Control Objective Selections
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Defines standard or custom control objective boundaries (<code>control-objective-selections</code>).
            </p>
          </div>
          {isEditing && (
            <button
              type="button"
              onClick={() => dispatch(addControlObjectiveSelection({ 'include-all': {} }))}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              + Add Objective Selection
            </button>
          )}
        </div>

        {objectiveSelections.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-center text-xs text-slate-500">
            No specific objective selections configured. Defaulting to all objectives for in-scope controls.
          </div>
        ) : (
          <div className="space-y-3">
            {objectiveSelections.map((sel, idx) => {
              const isAll = !!sel['include-all'];
              const incObjs = sel['include-objectives'] || [];
              return (
                <div key={idx} className="rounded-lg border border-slate-800 bg-slate-950 p-3.5 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">Objective Selection {idx + 1}</span>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => dispatch(removeControlObjectiveSelection(idx))}
                        className="rounded p-1 text-red-400 hover:bg-red-950/50 hover:text-red-300"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="text-slate-400">
                    {isAll ? (
                      <span className="text-emerald-400 font-medium">Includes all standard control objectives</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {incObjs.map((o) => (
                          <span key={o['objective-id']} className="rounded bg-slate-800 px-2 py-0.5 font-mono text-slate-300">
                            {o['objective-id']}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Objectives & Methods */}
      {ap?.['local-definitions']?.['objectives-and-methods'] && ap['local-definitions']['objectives-and-methods'].length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <span>🎯</span> Objectives & Methods
            </h3>
          </div>
          <div className="space-y-3">
            {ap['local-definitions']['objectives-and-methods'].map((om, idx) => (
              <div key={(om as any).uuid || idx} className="rounded-lg border border-slate-800 bg-slate-950 p-3.5 text-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-blue-400 uppercase">Control: {om['control-id']}</span>
                  <span className="text-slate-300 font-semibold">{om.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
