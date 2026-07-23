import React from 'react';
import { DebouncedInput } from '../shared/DebouncedInput';

const COMBINE_METHODS = [
  { value: 'use-first', label: 'Use First (Use first definition)' },
  { value: 'merge', label: 'Merge (Merge definitions)' },
  { value: 'keep', label: 'Keep (Keep all duplicates)' }
];

const ORDER_MODES = [
  { value: 'keep', label: 'keep (Original order)' },
  { value: 'ascending', label: 'ascending (ascending)' },
  { value: 'descending', label: 'descending (descending)' }
];

/**
 * Merge Configuration Panel for Profiles.
 * Supports as-is, flat, and custom (with grouping, insert-controls, and sort rules - US 2.7).
 */
export function MergeConfigurator({
  merge = {},
  onChange,
  isEditing = false
}) {
  const combineMethod = merge.combine?.method || 'use-first';

  const isAsIs = merge['as-is'] !== undefined;
  const isFlat = merge.flat !== undefined;
  const isCustom = merge.custom !== undefined;

  const customGroups = merge.custom?.groups || [];

  const handleCombineChange = (method) => {
    const updatedMerge = { ...merge, combine: { method } };
    onChange(updatedMerge);
  };

  const handleModeChange = (mode) => {
    const updatedMerge = { combine: merge.combine || { method: 'use-first' } };
    if (mode === 'as-is') {
      updatedMerge['as-is'] = {};
    } else if (mode === 'flat') {
      updatedMerge.flat = {};
    } else if (mode === 'custom') {
      updatedMerge.custom = { groups: customGroups.length > 0 ? customGroups : [{ id: 'group_1', title: 'Standard Group', 'insert-controls': [{ 'include-all': {}, order: 'keep' }] }] };
    }
    onChange(updatedMerge);
  };

  // --- Custom Groups CRUD (US 2.7) ---
  const handleCustomGroupsChange = (updatedGroups) => {
    onChange({
      ...merge,
      custom: { ...merge.custom, groups: updatedGroups }
    });
  };

  const handleAddCustomGroup = () => {
    const newGroup = {
      id: `custom_grp_${Date.now().toString().slice(-4)}`,
      title: 'New Group',
      'insert-controls': [{
        'include-all': {},
        order: 'keep'
      }]
    };
    handleCustomGroupsChange([...customGroups, newGroup]);
  };

  const handleRemoveCustomGroup = (idx) => {
    handleCustomGroupsChange(customGroups.filter((_, i) => i !== idx));
  };

  const handleGroupFieldChange = (idx, field, val) => {
    const updated = customGroups.map((g, i) => i === idx ? { ...g, [field]: val } : g);
    handleCustomGroupsChange(updated);
  };

  // --- Insert Controls configuration ---
  // insert-controls is an OSCAL array; we operate on the first entry.
  const handleInsertControlsChange = (idx, field, val) => {
    const group = customGroups[idx];
    const icArray = Array.isArray(group['insert-controls']) ? group['insert-controls'] : [group['insert-controls'] || {}];
    const insertControls = { ...(icArray[0] || {}) };

    if (field === 'include-mode') {
      if (val === 'all') {
        insertControls['include-all'] = {};
        delete insertControls['include-controls'];
      } else {
        insertControls['include-controls'] = [{ 'with-ids': [] }];
        delete insertControls['include-all'];
      }
    } else if (field === 'order') {
      insertControls.order = val;
    } else if (field === 'with-ids') {
      const ids = val.split(',').map(id => id.trim()).filter(id => id.length > 0);
      insertControls['include-controls'] = [{ 'with-ids': ids }];
    }

    handleGroupFieldChange(idx, 'insert-controls', [insertControls]);
  };

  return (
    <div className="merge-configurator card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ margin: 0, fontSize: '15px' }}>Merge & Combination Rules</h3>

      {/* 1. Combine Method Selector */}
      <div style={{ paddingBottom: '14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>
          Duplicate combination strategy (combine.method)
        </label>
        <select
          value={combineMethod}
          onChange={(e) => handleCombineChange(e.target.value)}
          className="form-input"
          disabled={!isEditing}
          style={{ width: '100%', height: '32px', fontSize: '13px' }}
        >
          {COMBINE_METHODS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* 2. Mode Radio Buttons */}
      <div>
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '8px' }}>
          Import structuring mode (Merge Mode)
        </span>
        <div style={{ display: 'flex', gap: '16px' }}>
          {[
            { id: 'as-is', label: 'As-Is (Keep catalog structure)' },
            { id: 'flat', label: 'Flat (Resolve hierarchy flat)' },
            { id: 'custom', label: 'Custom (Create custom groups)' }
          ].map((mode) => {
            const checked = mode.id === 'as-is' ? isAsIs : mode.id === 'flat' ? isFlat : isCustom;
            return (
              <label key={mode.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="merge-mode"
                  checked={checked}
                  onChange={() => handleModeChange(mode.id)}
                  disabled={!isEditing}
                  style={{ cursor: 'pointer' }}
                />
                {mode.label}
              </label>
            );
          })}
        </div>
      </div>

      {/* 3. Custom Groups builder section (US 2.7) */}
      {isCustom && (
        <div style={{ marginTop: '10px', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Custom group folders (custom.groups)</span>
            {isEditing && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleAddCustomGroup}
                style={{ padding: '2px 8px', fontSize: '11px' }}
              >
                ➕ Add Group
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {customGroups.map((g, idx) => {
              const icArray = Array.isArray(g['insert-controls']) ? g['insert-controls'] : [g['insert-controls'] || {}];
              const insertControls = icArray[0] || {};
              const isIncludeAll = insertControls['include-all'] !== undefined;
              const idsList = insertControls['include-controls']?.[0]?.['with-ids'] || [];

              return (
                <div
                  key={idx}
                  style={{
                    padding: '14px',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <DebouncedInput
                      value={g.id}
                      onChange={(val) => handleGroupFieldChange(idx, 'id', val)}
                      placeholder="Folder ID"
                      className="form-input"
                      style={{ width: '120px', height: '28px', fontSize: '12px' }}
                      disabled={!isEditing}
                    />
                    <DebouncedInput
                      value={g.title}
                      onChange={(val) => handleGroupFieldChange(idx, 'title', val)}
                      placeholder="Folder Title"
                      className="form-input"
                      style={{ flex: 1, height: '28px', fontSize: '12px' }}
                      disabled={!isEditing}
                    />
                    {isEditing && (
                      <button
                        type="button"
                        className="btn-delete"
                        onClick={() => handleRemoveCustomGroup(idx)}
                        style={{ padding: '2px 6px', height: '28px', fontSize: '11px' }}
                      >
                        🗑
                      </button>
                    )}
                  </div>

                  {/* Insert-controls details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {/* Include All vs Include controls toggle */}
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block' }}>Control Inclusion</label>
                      <select
                        value={isIncludeAll ? 'all' : 'controls'}
                        onChange={(e) => handleInsertControlsChange(idx, 'include-mode', e.target.value)}
                        className="form-input"
                        disabled={!isEditing}
                        style={{ width: '100%', height: '26px', fontSize: '11px' }}
                      >
                        <option value="all">All remaining controls (include-all)</option>
                        <option value="controls">Specific control IDs (include-controls)</option>
                      </select>
                    </div>

                    {/* Order sort rule (US 2.7) */}
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block' }}>Sorting (order)</label>
                      <select
                        value={insertControls.order || 'keep'}
                        onChange={(e) => handleInsertControlsChange(idx, 'order', e.target.value)}
                        className="form-input"
                        disabled={!isEditing}
                        style={{ width: '100%', height: '26px', fontSize: '11px' }}
                      >
                        {ORDER_MODES.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Specific controls inclusion field */}
                  {!isIncludeAll && (
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block' }}>Controls to include (e.g. ac-2, ac-7)</label>
                      <DebouncedInput
                        value={idsList.join(', ')}
                        onChange={(val) => handleInsertControlsChange(idx, 'with-ids', val)}
                        placeholder="ac-2, ac-3"
                        className="form-input"
                        disabled={!isEditing}
                        style={{ width: '100%', height: '26px', fontSize: '11px' }}
                      />
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
