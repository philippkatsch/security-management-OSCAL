import React from 'react';
import styles from './ControlEditor.module.css';
import { ControlHeader } from '../ControlHeader';
import { ControlPartsPanel } from '../control-detail/ControlPartsPanel';
import { ControlParametersPanel } from '../control-detail/ControlParametersPanel';
import { ControlEnhancementsPanel } from '../control-detail/ControlEnhancementsPanel';
import { ADAPTERS } from './adapters';
import { useProfileControlAlters } from './adapters/ProfileAdapter';
import { ControlEditorContext, StageContextType } from './ControlEditorContext';
import { Control, Result, ImplementedRequirement, ProfileAlter } from '@lib/types/oscal';
import { ErrorBoundary } from '@components/shared/ui/ErrorBoundary';
import { ProseWithParams } from '@components/shared/ProseWithParams';

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

const getControlAncestorsPath = (targetControlId: string, catalogData: any) => {
  if (!targetControlId || !catalogData) return [];
  const searchControls = (controls: any[] = [], currentPath: any[]): any[] | null => {
    for (const c of controls) {
      if (c.id === targetControlId) return currentPath;
      if (c.controls) {
        const found = searchControls(c.controls, [...currentPath, { id: c.id, title: c.title || c.id, type: 'control' }]);
        if (found) return found;
      }
    }
    return null;
  };

  const searchGroups = (groups: any[] = [], currentPath: any[]): any[] | null => {
    for (const g of groups) {
      const groupItem = { id: g.id, title: g.title || g.id, type: 'group' };
      if (g.controls) {
        const found = searchControls(g.controls, [...currentPath, groupItem]);
        if (found) return found;
      }
      if (g.groups) {
        const found = searchGroups(g.groups, [...currentPath, groupItem]);
        if (found) return found;
      }
    }
    return null;
  };

  if (catalogData.controls) {
    const found = searchControls(catalogData.controls, []);
    if (found) return found;
  }
  if (catalogData.groups) {
    const found = searchGroups(catalogData.groups, []);
    if (found) return found;
  }
  return [];
};

export function UnifiedControlEditor({
  control,
  stage,
  onChange,
  dispatch,
  isEditing = false,
  catalog,
  profile: propProfile,
  ...stageProps
}: UnifiedControlEditorProps) {
  const StageAdapter = ADAPTERS[stage];
  const {
    onSelectControl,
    onSelectGroup,
    onRestoreControl,
    onWithdrawControl,
    onDeleteControl,
    onAddSubControl,
    allUsedPropKeys
  } = stageProps as any;

  const profile = propProfile || (stageProps as any)?.profile;

  const contextValue = {
    stage,
    control,
    isEditing,
    dispatch
  };

  // Compile all available parameters for prose resolution (R3-04: overlays profile set-parameters)
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

    // Profile mode: overlay profile.modify['set-parameters'] onto allParams
    if (stage === 'profile' && profile?.modify?.['set-parameters']) {
      const setParams = profile.modify['set-parameters'];
      if (Array.isArray(setParams)) {
        setParams.forEach((sp: any) => {
          const spId = sp['param-id'] || sp.id;
          if (!spId) return;
          const existing = list.find((p: any) => (p.id || p['param-id'])?.toLowerCase() === spId.toLowerCase());
          if (existing) {
            if (sp.values !== undefined) existing.values = sp.values;
            if (sp.label !== undefined) existing.label = sp.label;
            if (sp.usage !== undefined) existing.usage = sp.usage;
            if (sp.guidelines !== undefined) existing.guidelines = sp.guidelines;
            if (sp.constraints !== undefined) existing.constraints = sp.constraints;
            if (sp.select !== undefined) existing.select = sp.select;
            if (sp.props !== undefined) existing.props = sp.props;
            if (sp.links !== undefined) existing.links = sp.links;
            if (sp.class !== undefined) existing.class = sp.class;
            existing.isOverridden = true;
          } else {
            list.push({
              id: spId,
              'param-id': spId,
              ...sp,
              scope: 'profile'
            });
          }
        });
      }
    }

    return list;
  }, [control, catalog, stage, profile]);

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

  // Profile stage alterations from ProfileAdapter (DD-030)
  const originalControl = (stageProps as any).originalControl;
  const onProfileChange = (stageProps as any).onProfileChange;

  const profileAlters = useProfileControlAlters({
    profile: stage === 'profile' ? profile : undefined,
    control,
    originalControl,
    onProfileChange,
    allParams
  });

  const resolvedParts = stage === 'profile' ? profileAlters.resolvedParts : (control?.parts || []);
  const renderEditPart = stage === 'profile' ? profileAlters.renderEditPart : undefined;
  const handleAddProfilePartAtEnd = stage === 'profile' ? profileAlters.handleAddProfilePartAtEnd : undefined;
  const profileGetModifiedPartIds = stage === 'profile' ? profileAlters.profileGetModifiedPartIds : undefined;
  const handleResetProse = stage === 'profile' ? profileAlters.handleResetProse : undefined;

  const ancestors = React.useMemo(() => getControlAncestorsPath(control?.id, catalog), [control?.id, catalog]);

  return (
    <ErrorBoundary>
      <ControlEditorContext.Provider value={contextValue}>
        <div className={styles.controlEditor}>
          {ancestors.length > 0 && (
            <div className="breadcrumbs" style={{ flexShrink: 0, fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <span onClick={() => onSelectGroup?.(null)} style={{ cursor: onSelectGroup ? 'pointer' : 'default' }} className="breadcrumb-link">Overview</span>
              {ancestors.map(b => (
                <React.Fragment key={b.id}>
                  <span>/</span>
                  <span 
                    onClick={() => {
                      if (b.type === 'group' && onSelectGroup) onSelectGroup(b.id);
                      else if (b.type === 'control' && onSelectControl) onSelectControl(b.id);
                    }} 
                    style={{ cursor: 'pointer' }}
                    className="breadcrumb-link"
                  >
                    {b.title || b.id}
                  </span>
                </React.Fragment>
              ))}
              <span>/</span>
              <span style={{ color: 'var(--color-text)', fontWeight: '600' }}>{control?.title || control?.id}</span>
            </div>
          )}
          <ControlHeader 
            id={control?.id}
            title={control?.title}
            controlClass={control?.class}
            isEditing={isEditing}
            stage={stage}
            control={control}
            onSelectControl={onSelectControl}
            onRestoreControl={onRestoreControl}
            onWithdrawControl={onWithdrawControl}
            onDeleteControl={onDeleteControl}
            onAddSubControl={onAddSubControl || (stage === 'catalog' && isEditing ? handleAddEnhancement : undefined)}
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
            
            {StageAdapter && (
              <StageAdapter 
                control={control} 
                isEditing={isEditing} 
                onChange={onChange} 
                allUsedPropKeys={allUsedPropKeys}
                catalog={catalog}
                profile={profile}
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
                onWithdrawEnhancement={onWithdrawControl}
                onRestoreEnhancement={onRestoreControl}
              />
            )}
          </div>
        </div>
      </ControlEditorContext.Provider>
    </ErrorBoundary>
  );
}
