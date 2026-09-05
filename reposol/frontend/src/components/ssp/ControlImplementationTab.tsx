import React, { useState, useMemo } from 'react';
import ProgressBar from '@components/shared/dashboard/ProgressBar';
import StatusBadge from '@components/shared/status/StatusBadge';
import {
  ControlImplementation,
  ImplementedRequirement,
  SystemImplementation,
  SystemComponent
} from '@lib/types/oscal';
import {
  upsertImplementedRequirement,
  removeImplementedRequirement,
  setControlImplementationDescription
} from '@lib/document-actions/ssp-actions';

export interface ControlImplementationTabProps {
  ctrlImp?: ControlImplementation;
  isEditing?: boolean;
  handleUpdateField?: (path: any, val: any) => void;
  openDetail?: (type: any, item: any) => void;
  coveragePercent?: number;
  catalog?: any;
  sysImp?: SystemImplementation;
  dispatch?: any;
  ssp?: any;
  onSelectControl?: (id: string) => void;
}

export function ControlImplementationTab({
  ctrlImp = { description: '', 'implemented-requirements': [] },
  isEditing = false,
  handleUpdateField,
  openDetail,
  coveragePercent = 0,
  catalog,
  sysImp,
  dispatch,
  ssp,
  onSelectControl
}: ControlImplementationTabProps) {
  const implementedReqs: ImplementedRequirement[] = ctrlImp['implemented-requirements'] || [];
  const components: SystemComponent[] = sysImp?.components || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [originationFilter, setOriginationFilter] = useState<string>('all');
  const [selectedReqIds, setSelectedReqIds] = useState<Set<string>>(new Set());
  const [newControlIdInput, setNewControlIdInput] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Flatten baseline controls from catalog if available
  const baselineControls = useMemo(() => {
    const list: any[] = [];
    const traverseControls = (ctrls: any[]) => {
      for (const c of ctrls) {
        list.push(c);
        if (c.controls) traverseControls(c.controls);
      }
    };
    const traverseGroups = (groups: any[]) => {
      for (const g of groups) {
        if (g.controls) traverseControls(g.controls);
        if (g.groups) traverseGroups(g.groups);
      }
    };
    if (catalog?.controls) traverseControls(catalog.controls);
    if (catalog?.groups) traverseGroups(catalog.groups);
    return list;
  }, [catalog]);

  // Merge baseline controls and implemented requirements into a unified list
  const combinedControls = useMemo(() => {
    const map = new Map<string, any>();

    // 1. Add all baseline controls
    for (const bc of baselineControls) {
      const cid = (bc.id || bc['control-id'] || '').toLowerCase();
      if (!cid) continue;
      map.set(cid, {
        id: bc.id || bc['control-id'],
        title: bc.title || bc.id,
        isBaseline: true,
        req: null
      });
    }

    // 2. Overlay or add implemented requirements
    for (const req of implementedReqs) {
      const cid = (req['control-id'] || '').toLowerCase();
      if (!cid) continue;
      const existing = map.get(cid);
      if (existing) {
        existing.req = req;
      } else {
        map.set(cid, {
          id: req['control-id'],
          title: req.description || req['control-id'],
          isBaseline: false,
          req
        });
      }
    }

    return Array.from(map.values());
  }, [baselineControls, implementedReqs]);

  // Calculate detailed status breakdown
  const statusStats = useMemo(() => {
    let implemented = 0;
    let partial = 0;
    let planned = 0;
    let alternative = 0;
    let notApplicable = 0;
    let undocumented = 0;

    for (const item of combinedControls) {
      if (!item.req) {
        undocumented++;
        continue;
      }
      const byComps = item.req['by-components'] || [];
      const state = byComps[0]?.['implementation-status']?.state || 'planned';
      if (state === 'implemented') implemented++;
      else if (state === 'partial') partial++;
      else if (state === 'planned') planned++;
      else if (state === 'alternative') alternative++;
      else if (state === 'not-applicable') notApplicable++;
      else undocumented++;
    }

    return {
      total: combinedControls.length,
      implemented,
      partial,
      planned,
      alternative,
      notApplicable,
      undocumented
    };
  }, [combinedControls]);

  // Filtering
  const filteredControls = useMemo(() => {
    return combinedControls.filter(item => {
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesId = item.id.toLowerCase().includes(query);
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesComp = item.req?.['by-components']?.some((bc: any) => {
          const comp = components.find(c => c.uuid === bc['component-uuid']);
          return comp?.title?.toLowerCase().includes(query) || bc.description?.toLowerCase().includes(query);
        });
        if (!matchesId && !matchesTitle && !matchesComp) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const byComps = item.req?.['by-components'] || [];
        const state = item.req ? (byComps[0]?.['implementation-status']?.state || 'planned') : 'undocumented';
        if (statusFilter === 'undocumented' && state !== 'undocumented') return false;
        if (statusFilter !== 'undocumented' && state !== statusFilter) return false;
      }

      // Origination filter
      if (originationFilter !== 'all') {
        const origProp = item.req?.props?.find((p: any) => p.name === 'control-origination');
        const origValue = origProp ? origProp.value : 'system-specific';
        if (!item.req || origValue !== originationFilter) return false;
      }

      return true;
    });
  }, [combinedControls, searchQuery, statusFilter, originationFilter, components]);

  // Checkbox helpers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedReqIds(new Set(filteredControls.map(c => c.id)));
    } else {
      setSelectedReqIds(new Set());
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedReqIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedReqIds(next);
  };

  // Batch delete selected implemented requirements
  const handleBatchDelete = () => {
    if (!selectedReqIds.size) return;
    if (dispatch) {
      selectedReqIds.forEach(id => {
        dispatch(removeImplementedRequirement(id));
      });
    } else if (handleUpdateField) {
      const remaining = implementedReqs.filter(r => !selectedReqIds.has(r['control-id']) && !selectedReqIds.has(r.uuid));
      handleUpdateField(['control-implementation', 'implemented-requirements'], remaining);
    }
    setSelectedReqIds(new Set());
  };

  // Batch initialize selected baseline controls into implemented requirements
  const handleBatchInitialize = () => {
    const defaultCompUuid = components.find(c => c.type === 'this-system')?.uuid || components[0]?.uuid || 'this-system';
    if (dispatch) {
      selectedReqIds.forEach(id => {
        const existing = implementedReqs.find(r => r['control-id'] === id);
        if (!existing) {
          dispatch(
            upsertImplementedRequirement({
              uuid: crypto.randomUUID(),
              'control-id': id,
              props: [{ name: 'control-origination', value: 'system-specific' }],
              'by-components': [
                {
                  uuid: crypto.randomUUID(),
                  'component-uuid': defaultCompUuid,
                  description: '',
                  'implementation-status': { state: 'planned' }
                }
              ]
            })
          );
        }
      });
    }
    setSelectedReqIds(new Set());
  };

  // Add single control requirement
  const handleAddControlReq = () => {
    const trimmed = newControlIdInput.trim();
    if (!trimmed) return;
    const defaultCompUuid = components.find(c => c.type === 'this-system')?.uuid || components[0]?.uuid || 'this-system';
    if (dispatch) {
      dispatch(
        upsertImplementedRequirement({
          uuid: crypto.randomUUID(),
          'control-id': trimmed,
          props: [{ name: 'control-origination', value: 'system-specific' }],
          'by-components': [
            {
              uuid: crypto.randomUUID(),
              'component-uuid': defaultCompUuid,
              description: 'Implementation description for ' + trimmed,
              'implementation-status': { state: 'planned' }
            }
          ]
        })
      );
    } else if (handleUpdateField) {
      handleUpdateField(['control-implementation', 'implemented-requirements'], [
        ...implementedReqs,
        {
          uuid: crypto.randomUUID(),
          'control-id': trimmed,
          'by-components': [
            {
              uuid: crypto.randomUUID(),
              'component-uuid': defaultCompUuid,
              description: 'Implementation description for ' + trimmed,
              'implementation-status': { state: 'planned' }
            }
          ]
        }
      ]);
    }
    setNewControlIdInput('');
    setShowAddModal(false);
  };

  const handleRowClick = (item: any) => {
    if (openDetail) {
      openDetail('control', item.req || { 'control-id': item.id, uuid: crypto.randomUUID(), title: item.title });
    }
    if (onSelectControl) {
      onSelectControl(item.id);
    }
  };

  return (
    <div data-testid="control-implementation-tab" className="ctrl-imp-tab p-6 h-full flex flex-col gap-6 overflow-y-auto">
      {/* Top Overview & Progress */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Control Implementation Coverage
            </h3>
            <p className="text-xs text-gray-500">
              Tracking satisfying components, operational statuses, and parameter overrides across {statusStats.total} baseline controls.
            </p>
          </div>
          <div className="w-full md:w-72">
            <ProgressBar progress={coveragePercent} label={`Implementation Coverage (${coveragePercent}%)`} />
          </div>
        </div>

        {/* Status Metrics Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
          <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
            <span className="text-xs text-gray-500 font-medium block">Total Controls</span>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{statusStats.total}</span>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900/50 text-center">
            <span className="text-xs text-green-700 dark:text-green-300 font-medium block">Implemented</span>
            <span className="text-lg font-bold text-green-700 dark:text-green-300">{statusStats.implemented}</span>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900/50 text-center">
            <span className="text-xs text-amber-700 dark:text-amber-300 font-medium block">Partial</span>
            <span className="text-lg font-bold text-amber-700 dark:text-amber-300">{statusStats.partial}</span>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900/50 text-center">
            <span className="text-xs text-blue-700 dark:text-blue-300 font-medium block">Planned</span>
            <span className="text-lg font-bold text-blue-700 dark:text-blue-300">{statusStats.planned}</span>
          </div>
          <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-900/50 text-center">
            <span className="text-xs text-purple-700 dark:text-purple-300 font-medium block">Alternative</span>
            <span className="text-lg font-bold text-purple-700 dark:text-purple-300">{statusStats.alternative}</span>
          </div>
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 text-center">
            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium block">Undocumented</span>
            <span className="text-lg font-bold text-gray-700 dark:text-gray-300">{statusStats.undocumented}</span>
          </div>
        </div>

        {/* Global Strategy Narrative */}
        {isEditing ? (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Top-Level Implementation Methodology & Strategy Description
            </label>
            <textarea
              rows={2}
              className="form-textarea w-full text-sm rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
              placeholder="Describe the system's overarching defense-in-depth architecture and compliance methodology..."
              value={ctrlImp.description || ''}
              onChange={e => {
                if (dispatch) {
                  dispatch(setControlImplementationDescription(e.target.value));
                } else if (handleUpdateField) {
                  handleUpdateField(['control-implementation', 'description'], e.target.value);
                }
              }}
            />
          </div>
        ) : (
          ctrlImp.description && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 italic">
              {ctrlImp.description}
            </div>
          )
        )}
      </div>

      {/* Main Table & Controls Toolbar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50 dark:bg-gray-900/30">
          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <input
              type="text"
              data-testid="search-controls-input"
              className="form-input text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 min-w-[200px]"
              placeholder="Search by Control ID, title, or component..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />

            <select
              data-testid="status-filter-select"
              className="form-select text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="implemented">Implemented</option>
              <option value="partial">Partial</option>
              <option value="planned">Planned</option>
              <option value="alternative">Alternative</option>
              <option value="not-applicable">Not Applicable</option>
              <option value="undocumented">Undocumented</option>
            </select>

            <select
              data-testid="origination-filter-select"
              className="form-select text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
              value={originationFilter}
              onChange={e => setOriginationFilter(e.target.value)}
            >
              <option value="all">All Originations</option>
              <option value="organization">Organization</option>
              <option value="system-specific">System-Specific</option>
              <option value="customer-configured">Customer-Configured</option>
              <option value="customer-provided">Customer-Provided</option>
              <option value="inherited">Inherited</option>
            </select>
          </div>

          {/* Action buttons & Batch Operations */}
          <div className="flex items-center gap-2">
            {selectedReqIds.size > 0 && isEditing && (
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/50 px-2 py-1 rounded border border-blue-200 dark:border-blue-800">
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                  {selectedReqIds.size} selected
                </span>
                <button
                  type="button"
                  data-testid="batch-init-btn"
                  className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition"
                  onClick={handleBatchInitialize}
                  title="Initialize implemented requirements for selected baseline controls"
                >
                  Init Selected
                </button>
                <button
                  type="button"
                  data-testid="batch-delete-btn"
                  className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition"
                  onClick={handleBatchDelete}
                  title="Delete implemented requirement records for selected controls"
                >
                  Delete Selected
                </button>
              </div>
            )}

            {isEditing && (
              <button
                type="button"
                data-testid="add-requirement-btn"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-sm transition"
                onClick={() => setShowAddModal(true)}
              >
                + Add Implemented Requirement
              </button>
            )}
          </div>
        </div>

        {/* Controls Table */}
        <div className="flex-1 overflow-x-auto">
          <table data-testid="controls-table" className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 uppercase font-semibold text-[11px]">
                {isEditing && (
                  <th className="p-3 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={filteredControls.length > 0 && selectedReqIds.size === filteredControls.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                )}
                <th className="p-3">Control ID</th>
                <th className="p-3">Title / Summary</th>
                <th className="p-3">Implemented Components</th>
                <th className="p-3">Origination</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredControls.length === 0 ? (
                <tr>
                  <td colSpan={isEditing ? 7 : 6} className="p-8 text-center text-gray-500">
                    No matching controls found.
                  </td>
                </tr>
              ) : (
                filteredControls.map(item => {
                  const req = item.req;
                  const byComps = req?.['by-components'] || [];
                  const state = req ? (byComps[0]?.['implementation-status']?.state || 'planned') : 'undocumented';
                  const origProp = req?.props?.find((p: any) => p.name === 'control-origination');
                  const origValue = origProp ? origProp.value : (req ? 'system-specific' : '—');
                  const isSelected = selectedReqIds.has(item.id);

                  return (
                    <tr
                      key={item.id}
                      data-testid={`control-row-${item.id}`}
                      className={`hover:bg-blue-50/40 dark:hover:bg-blue-950/20 cursor-pointer transition ${
                        isSelected ? 'bg-blue-50/60 dark:bg-blue-950/40' : ''
                      }`}
                      onClick={() => handleRowClick(item)}
                    >
                      {isEditing && (
                        <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(item.id)}
                          />
                        </td>
                      )}
                      <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {item.id}
                      </td>
                      <td className="p-3 font-medium text-gray-800 dark:text-gray-200 max-w-xs truncate">
                        {item.title}
                      </td>
                      <td className="p-3">
                        {byComps.length === 0 ? (
                          <span className="text-gray-400 italic">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {byComps.map((bc: any, idx: number) => {
                              const comp = components.find(c => c.uuid === bc['component-uuid']);
                              return (
                                <span
                                  key={bc.uuid || idx}
                                  className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-[11px] font-medium"
                                >
                                  {comp ? comp.title : bc['component-uuid']?.substring(0, 8)}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded text-[11px]">
                          {origValue}
                        </span>
                      </td>
                      <td className="p-3">
                        {req ? (
                          <StatusBadge status={state} category="implementation-status" />
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded text-[11px]">
                            Undocumented
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          className="text-blue-600 dark:text-blue-400 hover:underline font-semibold mr-2"
                          onClick={() => handleRowClick(item)}
                        >
                          {req ? 'Edit' : 'Implement'}
                        </button>
                        {isEditing && req && (
                          <button
                            type="button"
                            className="text-red-500 hover:underline"
                            onClick={() => {
                              if (dispatch) {
                                dispatch(removeImplementedRequirement(item.id));
                              } else if (handleUpdateField) {
                                handleUpdateField(
                                  ['control-implementation', 'implemented-requirements'],
                                  implementedReqs.filter(r => r['control-id'] !== item.id && r.uuid !== req.uuid)
                                );
                              }
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Implemented Requirement Modal */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl flex flex-col gap-4 border border-gray-200 dark:border-gray-700"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Add Implemented Requirement
            </h3>
            <p className="text-xs text-gray-500">
              Enter the Control ID (e.g. <code>ac-1</code>, <code>ia-2</code>, <code>sc-7</code>) to create an implementation requirement.
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                Control ID
              </label>
              <input
                type="text"
                data-testid="add-control-id-input"
                className="form-input w-full text-sm rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 font-mono"
                placeholder="e.g. ac-1"
                value={newControlIdInput}
                onChange={e => setNewControlIdInput(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded font-medium"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="submit-add-control-btn"
                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition"
                onClick={handleAddControlReq}
              >
                Create Requirement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ControlImplementationTab;
