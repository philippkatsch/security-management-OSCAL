import React from 'react';
import { useControlEditorContext } from '../ControlEditorContext';
import { PropsEditor } from '@components/shared/PropsEditor';
import { LinksEditor } from '@components/shared/LinksEditor';
import { ProseWithParams } from '@components/shared/ProseWithParams';
import {
  resolveProfilePartsForRendering,
  getModifiedPartIds as getModifiedPartIdsUtil,
  handleOriginalPartFieldChange,
  getAlterForControl,
  updateAlter,
  RenderablePart
} from '@lib/profile-alter-utils';

const REMOVE_SELECTORS = [
  { value: 'by-id', label: 'ID (by-id)' },
  { value: 'by-name', label: 'Name (by-name)' },
  { value: 'by-item-name', label: 'Item type (by-item-name)' },
  { value: 'by-class', label: 'Class (by-class)' },
  { value: 'by-ns', label: 'Namespace (by-ns)' }
];

const ADD_POSITIONS = ['before', 'after', 'starting', 'ending'];

export function ProfileAdapter({
  onChange,
  allUsedPropKeys = [],
  profile,
  onProfileChange,
  alterations = []
}: any) {
  const { isEditing, control } = useControlEditorContext();

  const handlePropsChange = (newProps: any[]) => {
    onChange?.({
      ...control,
      props: newProps
    });
  };

  const handleLinksChange = (newLinks: any[]) => {
    onChange?.({
      ...control,
      links: newLinks
    });
  };

  // Alter rules helpers (Enforces 1:1 control-to-alter mapping per R1-11)
  const handleUpdateAlterations = (updatedControlAlters: any[]) => {
    if (!profile || !onProfileChange || !control?.id) return;
    const currentAlters = profile.modify?.alters || [];
    const otherAlters = currentAlters.filter(
      (a: any) => a['control-id']?.toLowerCase() !== control.id.toLowerCase()
    );
    
    // Consolidate all alterations for this control into a single alter object
    let consolidatedAlter: any = null;
    if (updatedControlAlters && updatedControlAlters.length > 0) {
      const mergedAdds: any[] = [];
      const mergedRemoves: any[] = [];
      
      for (const a of updatedControlAlters) {
        if (Array.isArray(a.adds)) mergedAdds.push(...a.adds);
        if (Array.isArray(a.removes)) mergedRemoves.push(...a.removes);
      }

      if (mergedAdds.length > 0 || mergedRemoves.length > 0) {
        consolidatedAlter = {
          'control-id': control.id,
          ...(mergedAdds.length > 0 ? { adds: mergedAdds } : {}),
          ...(mergedRemoves.length > 0 ? { removes: mergedRemoves } : {})
        };
      }
    }
    
    const newAlters = consolidatedAlter ? [...otherAlters, consolidatedAlter] : otherAlters;
    
    const modify = profile.modify ? { ...profile.modify } : {};
    modify.alters = newAlters.length > 0 ? newAlters : undefined;
    if (!modify.alters) delete modify.alters;
    
    onProfileChange({
      ...profile,
      modify: Object.keys(modify).length > 0 ? modify : undefined
    });
  };

  const handleAddAlter = () => {
    const existingAlter = alterations.find(
      (a: any) => a['control-id']?.toLowerCase() === control?.id?.toLowerCase()
    ) || alterations[0];

    if (existingAlter) {
      // Append a default addition to the existing alter rather than creating a duplicate alter
      const adds = existingAlter.adds ? [...existingAlter.adds] : [];
      adds.push({
        position: 'ending',
        parts: [{ name: 'statement', prose: 'Custom profile statement addition.' }]
      });
      handleUpdateAlterations([{ ...existingAlter, adds }]);
    } else {
      const newAlter = {
        'control-id': control?.id,
        adds: [
          {
            position: 'ending',
            parts: [{ name: 'statement', prose: 'Custom profile statement addition.' }]
          }
        ],
        removes: []
      };
      handleUpdateAlterations([newAlter]);
    }
  };

  const handleRemoveAlter = (index: number) => {
    const updated = alterations.filter((_: any, i: number) => i !== index);
    handleUpdateAlterations(updated);
  };

  const handleAddRule = (alterIndex: number, type: 'add' | 'remove') => {
    const targetAlter = { ...alterations[alterIndex] };
    if (type === 'add') {
      const adds = targetAlter.adds ? [...targetAlter.adds] : [];
      adds.push({
        position: 'ending',
        parts: [{ name: 'statement', prose: 'Custom profile statement addition.' }]
      });
      targetAlter.adds = adds;
    } else {
      const removes = targetAlter.removes ? [...targetAlter.removes] : [];
      removes.push({ 'by-id': '' });
      targetAlter.removes = removes;
    }
    const updated = alterations.map((a: any, i: number) => i === alterIndex ? targetAlter : a);
    handleUpdateAlterations(updated);
  };

  const handleRemoveRule = (alterIndex: number, type: 'add' | 'remove', ruleIndex: number) => {
    const targetAlter = { ...alterations[alterIndex] };
    if (type === 'add') {
      targetAlter.adds = (targetAlter.adds || []).filter((_: any, i: number) => i !== ruleIndex);
      if (targetAlter.adds.length === 0) delete targetAlter.adds;
    } else {
      targetAlter.removes = (targetAlter.removes || []).filter((_: any, i: number) => i !== ruleIndex);
      if (targetAlter.removes.length === 0) delete targetAlter.removes;
    }
    const updated = alterations.map((a: any, i: number) => i === alterIndex ? targetAlter : a);
    handleUpdateAlterations(updated);
  };

  const handleRuleChange = (alterIndex: number, type: 'add' | 'remove', ruleIndex: number, field: string, val: any) => {
    const targetAlter = { ...alterations[alterIndex] };
    if (type === 'add') {
      const adds = [...(targetAlter.adds || [])];
      adds[ruleIndex] = { ...adds[ruleIndex], [field]: val };
      targetAlter.adds = adds;
    } else {
      const removes = (targetAlter.removes || []).map((r: any, i: number) => {
        if (i === ruleIndex) {
          return { [field]: val };
        }
        return r;
      });
      targetAlter.removes = removes;
    }
    const updated = alterations.map((a: any, i: number) => i === alterIndex ? targetAlter : a);
    handleUpdateAlterations(updated);
  };

  return (
    <div className="profile-adapter" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
      {/* Control Properties */}
      {(isEditing || (control?.props && control.props.length > 0)) && (
        <div className="section-container" style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px' }}>
          <PropsEditor
            props={control?.props || []}
            onChange={handlePropsChange}
            allUsedKeys={allUsedPropKeys}
            readOnly={!isEditing}
          />
        </div>
      )}

      {/* Control Links & References / Mappings */}
      {(isEditing || (control?.links && control.links.length > 0)) && (
        <div className="section-container" style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px' }}>
          <LinksEditor
            links={control?.links || []}
            onChange={handleLinksChange}
            readOnly={!isEditing}
          />
        </div>
      )}

      {/* Control Specific Alterations & Overrides (alters) */}
      {(isEditing || alterations.length > 0) && (
        <div 
          className="section-container" 
          style={{ 
            background: 'var(--color-surface)', 
            border: '1px solid var(--color-border)', 
            borderRadius: 'var(--radius-lg)', 
            padding: '24px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '16px',
            marginTop: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>
              Profile Alterations (`alters` for {control?.id})
            </h4>
            {isEditing && (
              <button
                type="button"
                onClick={handleAddAlter}
                style={{
                  background: 'var(--color-primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                ➕ Add Alteration Block
              </button>
            )}
          </div>

          {alterations.length === 0 ? (
            <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              No custom alterations defined for this control.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {alterations.map((alter: any, aIdx: number) => (
                <div 
                  key={`alter-${aIdx}`}
                  style={{
                    background: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                      Alteration #{aIdx + 1} ({control?.id})
                    </span>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAlter(aIdx)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--color-danger)',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        🗑️ Remove Block
                      </button>
                    )}
                  </div>

                  {/* Additions (alters.adds) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-success)' }}>
                        ➕ Structural Additions (`adds`)
                      </span>
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => handleAddRule(aIdx, 'add')}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--color-success)',
                            color: 'var(--color-success)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '2px 8px',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          + Add Addition
                        </button>
                      )}
                    </div>
                    {(!alter.adds || alter.adds.length === 0) ? (
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>None</span>
                    ) : (
                      alter.adds.map((addRule: any, rIdx: number) => (
                        <div 
                          key={`add-${rIdx}`}
                          style={{
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'center',
                            background: 'var(--color-surface)',
                            padding: '8px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border-subtle)'
                          }}
                        >
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Position:</span>
                          <select
                            value={addRule.position || 'ending'}
                            disabled={!isEditing}
                            onChange={(e) => handleRuleChange(aIdx, 'add', rIdx, 'position', e.target.value)}
                            style={{
                              background: 'var(--color-bg)',
                              color: 'var(--color-text)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '2px 6px',
                              fontSize: '12px'
                            }}
                          >
                            {ADD_POSITIONS.map(pos => (
                              <option key={pos} value={pos}>{pos}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Statement text..."
                            value={addRule.parts?.[0]?.prose || ''}
                            disabled={!isEditing}
                            onChange={(e) => {
                              const parts = [{ name: 'statement', prose: e.target.value }];
                              handleRuleChange(aIdx, 'add', rIdx, 'parts', parts);
                            }}
                            style={{
                              flex: 1,
                              background: 'var(--color-bg)',
                              color: 'var(--color-text)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '4px 8px',
                              fontSize: '12px'
                            }}
                          />
                          {isEditing && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRule(aIdx, 'add', rIdx)}
                              style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Removals (alters.removes) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-danger)' }}>
                        ➖ Removals (`removes`)
                      </span>
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => handleAddRule(aIdx, 'remove')}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--color-danger)',
                            color: 'var(--color-danger)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '2px 8px',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          + Add Removal
                        </button>
                      )}
                    </div>
                    {(!alter.removes || alter.removes.length === 0) ? (
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>None</span>
                    ) : (
                      alter.removes.map((removeRule: any, rIdx: number) => {
                        const activeKey = Object.keys(removeRule)[0] || 'by-id';
                        const activeVal = removeRule[activeKey] || '';
                        return (
                          <div 
                            key={`rem-${rIdx}`}
                            style={{
                              display: 'flex',
                              gap: '8px',
                              alignItems: 'center',
                              background: 'var(--color-surface)',
                              padding: '8px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-border-subtle)'
                            }}
                          >
                            <select
                              value={activeKey}
                              disabled={!isEditing}
                              onChange={(e) => handleRuleChange(aIdx, 'remove', rIdx, e.target.value, activeVal)}
                              style={{
                                background: 'var(--color-bg)',
                                color: 'var(--color-text)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '2px 6px',
                                fontSize: '12px'
                              }}
                            >
                              {REMOVE_SELECTORS.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder="Selector value (e.g. part-id, prop name)..."
                              value={activeVal}
                              disabled={!isEditing}
                              onChange={(e) => handleRuleChange(aIdx, 'remove', rIdx, activeKey, e.target.value)}
                              style={{
                                flex: 1,
                                background: 'var(--color-bg)',
                                color: 'var(--color-text)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '4px 8px',
                                fontSize: '12px'
                              }}
                            />
                            {isEditing && (
                              <button
                                type="button"
                                onClick={() => handleRemoveRule(aIdx, 'remove', rIdx)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function useProfileControlAlters({
  profile,
  control,
  originalControl,
  onProfileChange,
  allParams
}: {
  profile?: any;
  control?: any;
  originalControl?: any;
  onProfileChange?: (p: any) => void;
  allParams?: any[];
}) {
  const controlId = control?.id || '';
  const origControlId = originalControl?.id || control?.originalId;
  const targetControlId = origControlId || controlId;

  const profileAlter = React.useMemo(() => {
    return getAlterForControl(profile, controlId) || (origControlId ? getAlterForControl(profile, origControlId) : undefined);
  }, [profile, controlId, origControlId]);

  const resolvedParts = React.useMemo(() => {
    return resolveProfilePartsForRendering(
      originalControl?.parts || control?.parts,
      profileAlter
    );
  }, [control?.parts, originalControl?.parts, profileAlter]);

  const handleAddProfilePartAtEnd = React.useCallback((partName: string = 'statement') => {
    if (!profile || !onProfileChange) return;
    const newPartId = `${targetControlId}_${partName}_${Date.now()}`;
    updateAlter(profile, targetControlId, (alter) => {
      const adds = alter.adds ? [...alter.adds] : [];
      adds.push({
        position: 'ending',
        parts: [{ id: newPartId, name: partName, prose: '' }]
      } as any);
      return { ...alter, adds };
    }, onProfileChange);
  }, [profile, targetControlId, onProfileChange]);

  const profileGetModifiedPartIds = React.useCallback(() => {
    if (!profile) return [];
    const ids = getModifiedPartIdsUtil(profile, targetControlId);
    if (controlId && controlId !== targetControlId) {
      const overriddenIds = getModifiedPartIdsUtil(profile, controlId);
      return [...new Set([...ids, ...overriddenIds])];
    }
    return ids;
  }, [profile, targetControlId, controlId]);

  const handleResetProse = React.useCallback((partId: string) => {
    if (!profile || !onProfileChange) return;
    updateAlter(profile, targetControlId, (alter) => {
      let removes = alter.removes ? [...alter.removes] : [];
      let adds = alter.adds ? [...alter.adds] : [];
      removes = removes.filter(r => r['by-id'] !== partId);
      adds = adds.filter(a => !(a['by-id'] === partId && a.position === 'after'));
      adds = adds.map(a => {
        if (a.parts) {
          const filteredParts = a.parts.filter(p => p.id !== partId);
          if (filteredParts.length === 0) return null;
          return { ...a, parts: filteredParts };
        }
        return a;
      }).filter(Boolean) as typeof adds;
      return { ...alter, removes, adds };
    }, onProfileChange);
  }, [profile, targetControlId, onProfileChange]);

  const renderEditPart = React.useCallback((part: RenderablePart, _origPart: any, _depth: number, _index: number) => {
    const isOriginal = !part.isAdded;
    const partId = part.originalId || part.id;
    return (
      <div
        key={part.id || _index}
        style={{
          padding: '14px 16px',
          background: part.isModified ? 'rgba(245, 158, 11, 0.08)' : part.isAdded ? 'rgba(34, 197, 94, 0.08)' : 'var(--color-surface-2)',
          border: `1px solid ${part.isModified ? 'rgba(245, 158, 11, 0.35)' : part.isAdded ? 'rgba(34, 197, 94, 0.35)' : 'var(--color-border)'}`,
          borderLeft: `4px solid ${part.isModified ? '#f59e0b' : part.isAdded ? '#22c55e' : 'var(--color-primary)'}`,
          borderRadius: '6px',
          position: 'relative' as const
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>
              {part.name === 'statement' ? '☵ Statement' : `📄 ${part.name ? part.name.charAt(0).toUpperCase() + part.name.slice(1) : 'Part'}`}
            </span>
            {part.isModified && <span style={{ fontSize: '10px', color: '#fbbf24', background: 'rgba(245,158,11,0.2)', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>Modified</span>}
            {part.isAdded && <span style={{ fontSize: '10px', color: '#22c55e', background: 'rgba(34,197,94,0.2)', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>Added</span>}
          </div>
          {part.isModified && handleResetProse && (
            <button
              type="button"
              onClick={() => handleResetProse(partId)}
              title="Clear alter and revert to original catalog baseline"
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#fbbf24',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              ↩ Revert to Baseline
            </button>
          )}
          {part.isAdded && handleResetProse && (
            <button
              type="button"
              onClick={() => handleResetProse(part.id)}
              title="Remove added statement"
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              🗑️ Remove
            </button>
          )}
        </div>
        <ProseWithParams
          value={part.prose || ''}
          onChange={(newValue: string) => {
            if (isOriginal && profile && onProfileChange) {
              handleOriginalPartFieldChange(
                partId, 'prose', newValue,
                { originalName: part.originalName || part.name, originalProse: part.originalProse ?? part.prose },
                targetControlId, profile, onProfileChange
              );
            } else if (part.isAdded && profile && onProfileChange) {
              updateAlter(profile, targetControlId, (alter) => {
                const adds = (alter.adds || []).map(add => {
                  if (add.parts && add.parts.some(p => p.id === part.id)) {
                    const updatedParts = add.parts.map(p =>
                      p.id === part.id ? { ...p, prose: newValue } : p
                    );
                    return { ...add, parts: updatedParts };
                  }
                  return add;
                });
                return { ...alter, adds };
              }, onProfileChange);
            }
          }}
          params={allParams || []}
          placeholder="Enter prose text… (supports markdown formatting)"
          rows={2}
          style={{
            fontSize: '13px',
            width: '100%',
            minHeight: '65px'
          }}
        />
        {part.isModified && part.originalProse && part.originalProse !== part.prose && (
          <div style={{
            marginTop: '8px',
            padding: '6px 10px',
            background: 'rgba(245, 158, 11, 0.05)',
            border: '1px dashed rgba(245, 158, 11, 0.3)',
            borderRadius: '4px',
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            display: 'flex',
            alignItems: 'baseline',
            gap: '6px'
          }}>
            <span style={{ fontWeight: 600, fontSize: '11px', color: '#fbbf24', flexShrink: 0 }}>Baseline:</span>
            <span style={{ fontStyle: 'italic', textDecoration: 'line-through' }}>{part.originalProse}</span>
          </div>
        )}
      </div>
    );
  }, [profile, targetControlId, onProfileChange, handleResetProse, allParams]);

  return {
    resolvedParts,
    renderEditPart,
    handleAddProfilePartAtEnd,
    profileGetModifiedPartIds,
    handleResetProse
  };
}

