import React, { useState, useRef } from 'react';
import { DebouncedInput } from './DebouncedInput';
import { PropsEditor } from './PropsEditor';
import { LinksEditor } from './LinksEditor';
import { PartsEditor } from './PartsEditor';
import { ParameterEditor } from './ParameterEditor';
import { ParameterCard } from './ParameterCard';
import { ControlHeader } from './ControlHeader';
import { ReadOnlyParts, getAutoLabel } from './ReadOnlyParts';
import { EnhancementsAccordion } from './EnhancementsAccordion';
import { ProseWithParams } from './ProseWithParams';
import { formatProse } from '../../lib/oscal-utils';

const getAncestorsPath = (targetId, catalogData) => {
  if (!targetId || !catalogData) return [];
  const traverse = (node, path) => {
    if (node.id === targetId) return path;
    if (node.groups) {
      for (const g of node.groups) {
        const found = traverse(g, [...path, { id: g.id, title: g.title }]);
        if (found) return found;
      }
    }
    if (node.controls) {
      for (const c of node.controls) {
        const found = traverse(c, path);
        if (found) return found;
      }
    }
    return null;
  };
  return traverse({ groups: catalogData.groups || [], controls: catalogData.controls || [] }, []) || [];
};

const getGroupParamsForControl = (controlId, catalogData) => {
  const ancestors = getAncestorsPath(controlId, catalogData);
  if (!ancestors || ancestors.length === 0) return [];
  
  const groupParams = [];
  
  const findGroup = (groups, id) => {
    for (const g of groups) {
      if (g.id === id) return g;
      if (g.groups) {
        const found = findGroup(g.groups, id);
        if (found) return found;
      }
    }
    return null;
  };
  
  ancestors.forEach(anc => {
    const groupObj = findGroup(catalogData?.groups || [], anc.id);
    if (groupObj && groupObj.params) {
      groupParams.push(...groupObj.params);
    }
  });
  
  return groupParams;
};

const getAllVisibleParamsMap = (controlId, controlParams, catalogData) => {
  const resolved = {};

  // 1. Catalog level (lowest priority)
  if (catalogData && catalogData.params) {
    catalogData.params.forEach(p => {
      resolved[p.id] = p;
    });
  }

  // 2. Group level (inheriting downward)
  const groupParams = getGroupParamsForControl(controlId, catalogData);
  groupParams.forEach(p => {
    resolved[p.id] = p;
  });

  // 3. Control level (highest priority)
  controlParams.forEach(p => {
    resolved[p.id] = p;
  });

  return resolved;
};

function InfoTooltip({ mode, type }) {
  const [visible, setVisible] = React.useState(false);

  const content = {
    properties: {
      catalog: "Alle Properties können direkt bearbeitet, hinzugefügt oder gelöscht werden. Die Änderungen werden fest im Katalog gespeichert.",
      profile: "Du kannst eigene Properties hinzufügen oder bestehende entfernen. Technisch wird das Original aus dem Katalog dabei nicht wirklich gelöscht, sondern nur im Profil überschrieben (im Editor durchgestrichen sichtbar)."
    },
    parts: {
      catalog: "Texte, Typen und IDs können direkt verändert werden. Neue Statements lassen sich beliebig einbauen.",
      profile: "Du kannst Texte ändern, IDs anpassen oder neue Statements ergänzen. Wenn du ein Original-Statement anpasst, wird es im Hintergrund gelöscht und sofort als neues Objekt mit deinen Änderungen wieder angelegt."
    },
    parameters: {
      catalog: "Parameter (z.B. Variablen) können direkt angelegt und ihre Standardwerte konfiguriert werden.",
      profile: "Du kannst die Werte der Parameter für dein System überschreiben. Der Originalwert aus dem Katalog bleibt im Hintergrund immer als Fallback erhalten."
    }
  };

  const text = content[type]?.[mode] || "";
  if (!text) return null;

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span
        onClick={() => setVisible(!visible)}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        style={{
          cursor: 'help',
          fontSize: '11px',
          background: 'var(--color-surface-3)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)',
          borderRadius: '50%',
          width: '16px',
          height: '16px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          userSelect: 'none'
        }}
      >
        i
      </span>
      {visible && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            background: 'var(--color-surface-3)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            fontSize: '12px',
            lineHeight: '1.5',
            color: 'var(--color-text)',
            width: '260px',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 999,
            pointerEvents: 'none'
          }}
        >
          <strong style={{ display: 'block', marginBottom: '6px', color: 'var(--color-primary)' }}>
            {mode === 'catalog' ? 'Katalog-Modus' : 'Profil-Modus'}
          </strong>
          {text}
        </div>
      )}
    </div>
  );
}

/**
 * Unified Control Detail View & Editor.
 *
 * Replaces both catalog/ControlDetail and profile/ProfileDetailPanel.
 *
 * mode='catalog': Direct mutation of control object, full PartsEditor CRUD,
 *                 ParameterEditor, Enhancement navigation.
 * mode='profile': Modify via profile.modify.alters, ProseWithParams for text override,
 *                 Parameter Override cards, inline Enhancement expand.
 */
export function ControlDetailView({
  control = {},
  isEditing = false,
  allUsedPropKeys = [],
  mode = 'catalog',
  // Catalog-specific:
  catalog = {},
  onControlChange,
  onSelectControl,
  onSelectGroup,
  // Profile-specific:
  originalControl = {},
  profile = {},
  onProfileChange,
  backMatterResources = []
}) {
  const params = control.params || [];
  const visibleParamsMap = getAllVisibleParamsMap(control.id, params, catalog);
  
  if (mode === 'profile') {
    const profileSetParams = profile.modify?.['set-parameters'] || [];
    profileSetParams.forEach(sp => {
      const pid = sp['param-id'] || sp.id;
      if (!pid) return;
      if (visibleParamsMap[pid]) {
        visibleParamsMap[pid] = { ...visibleParamsMap[pid], ...sp, id: pid };
      } else {
        visibleParamsMap[pid] = {
          id: pid,
          label: sp.label || pid,
          values: sp.values || [],
          select: sp.select,
          scope: 'profile',
          scopeLabel: '⚙️ Profile Parameters',
          ...sp
        };
      }
    });
  }

  const combinedParams = Object.values(visibleParamsMap).map(p => {
    if (p.scope) return p;
    let scope = 'control';
    let scopeLabel = `🎯 Control Parameters (${control.id})`;
    
    const isInCatalog = (catalog?.params || []).some(cp => cp.id === p.id);
    if (isInCatalog) {
      scope = 'catalog';
      scopeLabel = '🌐 Catalog Parameters';
    } else {
      const groupParams = getGroupParamsForControl(control.id, catalog);
      const isInGroup = groupParams.some(gp => gp.id === p.id);
      if (isInGroup) {
        scope = 'group';
        scopeLabel = '📁 Group Parameters';
      }
    }
    
    return {
      ...p,
      scope,
      scopeLabel
    };
  });
  const props = control.props || [];
  const links = control.links || [];
  const enhancements = control.controls || [];
  const isSubcontrol = control.id?.includes('.');
  const proseRefs = useRef({});
  const paramSectionRef = useRef(null);
  const [showAdvancedPartIndex, setShowAdvancedPartIndex] = useState({});
  const toggleAdvancedPart = (key) => {
    setShowAdvancedPartIndex(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleDefineNewParam = () => {
    if (mode === 'catalog') {
      const newId = `param_new_${Date.now().toString().slice(-4)}`;
      const updatedParams = [...params, {
        id: newId,
        label: 'New Parameter',
        values: []
      }];
      handleFieldChange('params', updatedParams);
    } else if (mode === 'profile' && onProfileChange) {
      const newId = `param_${Date.now().toString().slice(-4)}`;
      const propsList = isSubcontrol
        ? [{ name: 'subcontrol-id', value: control.id }]
        : [{ name: 'control-id', value: control.id }];
      const newParam = {
        'param-id': newId,
        label: 'Custom Profile Parameter',
        values: [],
        props: propsList
      };
      const currentSetParams = profile.modify?.['set-parameters'] || [];
      const updatedSetParams = [...currentSetParams, newParam];
      const modify = profile.modify ? { ...profile.modify } : {};
      modify['set-parameters'] = updatedSetParams;
      onProfileChange({ ...profile, modify });
    }
    setTimeout(() => {
      if (paramSectionRef.current) {
        paramSectionRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  // ══════════════════════════════════════════════════════════════
  // Shared: field change handler (dispatches to correct mode)
  // ══════════════════════════════════════════════════════════════

  const handleFieldChange = (field, val) => {
    if (mode === 'catalog' && onControlChange) {
      onControlChange({ ...control, [field]: val });
    }
  };

  // ══════════════════════════════════════════════════════════════
  // Shared: Prose rendering (read-only mode)
  // ══════════════════════════════════════════════════════════════

  const renderFormattedProse = (prose) => {
    const visibleParams = getAllVisibleParamsMap(control.id, params, catalog);
    const resolvedParams = {};

    Object.keys(visibleParams).forEach(id => {
      const p = visibleParams[id];
      resolvedParams[id] = (p.values && p.values.length > 0 && p.values[0])
        ? p.values[0]
        : (p.label ? `[${p.label}]` : `[${id}]`);
    });

    if (mode === 'profile') {
      const setParams = profile.modify?.['set-parameters'] || [];
      setParams.forEach(override => {
        const pid = override['param-id'] || override.id;
        if (!pid) return;
        if (override.values && override.values.length > 0 && override.values[0]) {
          resolvedParams[pid] = override.values[0];
          resolvedParams[pid.toLowerCase()] = override.values[0];
        } else if (override.label) {
          resolvedParams[pid] = `[${override.label}]`;
          resolvedParams[pid.toLowerCase()] = `[${override.label}]`;
        }
      });
    }
    return formatProse(prose, resolvedParams);
  };

  const renderProseToReact = (proseText) => {
    const visibleParams = getAllVisibleParamsMap(control.id, params, catalog);
    
    if (!proseText) return '';
    const placeholderRegex = /\{\{\s*insert:\s*param,\s*([^\s}]+)\s*\}\}/g;
    const partsList = [];
    let lastIdx = 0;
    let match;

    const profileSetParams = mode === 'profile' ? (profile.modify?.['set-parameters'] || []) : [];

    while ((match = placeholderRegex.exec(proseText)) !== null) {
      const textBefore = proseText.substring(lastIdx, match.index);
      if (textBefore) partsList.push(textBefore);

      const paramId = match[1];
      const paramIdLower = paramId.toLowerCase();
      
      // Find catalog parameter definition
      const catalogParamKey = Object.keys(visibleParams).find(k => k.toLowerCase() === paramIdLower);
      const catalogParam = catalogParamKey ? visibleParams[catalogParamKey] : null;

      // Find profile override definition
      const override = profileSetParams.find(sp => (sp['param-id'] || sp.id)?.toLowerCase() === paramIdLower);

      const isOverridden = Boolean(override && Object.keys(override).filter(k => k !== 'param-id' && k !== 'id' && override[k] !== undefined).length > 0);
      
      const activeValues = (override?.values && override.values.length > 0)
        ? override.values
        : (catalogParam?.values && catalogParam.values.length > 0 ? catalogParam.values : []);

      const hasValue = activeValues.length > 0 && Boolean(activeValues[0]);
      const activeValueStr = activeValues.join(', ');

      const label = override?.label || catalogParam?.label || paramId;
      const guidelines = override?.guidelines?.prose 
        || (Array.isArray(override?.guidelines) ? override?.guidelines[0]?.prose : undefined)
        || catalogParam?.guidelines?.prose
        || (Array.isArray(catalogParam?.guidelines) ? catalogParam?.guidelines[0]?.prose : undefined);

      let statusLine = `Status: Unset`;
      if (hasValue) {
        statusLine = `Status: Set ("${activeValueStr}")`;
      }

      const displayText = hasValue ? activeValueStr : `[${label}]`;

      // English tooltip: Parameter header, Status (Set/Unset + value), Guidance, and jump hint
      const tooltipLines = [
        `Parameter: ${paramId}`,
        statusLine,
        guidelines ? `Guidance: ${guidelines}` : null,
        `(Click to jump to parameter editor)`
      ].filter(Boolean);

      const tooltipText = tooltipLines.join('\n');

      const handleChipClick = (e) => {
        e.preventDefault();
        const cardElem = document.getElementById(`param-card-${paramIdLower}`);
        if (cardElem) {
          cardElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          cardElem.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
          cardElem.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.5)';
          setTimeout(() => {
            cardElem.style.boxShadow = '';
          }, 2000);
        }
      };

      partsList.push(
        <span
          key={match.index}
          className="control-param-insert"
          style={{ 
            cursor: 'pointer', 
            fontWeight: hasValue ? '700' : '500',
            border: hasValue ? '1.5px solid var(--color-success, #059669)' : '1px solid rgba(56, 139, 253, 0.3)',
            background: hasValue ? 'var(--color-success-subtle, rgba(16, 185, 129, 0.12))' : 'var(--color-accent-bg)',
            color: hasValue ? 'var(--color-success, #059669)' : 'var(--color-accent-hover)'
          }}
          title={tooltipText}
          onClick={handleChipClick}
        >
          {displayText}
        </span>
      );
      lastIdx = placeholderRegex.lastIndex;
    }
    
    const textAfter = proseText.substring(lastIdx);
    if (textAfter) partsList.push(textAfter);

    return partsList.length > 0 ? partsList : proseText;
  };

  const extractAssessmentMethods = (controlObject) => {
    const methods = [];
    const traverse = (part) => {
      const partName = part.name?.toLowerCase();
      if (partName === 'objective') {
        if (part.parts) {
          part.parts.forEach(sub => {
            const subName = sub.name?.toLowerCase();
            if (subName === 'method' || ['examine', 'interview', 'test'].includes(subName)) {
              const methodVal = sub.props?.find(p => p.name?.toLowerCase() === 'method')?.value || sub.name;
              methods.push({
                id: sub.id || `${controlObject.id}_obj.${methodVal.toLowerCase()}`,
                method: methodVal,
                prose: sub.prose
              });
            }
          });
        }
      }
      if (partName === 'assessment-method' || ['examine', 'interview', 'test'].includes(partName)) {
        const methodVal = part.props?.find(p => p.name?.toLowerCase() === 'method')?.value || part.name;
        methods.push({
          id: part.id || `${controlObject.id}_obj.${methodVal.toLowerCase()}`,
          method: methodVal,
          prose: part.prose
        });
      }
      if (part.parts) {
        part.parts.forEach(traverse);
      }
    };
    if (controlObject.parts) {
      controlObject.parts.forEach(traverse);
    }
    return methods;
  };

  const formatMethodId = (ctrlId, methodName) => {
    let paddedId = ctrlId.toUpperCase();
    const match = ctrlId.match(/^([a-zA-Z]+)-([0-9]+)$/);
    if (match) {
      const num = parseInt(match[2], 10);
      if (num < 10) {
        paddedId = `${match[1].toUpperCase()}-0${num}`;
      }
    }
    const capMethod = methodName.charAt(0).toUpperCase() + methodName.slice(1).toLowerCase();
    return `${paddedId}-${capMethod}`;
  };

  // ══════════════════════════════════════════════════════════════
  // Catalog-specific handlers
  // ══════════════════════════════════════════════════════════════

  const handleAddEnhancement = () => {
    const parentId = control.id || 'control';
    const newId = `${parentId}.${enhancements.length + 1}`;
    handleFieldChange('controls', [...enhancements, {
      id: newId,
      title: 'New Enhancement',
      parts: [{ name: 'statement', prose: '' }]
    }]);
  };

  const handleRemoveEnhancement = (idx, e) => {
    e.stopPropagation();
    handleFieldChange('controls', enhancements.filter((_, i) => i !== idx));
  };

  // ══════════════════════════════════════════════════════════════
  // Profile-specific handlers
  // ══════════════════════════════════════════════════════════════

  const setParams = profile.modify?.['set-parameters'] || [];

  const getAlterForControl = (controlId) => {
    return (profile?.modify?.alters || []).find(a => a['control-id'] === controlId);
  };

  const updateAlter = (controlId, updateFn) => {
    const modify = profile?.modify ? { ...profile.modify } : {};
    const alters = modify.alters ? [...modify.alters] : [];
    const alterIdx = alters.findIndex(a => a['control-id'] === controlId);

    let currentAlter = alterIdx >= 0 ? { ...alters[alterIdx] } : { 'control-id': controlId };
    currentAlter = updateFn(currentAlter);

    const hasAdds = currentAlter.adds && currentAlter.adds.length > 0;
    const hasRemoves = currentAlter.removes && currentAlter.removes.length > 0;

    if (!hasAdds && !hasRemoves) {
      if (alterIdx >= 0) alters.splice(alterIdx, 1);
    } else {
      if (alterIdx >= 0) alters[alterIdx] = currentAlter;
      else alters.push(currentAlter);
    }

    onProfileChange({ ...profile, modify: { ...modify, alters } });
  };

  const getParamStatus = (paramId, defaultValues) => {
    const override = setParams.find(p => p['param-id'] === paramId);
    if (override?.values?.length > 0) {
      return { value: override.values[0], isOverridden: true };
    }
    return { value: defaultValues?.[0] || `[${paramId}]`, isOverridden: false };
  };

  const getModifiedPartIds = (controlId = control.id) => {
    const alter = getAlterForControl(controlId);
    if (!alter) return [];
    const ids = [];
    (alter.removes || []).forEach(r => {
      if (r['by-id'] && alter.adds?.some(a => a['by-id'] === r['by-id'])) {
        ids.push(r['by-id']);
      }
    });
    return ids;
  };

  const handleParamOverrideChange = (paramId, overrideValue) => {
    let updatedSetParams = [...setParams];
    const existingIdx = updatedSetParams.findIndex(p => p['param-id'] === paramId);
    const values = overrideValue.trim() ? [overrideValue.trim()] : [];

    if (values.length === 0) {
      if (existingIdx !== -1) updatedSetParams = updatedSetParams.filter((_, i) => i !== existingIdx);
    } else {
      if (existingIdx !== -1) updatedSetParams[existingIdx] = { ...updatedSetParams[existingIdx], values };
      else updatedSetParams.push({ 'param-id': paramId, values });
    }

    const modify = profile.modify ? { ...profile.modify } : {};
    modify['set-parameters'] = updatedSetParams;
    onProfileChange({ ...profile, modify });
  };

  const handleOriginalPartFieldChange = (originalId, field, newVal, originalPart, targetControlId = control.id) => {
    updateAlter(targetControlId, (alter) => {
      let removes = alter.removes ? [...alter.removes] : [];
      let adds = alter.adds ? [...alter.adds] : [];

      // Ensure the original ID is in removes
      if (!removes.some(r => r['by-id'] === originalId)) {
        removes.push({ 'by-id': originalId });
      }

      // Find the replacement add block
      const addIdx = adds.findIndex(a => a['by-id'] === originalId && a.position === 'after');
      
      // Determine current replacement state or default to original values
      let currentPart = {
        id: originalId,
        name: originalPart.originalName || 'statement',
        prose: originalPart.originalProse || ''
      };
      
      if (addIdx >= 0 && adds[addIdx].parts?.[0]) {
        currentPart = { ...currentPart, ...adds[addIdx].parts[0] };
      }

      // Update the modified field
      if (newVal === undefined) {
        delete currentPart[field];
      } else {
        currentPart[field] = newVal;
      }

      // If the part is now identical to original in all fields, we can reset it!
      const isIdentical = currentPart.id === originalId &&
                          currentPart.name === originalPart.originalName &&
                          currentPart.prose === originalPart.originalProse;
      
      if (isIdentical) {
        // Remove from removes and adds
        removes = removes.filter(r => r['by-id'] !== originalId);
        adds = adds.filter(a => !(a['by-id'] === originalId && a.position === 'after'));
      } else {
        // Update or push the replacement adds block
        const newAddBlock = {
          position: 'after',
          'by-id': originalId,
          parts: [currentPart]
        };
        if (addIdx >= 0) {
          adds[addIdx] = newAddBlock;
        } else {
          adds.push(newAddBlock);
        }
      }

      return { ...alter, removes, adds };
    });
  };

  const handleProseChange = (partId, newProse, originalPart, targetControlId = control.id) => {
    if (!partId) return;
    
    // Check if it is a newly added supplemental part
    const alter = getAlterForControl(targetControlId);
    const adds = alter?.adds || [];
    const isAddedPart = adds.some(a => a.parts?.some(p => p.id === partId && !(a.position === 'after' && a['by-id'] === partId)));
    
    if (isAddedPart) {
      updateAlter(targetControlId, (alter) => {
        let adds = alter.adds ? [...alter.adds] : [];
        const addedIdx = adds.findIndex(a => a.parts?.some(p => p.id === partId));
        if (addedIdx >= 0) {
          const addBlock = { ...adds[addedIdx] };
          addBlock.parts = addBlock.parts.map(p => p.id === partId ? { ...p, prose: newProse } : p);
          adds[addedIdx] = addBlock;
        }
        return { ...alter, adds };
      });
    } else {
      // It is an original part or a replacement
      const originalId = originalPart.originalId || partId;
      handleOriginalPartFieldChange(originalId, 'prose', newProse, originalPart, targetControlId);
    }
  };

  const handleResetProse = (partId, targetControlId = control.id) => {
    updateAlter(targetControlId, (alter) => {
      const removes = (alter.removes || []).filter(r => r['by-id'] !== partId);
      const adds = (alter.adds || []).filter(a => !(a['by-id'] === partId && a.position === 'after'));
      return { ...alter, removes, adds };
    });
  };

  const handleRemoveProfilePart = (partId, targetControlId = control.id) => {
    updateAlter(targetControlId, (alter) => {
      let adds = alter.adds ? [...alter.adds] : [];
      
      // If it is a newly added part, just delete it from adds completely!
      const isAddedPart = adds.some(a => a.parts?.some(p => p.id === partId && !(a.position === 'after' && a['by-id'] === partId))); // exclude replacements
      if (isAddedPart) {
        adds = adds.filter(a => !a.parts?.some(p => p.id === partId));
        return { ...alter, adds };
      }

      // Otherwise, original part removal logic
      let removes = alter.removes ? [...alter.removes] : [];
      adds = adds.filter(a => !(a['by-id'] === partId && a.position === 'after'));
      if (!removes.some(r => r['by-id'] === partId)) {
        removes.push({ 'by-id': partId });
      }
      return { ...alter, removes, adds };
    });
  };

  const handleRestoreProfilePart = (partId, targetControlId = control.id) => {
    updateAlter(targetControlId, (alter) => {
      const removes = (alter.removes || []).filter(r => r['by-id'] !== partId);
      return { ...alter, removes };
    });
  };

  const resolveProfilePartsForRendering = (origParts, alter) => {
    if (!origParts) origParts = [];
    const removes = alter?.removes || [];
    const adds = alter?.adds || [];
    
    // First, map the original parts (and handle replacements and direct removals)
    let result = origParts.map(p => {
      const isReplacementRemoves = removes.some(r => r['by-id'] === p.id);
      const replacementAdd = adds.find(a => a['by-id'] === p.id && a.position === 'after');
      
      const isReplaced = !!replacementAdd;
      const isRemoved = isReplacementRemoves && !isReplaced;
      const subparts = resolveProfilePartsForRendering(p.parts || [], alter);
      
      return {
        ...p,
        id: replacementAdd?.parts?.[0]?.id || p.id,
        name: replacementAdd?.parts?.[0]?.name || p.name,
        prose: replacementAdd?.parts?.[0]?.prose !== undefined ? replacementAdd.parts[0].prose : p.prose,
        isRemoved,
        isModified: isReplaced,
        originalId: p.id,
        originalName: p.name,
        originalProse: p.prose,
        parts: subparts
      };
    });

    // Now insert any non-replacement adds
    adds.forEach(add => {
      if (!add.parts) return;
      
      add.parts.forEach(newPart => {
        // If this newPart is a replacement (it is used as a replacement for an orig part),
        // it is already handled inside the map above.
        const isReplacement = origParts.some(op => op.id === add['by-id'] && removes.some(r => r['by-id'] === op.id) && add.position === 'after' && newPart.id === op.id);
        if (isReplacement) return;

        // Otherwise, insert it based on its position
        if (add.position === 'starting') {
          if (!result.some(p => p.id === newPart.id)) {
            result.push({ ...newPart, isAdded: true });
          }
        } else if (add.position === 'ending') {
          if (!result.some(p => p.id === newPart.id)) {
            result.push({ ...newPart, isAdded: true });
          }
        } else if (add.position === 'before' && add['by-id']) {
          const targetIdx = result.findIndex(p => p.id === add['by-id']);
          if (targetIdx >= 0 && !result.some(p => p.id === newPart.id)) {
            result.splice(targetIdx, 0, { ...newPart, isAdded: true });
          }
        } else if (add.position === 'after' && add['by-id']) {
          const targetIdx = result.findIndex(p => p.id === add['by-id']);
          if (targetIdx >= 0 && !result.some(p => p.id === newPart.id)) {
            result.splice(targetIdx + 1, 0, { ...newPart, isAdded: true });
          }
        }
      });
    });

    return result;
  };

  const handlePartIdChange = (oldId, newId, targetControlId = control.id) => {
    if (!newId || oldId === newId) return;
    updateAlter(targetControlId, (alter) => {
      let adds = alter.adds ? [...alter.adds] : [];
      adds = adds.map(a => {
        if (a.parts) {
          const updatedParts = a.parts.map(pt => pt.id === oldId ? { ...pt, id: newId } : pt);
          return { ...a, parts: updatedParts };
        }
        return a;
      });
      return { ...alter, adds };
    });
  };

  const handlePartNameChange = (partId, newName, targetControlId = control.id) => {
    updateAlter(targetControlId, (alter) => {
      let adds = alter.adds ? [...alter.adds] : [];
      adds = adds.map(a => {
        if (a.parts) {
          const updatedParts = a.parts.map(pt => pt.id === partId ? { ...pt, name: newName } : pt);
          return { ...a, parts: updatedParts };
        }
        return a;
      });
      return { ...alter, adds };
    });
  };

  const handleAddedPartFieldChange = (partId, field, newVal, targetControlId = control.id) => {
    updateAlter(targetControlId, (alter) => {
      let adds = alter.adds ? [...alter.adds] : [];
      adds = adds.map(a => {
        if (a.parts) {
          const updatedParts = a.parts.map(pt => {
            if (pt.id === partId) {
              const item = { ...pt };
              if (newVal === undefined || newVal === '') {
                delete item[field];
              } else {
                item[field] = newVal;
              }
              return item;
            }
            return pt;
          });
          return { ...a, parts: updatedParts };
        }
        return a;
      });
      return { ...alter, adds };
    });
  };

  const handleAddProfilePartAtEnd = () => {
    const newPartId = `${control.id}_smt_added_${Date.now().toString().slice(-4)}`;
    updateAlter(control.id, (alter) => {
      let adds = alter.adds ? [...alter.adds] : [];
      adds.push({
        position: 'ending',
        parts: [{
          id: newPartId,
          name: 'statement',
          prose: ''
        }]
      });
      return { ...alter, adds };
    });
  };

  const handleAddProfilePartAfter = (siblingId, targetControlId = control.id) => {
    const newPartId = `${targetControlId}_smt_added_${Date.now().toString().slice(-4)}`;
    updateAlter(targetControlId, (alter) => {
      let adds = alter.adds ? [...alter.adds] : [];
      adds.push({
        position: 'after',
        'by-id': siblingId,
        parts: [{
          id: newPartId,
          name: 'statement',
          prose: ''
        }]
      });
      return { ...alter, adds };
    });
  };

  const handlePropsChange = (updatedProps) => {
    if (mode === 'catalog') {
      handleFieldChange('props', updatedProps);
      return;
    }

    const originalProps = originalControl?.props || [];
    
    // Determine which original props were removed
    const removedProps = originalProps.filter(op => 
      !updatedProps.some(up => up.name === op.name)
    );

    // Determine which props are new or modified
    const addedOrModifiedProps = updatedProps.filter(up => {
      const op = originalProps.find(o => o.name === up.name);
      if (!op) return true;
      return op.value !== up.value || op.ns !== up.ns || op.class !== up.class;
    });

    updateAlter(control.id, (alter) => {
      let removes = alter.removes ? [...alter.removes] : [];
      let adds = alter.adds ? [...alter.adds] : [];

      // 1. Update removes (filter out elements reactivated, add newly removed ones)
      removes = removes.filter(r => !updatedProps.some(up => up.name === r['by-name']));
      removedProps.forEach(rp => {
        if (!removes.some(r => r['by-name'] === rp.name)) {
          removes.push({ 'by-name': rp.name });
        }
      });

      // Also add overridden original props to removes so they are cleanly replaced
      addedOrModifiedProps.forEach(ap => {
        if (originalProps.some(op => op.name === ap.name)) {
          if (!removes.some(r => r['by-name'] === ap.name)) {
            removes.push({ 'by-name': ap.name });
          }
        }
      });

      // 2. Update adds
      adds = adds.filter(a => !(a.position === 'ending' && a.props));
      if (addedOrModifiedProps.length > 0) {
        adds.push({
          position: 'ending',
          props: addedOrModifiedProps
        });
      }

      return { ...alter, removes, adds };
    });
  };

  const handleRestoreProp = (propName) => {
    updateAlter(control.id, (alter) => {
      const removes = (alter.removes || []).filter(r => r['by-name'] !== propName);
      return { ...alter, removes };
    });
  };

  const handleRevertProp = (propName) => {
    updateAlter(control.id, (alter) => {
      // Remove from adds
      let adds = alter.adds ? [...alter.adds] : [];
      adds = adds.map(a => {
        if (a.position === 'ending' && a.props) {
          const props = a.props.filter(p => p.name !== propName);
          return props.length > 0 ? { ...a, props } : null;
        }
        return a;
      }).filter(Boolean);

      // Remove from removes (so the default comes back)
      const removes = (alter.removes || []).filter(r => r['by-name'] !== propName);

      return { ...alter, adds, removes };
    });
  };

  const getOverriddenPropNames = () => {
    if (mode !== 'profile' || !originalControl) return [];
    const origProps = originalControl.props || [];
    const alter = getAlterForControl(control.id);
    const addedProps = (alter?.adds || [])
      .filter(a => a.position === 'ending' && a.props)
      .flatMap(a => a.props || []);
    
    return addedProps
      .filter(ap => origProps.some(op => op.name === ap.name))
      .map(ap => ap.name);
  };

  const getDisplayPropsForProfileEditing = () => {
    const origProps = originalControl?.props || [];
    const alter = getAlterForControl(control.id);
    const addedProps = (alter?.adds || [])
      .filter(a => a.position === 'ending' && a.props)
      .flatMap(a => a.props || []);
    
    const result = [...origProps];
    addedProps.forEach(ap => {
      const idx = result.findIndex(op => op.name === ap.name);
      if (idx >= 0) {
        result[idx] = ap;
      } else {
        result.push(ap);
      }
    });
    return result;
  };


  const handleHeaderChange = (field, val) => {
    const propName = field === 'id' ? 'id-override' : 'title-override';
    updateAlter(control.id, (alter) => {
      let adds = alter.adds ? [...alter.adds] : [];
      const startingIdx = adds.findIndex(a => a.position === 'starting');
      let startingAdd = startingIdx >= 0 ? { ...adds[startingIdx] } : { position: 'starting', props: [] };
      let uProps = startingAdd.props ? [...startingAdd.props] : [];

      const pIdx = uProps.findIndex(p => p.name === propName);
      if (pIdx >= 0) {
        if (!val) uProps.splice(pIdx, 1);
        else uProps[pIdx] = { ...uProps[pIdx], value: val };
      } else if (val) {
        uProps.push({ name: propName, value: val });
      }
startingAdd.props = uProps;
      if (uProps.length === 0 && Object.keys(startingAdd).length <= 1) {
        if (startingIdx >= 0) adds.splice(startingIdx, 1);
      } else {
        if (startingIdx >= 0) adds[startingIdx] = startingAdd;
        else adds.push(startingAdd);
      }

      return { ...alter, adds };
    });
  };

  const handleLinksChange = (updatedLinks) => {
    if (mode === 'catalog') {
      handleFieldChange('links', updatedLinks);
    } else {
      updateAlter(control.id, (alter) => {
        let adds = alter.adds ? [...alter.adds] : [];
        const linksIdx = adds.findIndex(a => a.position === 'ending' && a.links);
        if (updatedLinks.length === 0) {
          if (linksIdx >= 0) adds.splice(linksIdx, 1);
        } else {
          if (linksIdx >= 0) adds[linksIdx] = { ...adds[linksIdx], links: updatedLinks };
          else adds.push({ position: 'ending', links: updatedLinks });
        }
        return { ...alter, adds };
      });
    }
  };



  // ══════════════════════════════════════════════════════════════
  // Profile: Edit-mode part rendering (with prose change tracking)
  // ══════════════════════════════════════════════════════════════

  const renderEditPart = (p, origP, level = 0, index = 0, targetControlId = control.id) => {
    const alter = getAlterForControl(targetControlId);
    const isModified = alter?.removes?.some(r => r['by-id'] === p.id) && alter?.adds?.some(a => a['by-id'] === p.id);
    const subparts = p.parts || [];
    const origSubparts = origP?.parts || [];

    const label = level > 0 ? getAutoLabel(index, level) : null;

    // Available part names/types matching PartsEditor.jsx
    const PART_NAMES = [
      'statement',
      'guidance',
      'discussion',
      'information',
      'overview',
      'item',
      'objective',
      'assessment-objective',
      'assessment-method',
      'example',
      'custom'
    ];

    if (level === 0) {
      let borderLeftColor = 'var(--color-primary)';
      if (p.name?.toLowerCase() !== 'statement') {
        borderLeftColor = 'var(--color-accent, var(--color-primary))';
      }
      if (isModified) borderLeftColor = 'var(--color-warning)';
      if (p.isAdded) borderLeftColor = 'var(--color-accent)';
      if (p.isRemoved) borderLeftColor = 'var(--color-border)';

      const cardStyle = {
        background: isModified || p.isAdded ? 'var(--color-surface-2)' : 'var(--color-surface)',
        border: p.isRemoved ? '1px dashed var(--color-border)' : '1px solid var(--color-border)',
        borderLeft: `4px solid ${borderLeftColor}`,
        borderRadius: 'var(--radius-md)',
        padding: '20px',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        opacity: p.isRemoved ? 0.6 : 1,
        position: 'relative'
      };

      return (
        <div key={p.id || p.prose} style={cardStyle}>
          {/* Header Row: Icons, badge selector, ID, actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', color: 'var(--color-primary)' }}>
                {p.name?.toLowerCase() === 'statement' ? '☵' : '📖'}
              </span>
              
              {/* Category Type selector (Same style as PartsEditor) */}
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', background: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: '4px', padding: '2px 8px' }}>
                {!p.isRemoved && (
                  <select
                    value={p.name || 'statement'}
                    onChange={(e) => p.isAdded
                      ? handlePartNameChange(p.id, e.target.value, targetControlId)
                      : handleOriginalPartFieldChange(p.originalId || p.id, 'name', e.target.value, p, targetControlId)
                    }
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer',
                      zIndex: 2
                    }}
                  >
                    {PART_NAMES.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                )}
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-primary)', textTransform: 'uppercase' }}>
                  {p.name || 'statement'} {!p.isRemoved && '▼'}
                </span>
              </div>

              {/* Part ID Field */}
              <DebouncedInput
                value={p.id}
                onChange={(newId) => p.isAdded
                  ? handlePartIdChange(p.id, newId, targetControlId)
                  : handleOriginalPartFieldChange(p.originalId || p.id, 'id', newId, p, targetControlId)
                }
                disabled={p.isRemoved}
                className="form-input-plain"
                style={{
                  width: '120px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: 'var(--color-text-muted)',
                  background: 'var(--color-surface-2)',
                  padding: '1px 4px',
                  borderRadius: '3px'
                }}
              />
            </div>

            {/* Badges for modified / added / removed & reset/restore/delete/add actions */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {isModified && (
                <span style={{ background: 'var(--color-warning)', color: '#000', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                  Modified
                </span>
              )}
              {p.isAdded && (
                <span style={{ background: 'var(--color-accent)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                  Added
                </span>
              )}
              {p.isRemoved && (
                <span style={{ background: 'var(--color-border)', color: 'var(--color-text-muted)', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                  Removed
                </span>
              )}
              {isModified && !p.isRemoved && (
                <button
                  onClick={() => handleResetProse(p.id, targetControlId)}
                  style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--color-surface-3)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  ↺ Reset
                </button>
              )}
              {p.isRemoved ? (
                <button
                  onClick={() => handleRestoreProfilePart(p.id, targetControlId)}
                  style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--color-surface-3)', border: '1px solid var(--color-success)', borderRadius: '4px', color: '#22c55e', cursor: 'pointer' }}
                >
                  ↺ Restore
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '4px' }}>
                  {p.isAdded && (
                    <button
                      onClick={() => handleRemoveProfilePart(p.id, targetControlId)}
                      title="Delete added statement"
                      style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--color-surface-3)', border: '1px solid var(--color-danger)', borderRadius: '4px', color: '#ff4d4f', cursor: 'pointer' }}
                    >
                      🗑
                    </button>
                  )}
                  {p.prose !== undefined && p.prose !== null && (
                    <button
                      onClick={() => proseRefs.current[p.id]?.insertParamPlaceholder()}
                      title="Add Parameter"
                      style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--color-surface-3)', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'var(--color-primary)' }}
                    >
                      ⚙️ Add Parameter
                    </button>
                  )}
                  <button
                    onClick={() => handleAddProfilePartAfter(p.id, targetControlId)}
                    title="Add statement after this"
                    style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--color-surface-3)', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'var(--color-accent-hover)' }}
                  >
                    ➕ Add After
                  </button>
                  <button
                    onClick={() => toggleAdvancedPart(p.id)}
                    title="Advanced Settings"
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      background: showAdvancedPartIndex[p.id] ? 'var(--color-primary-light, rgba(99, 102, 241, 0.15))' : 'var(--color-surface-3)',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: showAdvancedPartIndex[p.id] ? 'var(--color-primary)' : 'inherit'
                    }}
                  >
                    🔧
                  </button>
                  <button
                    onClick={() => handleRemoveProfilePart(p.id, targetControlId)}
                    title="Remove statement"
                    style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--color-surface-3)', border: '1px solid var(--color-danger)', borderRadius: '4px', color: '#ff4d4f', cursor: 'pointer' }}
                  >
                    🗑 Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Prose Text Area */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {p.isRemoved ? (
              <span style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>
                {p.prose || ''}
              </span>
            ) : p.prose !== undefined && p.prose !== null ? (
              <ProseWithParams
                ref={(el) => { if (el) proseRefs.current[p.id] = el; }}
                value={p.prose || ''}
                onChange={(newVal) => handleProseChange(p.id, newVal, p, targetControlId)}
                params={combinedParams}
                rows={2}
                placeholder="Enter prose text..."
                className="form-textarea"
                style={{ fontSize: '14px', width: '100%' }}
                onDefineNewParam={handleDefineNewParam}
              />
            ) : null}
          </div>

          {/* Advanced fields collapsible for profile top-level parts */}
          {showAdvancedPartIndex[p.id] && !p.isRemoved && (
            <div
              style={{
                padding: '12px',
                background: 'var(--color-surface-3)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '12px',
                marginTop: '4px'
              }}
            >
              <div>
                <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Namespace (ns)</label>
                <DebouncedInput
                  value={p.ns || ''}
                  onChange={(val) => p.isAdded
                    ? handleAddedPartFieldChange(p.id, 'ns', val, targetControlId)
                    : handleOriginalPartFieldChange(p.originalId || p.id, 'ns', val, p, targetControlId)
                  }
                  placeholder="ns-uri"
                  className="form-input form-input-plain"
                  style={{ fontSize: '12px', width: '100%', padding: '4px 6px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Class</label>
                <DebouncedInput
                  value={p.class || ''}
                  onChange={(val) => p.isAdded
                    ? handleAddedPartFieldChange(p.id, 'class', val, targetControlId)
                    : handleOriginalPartFieldChange(p.originalId || p.id, 'class', val, p, targetControlId)
                  }
                  placeholder="class"
                  className="form-input form-input-plain"
                  style={{ fontSize: '12px', width: '100%', padding: '4px 6px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Title</label>
                <DebouncedInput
                  value={p.title || ''}
                  onChange={(val) => p.isAdded
                    ? handleAddedPartFieldChange(p.id, 'title', val, targetControlId)
                    : handleOriginalPartFieldChange(p.originalId || p.id, 'title', val, p, targetControlId)
                  }
                  placeholder="Title"
                  className="form-input form-input-plain"
                  style={{ fontSize: '12px', width: '100%', padding: '4px 6px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <PropsEditor
                  props={p.props || []}
                  onChange={(val) => p.isAdded
                    ? handleAddedPartFieldChange(p.id, 'props', val, targetControlId)
                    : handleOriginalPartFieldChange(p.originalId || p.id, 'props', val, p, targetControlId)
                  }
                  readOnly={readOnly}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <LinksEditor
                  links={p.links || []}
                  onChange={(val) => p.isAdded
                    ? handleAddedPartFieldChange(p.id, 'links', val, targetControlId)
                    : handleOriginalPartFieldChange(p.originalId || p.id, 'links', val, p, targetControlId)
                  }
                  readOnly={readOnly}
                />
              </div>
            </div>
          )}

          {/* Recursive child list items */}
          {subparts.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              {subparts.map((sp, i) => renderEditPart(sp, origSubparts[i], level + 1, i, targetControlId))}
            </div>
          )}
        </div>
      );
    }

    // Nested List Item Rendering (level > 0)
    const itemStyle = {
      display: 'flex',
      gap: '12px',
      marginBottom: '12px',
      marginLeft: level > 1 ? '16px' : '0',
      position: 'relative',
      opacity: p.isRemoved ? 0.6 : 1
    };

    const verticalLineStyle = {
      borderLeft: p.isAdded ? '2px solid var(--color-accent)' : isModified ? '2px solid var(--color-warning)' : '2px solid var(--color-primary-light, var(--color-primary))',
      opacity: 0.5,
      marginRight: '2px',
      flexShrink: 0
    };

    return (
      <div key={p.id || p.prose} style={itemStyle}>
        {/* Left vertical border line */}
        <div style={verticalLineStyle}></div>

        {/* Automatic numbering label */}
        <span style={{ fontWeight: '800', color: 'var(--color-primary)', minWidth: '24px', flexShrink: 0, textAlign: 'center', textDecoration: p.isRemoved ? 'line-through' : 'none' }}>
          {label}
        </span>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            
            {/* Prose Text Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {p.isRemoved ? (
                <span style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>
                  {p.prose || ''}
                </span>
              ) : p.prose !== undefined && p.prose !== null ? (
                <ProseWithParams
                  ref={(el) => { if (el) proseRefs.current[p.id] = el; }}
                  value={p.prose || ''}
                  onChange={(newVal) => handleProseChange(p.id, newVal, p, targetControlId)}
                  params={combinedParams}
                  rows={1}
                  placeholder="Item prose text..."
                  className="form-textarea-plain"
                  style={{ fontSize: '14px', flex: 1, padding: '2px 4px', minHeight: '22px' }}
                  onDefineNewParam={handleDefineNewParam}
                />
              ) : (
                <span style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--color-text-muted)', flex: 1, alignSelf: 'center' }}>
                  No prose text
                </span>
              )}
            </div>

            {/* Badges for modified / added / removed */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
              {isModified && (
                <span style={{ background: 'var(--color-warning)', color: '#000', fontSize: '9px', padding: '1px 4px', borderRadius: '4px' }}>
                  Modified
                </span>
              )}
              {p.isAdded && (
                <span style={{ background: 'var(--color-accent)', color: '#fff', fontSize: '9px', padding: '1px 4px', borderRadius: '4px' }}>
                  Added
                </span>
              )}
              {p.isRemoved && (
                <span style={{ background: 'var(--color-border)', color: 'var(--color-text-muted)', fontSize: '9px', padding: '1px 4px', borderRadius: '4px' }}>
                  Removed
                </span>
              )}
            </div>

            {/* Actions for Subpart */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
              {isModified && !p.isRemoved && (
                <button
                  onClick={() => handleResetProse(p.id, targetControlId)}
                  style={{ fontSize: '9px', padding: '1px 4px', background: 'var(--color-surface-3)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  ↺ Reset
                </button>
              )}
              {p.isRemoved ? (
                <button
                  onClick={() => handleRestoreProfilePart(p.id, targetControlId)}
                  style={{ fontSize: '9px', padding: '1px 4px', background: 'var(--color-surface-3)', border: '1px solid var(--color-success)', borderRadius: '4px', color: '#22c55e', cursor: 'pointer' }}
                >
                  ↺ Restore
                </button>
              ) : (
                <>
                  {p.prose !== undefined && p.prose !== null && (
                    <button
                      onClick={() => proseRefs.current[p.id]?.insertParamPlaceholder()}
                      title="Add Parameter"
                      style={{ fontSize: '9px', padding: '1px 4px', background: 'var(--color-surface-3)', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'var(--color-primary)' }}
                    >
                      ⚙️
                    </button>
                  )}
                  <button
                    onClick={() => handleAddProfilePartAfter(p.id, targetControlId)}
                    title="Add statement after this"
                    style={{ fontSize: '9px', padding: '1px 4px', background: 'var(--color-surface-3)', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'var(--color-accent-hover)' }}
                  >
                    ➕
                  </button>
                  <button
                    onClick={() => toggleAdvancedPart(p.id)}
                    title="Advanced Settings"
                    style={{ fontSize: '9px', padding: '1px 4px', background: showAdvancedPartIndex[p.id] ? 'var(--color-primary-light, rgba(99, 102, 241, 0.15))' : 'var(--color-surface-3)', border: 'none', borderRadius: '4px', cursor: 'pointer', color: showAdvancedPartIndex[p.id] ? 'var(--color-primary)' : 'inherit' }}
                  >
                    🔧
                  </button>
                  <button
                    onClick={() => handleRemoveProfilePart(p.id)}
                    title="Remove statement"
                    style={{ fontSize: '9px', padding: '1px 4px', background: 'var(--color-surface-3)', border: '1px solid var(--color-danger)', borderRadius: '4px', color: '#ff4d4f', cursor: 'pointer' }}
                  >
                    🗑
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Advanced fields collapsible for profile sub-parts */}
          {showAdvancedPartIndex[p.id] && !p.isRemoved && (
            <div
              style={{
                padding: '8px',
                background: 'var(--color-surface-3)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                marginTop: '4px'
              }}
            >
              <div>
                <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Class</label>
                <DebouncedInput
                  value={p.class || ''}
                  onChange={(val) => p.isAdded
                    ? handleAddedPartFieldChange(p.id, 'class', val, targetControlId)
                    : handleOriginalPartFieldChange(p.originalId || p.id, 'class', val, p, targetControlId)
                  }
                  placeholder="class"
                  className="form-input form-input-plain"
                  style={{ fontSize: '11px', width: '100%', padding: '2px 4px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Title</label>
                <DebouncedInput
                  value={p.title || ''}
                  onChange={(val) => p.isAdded
                    ? handleAddedPartFieldChange(p.id, 'title', val, targetControlId)
                    : handleOriginalPartFieldChange(p.originalId || p.id, 'title', val, p, targetControlId)
                  }
                  placeholder="Title"
                  className="form-input form-input-plain"
                  style={{ fontSize: '11px', width: '100%', padding: '2px 4px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <PropsEditor
                  props={p.props || []}
                  onChange={(val) => p.isAdded
                    ? handleAddedPartFieldChange(p.id, 'props', val, targetControlId)
                    : handleOriginalPartFieldChange(p.originalId || p.id, 'props', val, p, targetControlId)
                  }
                  readOnly={readOnly}
                />
              </div>
            </div>
          )}

          {/* Child parts rendering recursively */}
          {subparts.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              {subparts.map((sp, i) => renderEditPart(sp, origSubparts[i], level + 1, i))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════
  // Profile: Enhancement content renderer for accordion
  // ══════════════════════════════════════════════════════════════

  const renderEnhancementContent = (enhancement, idx) => {
    const origEnhancement = originalControl?.controls?.[idx];
    const alter = getAlterForControl(enhancement.id);
    const enhancementParts = mode === 'profile' && origEnhancement
      ? resolveProfilePartsForRendering(origEnhancement.parts, alter)
      : enhancement.parts || [];

    return (
      <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
        {enhancementParts.map((p, i) => {
          if (isEditing) return renderEditPart(p, origEnhancement?.parts?.[i], 0, i, enhancement.id);
          return null;
        })}
        {!isEditing && enhancementParts.length > 0 && (
          <ReadOnlyParts
            parts={enhancementParts}
            renderProse={renderProseToReact}
            modifiedPartIds={getModifiedPartIds(enhancement.id)}
            onResetPart={(partId) => handleResetProse(partId, enhancement.id)}
            isEditing={isEditing}
          />
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════
  // Resources for links
  // ══════════════════════════════════════════════════════════════

  const globalResources = mode === 'catalog'
    ? (catalog['back-matter']?.resources || [])
    : backMatterResources;

  const parts = mode === 'profile' && originalControl
    ? resolveProfilePartsForRendering(originalControl.parts, getAlterForControl(control.id))
    : control.parts || [];

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  return (
    <div className="control-detail-view" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>

      {/* Breadcrumbs */}
      <div className="breadcrumbs" style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span onClick={() => onSelectGroup?.(null)} style={{ cursor: onSelectGroup ? 'pointer' : 'default' }} className="breadcrumb-link">Overview</span>
        {getAncestorsPath(control.id, catalog).map(b => (
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
        <span style={{ color: 'var(--color-text)', fontWeight: '500' }}>{control.title || control.id}</span>
      </div>

      {/* ── 1. Header Card (ID, Title, Class, Props) ── */}
      <div
        className="header-card"
        style={{
          background: 'none',
          border: 'none',
          borderRadius: '0',
          padding: '0',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <ControlHeader
          id={control.id}
          title={control.title}
          controlClass={mode === 'catalog' ? control.class : undefined}
          isEditing={isEditing}
          onIdChange={(val) => mode === 'catalog' ? handleFieldChange('id', val) : handleHeaderChange('id', val)}
          onTitleChange={(val) => mode === 'catalog' ? handleFieldChange('title', val) : handleHeaderChange('title', val)}
          onClassChange={mode === 'catalog' ? (val) => handleFieldChange('class', val) : undefined}
          showClass={mode === 'catalog'}
        />

        {/* ── 1b. Properties (always shown, readOnly in view mode) ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
          <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>Properties</h4>
          <InfoTooltip mode={mode} type="properties" />
        </div>
        <PropsEditor
          props={mode === 'profile' && isEditing ? getDisplayPropsForProfileEditing() : props}
          onChange={mode === 'catalog' ? (updatedProps) => handleFieldChange('props', updatedProps) : handlePropsChange}
          allUsedKeys={allUsedPropKeys}
          readOnly={!isEditing}
          removedPropNames={mode === 'profile' ? (getAlterForControl(control.id)?.removes || []).map(r => r['by-name']).filter(Boolean) : []}
          onRestoreProp={mode === 'profile' ? handleRestoreProp : undefined}
          overriddenPropNames={mode === 'profile' ? getOverriddenPropNames() : []}
          onRevertProp={mode === 'profile' ? handleRevertProp : undefined}
        />
      </div>

      {/* ── 2. Statements / Prose Parts Section ── */}
      <div className="section-container" style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>Statements / Prose Parts</h4>
          <InfoTooltip mode={mode} type="parts" />
        </div>
        {mode === 'catalog' && isEditing ? (
          /* Catalog edit: Full PartsEditor with structure CRUD */
          <PartsEditor
            parts={parts}
            onChange={(updatedParts) => handleFieldChange('parts', updatedParts)}
            params={combinedParams}
            readOnly={false}
            onDefineNewParam={handleDefineNewParam}
          />
        ) : mode === 'profile' && isEditing ? (
          /* Profile edit: ProseWithParams with alter tracking */
          <div>
            {parts.length === 0 ? (
              <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px' }}>No prose statements.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {parts.map((p, i) => renderEditPart(p, originalControl?.parts?.[i], 0, i))}
              </div>
            )}
            <button
              type="button"
              onClick={handleAddProfilePartAtEnd}
              style={{
                marginTop: '12px',
                background: 'transparent',
                border: 'none',
                color: 'var(--color-accent-hover)',
                fontSize: '12px',
                cursor: 'pointer',
                padding: '4px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              ➕ Add Statement
            </button>
          </div>
        ) : (
          /* Read-only view (both modes) */
          <div>
            {parts.length === 0 ? (
              <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px' }}>No prose statements.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <ReadOnlyParts
                  parts={parts}
                  renderProse={renderProseToReact}
                  modifiedPartIds={mode === 'profile' ? getModifiedPartIds() : undefined}
                  onResetPart={mode === 'profile' ? handleResetProse : undefined}
                  isEditing={isEditing}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 3. Parameters (always shown) ── */}
      <div 
        ref={paramSectionRef} 
        className="section-container" 
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
            {mode === 'profile' && isEditing 
              ? (isSubcontrol ? 'Sub-control Parameter Overrides' : 'Control Parameter Overrides') 
              : (isSubcontrol ? 'Sub-control Parameters' : 'Control Parameters')}
          </h4>
          <InfoTooltip mode={mode} type="parameters" />
        </div>
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px', marginTop: '4px' }}>
          {mode === 'catalog' ? (
            <ParameterEditor
              params={params}
              onChange={(updatedParams) => handleFieldChange('params', updatedParams)}
              readOnly={!isEditing}
              fullDocument={catalog}
            />
          ) : (
            <ParameterEditor
              params={setParams}
              catalogParams={originalControl.params || []}
              mode="profile"
              context="local"
              parentId={control.id}
              parentType="control"
              onChange={(updatedSetParams) => {
                const modify = profile.modify ? { ...profile.modify } : {};
                modify['set-parameters'] = updatedSetParams;
                onProfileChange({ ...profile, modify });
              }}
              onChangeAlters={(updateFn) => updateAlter(control.id, updateFn)}
              readOnly={!isEditing}
              fullDocument={profile}
              catalogDocument={catalog}
            />
          )}
        </div>
      </div>

      {/* ── 4. Assessment Methods (always shown, read-only) ── */}
      {extractAssessmentMethods(control).length > 0 && (
        <div 
          className="section-container" 
          style={{ 
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderLeft: '4px solid #14b8a6',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '16px', color: '#14b8a6', fontWeight: 'bold' }}>✓</span>
            <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--color-text)', letterSpacing: '0.3px' }}>Assessment Method</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {extractAssessmentMethods(control).map((m, idx) => (
              <div key={m.id || idx} style={{ borderLeft: '2px solid #14b8a6', paddingLeft: '12px' }}>
                <h5 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-muted)' }}>
                  {formatMethodId(control.id, m.method)}
                </h5>
                <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--color-text)' }}>
                  {renderProseToReact(m.prose || '')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5. Links (always shown, readOnly in view mode) ── */}
      <div className="section-container" style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px' }}>
        <LinksEditor
          links={links}
          onChange={handleLinksChange}
          resources={globalResources}
          readOnly={!isEditing}
        />
      </div>

      {/* ── 6. Enhancements (always shown) ── */}
      <div className="section-container" style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px' }}>
        <EnhancementsAccordion
          enhancements={enhancements}
          isEditing={isEditing}
          onSelectEnhancement={onSelectControl}
          onAddEnhancement={mode === 'catalog' && isEditing ? handleAddEnhancement : undefined}
          onRemoveEnhancement={mode === 'catalog' && isEditing ? handleRemoveEnhancement : undefined}
          showNavArrow={mode === 'catalog'}
          renderEnhancementContent={mode === 'profile' ? renderEnhancementContent : undefined}
        />
      </div>
    </div>
  );
}
