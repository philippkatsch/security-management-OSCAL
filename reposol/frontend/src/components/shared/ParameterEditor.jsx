import React, { useState } from 'react';
import { ParameterCard } from './ParameterCard';

/**
 * Full parameter definition editor for Catalogs and Profiles.
 */
export function ParameterEditor({
  params = [],
  onChange,
  readOnly = false,
  mode = 'catalog',
  catalogParams = [], // used when mode === 'profile'
  context = 'global', // 'global' or 'local'
  parentId = null,
  parentType = null,  // 'control' or 'group'
  fullDocument = null,
  onChangeAlters = null,
  catalogDocument = null
}) {
  const [expandedIndices, setExpandedIndices] = useState({});

  const handleParamChange = (index, updatedParam, isProfileOverride = false, originalId = null) => {
    if (mode === 'profile') {
      const updatedSetParams = [...params];
      // Check if this is a custom parameter (not a catalog default param)
      const isCustomParam = catalogParams && !catalogParams.some(cp => (cp.id || cp['param-id'])?.toLowerCase() === originalId?.toLowerCase());
      
      const targetId = (isCustomParam && updatedParam['param-id']) 
        ? updatedParam['param-id'] 
        : (originalId || updatedParam['param-id'] || updatedParam.id);
        
      const targetIdLower = targetId?.toLowerCase();
      const originalIdLower = originalId?.toLowerCase();
      
      const existingIdx = updatedSetParams.findIndex(sp => {
        const spId = (sp['param-id'] || sp.id)?.toLowerCase();
        return isCustomParam ? spId === originalIdLower : spId === targetIdLower;
      });
      
      // If the updated param is empty (only has param-id or id or undefined values), remove override
      const nonIdKeys = Object.keys(updatedParam).filter(k => k !== 'param-id' && k !== 'id' && updatedParam[k] !== undefined && k !== 'props');
      if (nonIdKeys.length === 0) {
        if (existingIdx !== -1) {
          updatedSetParams.splice(existingIdx, 1);
        }
      } else {
        const cleanParam = { 'param-id': targetId, ...updatedParam };
        delete cleanParam.id;
        if (existingIdx !== -1) {
          updatedSetParams[existingIdx] = cleanParam;
        } else {
          updatedSetParams.push(cleanParam);
        }
      }
      onChange(updatedSetParams);
    } else {
      const updated = params.map((p, i) => i === index ? updatedParam : p);
      onChange(updated);
    }
  };

  const handleAddParam = () => {
    const newId = `param_${Date.now().toString().slice(-4)}`;
    let newParam;
    if (mode === 'profile') {
      const propsList = [];
      if (parentId && parentType) {
        propsList.push({ name: `${parentType}-id`, value: parentId });
      }
      newParam = { 'param-id': newId, label: 'Custom Profile Parameter', values: [], props: propsList };
    } else {
      newParam = { id: newId, label: 'New Parameter', values: [] };
    }
    onChange([...params, newParam]);
    setExpandedIndices(prev => ({
      ...prev,
      [displayArray.length]: true
    }));
  };

  const handleRemoveParam = (index) => {
    const targetParam = displayArray[index];
    const targetId = targetParam?.id || targetParam?.['param-id'];
    
    if (targetId && (fullDocument || catalogDocument)) {
      const docString = JSON.stringify(fullDocument || {}) + JSON.stringify(catalogDocument || {});
      const escapedId = targetId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const placeholderRegex = new RegExp(`\\{\\{\\s*insert:\\s*param,\\s*${escapedId}\\s*\\}\\}`, 'i');
      const oscalBracketRegex = new RegExp(`\\[\\s*${escapedId}\\s*\\]`, 'i');
      const isUsedInProse = placeholderRegex.test(docString) || oscalBracketRegex.test(docString);
      
      const isUsedAsDependency = displayArray.some(p => p !== targetParam && p['depends-on'] === targetId);

      if (isUsedInProse || isUsedAsDependency) {
        let reason = "";
        if (isUsedInProse && isUsedAsDependency) {
          reason = "it is inserted in control statement prose and referenced as a dependency by another parameter";
        } else if (isUsedInProse) {
          reason = "it is inserted in control statement prose";
        } else {
          reason = "it is referenced as a dependency by another parameter";
        }
        alert(`Cannot delete parameter "${targetId}" because ${reason}. Please remove its references first.`);
        return;
      }
    }

    if (mode === 'profile') {
      const isDefault = catalogParams?.some(cp => (cp.id || cp['param-id'])?.toLowerCase() === targetId?.toLowerCase());
      if (isDefault) {
        if (parentIdLower && onChangeAlters) {
          onChangeAlters((alter) => {
            const removes = alter.removes ? [...alter.removes] : [];
            if (!removes.some(r => r['by-id']?.toLowerCase() === targetId?.toLowerCase())) {
              removes.push({ 'by-id': targetId });
            }
            return { ...alter, removes };
          });
        }
      } else {
        const targetIdLower = targetId?.toLowerCase();
        onChange(params.filter(sp => (sp['param-id'] || sp.id)?.toLowerCase() !== targetIdLower));
      }
    } else {
      onChange(params.filter((_, i) => i !== index));
    }
  };

  const handleRestoreParam = (targetId) => {
    if (mode === 'profile' && parentIdLower && onChangeAlters) {
      onChangeAlters((alter) => {
        const removes = (alter.removes || []).filter(r => r['by-id']?.toLowerCase() !== targetId?.toLowerCase());
        return { ...alter, removes };
      });
    }
  };

  const toggleExpand = (index) => {
    setExpandedIndices(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const parentIdLower = parentId?.toLowerCase();
  const alter = mode === 'profile' && parentIdLower && fullDocument?.modify?.alters?.find(a => a['control-id']?.toLowerCase() === parentIdLower);
  const removes = alter?.removes || [];
  const isRemoved = (paramId) => removes.some(r => r['by-id']?.toLowerCase() === paramId?.toLowerCase());

  // In profile mode:
  // - If context is 'global', display array is all profile overrides/custom parameters (params).
  // - If context is 'local', display array is the local catalog-defined parameters (catalogParams)
  //   plus any custom parameters from the profile (params) that belong to this local context.
  const localCustomParams = (mode === 'profile' && context === 'local' && parentId)
    ? params.filter(sp => {
        // If it has a catalog default, it is an override, not a new custom parameter
        const hasCatalogDefault = catalogParams?.some(cp => (cp.id || cp['param-id'])?.toLowerCase() === (sp['param-id'] || sp.id)?.toLowerCase());
        if (hasCatalogDefault) return false;
        
        // Match parent ID
        const parentProp = sp.props?.find(pr => pr.name === 'control-id' || pr.name === 'group-id');
        return parentProp?.value?.toLowerCase() === parentId.toLowerCase();
      })
    : [];

  const displayArray = (mode === 'profile' && context === 'local') 
    ? [...(catalogParams || []), ...localCustomParams] 
    : params;

  // Group parameters by scope/origin category
  const groupsMap = new Map();
  displayArray.forEach((p, idx) => {
    let categoryKey = 'general';
    let categoryTitle = '⚙️ Parameters';

    let originalId = p.id || p['param-id'];
    let catalogDefault = null;
    let override = null;

    if (mode === 'profile') {
      if (context === 'local') {
        const isDefault = catalogParams?.some(cp => (cp.id || cp['param-id'])?.toLowerCase() === originalId?.toLowerCase());
        catalogDefault = isDefault ? p : null;
        const pIdLower = originalId?.toLowerCase();
        override = params.find(sp => (sp['param-id'] || sp.id)?.toLowerCase() === pIdLower);
      } else {
        catalogDefault = catalogParams?.find(cp => (cp.id || cp['param-id'])?.toLowerCase() === originalId?.toLowerCase());
        override = p;
      }

      // Determine grouping scope
      const activeParamForScope = catalogDefault || p;
      const isSub = activeParamForScope.isSubcontrol || (p.props?.some(pr => pr.name === 'control-id' && pr.value?.includes('.')));

      if (!catalogDefault && context === 'global') {
        const controlIdProp = p.props?.find(pr => pr.name === 'control-id')?.value;
        const groupIdProp = p.props?.find(pr => pr.name === 'group-id')?.value;
        if (controlIdProp) {
          if (controlIdProp.includes('.')) {
            categoryKey = 'custom-subcontrol';
            categoryTitle = '🧩 Custom Sub-control Parameters';
          } else {
            categoryKey = 'custom-control';
            categoryTitle = '🎯 Custom Control Parameters';
          }
        } else if (groupIdProp) {
          categoryKey = 'custom-group';
          categoryTitle = '📁 Custom Group Parameters';
        } else {
          categoryKey = 'custom';
          categoryTitle = '➕ Custom Profile Parameters';
        }
      } else if (activeParamForScope.scope === 'catalog') {
        categoryKey = 'global';
        categoryTitle = '🌐 Global Catalog Parameters';
      } else if (activeParamForScope.scope === 'group') {
        categoryKey = 'group';
        categoryTitle = '📁 Group Parameters';
      } else if (isSub) {
        categoryKey = 'subcontrol';
        categoryTitle = '🧩 Sub-control Parameters';
      } else if (activeParamForScope.scope === 'control') {
        categoryKey = 'control';
        categoryTitle = '🎯 Control Parameters';
      } else {
        categoryKey = 'inherited';
        categoryTitle = '📋 Inherited Baseline Parameters';
      }
    } else {
      const isSub = p.isSubcontrol || p.id?.includes('.');
      if (p.scope === 'catalog') {
        categoryKey = 'global';
        categoryTitle = '🌐 Global Catalog Parameters';
      } else if (p.scope === 'group') {
        categoryKey = 'group';
        categoryTitle = '📁 Group Parameters';
      } else if (isSub) {
        categoryKey = 'subcontrol';
        categoryTitle = '🧩 Sub-control Parameters';
      } else if (p.scope === 'control') {
        categoryKey = 'control';
        categoryTitle = '🎯 Control Parameters';
      }
    }

    if (!groupsMap.has(categoryKey)) {
      groupsMap.set(categoryKey, { title: categoryTitle, items: [] });
    }
    groupsMap.get(categoryKey).items.push({ p, idx, catalogDefault, override, originalId });
  });

  const categoryOrder = [
    'custom',
    'custom-group',
    'custom-control',
    'custom-subcontrol',
    'global',
    'group',
    'control',
    'subcontrol',
    'inherited',
    'general'
  ];

  const sortedGroups = Array.from(groupsMap.entries())
    .sort((a, b) => {
      const idxA = categoryOrder.indexOf(a[0]);
      const idxB = categoryOrder.indexOf(b[0]);
      return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999);
    })
    .map(entry => entry[1]);

  return (
    <div className="parameter-editor-section card-body">

      {displayArray.length === 0 ? (
        <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px', margin: '0 0 8px 0' }}>
          {mode === 'profile'
            ? 'No parameter overrides or custom parameters defined in this profile yet.'
            : 'No parameters defined for this control.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {sortedGroups.map((group, gIdx) => (
            <div key={gIdx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {groupsMap.size > 1 && (
                <h5 style={{
                  margin: '4px 0 4px 0',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  paddingBottom: '4px'
                }}>
                  {group.title} ({group.items.length})
                </h5>
              )}
               {group.items.map(({ p, idx, catalogDefault, override, originalId }) => {
                let currentParam = p;
                
                if (mode === 'profile') {
                  currentParam = override ? override : (catalogDefault ? { 'param-id': originalId } : p);
                }

                return (
                  <ParameterCard
                    key={`param-card-${idx}`}
                    param={currentParam}
                    onChange={(updatedParam) => handleParamChange(idx, updatedParam, mode === 'profile', originalId)}
                    onRemove={(mode === 'profile' && catalogDefault !== null && !onChangeAlters) ? null : () => handleRemoveParam(idx)}
                    isExpanded={!!expandedIndices[idx]}
                    onToggleExpand={() => toggleExpand(idx)}
                    readOnly={readOnly}
                    mode={mode}
                    catalogDefaultParam={catalogDefault}
                    allParams={mode === 'profile' ? displayArray : params}
                    isRemoved={!!(mode === 'profile' && originalId && isRemoved(originalId))}
                    onRestore={() => handleRestoreParam(originalId)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <div style={{ marginTop: '12px' }}>
          <button
            type="button"
            className="btn-soft"
            onClick={handleAddParam}
            style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '4px', background: 'var(--color-surface)', border: '1px dashed var(--color-border)' }}
          >
            ➕ Add Parameter
          </button>
        </div>
      )}
    </div>
  );
}
