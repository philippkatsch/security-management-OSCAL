import React, { useState, useEffect, useRef } from 'react';
import styles from './ComponentPage.module.css';
import sharedStyles from '@components/shared/SharedComponents.module.css';
import { PropsEditor } from '@components/shared/PropsEditor';
import { ProseWithParams } from '@components/shared/ProseWithParams';
import ControlImplementationsEditor from './editors/ControlImplementationsEditor';
import ComponentLinksEditor from './editors/ComponentLinksEditor';
import { Capability, DefinedComponent, Resource, Link } from '@lib/types/oscal';

const Accordion = ({
  title,
  children,
  defaultOpen = false,
  isOpen: controlledIsOpen,
  onToggle
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalOpen(!internalOpen);
    }
  };

  return (
    <div className={styles['component-editor__section']}>
      <div
        className={styles['component-editor__section-header']}
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(); } }}
      >
        <h4 className={styles['section-title']}>{title}</h4>
        <span className={`${styles['chevron']} ${isOpen ? styles['open'] : ''}`}>▼</span>
      </div>
      {isOpen && <div className={styles['component-editor__section-content']}>{children}</div>}
    </div>
  );
};

export interface CapabilityEditorProps {
  capability: Capability | any;
  components?: DefinedComponent[] | any[];
  resources?: Resource[];
  onUpdate?: (capability: any) => void;
  onClose?: () => void;
  editMode?: boolean;
}

export default function CapabilityEditor({
  capability,
  components = [],
  resources = [],
  onUpdate = () => {},
  onClose: _onClose,
  editMode = false
}: CapabilityEditorProps) {
  if (!capability) return null;

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basic: true,
    incorporates: (capability?.['incorporates-components']?.length || 0) > 0,
    impls: (capability?.['control-implementations']?.length || 0) > 0,
    props: false
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const capabilityRef = useRef(capability);
  useEffect(() => {
    capabilityRef.current = capability;
  }, [capability]);

  const handleChange = (field: string, value: any) => {
    if (!editMode) return;
    const next = { ...capabilityRef.current, [field]: value };
    capabilityRef.current = next;
    onUpdate(next);
  };

  const addIncorporatedComponent = (componentUuid: string) => {
    if (!editMode || !componentUuid) return;
    const targetComp = (components as any[]).find((c: any) => c.uuid === componentUuid);
    const defaultDescription = targetComp?.description || targetComp?.title || 'Incorporated component';
    const newComps = [
      ...(capability['incorporates-components'] || []),
      {
        'component-uuid': componentUuid,
        description: defaultDescription
      }
    ];
    handleChange('incorporates-components', newComps);
  };

  const updateIncorporatedComponent = (index: number, field: string, value: any) => {
    if (!editMode) return;
    const newComps = [...(capability['incorporates-components'] || [])];
    newComps[index] = { ...newComps[index], [field]: value };
    handleChange('incorporates-components', newComps);
  };

  const removeIncorporatedComponent = (index: number) => {
    if (!editMode) return;
    const newComps = [...(capability['incorporates-components'] || [])];
    newComps.splice(index, 1);
    handleChange('incorporates-components', newComps);
  };

  const getComponentTitle = (uuid: string) => {
    const comp = (components as any[]).find((c: any) => c.uuid === uuid);
    return comp ? comp.title : uuid;
  };

  const incorporatedUuids = (capability['incorporates-components'] || []).map((c: any) => c['component-uuid']);
  const availableComponents = (components as any[]).filter((c: any) => !incorporatedUuids.includes(c.uuid));

  return (
    <div className={`${styles['component-editor']} ${styles['capability-editor']}`}>
      <div className={styles['panel-body']}>

        {/* 1. Basic Info */}
        <Accordion
          title="Basic Info"
          isOpen={openSections.basic}
          onToggle={() => toggleSection('basic')}
        >
          <div className={styles['form-group']}>
            <label className="form-label">Name <span className="required">*</span></label>
            <input
              type="text"
              className="form-input"
              value={capability.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              disabled={!editMode}
              placeholder="e.g. Enterprise Identity & Access Management (IAM)"
            />
          </div>
          <div className={styles['form-group']}>
            <label className="form-label">Description <span className="required">*</span></label>
            {editMode ? (
              <textarea
                className="form-textarea"
                value={capability.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe the architectural capability, how its incorporated components work together, and the composite security solution it provides..."
              />
            ) : (
              <div className={styles['prose-readonly']}>
                <ProseWithParams value={capability.description} />
              </div>
            )}
          </div>
          <div className={styles['form-group']}>
            <label className="form-label">Remarks</label>
            {editMode ? (
              <textarea
                className="form-textarea"
                value={capability.remarks || ''}
                onChange={(e) => handleChange('remarks', e.target.value)}
                placeholder="Optional implementation remarks, caveats, or operational guidance..."
              />
            ) : (
              <div className={styles['prose-readonly']}>
                <ProseWithParams value={capability.remarks} />
              </div>
            )}
          </div>
        </Accordion>

        {/* 2. Incorporated Components */}
        <Accordion
          title={`Incorporated Components (${(capability['incorporates-components'] || []).length})`}
          isOpen={openSections.incorporates}
          onToggle={() => toggleSection('incorporates')}
        >
          <div className={styles['component-linker']}>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'var(--color-text-muted, #7d8590)' }}>
              Group multiple discrete building blocks that jointly fulfill this capability.
            </p>

            {(capability['incorporates-components'] || []).length === 0 ? (
              <p className={styles['empty-state']}>No components linked to this capability yet.</p>
            ) : (
              <ul className={styles['linked-components-list']}>
                {(capability['incorporates-components'] || []).map((inc: any, idx: number) => {
                  const isDangling = !(components as any[]).some((c: any) => c.uuid === inc['component-uuid']);
                  return (
                    <li key={idx} className={styles['linked-component-item']} style={isDangling ? { borderLeft: '3px solid var(--color-danger, #ef4444)' } : undefined}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', marginRight: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ color: isDangling ? 'var(--color-danger, #ef4444)' : 'var(--color-text, #111827)' }}>
                            {getComponentTitle(inc['component-uuid'])}
                          </strong>
                          {isDangling && (
                            <span className="badge badge-danger" style={{ fontSize: '10px', background: '#fee2e2', color: '#b91c1c', padding: '1px 6px', borderRadius: '4px' }}>
                              ⚠️ Dangling Reference
                            </span>
                          )}
                        </div>
                        {isDangling && (
                          <span style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)' }}>
                            Component UUID {inc['component-uuid']} not found in document inventory.
                          </span>
                        )}
                        {editMode ? (
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Description of role in this composite capability (required by OSCAL)"
                            value={inc.description || ''}
                            onChange={(e) => updateIncorporatedComponent(idx, 'description', e.target.value)}
                          />
                        ) : (
                          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted, #6b7280)' }}>
                            {inc.description || 'No description provided.'}
                          </span>
                        )}
                      </div>
                      {editMode && (
                        <button
                          type="button"
                          className={['btn', 'btn-danger', sharedStyles['btn-sm']].filter(Boolean).join(' ')}
                          onClick={() => removeIncorporatedComponent(idx)}
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {editMode && availableComponents.length > 0 && (
              <div className={styles['add-component-row']} style={{ marginTop: '8px' }}>
                <select
                  className="form-input"
                  onChange={(e) => {
                    addIncorporatedComponent(e.target.value);
                    e.target.value = "";
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>+ Add Component to Capability...</option>
                  {availableComponents.map(c => (
                    <option key={c.uuid} value={c.uuid}>{c.title || c.uuid}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </Accordion>

        {/* 3. Control Implementations */}
        <Accordion
          title={`Control Implementations (${(capability['control-implementations'] || []).length})`}
          isOpen={openSections.impls}
          onToggle={() => toggleSection('impls')}
        >
          <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--color-text-muted, #7d8590)' }}>
            Document how this composite capability satisfies security controls across referenced compliance frameworks.
          </p>
          <ControlImplementationsEditor
            controlImplementations={capability['control-implementations'] || []}
            onChange={(impls) => handleChange('control-implementations', impls)}
            editMode={editMode}
          />
        </Accordion>

        {/* 4. Properties & Links */}
        <Accordion
          title="Properties & Links"
          isOpen={openSections.props}
          onToggle={() => toggleSection('props')}
        >
          <div style={{ marginBottom: '16px' }}>
            <h5 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted, #7d8590)', margin: '0 0 8px 0' }}>
              Custom Properties
            </h5>
            <PropsEditor
              props={capability.props || []}
              onChange={(props) => handleChange('props', props)}
              readOnly={!editMode}
            />
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <h5 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted, #7d8590)', margin: '0 0 8px 0' }}>
              Links &amp; Relationships
            </h5>
            <ComponentLinksEditor
              links={capability.links || []}
              components={components}
              resources={resources}
              currentComponentUuid={capability.uuid}
              componentType="capability"
              onChange={(links: Link[]) => handleChange('links', links)}
              editMode={editMode}
            />
          </div>
        </Accordion>

      </div>
    </div>
  );
}
