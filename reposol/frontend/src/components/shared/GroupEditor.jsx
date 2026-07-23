import React, { useState } from 'react';
import { DebouncedInput } from '../shared/DebouncedInput';
import { PropsEditor } from '../shared/PropsEditor';
import { LinksEditor } from '../shared/LinksEditor';
import { PartsEditor } from '../shared/PartsEditor';
import { ParameterEditor } from './ParameterEditor';

const countControlsInGroup = (g) => {
  let count = 0;
  const traverse = (item) => {
    count++;
    if (item.controls) {
      item.controls.forEach(traverse);
    }
  };
  if (g.controls) {
    g.controls.forEach(traverse);
  }
  const traverseGroup = (sub) => {
    if (sub.controls) {
      sub.controls.forEach(traverse);
    }
    if (sub.groups) {
      sub.groups.forEach(traverseGroup);
    }
  };
  if (g.groups) {
    g.groups.forEach(traverseGroup);
  }
  return count;
};

const getGroupAncestorsPath = (targetGroupId, catalogData) => {
  if (!targetGroupId || !catalogData) return [];
  const traverse = (node, path) => {
    if (node.id === targetGroupId) return path;
    if (node.groups) {
      for (const g of node.groups) {
        const found = traverse(g, [...path, { id: g.id, title: g.title }]);
        if (found) return found;
      }
    }
    return null;
  };
  return traverse(catalogData, []) || [];
};

/**
 * Group details editor.
 */
export function GroupEditor({
  group = {},
  catalog = null,
  onChange,
  isEditing = false,
  allUsedPropKeys = [],
  onSelectGroup,
  onSelectControl,
  mode = 'catalog',
  profile = {},
  onProfileChange
}) {
  const [showGroupParams, setShowGroupParams] = useState(false);
  const [expandedControlIds, setExpandedControlIds] = useState({});

  const handleFieldChange = (field, val) => {
    onChange({ ...group, [field]: val });
  };

  const groupParams = (group.params || []).map(p => ({ ...p, scope: 'group', scopeLabel: '📁 Group Parameters' }));
  const catalogParams = (catalog?.params || []).map(p => ({ ...p, scope: 'catalog', scopeLabel: '🌐 Catalog Parameters' }));
  const groupParamIds = new Set(groupParams.map(p => p.id));
  const visibleGroupParams = [...groupParams, ...catalogParams.filter(cp => !groupParamIds.has(cp.id))];

  const handleDefineNewParam = () => {
    if (mode === 'catalog') {
      const newId = `param_${group.id || 'group'}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const updatedParams = [
        ...(group.params || []),
        { id: newId, label: 'New Group Parameter', values: [] }
      ];
      handleFieldChange('params', updatedParams);
    } else if (mode === 'profile' && onProfileChange) {
      const newId = `param_${group.id || 'group'}_${Date.now().toString().slice(-4)}`;
      const propsList = group.id ? [{ name: 'group-id', value: group.id }] : [];
      const newParam = {
        'param-id': newId,
        label: 'Custom Profile Group Parameter',
        values: [],
        props: propsList
      };
      const currentSetParams = profile.modify?.['set-parameters'] || [];
      const updatedSetParams = [...currentSetParams, newParam];
      const modify = profile.modify ? { ...profile.modify } : {};
      modify['set-parameters'] = updatedSetParams;
      onProfileChange({ ...profile, modify });
    }
  };

  const toggleControlExpand = (e, ctrlId) => {
    e.stopPropagation();
    setExpandedControlIds(prev => ({
      ...prev,
      [ctrlId]: !prev[ctrlId]
    }));
  };

  const props = group.props || [];
  const links = group.links || [];
  const parts = group.parts || [];
  const subgroups = group.groups || [];
  const controls = group.controls || [];
  const setParams = profile?.modify?.['set-parameters'] || [];

  const directControlsCount = controls.length;
  const subgroupsCount = subgroups.length;
  const totalControlsCount = countControlsInGroup(group);

  const metricCardStyle = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: '1',
    minWidth: '130px'
  };

  const metricLabelStyle = {
    fontSize: '10px',
    fontWeight: '700',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  };

  return (
    <div className="group-editor-view premium-group-editor-view" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
      
      {/* Breadcrumbs */}
      <div className="breadcrumbs" style={{ flexShrink: 0, fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span onClick={() => onSelectGroup?.(null)} style={{ cursor: onSelectGroup ? 'pointer' : 'default' }} className="breadcrumb-link">Overview</span>
        {getGroupAncestorsPath(group.id, catalog).slice(0, -1).map(b => (
          <React.Fragment key={b.id}>
            <span>/</span>
            <span 
              onClick={() => onSelectGroup?.(b.id)}
              style={{ cursor: onSelectGroup ? 'pointer' : 'default' }}
              className="breadcrumb-link"
            >
              {b.title || b.id}
            </span>
          </React.Fragment>
        ))}
        <span>/</span>
        <span style={{ color: 'var(--color-text)', fontWeight: '500' }}>{group.title || group.id}</span>
      </div>

      {/* Header Title section */}
      <div className="group-banner-header" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '32px' }}>📁</span>
          {isEditing ? (
            <DebouncedInput
              value={group.title || ''}
              onChange={(val) => handleFieldChange('title', val)}
              placeholder="Group Title"
              className="form-input form-input-plain form-input-h2"
              style={{ 
                fontSize: '24px',
                fontWeight: '800',
                color: 'var(--color-text)',
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none'
              }}
            />
          ) : (
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: 'var(--color-text)', letterSpacing: '-0.3px' }}>
              {group.title || 'Untitled Group'}
            </h1>
          )}
        </div>

        {isEditing ? (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Folder ID:</span>
            <DebouncedInput
              value={group.id}
              onChange={(val) => handleFieldChange('id', val)}
              className="form-input-plain"
              style={{ width: '120px', fontSize: '12px', color: 'var(--color-text-muted)', padding: '2px 6px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: '12px' }}>Class:</span>
            <DebouncedInput
              value={group.class || ''}
              onChange={(val) => handleFieldChange('class', val)}
              className="form-input-plain"
              style={{ width: '120px', fontSize: '12px', color: 'var(--color-text-muted)', padding: '2px 6px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
            />
          </div>
        ) : (
          props.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
              {props.map((p, idx) => (
                <span key={idx} className="badge premium-prop-badge">
                  🏷️ <strong style={{ color: 'var(--color-text-muted)' }}>{p.name}:</strong> <span style={{ color: 'var(--color-text)' }}>{p.value}</span>
                </span>
              ))}
            </div>
          )
        )}
      </div>

      {/* Metrics Row */}
      <div className="overview-metrics-grid" style={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        <div className="metric-card premium-metric-card-styled" style={metricCardStyle}>
          <span className="metric-label" style={metricLabelStyle}>Family ID</span>
          <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-text)' }}>{group.id}</span>
        </div>
        <div className="metric-card premium-metric-card-styled" style={metricCardStyle}>
          <span className="metric-label" style={metricLabelStyle}>Controls</span>
          <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-text)' }}>{directControlsCount}</span>
        </div>
        <div className="metric-card premium-metric-card-styled" style={metricCardStyle}>
          <span className="metric-label" style={metricLabelStyle}>Sub-groups</span>
          <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-text)' }}>{subgroupsCount}</span>
        </div>
        <div className="metric-card premium-metric-card-styled" style={metricCardStyle}>
          <span className="metric-label" style={metricLabelStyle}>Total (incl. enhancements)</span>
          <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-primary)' }}>{totalControlsCount}</span>
        </div>
      </div>

      {isEditing && (
        <div style={{ marginTop: '8px' }}>
          <PropsEditor
            props={props}
            onChange={(val) => handleFieldChange('props', val)}
            allUsedKeys={allUsedPropKeys}
            readOnly={false}
          />
        </div>
      )}

      {/* Sub-groups Card */}
      {subgroups.length > 0 && (
        <div style={{ flexShrink: 0, marginTop: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
            Sub-groups
          </h3>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', overflow: 'hidden' }}>
            {subgroups.map((sub, idx) => {
              const count = countControlsInGroup(sub);
              return (
                <div 
                  key={sub.id} 
                  onClick={() => onSelectGroup?.(sub.id)}
                  className="sidebar-item-like"
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '16px 20px', 
                    cursor: onSelectGroup ? 'pointer' : 'default',
                    borderBottom: idx < subgroups.length - 1 ? '1px solid var(--color-border)' : 'none',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>📁</span>
                    <strong style={{ fontSize: '14px', color: 'var(--color-text)' }}>
                      {sub.title || sub.id}
                    </strong>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    {count} {count === 1 ? 'control' : 'controls'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Controls Card */}
      <div style={{ flexShrink: 0, marginTop: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
          Controls ({directControlsCount})
        </h3>
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', overflow: 'hidden' }}>
          {controls.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '13px' }}>
              No controls directly under this group.
            </div>
          ) : (
            controls.map((ctrl, idx) => (
              <div 
                key={ctrl.id} 
                onClick={() => onSelectControl?.(ctrl.id)}
                className="sidebar-item-like"
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '16px 20px', 
                  cursor: onSelectControl ? 'pointer' : 'default',
                  borderBottom: idx < controls.length - 1 ? '1px solid var(--color-border)' : 'none',
                  transition: 'background-color 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: 'var(--color-primary)', fontSize: '16px' }}>⬡</span>
                  <strong style={{ fontSize: '14px', color: 'var(--color-text)' }}>
                    <span style={{ color: 'var(--color-text-muted)', marginRight: '8px', fontWeight: '500' }}>{ctrl.id}</span>
                    {ctrl.title}
                  </strong>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Group Parameters Card (Always open and matches Control Parameters style) */}
      {(isEditing || (group.params && group.params.length > 0)) && (
        <div 
          style={{ 
            background: 'var(--color-surface)', 
            border: '1px solid var(--color-border)', 
            borderRadius: 'var(--radius-lg)', 
            padding: '24px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '16px',
            marginTop: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>
              {mode === 'profile' && isEditing ? 'Group Parameter Overrides' : 'Group Parameters'}
            </h4>
          </div>
          <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px', marginTop: '4px' }}>
            {mode === 'profile' ? (
              <ParameterEditor
                params={setParams}
                catalogParams={group.params || []}
                mode="profile"
                context="local"
                parentId={group.id}
                parentType="group"
                onChange={(updatedSetParams) => {
                  const modify = profile.modify ? { ...profile.modify } : {};
                  modify['set-parameters'] = updatedSetParams;
                  onProfileChange({ ...profile, modify });
                }}
                readOnly={!isEditing}
                fullDocument={profile}
                catalogDocument={catalog}
              />
            ) : (
              <ParameterEditor
                params={group.params || []}
                onChange={(val) => handleFieldChange('params', val)}
                readOnly={!isEditing}
                fullDocument={catalog}
              />
            )}
          </div>
        </div>
      )}

      {/* Links & Prose parts (Only when editing group) */}
      {isEditing && (
        <>
          <div className="section-container" style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px' }}>
            <LinksEditor
              links={links}
              onChange={(val) => handleFieldChange('links', val)}
              readOnly={false}
            />
          </div>

          <div className="section-container" style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px' }}>
            <PartsEditor
              parts={parts}
              onChange={(val) => handleFieldChange('parts', val)}
              readOnly={false}
              params={visibleGroupParams}
              onDefineNewParam={handleDefineNewParam}
            />
          </div>
        </>
      )}

    </div>
  );
}
