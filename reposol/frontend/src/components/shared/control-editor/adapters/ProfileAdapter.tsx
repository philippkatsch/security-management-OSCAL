import React from 'react';
import { useControlEditorContext } from '../ControlEditorContext';
import { PropsEditor } from '@components/shared/PropsEditor';
import { LinksEditor } from '@components/shared/LinksEditor';

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

  // Alter rules helpers
  const handleUpdateAlterations = (updatedControlAlters: any[]) => {
    if (!profile || !onProfileChange) return;
    const currentAlters = profile.modify?.alters || [];
    const otherAlters = currentAlters.filter((a: any) => a['control-id'] !== control?.id);
    const newAlters = [...otherAlters, ...updatedControlAlters];
    
    const modify = profile.modify ? { ...profile.modify } : {};
    modify.alters = newAlters.length > 0 ? newAlters : undefined;
    if (!modify.alters) delete modify.alters;
    
    onProfileChange({
      ...profile,
      modify: Object.keys(modify).length > 0 ? modify : undefined
    });
  };

  const handleAddAlter = () => {
    const newAlter = {
      'control-id': control?.id,
      adds: [],
      removes: []
    };
    handleUpdateAlterations([...alterations, newAlter]);
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
