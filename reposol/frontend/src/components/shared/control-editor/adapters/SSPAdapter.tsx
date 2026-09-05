import React, { useState } from 'react';
import { useControlEditorContext } from '../ControlEditorContext';
import StatusBadge from '@components/shared/status/StatusBadge';
import {
  ImplementedRequirement,
  ByComponent,
  SystemComponent,
  SetParameter,
  StatementImplementation,
  InheritedControlImplementation,
  SatisfiedControlImplementation,
  ExportControlImplementation,
  Control
} from '@lib/types/oscal';
import {
  upsertImplementedRequirement,
  removeImplementedRequirement,
  addByComponent,
  updateByComponent,
  removeByComponent,
  addStatementByComponent,
  updateStatementByComponent,
  removeStatementByComponent,
  setSSPParameterValue,
  setSecurityInheritance
} from '@lib/document-actions/ssp-actions';

export interface SSPAdapterProps {
  control?: Control;
  isEditing?: boolean;
  onChange?: (updated: any) => void;
  implementation?: ImplementedRequirement;
  components?: SystemComponent[];
  catalog?: any;
  profile?: any;
  ssp?: any;
  dispatch?: any;
  allUsedPropKeys?: string[];
}

const ORIGINATION_OPTIONS = [
  { value: 'organization', label: 'Organization-Wide / Policy (organization)' },
  { value: 'system-specific', label: 'System-Specific Implementation (system-specific)' },
  { value: 'customer-configured', label: 'Customer-Configured (customer-configured)' },
  { value: 'customer-provided', label: 'Customer-Provided (customer-provided)' },
  { value: 'inherited', label: 'Inherited from Provider (inherited)' }
];

const STATUS_OPTIONS = [
  { value: 'implemented', label: 'Implemented / Satisfied', badge: 'implemented' },
  { value: 'partial', label: 'Partially Implemented', badge: 'partial' },
  { value: 'planned', label: 'Planned', badge: 'planned' },
  { value: 'alternative', label: 'Alternative / Compensating', badge: 'alternative' },
  { value: 'not-applicable', label: 'Not Applicable', badge: 'not-applicable' }
];

export function SSPAdapter(props: SSPAdapterProps) {
  const ctx = useControlEditorContext();
  const isEditing = props.isEditing ?? ctx.isEditing ?? false;
  const control = props.control || ctx.control;
  const dispatch = props.dispatch || ctx.dispatch;
  const ssp = props.ssp;
  const controlId = control?.id || '';

  const [activeTab, setActiveTab] = useState<'by-components' | 'statements' | 'parameters' | 'inheritance'>('by-components');
  const [inheritanceMode, setInheritanceMode] = useState<'consumer' | 'provider'>('consumer');
  const [selectedByCompIndex, setSelectedByCompIndex] = useState<number>(0);
  const [paramInputValues, setParamInputValues] = useState<Record<string, string>>({});
  const [paramInputRemarks, setParamInputRemarks] = useState<Record<string, string>>({});

  // Resolve components from props or ssp root
  const components: SystemComponent[] =
    props.components ||
    ssp?.['system-implementation']?.components ||
    [];

  // Locate the implemented requirement for this control
  const implementation: ImplementedRequirement | undefined =
    props.implementation ||
    ssp?.['control-implementation']?.['implemented-requirements']?.find(
      (r: any) => r['control-id'] === controlId || (controlId && r['control-id']?.toLowerCase() === controlId.toLowerCase())
    );

  const byComponents = implementation?.['by-components'] || [];
  const currentByComp = byComponents[selectedByCompIndex] || byComponents[0];

  // Default component fallback UUID (e.g. this-system or first component)
  const defaultCompUuid =
    components.find(c => c.type === 'this-system')?.uuid ||
    components[0]?.uuid ||
    'this-system';

  // Control origination property
  const currentOrigination =
    implementation?.props?.find((p: any) => p.name === 'control-origination')?.value ||
    'system-specific';

  // 1. Requirement initialization
  const handleInitializeRequirement = () => {
    if (!dispatch || !controlId) return;
    const newReq: ImplementedRequirement = {
      uuid: crypto.randomUUID(),
      'control-id': controlId,
      props: [{ name: 'control-origination', value: 'system-specific' }],
      'by-components': [
        {
          uuid: crypto.randomUUID(),
          'component-uuid': defaultCompUuid,
          description: '',
          'implementation-status': { state: 'planned' }
        }
      ]
    };
    dispatch(upsertImplementedRequirement(newReq));
  };

  // 2. Control Origination Change
  const handleOriginationChange = (origValue: string) => {
    if (!dispatch || !controlId) return;
    const existingProps = (implementation?.props || []).filter((p: any) => p.name !== 'control-origination');
    const updatedProps = [...existingProps, { name: 'control-origination', value: origValue }];
    dispatch(upsertImplementedRequirement({
      'control-id': controlId,
      uuid: implementation?.uuid,
      props: updatedProps
    }));
  };

  // 3. By-Components CRUD
  const handleAddByComp = () => {
    if (!dispatch || !controlId) return;
    dispatch(
      addByComponent(controlId, {
        uuid: crypto.randomUUID(),
        'component-uuid': defaultCompUuid,
        description: '',
        'implementation-status': { state: 'planned' }
      })
    );
    setSelectedByCompIndex(byComponents.length);
  };

  const handleUpdateByCompField = (byCompUuid: string, fieldUpdates: Partial<ByComponent>) => {
    if (!dispatch || !controlId) return;
    dispatch(updateByComponent(controlId, byCompUuid, fieldUpdates));
  };

  const handleRemoveByComp = (byCompUuid: string) => {
    if (!dispatch || !controlId) return;
    dispatch(removeByComponent(controlId, byCompUuid));
    if (selectedByCompIndex > 0) {
      setSelectedByCompIndex(selectedByCompIndex - 1);
    }
  };

  // 4. Statements Extraction
  const extractStatementParts = (parts: any[] = []): { id: string; name: string; prose?: string }[] => {
    const list: { id: string; name: string; prose?: string }[] = [];
    const traverse = (items: any[]) => {
      for (const item of items) {
        if (item.name === 'statement' || item.name === 'item' || (item.id && item.id.includes('smt'))) {
          list.push({ id: item.id, name: item.name || 'statement', prose: item.prose });
        }
        if (item.parts) traverse(item.parts);
      }
    };
    traverse(parts);
    return list;
  };

  const statementParts = extractStatementParts(control?.parts || []);

  // 5. Parameters Collection & 4-Tier Cascade Calculation
  const allParams = React.useMemo(() => {
    const paramsList: any[] = [];
    if (control?.params) {
      control.params.forEach((p: any) => paramsList.push({ ...p, originScope: 'control-def' }));
    }
    if (props.catalog?.params) {
      props.catalog.params.forEach((p: any) => {
        if (!paramsList.some(item => (item.id || item['param-id']) === (p.id || p['param-id']))) {
          paramsList.push({ ...p, originScope: 'catalog' });
        }
      });
    }
    // Scan prose for parameter placeholders
    const findParamsInProse = (parts: any[] = []) => {
      const regex = /\{\{\s*insert:\s*param,\s*([^\s}]+)\s*\}\}/g;
      const traverse = (items: any[]) => {
        for (const it of items) {
          if (it.prose) {
            let match;
            while ((match = regex.exec(it.prose)) !== null) {
              const pid = match[1];
              if (!paramsList.some(item => (item.id || item['param-id']) === pid)) {
                paramsList.push({ id: pid, 'param-id': pid, originScope: 'prose-placeholder' });
              }
            }
          }
          if (it.parts) traverse(it.parts);
        }
      };
      traverse(parts);
    };
    findParamsInProse(control?.parts || []);
    return paramsList;
  }, [control, props.catalog]);

  const resolveCascade = (paramId: string) => {
    const pidLower = paramId.toLowerCase();

    // Tier 1: Component Override
    const compOverride = currentByComp?.['set-parameters']?.find(
      sp => (sp['param-id'] || (sp as any).id)?.toLowerCase() === pidLower
    );
    if (compOverride && compOverride.values && compOverride.values.length > 0) {
      return {
        effectiveValues: compOverride.values,
        origin: 'Component Override',
        tier: 1,
        badgeColor: '#10b981', // green
        override: compOverride
      };
    }

    // Tier 2: Control Level Override
    const ctrlOverride = implementation?.['set-parameters']?.find(
      sp => (sp['param-id'] || (sp as any).id)?.toLowerCase() === pidLower
    );
    if (ctrlOverride && ctrlOverride.values && ctrlOverride.values.length > 0) {
      return {
        effectiveValues: ctrlOverride.values,
        origin: 'Control Level',
        tier: 2,
        badgeColor: '#3b82f6', // blue
        override: ctrlOverride
      };
    }

    // Tier 3: SSP Global Override
    const globalOverride = ssp?.['control-implementation']?.['set-parameters']?.find(
      (sp: any) => (sp['param-id'] || sp.id)?.toLowerCase() === pidLower
    );
    if (globalOverride && globalOverride.values && globalOverride.values.length > 0) {
      return {
        effectiveValues: globalOverride.values,
        origin: 'SSP Global',
        tier: 3,
        badgeColor: '#8b5cf6', // purple
        override: globalOverride
      };
    }

    // Tier 4: Baseline Default
    const baselineParam = allParams.find(
      p => (p.id || p['param-id'])?.toLowerCase() === pidLower
    );
    const profileOverride = props.profile?.modify?.['set-parameters']?.find(
      (sp: any) => (sp['param-id'] || sp.id)?.toLowerCase() === pidLower
    );

    const baselineVals = profileOverride?.values || baselineParam?.values;
    if (baselineVals && baselineVals.length > 0) {
      return {
        effectiveValues: baselineVals,
        origin: profileOverride ? 'Profile Baseline' : 'Catalog Default',
        tier: 4,
        badgeColor: '#f59e0b', // amber
        override: null
      };
    }

    return {
      effectiveValues: [],
      origin: 'Unset',
      tier: 5,
      badgeColor: '#6b7280', // gray
      override: null
    };
  };

  // 6. Security Inheritance handlers
  const handleAddInherited = () => {
    if (!dispatch || !controlId || !currentByComp) return;
    const currentInherited = currentByComp.inherited || [];
    const newInherited: InheritedControlImplementation = {
      uuid: crypto.randomUUID(),
      description: 'Inherited security capability from common control provider'
    };
    dispatch(
      setSecurityInheritance(controlId, currentByComp.uuid, {
        inherited: [...currentInherited, newInherited]
      })
    );
  };

  const handleUpdateInherited = (idx: number, updates: Partial<InheritedControlImplementation>) => {
    if (!dispatch || !controlId || !currentByComp) return;
    const currentInherited = [...(currentByComp.inherited || [])];
    if (currentInherited[idx]) {
      currentInherited[idx] = { ...currentInherited[idx], ...updates };
      dispatch(
        setSecurityInheritance(controlId, currentByComp.uuid, {
          inherited: currentInherited
        })
      );
    }
  };

  const handleRemoveInherited = (idx: number) => {
    if (!dispatch || !controlId || !currentByComp) return;
    const currentInherited = (currentByComp.inherited || []).filter((_, i) => i !== idx);
    dispatch(
      setSecurityInheritance(controlId, currentByComp.uuid, {
        inherited: currentInherited
      })
    );
  };

  const handleAddSatisfied = () => {
    if (!dispatch || !controlId || !currentByComp) return;
    const currentSatisfied = currentByComp.satisfied || [];
    const newSatisfied: SatisfiedControlImplementation = {
      uuid: crypto.randomUUID(),
      description: 'Customer responsibility satisfied through operational configuration'
    };
    dispatch(
      setSecurityInheritance(controlId, currentByComp.uuid, {
        satisfied: [...currentSatisfied, newSatisfied]
      })
    );
  };

  const handleUpdateSatisfied = (idx: number, updates: Partial<SatisfiedControlImplementation>) => {
    if (!dispatch || !controlId || !currentByComp) return;
    const currentSatisfied = [...(currentByComp.satisfied || [])];
    if (currentSatisfied[idx]) {
      currentSatisfied[idx] = { ...currentSatisfied[idx], ...updates };
      dispatch(
        setSecurityInheritance(controlId, currentByComp.uuid, {
          satisfied: currentSatisfied
        })
      );
    }
  };

  const handleRemoveSatisfied = (idx: number) => {
    if (!dispatch || !controlId || !currentByComp) return;
    const currentSatisfied = (currentByComp.satisfied || []).filter((_, i) => i !== idx);
    dispatch(
      setSecurityInheritance(controlId, currentByComp.uuid, {
        satisfied: currentSatisfied
      })
    );
  };

  const handleAddExportProvided = () => {
    if (!dispatch || !controlId || !currentByComp) return;
    const currentExport = currentByComp.export || {};
    const provided = currentExport.provided || [];
    const updated = {
      ...currentExport,
      provided: [...provided, { uuid: crypto.randomUUID(), description: 'Exported capability provided to consumers' }]
    };
    dispatch(setSecurityInheritance(controlId, currentByComp.uuid, { export: updated }));
  };

  const handleUpdateExportProvided = (idx: number, updates: any) => {
    if (!dispatch || !controlId || !currentByComp) return;
    const currentExport = currentByComp.export || {};
    const provided = [...(currentExport.provided || [])];
    if (provided[idx]) {
      provided[idx] = { ...provided[idx], ...updates };
      dispatch(setSecurityInheritance(controlId, currentByComp.uuid, { export: { ...currentExport, provided } }));
    }
  };

  const handleRemoveExportProvided = (idx: number) => {
    if (!dispatch || !controlId || !currentByComp) return;
    const currentExport = currentByComp.export || {};
    const provided = (currentExport.provided || []).filter((_, i) => i !== idx);
    dispatch(setSecurityInheritance(controlId, currentByComp.uuid, { export: { ...currentExport, provided } }));
  };

  const handleAddExportResponsibility = () => {
    if (!dispatch || !controlId || !currentByComp) return;
    const currentExport = currentByComp.export || {};
    const responsibilities = currentExport.responsibilities || [];
    const updated = {
      ...currentExport,
      responsibilities: [...responsibilities, { uuid: crypto.randomUUID(), description: 'Customer responsibility required for consumers' }]
    };
    dispatch(setSecurityInheritance(controlId, currentByComp.uuid, { export: updated }));
  };

  const handleUpdateExportResponsibility = (idx: number, updates: any) => {
    if (!dispatch || !controlId || !currentByComp) return;
    const currentExport = currentByComp.export || {};
    const responsibilities = [...(currentExport.responsibilities || [])];
    if (responsibilities[idx]) {
      responsibilities[idx] = { ...responsibilities[idx], ...updates };
      dispatch(setSecurityInheritance(controlId, currentByComp.uuid, { export: { ...currentExport, responsibilities } }));
    }
  };

  const handleRemoveExportResponsibility = (idx: number) => {
    if (!dispatch || !controlId || !currentByComp) return;
    const currentExport = currentByComp.export || {};
    const responsibilities = (currentExport.responsibilities || []).filter((_, i) => i !== idx);
    dispatch(setSecurityInheritance(controlId, currentByComp.uuid, { export: { ...currentExport, responsibilities } }));
  };

  if (!implementation && !isEditing) {
    return (
      <div data-testid="ssp-adapter" className="ssp-adapter mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
        <div className="text-gray-500 italic text-sm">
          No implementation details documented for control <span className="font-mono font-bold">{controlId}</span>.
        </div>
      </div>
    );
  }

  return (
    <div data-testid="ssp-adapter" className="ssp-adapter mt-6 border-t border-gray-200 dark:border-gray-700 pt-6 flex flex-col gap-6">
      {/* Control Header & Origination Toolbar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400">Step 4 SSP Implementation</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span className="font-mono text-sm font-semibold">{controlId}</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">
            System Control Implementation
          </h3>
        </div>

        {implementation ? (
          <div className="flex items-center gap-3 w-full md:w-auto">
            <label htmlFor="control-origination-select" className="text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Origination:
            </label>
            {isEditing ? (
              <select
                id="control-origination-select"
                data-testid="control-origination-select"
                className="form-select text-sm rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 py-1 px-2"
                value={currentOrigination}
                onChange={e => handleOriginationChange(e.target.value)}
              >
                {ORIGINATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <span data-testid="origination-badge" className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                {ORIGINATION_OPTIONS.find(o => o.value === currentOrigination)?.label || currentOrigination}
              </span>
            )}
          </div>
        ) : (
          isEditing && (
            <button
              type="button"
              data-testid="initialize-requirement-btn"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded shadow-sm transition"
              onClick={handleInitializeRequirement}
            >
              + Start Implementing Control
            </button>
          )
        )}
      </div>

      {/* If requirement is implemented, show sub-tabs */}
      {implementation && (
        <div className="flex flex-col gap-4">
          {/* Sub-Tab Navigation */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 gap-2">
            {[
              { id: 'by-components', label: `🧱 By-Components (${byComponents.length})` },
              { id: 'statements', label: `📑 Statement Mappings (${(implementation.statements || []).length})` },
              { id: 'parameters', label: `⚙️ 4-Tier Parameters (${allParams.length})` },
              { id: 'inheritance', label: `🔗 Security Inheritance` }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`py-2 px-4 text-sm font-medium border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
                onClick={() => setActiveTab(tab.id as any)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: By-Components Editor (US 4.15, US 4.16) */}
          {activeTab === 'by-components' && (
            <div data-testid="by-components-list" className="flex flex-col gap-4">
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 p-2.5 rounded">
                💡 <strong>NIST OSCAL Requirement:</strong> Control implementation narratives must reside within component entries (<code>by-components</code>) with at least 1 component satisfying the requirement.
              </div>

              {/* By-Component Navigation Pill Row */}
              <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
                <div className="flex gap-2">
                  {byComponents.map((bc, idx) => {
                    const comp = components.find(c => c.uuid === bc['component-uuid']);
                    const title = comp ? comp.title : bc['component-uuid'] || `Component ${idx + 1}`;
                    const state = bc['implementation-status']?.state || 'planned';
                    return (
                      <button
                        key={bc.uuid || idx}
                        type="button"
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 border transition ${
                          selectedByCompIndex === idx
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                        }`}
                        onClick={() => setSelectedByCompIndex(idx)}
                      >
                        <span>{title}</span>
                        <StatusBadge status={state} category="implementation-status" />
                      </button>
                    );
                  })}
                </div>

                {isEditing && (
                  <button
                    type="button"
                    data-testid="add-by-component-btn"
                    className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-800 dark:text-gray-200 rounded font-medium border border-gray-300 dark:border-gray-600 transition whitespace-nowrap"
                    onClick={handleAddByComp}
                  >
                    + Add Component
                  </button>
                )}
              </div>

              {/* Active By-Component Editor Card */}
              {currentByComp ? (
                <div data-testid="by-component-card" className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col gap-4">
                  {/* Top Grid: Component selector & Status */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                        Implementing Component (system-component)
                      </label>
                      {isEditing ? (
                        <div className="flex gap-2">
                          <select
                            data-testid="component-selector"
                            className="form-select w-full text-sm rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                            value={currentByComp['component-uuid']}
                            onChange={e => handleUpdateByCompField(currentByComp.uuid, { 'component-uuid': e.target.value })}
                          >
                            {components.map(c => (
                              <option key={c.uuid} value={c.uuid}>
                                {c.title} ({c.type}) {c.type === 'this-system' ? '★' : ''}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            data-testid="assign-this-system-btn"
                            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-700 dark:text-gray-200 rounded whitespace-nowrap"
                            title="Assign to root This System component"
                            onClick={() => {
                              const root = components.find(c => c.type === 'this-system');
                              if (root) handleUpdateByCompField(currentByComp.uuid, { 'component-uuid': root.uuid });
                            }}
                          >
                            This System
                          </button>
                        </div>
                      ) : (
                        <div className="text-sm font-medium py-1">
                          {components.find(c => c.uuid === currentByComp['component-uuid'])?.title || currentByComp['component-uuid']}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                        Implementation Status
                      </label>
                      {isEditing ? (
                        <select
                          data-testid="status-selector"
                          className="form-select w-full text-sm rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                          value={currentByComp['implementation-status']?.state || 'planned'}
                          onChange={e =>
                            handleUpdateByCompField(currentByComp.uuid, {
                              'implementation-status': {
                                state: e.target.value as any,
                                remarks: currentByComp['implementation-status']?.remarks
                              }
                            })
                          }
                        >
                          {STATUS_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="py-1">
                          <StatusBadge status={currentByComp['implementation-status']?.state || 'planned'} category="implementation-status" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Remarks */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                      Status Remarks / Justification (Required for Partial, Alternative, Planned, or N/A)
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        data-testid="status-remarks-input"
                        className="form-input w-full text-sm rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                        placeholder="e.g. Planned implementation date: 2026-11-30, or Compensating proxy controls in place..."
                        value={currentByComp['implementation-status']?.remarks || ''}
                        onChange={e =>
                          handleUpdateByCompField(currentByComp.uuid, {
                            'implementation-status': {
                              state: currentByComp['implementation-status']?.state || 'planned',
                              remarks: e.target.value
                            }
                          })
                        }
                      />
                    ) : (
                      <div className="text-sm text-gray-600 dark:text-gray-400 italic">
                        {currentByComp['implementation-status']?.remarks || 'No remarks provided.'}
                      </div>
                    )}
                  </div>

                  {/* Implementation Narrative Textarea */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                      Implementation Narrative (How this component satisfies the requirement)
                    </label>
                    {isEditing ? (
                      <textarea
                        data-testid="by-comp-narrative-input"
                        rows={5}
                        className="form-textarea w-full text-sm rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                        placeholder="Provide detailed technical or procedural implementation prose for this component..."
                        value={currentByComp.description || ''}
                        onChange={e => handleUpdateByCompField(currentByComp.uuid, { description: e.target.value })}
                      />
                    ) : (
                      <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 text-sm whitespace-pre-wrap">
                        {currentByComp.description || 'No implementation narrative documented.'}
                      </div>
                    )}
                  </div>

                  {/* Remove Button */}
                  {isEditing && byComponents.length > 1 && (
                    <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-700">
                      <button
                        type="button"
                        data-testid="remove-by-component-btn"
                        className="text-xs text-red-600 hover:text-red-700 font-medium"
                        onClick={() => handleRemoveByComp(currentByComp.uuid)}
                      >
                        🗑️ Remove this By-Component
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500 bg-gray-50 dark:bg-gray-800 rounded">
                  No by-components declared. Click "+ Add Component" above.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Statement-Level Mappings (US 4.16, US 4.17) */}
          {activeTab === 'statements' && (
            <div data-testid="statements-section" className="flex flex-col gap-4">
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 rounded">
                Document how sub-clauses and fine-grained statement parts (e.g. <code>part a</code>, <code>part b</code>) are satisfied by specific components.
              </div>

              {statementParts.length === 0 ? (
                <div className="p-6 text-center text-gray-500 bg-gray-50 dark:bg-gray-800 rounded">
                  No individual statement parts detected in this control definition.
                </div>
              ) : (
                statementParts.map(stmt => {
                  const matchingStmtImpl = implementation.statements?.find(s => s['statement-id'] === stmt.id);
                  const stmtByComps = matchingStmtImpl?.['by-components'] || [];

                  return (
                    <div key={stmt.id} data-testid="statement-item" className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 font-mono text-xs font-bold rounded">
                            {stmt.id}
                          </span>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-1">
                            {stmt.prose || `Statement clause ${stmt.id}`}
                          </p>
                        </div>
                        {isEditing && (
                          <button
                            type="button"
                            data-testid="add-statement-by-comp-btn"
                            className="px-2 py-1 text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 rounded font-medium border border-blue-200 dark:border-blue-800 whitespace-nowrap"
                            onClick={() =>
                              dispatch(
                                addStatementByComponent(controlId, stmt.id, {
                                  uuid: crypto.randomUUID(),
                                  'component-uuid': defaultCompUuid,
                                  description: '',
                                  'implementation-status': { state: 'planned' }
                                })
                              )
                            }
                          >
                            + Map Component to {stmt.id}
                          </button>
                        )}
                      </div>

                      {/* Statement By-Components */}
                      {stmtByComps.length > 0 && (
                        <div className="flex flex-col gap-2 pl-4 border-l-2 border-blue-500/30 mt-2">
                          {stmtByComps.map((sbc, sIdx) => {
                            const comp = components.find(c => c.uuid === sbc['component-uuid']);
                            return (
                              <div key={sbc.uuid || sIdx} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-200 dark:border-gray-800 flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                      {comp ? comp.title : sbc['component-uuid']}
                                    </span>
                                    <StatusBadge status={sbc['implementation-status']?.state || 'planned'} category="implementation-status" />
                                  </div>
                                  {isEditing && (
                                    <button
                                      type="button"
                                      className="text-xs text-red-500 hover:underline"
                                      onClick={() => dispatch(removeStatementByComponent(controlId, stmt.id, sbc.uuid))}
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                                {isEditing ? (
                                  <textarea
                                    data-testid="statement-by-comp-narrative"
                                    rows={2}
                                    className="form-textarea text-xs w-full rounded border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                                    placeholder="Describe implementation for this specific statement..."
                                    value={sbc.description || ''}
                                    onChange={e =>
                                      dispatch(
                                        updateStatementByComponent(controlId, stmt.id, sbc.uuid, {
                                          description: e.target.value
                                        })
                                      )
                                    }
                                  />
                                ) : (
                                  <div className="text-xs text-gray-600 dark:text-gray-300">{sbc.description}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: 4-Tier Parameter Cascade Visualizer (US 4.19, DD-012, DD-036) */}
          {activeTab === 'parameters' && (
            <div className="flex flex-col gap-4">
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 rounded">
                <strong>4-Tier Hierarchy:</strong> Parameter values resolve hierarchically:
                <br />
                <code>[Tier 1: Component Override]</code> &gt; <code>[Tier 2: Control Level]</code> &gt; <code>[Tier 3: SSP Global Default]</code> &gt; <code>[Tier 4: Baseline Default]</code>.
              </div>

              {allParams.length === 0 ? (
                <div className="p-6 text-center text-gray-500 bg-gray-50 dark:bg-gray-800 rounded">
                  No parameters associated with this control.
                </div>
              ) : (
                allParams.map(param => {
                  const paramId = param.id || param['param-id'];
                  const cascade = resolveCascade(paramId);
                  const effectiveStr = cascade.effectiveValues.join(', ');
                  const isLocalOverride = cascade.tier === 2;

                  return (
                    <div
                      key={paramId}
                      data-testid="param-cascade-card"
                      className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col gap-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                              {paramId}
                            </span>
                            <span className="text-xs text-gray-500">{param.label || param.title}</span>
                          </div>
                          {param.guidelines?.[0]?.prose && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                              Guidance: {param.guidelines[0].prose}
                            </p>
                          )}
                        </div>

                        {/* Active Effective Value Badge */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500">Effective:</span>
                          <span
                            data-testid="param-effective-badge"
                            style={{
                              backgroundColor: `${cascade.badgeColor}20`,
                              color: cascade.badgeColor,
                              border: `1px solid ${cascade.badgeColor}40`
                            }}
                            className="px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5"
                          >
                            <span>{effectiveStr || '[Unset]'}</span>
                            <span className="text-[10px] uppercase tracking-wider opacity-80">({cascade.origin})</span>
                          </span>
                        </div>
                      </div>

                      {/* Cascade Breakdown Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-gray-50 dark:bg-gray-900/60 p-2.5 rounded text-xs">
                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase font-bold">1. Component Override</span>
                          <span className="font-mono text-gray-700 dark:text-gray-300">
                            {currentByComp?.['set-parameters']?.find(sp => (sp['param-id'] || (sp as any).id) === paramId)?.values?.join(', ') || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase font-bold">2. Control Override</span>
                          <span className="font-mono text-gray-700 dark:text-gray-300">
                            {implementation?.['set-parameters']?.find(sp => (sp['param-id'] || (sp as any).id) === paramId)?.values?.join(', ') || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase font-bold">3. SSP Global Default</span>
                          <span className="font-mono text-gray-700 dark:text-gray-300">
                            {ssp?.['control-implementation']?.['set-parameters']?.find((sp: any) => (sp['param-id'] || sp.id) === paramId)?.values?.join(', ') || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase font-bold">4. Baseline Default</span>
                          <span className="font-mono text-gray-700 dark:text-gray-300">
                            {param.values?.join(', ') || '—'}
                          </span>
                        </div>
                      </div>

                      {/* Override Editor (Tier 2 Control Level) */}
                      {isEditing && (
                        <div className="flex flex-col sm:flex-row gap-2 items-center pt-2 border-t border-gray-100 dark:border-gray-700">
                          <input
                            type="text"
                            data-testid="param-override-input"
                            className="form-input text-xs w-full sm:flex-1 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 font-mono"
                            placeholder="Set control-level parameter value (e.g. 15 minutes, 3 attempts)..."
                            value={paramInputValues[paramId] !== undefined ? paramInputValues[paramId] : (cascade.override?.values?.join(', ') || '')}
                            onChange={e => setParamInputValues({ ...paramInputValues, [paramId]: e.target.value })}
                          />
                          <button
                            type="button"
                            data-testid="save-param-override-btn"
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold whitespace-nowrap transition"
                            onClick={() => {
                              const val = paramInputValues[paramId] !== undefined ? paramInputValues[paramId] : (cascade.override?.values?.join(', ') || '');
                              if (val.trim()) {
                                dispatch(
                                  setSSPParameterValue(paramId, [val.trim()], {
                                    controlId,
                                    remarks: paramInputRemarks[paramId]
                                  })
                                );
                              }
                            }}
                          >
                            Apply Control Override
                          </button>
                          {isLocalOverride && (
                            <button
                              type="button"
                              data-testid="reset-param-override-btn"
                              className="px-2.5 py-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 font-medium whitespace-nowrap"
                              onClick={() => {
                                dispatch(setSSPParameterValue(paramId, [], { controlId }));
                                setParamInputValues({ ...paramInputValues, [paramId]: '' });
                              }}
                            >
                              Reset to Baseline
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 4: Security Inheritance (US 4.20, DD-036) */}
          {activeTab === 'inheritance' && (
            <div data-testid="inheritance-section" className="flex flex-col gap-4">
              {/* Inheritance Mode Toggle */}
              <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg self-start">
                <button
                  type="button"
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                    inheritanceMode === 'consumer'
                      ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-300'
                  }`}
                  onClick={() => setInheritanceMode('consumer')}
                >
                  Consumer Mode (Inherited & Satisfied)
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                    inheritanceMode === 'provider'
                      ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-300'
                  }`}
                  onClick={() => setInheritanceMode('provider')}
                >
                  CSP Provider Mode (Export)
                </button>
              </div>

              {/* Consumer Mode */}
              {inheritanceMode === 'consumer' && (
                <div className="flex flex-col gap-6">
                  {/* Inherited Controls Section */}
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          Inherited Capabilities (inherited[])
                        </h4>
                        <p className="text-xs text-gray-500">
                          Protections and controls inherited directly from the underlying cloud or common control provider.
                        </p>
                      </div>
                      {isEditing && (
                        <button
                          type="button"
                          data-testid="add-inherited-btn"
                          className="px-2.5 py-1 text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded font-medium border border-blue-200 dark:border-blue-800"
                          onClick={handleAddInherited}
                        >
                          + Add Inherited
                        </button>
                      )}
                    </div>

                    {(currentByComp?.inherited || []).length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400 bg-gray-50 dark:bg-gray-900 rounded">
                        No inherited protections declared for this component.
                      </div>
                    ) : (
                      (currentByComp?.inherited || []).map((inh, iIdx) => (
                        <div key={inh.uuid || iIdx} data-testid="inherited-item" className="p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                              Inherited Protection #{iIdx + 1}
                            </span>
                            {isEditing && (
                              <button
                                type="button"
                                className="text-xs text-red-500 hover:underline"
                                onClick={() => handleRemoveInherited(iIdx)}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                className="form-input text-xs w-full rounded border-gray-300 dark:border-gray-700 dark:bg-gray-800 font-mono"
                                placeholder="Provided UUID reference (optional provider export.provided.uuid)..."
                                value={inh['provided-uuid'] || ''}
                                onChange={e => handleUpdateInherited(iIdx, { 'provided-uuid': e.target.value })}
                              />
                              <textarea
                                rows={2}
                                className="form-textarea text-xs w-full rounded border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                                placeholder="Describe inherited protections..."
                                value={inh.description || ''}
                                onChange={e => handleUpdateInherited(iIdx, { description: e.target.value })}
                              />
                            </div>
                          ) : (
                            <div className="text-xs text-gray-700 dark:text-gray-300">{inh.description}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Satisfied Customer Responsibilities Section */}
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          Satisfied Customer Responsibilities (satisfied[])
                        </h4>
                        <p className="text-xs text-gray-500">
                          How this system fulfills shared responsibilities imposed by the leveraged provider.
                        </p>
                      </div>
                      {isEditing && (
                        <button
                          type="button"
                          data-testid="add-satisfied-btn"
                          className="px-2.5 py-1 text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded font-medium border border-blue-200 dark:border-blue-800"
                          onClick={handleAddSatisfied}
                        >
                          + Add Satisfied Responsibility
                        </button>
                      )}
                    </div>

                    {(currentByComp?.satisfied || []).length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400 bg-gray-50 dark:bg-gray-900 rounded">
                        No satisfied responsibilities declared for this component.
                      </div>
                    ) : (
                      (currentByComp?.satisfied || []).map((sat, sIdx) => (
                        <div key={sat.uuid || sIdx} data-testid="satisfied-item" className="p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                              Satisfied Responsibility #{sIdx + 1}
                            </span>
                            {isEditing && (
                              <button
                                type="button"
                                className="text-xs text-red-500 hover:underline"
                                onClick={() => handleRemoveSatisfied(sIdx)}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                className="form-input text-xs w-full rounded border-gray-300 dark:border-gray-700 dark:bg-gray-800 font-mono"
                                placeholder="Responsibility UUID reference (optional provider export.responsibilities.uuid)..."
                                value={sat['responsibility-uuid'] || ''}
                                onChange={e => handleUpdateSatisfied(sIdx, { 'responsibility-uuid': e.target.value })}
                              />
                              <textarea
                                rows={2}
                                className="form-textarea text-xs w-full rounded border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                                placeholder="Describe customer satisfaction of responsibility..."
                                value={sat.description || ''}
                                onChange={e => handleUpdateSatisfied(sIdx, { description: e.target.value })}
                              />
                            </div>
                          ) : (
                            <div className="text-xs text-gray-700 dark:text-gray-300">{sat.description}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Provider Mode */}
              {inheritanceMode === 'provider' && (
                <div className="flex flex-col gap-6">
                  {/* Export Provided Capabilities */}
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          Exported Capabilities (export.provided[])
                        </h4>
                        <p className="text-xs text-gray-500">
                          Capabilities this system provides to downstream leveraging systems.
                        </p>
                      </div>
                      {isEditing && (
                        <button
                          type="button"
                          data-testid="add-export-provided-btn"
                          className="px-2.5 py-1 text-xs bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded font-medium border border-purple-200 dark:border-purple-800"
                          onClick={handleAddExportProvided}
                        >
                          + Add Exported Capability
                        </button>
                      )}
                    </div>

                    {(currentByComp?.export?.provided || []).length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400 bg-gray-50 dark:bg-gray-900 rounded">
                        No exported capabilities declared for this component.
                      </div>
                    ) : (
                      (currentByComp?.export?.provided || []).map((prov, pIdx) => (
                        <div key={prov.uuid || pIdx} data-testid="export-provided-item" className="p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                              Provided Capability #{pIdx + 1}
                            </span>
                            {isEditing && (
                              <button
                                type="button"
                                className="text-xs text-red-500 hover:underline"
                                onClick={() => handleRemoveExportProvided(pIdx)}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          {isEditing ? (
                            <textarea
                              rows={2}
                              className="form-textarea text-xs w-full rounded border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                              placeholder="Describe exported capability..."
                              value={prov.description || ''}
                              onChange={e => handleUpdateExportProvided(pIdx, { description: e.target.value })}
                            />
                          ) : (
                            <div className="text-xs text-gray-700 dark:text-gray-300">{prov.description}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Export Responsibilities */}
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          Exported Customer Responsibilities (export.responsibilities[])
                        </h4>
                        <p className="text-xs text-gray-500">
                          Responsibilities that leveraging downstream systems must fulfill.
                        </p>
                      </div>
                      {isEditing && (
                        <button
                          type="button"
                          data-testid="add-export-responsibility-btn"
                          className="px-2.5 py-1 text-xs bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded font-medium border border-purple-200 dark:border-purple-800"
                          onClick={handleAddExportResponsibility}
                        >
                          + Add Customer Responsibility
                        </button>
                      )}
                    </div>

                    {(currentByComp?.export?.responsibilities || []).length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400 bg-gray-50 dark:bg-gray-900 rounded">
                        No customer responsibilities declared for this component.
                      </div>
                    ) : (
                      (currentByComp?.export?.responsibilities || []).map((resp, rIdx) => (
                        <div key={resp.uuid || rIdx} data-testid="export-responsibility-item" className="p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                              Customer Responsibility #{rIdx + 1}
                            </span>
                            {isEditing && (
                              <button
                                type="button"
                                className="text-xs text-red-500 hover:underline"
                                onClick={() => handleRemoveExportResponsibility(rIdx)}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          {isEditing ? (
                            <textarea
                              rows={2}
                              className="form-textarea text-xs w-full rounded border-gray-300 dark:border-gray-700 dark:bg-gray-800"
                              placeholder="Describe required customer responsibility..."
                              value={resp.description || ''}
                              onChange={e => handleUpdateExportResponsibility(rIdx, { description: e.target.value })}
                            />
                          ) : (
                            <div className="text-xs text-gray-700 dark:text-gray-300">{resp.description}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SSPAdapter;
