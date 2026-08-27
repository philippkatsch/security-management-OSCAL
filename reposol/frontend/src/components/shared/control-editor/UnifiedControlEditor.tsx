import React from 'react';
import styles from './ControlEditor.module.css';
import { ControlHeader } from '../ControlHeader';
import { ControlPartsPanel } from '../control-detail/ControlPartsPanel';
import { ControlParametersPanel } from '../control-detail/ControlParametersPanel';
import { ControlEnhancementsPanel } from '../control-detail/ControlEnhancementsPanel';
import { ADAPTERS } from './adapters';
import { ControlEditorContext, StageContextType } from './ControlEditorContext';
import { Control, Result, ImplementedRequirement, ProfileAlter } from '@lib/types/oscal';
import { ErrorBoundary } from '@components/shared/ui/ErrorBoundary';
import { ProseWithParams } from '@components/shared/ProseWithParams';
import {
  resolveProfilePartsForRendering,
  getModifiedPartIds as getModifiedPartIdsUtil,
  handleOriginalPartFieldChange,
  getAlterForControl,
  updateAlter,
  RenderablePart
} from '@lib/profile-alter-utils';

interface UnifiedControlEditorProps {
  control: Control;
  stage: StageContextType;
  onChange?: (updated: Control) => void;
  dispatch?: any;
  isEditing?: boolean;

  // Stage-specific data
  alterations?: ProfileAlter[];
  implementation?: ImplementedRequirement;
  components?: any[];
  assessmentResults?: Result[];
  
  // Extra props that were used by old panels
  originalControl?: Control;
  catalog?: any;
  profile?: any;
  onProfileChange?: any;
  [key: string]: any;
}

export function UnifiedControlEditor({
  control,
  stage,
  onChange,
  dispatch,
  isEditing = false,
  catalog,
  ...stageProps
}: UnifiedControlEditorProps) {
  const StageAdapter = ADAPTERS[stage];
  const { onSelectControl, onRestoreControl, allUsedPropKeys } = stageProps as any;

  const contextValue = {
    stage,
    control,
    isEditing,
    dispatch
  };

  // Compile all available parameters for prose resolution
  const allParams = React.useMemo(() => {
    const list: any[] = [];
    if (control?.params) {
      control.params.forEach((p: any) => list.push({ ...p, scope: 'control' }));
    }
    if (catalog?.params) {
      catalog.params.forEach((p: any) => list.push({ ...p, scope: 'catalog' }));
    }
    const searchGroups = (groups: any[] = []) => {
      for (const g of groups) {
        if (g.params) g.params.forEach((p: any) => list.push({ ...p, scope: 'group' }));
        if (g.groups) searchGroups(g.groups);
      }
    };
    if (catalog?.groups) searchGroups(catalog.groups);
    return list;
  }, [control, catalog]);

  const renderProseToReact = React.useCallback((proseText: string) => {
    if (!proseText) return null;
    const regex = /\{\{\s*insert:\s*param,\s*([^\s}]+)\s*\}\}/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(proseText)) !== null) {
      const matchIndex = match.index;
      const paramId = match[1];

      if (matchIndex > lastIndex) {
        elements.push(proseText.substring(lastIndex, matchIndex));
      }

      const param = allParams.find((p: any) => (p.id || p['param-id']) === paramId);
      const val = param?.values && param.values.length > 0 ? param.values.join(', ') : null;
      const label = param?.label || paramId;
      const isSet = !!val;

      elements.push(
        <span
          key={`param-insert-${matchIndex}`}
          className="param-chip"
          title={`Parameter: ${paramId}\nStatus: ${isSet ? 'Assigned' : 'Unset'}${param?.guidelines?.[0]?.prose ? `\nGuidance: ${param.guidelines[0].prose}` : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            const el = document.querySelector(`[data-param-id="${paramId}"]`) || document.querySelector(`[data-testid="param-card-${paramId}"]`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '1px 6px',
            margin: '0 2px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            background: isSet ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
            color: isSet ? 'var(--color-success, #22c55e)' : 'var(--color-primary, #3b82f6)',
            border: `1px solid ${isSet ? 'rgba(34, 197, 94, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
            verticalAlign: 'baseline',
            transition: 'all 0.15s ease'
          }}
        >
          {isSet ? val : `[${label}]`}
        </span>
      );

      lastIndex = matchIndex + match[0].length;
    }

    if (lastIndex < proseText.length) {
      elements.push(proseText.substring(lastIndex));
    }

    return elements.length > 0 ? <>{elements}</> : proseText;
  }, [allParams]);

  const handleAddEnhancement = () => {
    const enhancements = control?.controls ? [...control.controls] : [];
    const newNum = enhancements.length + 1;
    const newId = `${control?.id || 'ctrl'}.${newNum}`;
    const newEnhancement: Control = {
      id: newId,
      title: `Enhancement ${newNum}`,
      parts: [
        {
          id: `${newId}_smt`,
          name: 'statement',
          prose: 'Enhancement statement requirement...'
        }
      ]
    };
    onChange?.({
      ...control,
      controls: [...enhancements, newEnhancement]
    });
  };

  const handleRemoveEnhancement = (index: number, ev: React.MouseEvent) => {
    ev.stopPropagation();
    if (!control?.controls) return;
    const updated = control.controls.filter((_, i) => i !== index);
    onChange?.({
      ...control,
      controls: updated.length > 0 ? updated : undefined
    });
  };

  // --- Profile-specific statement editing logic ---
  const profile = (stageProps as any).profile;
  const originalControl = (stageProps as any).originalControl;
  const onProfileChange = (stageProps as any).onProfileChange;
  const controlId = control?.id || '';
  const origControlId = originalControl?.id || (control as any)?.originalId;
  const targetControlId = origControlId || controlId;

  const profileAlter = stage === 'profile' ? (getAlterForControl(profile, controlId) || (origControlId ? getAlterForControl(profile, origControlId) : undefined)) : undefined;

  // Resolve parts with alter overlays for profile mode
  const resolvedParts = React.useMemo(() => {
    if (stage !== 'profile') return control?.parts || [];
    return resolveProfilePartsForRendering(
      originalControl?.parts || control?.parts,
      profileAlter
    );
  }, [stage, control?.parts, originalControl?.parts, profileAlter]);

  // Render a single editable part in profile mode (prose editing via alters)
  const renderEditPart = stage === 'profile' ? (part: RenderablePart, _origPart: any, _depth: number, _index: number) => {
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
          params={allParams}
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
  } : undefined;

  // Add new profile part at end (via alter) — accepts part type name
  const handleAddProfilePartAtEnd = stage === 'profile' && profile && onProfileChange ? (partName: string = 'statement') => {
    const newPartId = `${targetControlId}_${partName}_${Date.now()}`;
    updateAlter(profile, targetControlId, (alter) => {
      const adds = alter.adds ? [...alter.adds] : [];
      adds.push({
        position: 'ending',
        parts: [{ id: newPartId, name: partName, prose: '' }]
      } as any);
      return { ...alter, adds };
    }, onProfileChange);
  } : undefined;

  // Get modified part IDs for highlighting
  const profileGetModifiedPartIds = stage === 'profile' && profile
    ? () => {
        const ids = getModifiedPartIdsUtil(profile, targetControlId);
        if (controlId && controlId !== targetControlId) {
          const overriddenIds = getModifiedPartIdsUtil(profile, controlId);
          return [...new Set([...ids, ...overriddenIds])];
        }
        return ids;
      }
    : undefined;

  // Reset prose to original value
  const handleResetProse = stage === 'profile' && profile && onProfileChange ? (partId: string) => {
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
  } : undefined;

  return (
    <ErrorBoundary>
      <ControlEditorContext.Provider value={contextValue}>
        <div className={styles.controlEditor}>
          <ControlHeader 
            id={control?.id}
            title={control?.title}
            controlClass={control?.class}
            isEditing={isEditing}
            stage={stage}
            control={control}
            onSelectControl={onSelectControl}
            onRestoreControl={onRestoreControl}
            onChange={onChange}
            onTitleChange={(val) => onChange?.({ ...control, title: val })}
            onIdChange={(val) => onChange?.({ ...control, id: val })}
            onClassChange={(val) => onChange?.({ ...control, class: val })}
          />
          <div className={styles.editorContent}>
            <ControlPartsPanel 
              parts={resolvedParts} 
              isEditing={isEditing} 
              mode={stage} 
              controlId={control?.id} 
              combinedParams={allParams}
              renderProseToReact={renderProseToReact}
              handleFieldChange={(field, val) => onChange?.({ ...control, [field]: val })}
              renderEditPart={renderEditPart}
              handleAddProfilePartAtEnd={handleAddProfilePartAtEnd}
              getModifiedPartIds={profileGetModifiedPartIds}
              handleResetProse={handleResetProse}
              originalControl={originalControl}
            />
            <ControlParametersPanel 
              params={control?.params || []} 
              setParams={(stageProps as any).profile?.modify?.['set-parameters'] || []}
              originalControl={(stageProps as any).originalControl}
              profile={(stageProps as any).profile}
              onProfileChange={(stageProps as any).onProfileChange}
              isEditing={isEditing} 
              mode={stage} 
              control={control}
              controlId={control?.id} 
              catalog={catalog}
              handleFieldChange={(field, val) => onChange?.({ ...control, [field]: val })}
            />
            
            {/* Profile stage uses inline Modified/Added badges instead of raw alter blocks */}
            {StageAdapter && stage !== 'profile' && (
              <StageAdapter 
                control={control} 
                isEditing={isEditing} 
                onChange={onChange} 
                allUsedPropKeys={allUsedPropKeys}
                catalog={catalog}
                {...stageProps} 
              />
            )}
            
            {((isEditing && stage === 'catalog') || (control?.controls && control.controls.length > 0)) && (
              <ControlEnhancementsPanel 
                enhancements={control?.controls || []} 
                isEditing={isEditing} 
                mode={stage} 
                controlId={control?.id}
                onSelectControl={onSelectControl}
                handleAddEnhancement={handleAddEnhancement}
                handleRemoveEnhancement={handleRemoveEnhancement}
              />
            )}
          </div>
        </div>
      </ControlEditorContext.Provider>
    </ErrorBoundary>
  );
}
